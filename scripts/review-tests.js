#!/usr/bin/env node
'use strict';

// Send TestExpress recordings out for review.
//
// Recorded tests live in one browser's localStorage, where nobody else can see
// them and nobody can comment on them. This turns an export into Playwright spec
// files on a branch and opens a pull request, which is the part that matters:
// a reviewer comments on line 14 of the spec, the comment is anchored to that
// step, and the thread resolves when you push a fix.
//
// Usage:
//   1. In TestExpress, "Export all" -> testrunner-tests.json
//   2. npm run tests:review -- ~/Downloads/testrunner-tests.json --pr
//
//   --test <name>     only this test (repeatable; case-insensitive substring)
//   --tag <tag>       only tests carrying this tag (repeatable)
//   --out <dir>       where specs go                 (default: tests)
//   --branch <name>   branch to commit on            (default: review/tests-<n>)
//   --base <branch>   PR base                        (default: current branch)
//   --title <text>    PR title
//   --pr              commit, push and open the PR. Without it, nothing outside
//                     <dir> is touched and the git commands are only printed.
//   --dry-run         print what would be written, write nothing
//
// The code comes from src/testrunner/pom.js — the same generator behind the
// in-app "Export spec" button and the recorder's live code view, so what a
// reviewer reads is what the app hands you.
//
// Web recordings only. A native Android recording drives a device rather than
// a page, so it is skipped and named; use "Download Spec" in the app for those.
//
// Written as a Page Object Model: <dir>/pages/*.ts hold the locators, and each
// spec names only methods. The page objects are shared across every test in the
// run rather than regenerated per spec — two recordings that both visit /signup
// contribute to one SignupPage, which is what makes a rotted selector one edit
// for the whole suite.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { ownerLabel, ownerOf, slug, specName, tagsOf } = require('../src/testrunner/spec');
const {
  newRegistry,
  playwrightPageClass,
  pwPageImport,
  toPlaywrightPom,
} = require('../src/testrunner/pom');
// Asked rather than assumed: an export can hold native Android recordings, and
// the same predicate the app replays and exports by is what decides here too.
const { isMobileTest } = require('../src/testrunner/mobileSpec');
const { setFor } = require('../src/testrunner/testdata');

/**
 * A module specifier for `to`, as seen from the directory `from`.
 *
 * path.relative gives "pages" for a sibling, which as an import specifier means
 * the package called "pages" rather than the directory next door — so a leading
 * "./" is added when there is no "../" to make it relative already.
 */
function relative(from, to) {
  const rel = path.posix.relative(from, to) || '.';
  return rel.startsWith('.') ? rel : `./${rel}`;
}

const ROOT = path.join(__dirname, '..');
// The app's own start URL, for a recording saved before startUrl was stored per
// test. Kept in step with START_URL in src/TestRunner.jsx.
const START_URL = '/Customer_home';

const die = (msg) => {
  console.error(`review-tests: ${msg}`);
  process.exit(1);
};

// ---- args -----------------------------------------------------------------
function parseArgs(argv) {
  const opts = { tests: [], tags: [], out: 'tests', pr: false, dryRun: false };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) die(`${a} needs a value`);
      return v;
    };
    if (a === '--test') opts.tests.push(next());
    else if (a === '--tag') opts.tags.push(next().replace(/^@+/, '').toLowerCase());
    else if (a === '--out') opts.out = next();
    else if (a === '--branch') opts.branch = next();
    else if (a === '--base') opts.base = next();
    else if (a === '--title') opts.title = next();
    else if (a === '--pr') opts.pr = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '-h' || a === '--help') opts.help = true;
    else if (a.startsWith('-')) die(`unknown option ${a}`);
    else rest.push(a);
  }
  opts.file = rest[0];
  return opts;
}

// ---- the export -----------------------------------------------------------
// Three shapes are in circulation: {version:3, projects, tests, data},
// {version:2, projects, tests} and the older bare array. importTests in the app
// reads all of them, so this must too — otherwise an export taken before the
// projects tree (or before test data) existed fails here for no good reason.
function readExport(file) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (err) {
    die(`cannot read ${file}: ${err.message}`);
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    die(`${file} is not valid JSON: ${err.message}`);
  }
  const tests = Array.isArray(data) ? data : Array.isArray(data.tests) ? data.tests : null;
  if (!tests) die(`${file} has no tests — expected a TestExpress export ({version, projects, tests})`);
  const projects = (Array.isArray(data.projects) ? data.projects : []).filter((p) => p && p.id);
  // The named values the recordings refer to. Without them a test using
  // {{email}} would generate a spec that fills the literal braces into a form,
  // so the data travels with the tests and is handed to the generator per test
  // (see setFor: a test may pin a set, otherwise the live one applies).
  const testData =
    data && data.data && Array.isArray(data.data.sets) ? data.data : { sets: [], activeId: null };
  return { tests: tests.filter((t) => t && t.name), projects, testData };
}

// suiteId -> "project/suite", the directory a spec lands in. A test whose suite
// was deleted keeps a dangling suiteId, exactly as the app's own tree does, so an
// unresolvable id is "unfiled" rather than an error.
function suiteIndex(projects) {
  const map = new Map();
  projects.forEach((p) =>
    (Array.isArray(p.suites) ? p.suites : []).forEach((s) => {
      if (s && s.id) map.set(s.id, path.posix.join(slug(p.name, 'project'), slug(s.name, 'suite')));
    }),
  );
  return map;
}

function select(tests, opts) {
  let out = tests;
  if (opts.tests.length) {
    const wanted = opts.tests.map((t) => t.toLowerCase());
    out = out.filter((t) => wanted.some((w) => String(t.name).toLowerCase().includes(w)));
  }
  if (opts.tags.length) {
    out = out.filter((t) => tagsOf(t).some((tag) => opts.tags.includes(tag)));
  }
  return out;
}

// ---- review notes ---------------------------------------------------------
// The index a reviewer reads first. It also gives them somewhere to leave a
// comment that is about the set rather than about one line of one spec —
// "these three all assert on the same toast" has no natural home otherwise.
function reviewNotes(picked, dirOf) {
  const row = (t) => {
    const tags = tagsOf(t);
    return [
      `- **${t.name}** — [\`${dirOf(t)}\`](${dirOf(t)})`,
      `  - ${(t.steps || []).length} steps · ${tags.length ? tags.map((x) => `\`@${x}\``).join(' ') : 'no tags'}`,
      `  - ${ownerLabel(ownerOf(t))}`,
      `  - starts at \`${t.startUrl || START_URL}\``,
    ].join('\n');
  };
  return `# Tests for review

${picked.length} recorded test${picked.length === 1 ? '' : 's'} exported from TestExpress.

${picked.map(row).join('\n')}

## How to review

Comment on any line of a spec — each line is one recorded step, so a comment
lands on the step it is about. Things worth a comment:

- **Selectors.** A generated locator may be positional where a \`data-testid\`
  would survive the next redesign. Fallback selectors are in a comment above
  each step; if the first one looks brittle, one of those is usually the fix.
- **Missing assertions.** A recording captures what was *done*, not what should
  be *true*. A test that clicks through a flow without an \`expect\` passes even
  when the flow is broken.
- **Hard waits.** \`waitForTimeout\` came from a recorded pause. Playwright
  auto-waits, so most of them can go.
- **Fixtures.** \`setInputFiles\` points at \`fixtures/<name>\` — that file has to
  exist before the test can run.

Regenerate after changes rather than hand-editing: fix the recording in
TestExpress, export again, and re-run \`npm run tests:review\`.
`;
}

// ---- git ------------------------------------------------------------------
const git = (args, quiet) => {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch (err) {
    if (quiet) return null;
    die(`git ${args.join(' ')} failed: ${(err.stderr || err.message || '').toString().trim()}`);
  }
};

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.file) {
    // The header block, down to the "Web recordings only" note — the paragraphs
    // after it are about how the generator works, which is not what somebody
    // asking for --help wants. Line-numbered, so adding to the header above
    // means moving this bound with it.
    console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(3, 31).join('\n').replace(/^\/\/ ?/gm, ''));
    process.exit(opts.help ? 0 : 1);
  }

  const { tests, projects, testData } = readExport(opts.file);
  const selected = select(tests, opts);
  if (!selected.length) {
    die(
      `no tests matched. ${tests.length} in the export: ` +
        tests.map((t) => t.name).slice(0, 12).join(', ') +
        (tests.length > 12 ? ', …' : ''),
    );
  }

  // Native recordings are not Playwright's to run. A mobile test taps an
  // accessibility tree on a device — it has no page to goto and no CSS to
  // select with — so putting one through the Playwright generator produces a
  // spec that cannot work. Worse than useless, in fact: it would land in <dir>
  // as a *.spec.ts that `npx playwright test` picks up and fails on, so one
  // Android recording in the export would turn the whole suite red and the
  // reviewer would be reading a generated file to find out why.
  //
  // Skipped and named rather than dropped quietly, because the recording is
  // perfectly good — it is this script that has no Appium half yet. Exporting
  // one is the in-app "Download Spec" button, which picks the right generator.
  const native = selected.filter(isMobileTest);
  const picked = selected.filter((t) => !isMobileTest(t));
  if (native.length) {
    console.warn(
      `Skipping ${native.length} native recording${native.length === 1 ? '' : 's'} — ` +
        `Playwright cannot replay a device test:\n` +
        native.map((t) => `  - ${t.name}`).join('\n') +
        `\nUse "Download Spec" in TestExpress for ${native.length === 1 ? 'it' : 'those'}; ` +
        `it writes a WebdriverIO spec instead.\n`,
    );
  }
  // Every match was a mobile one, which is a dead end rather than a no-op: it
  // is almost always `--test` or `--tag` naming a device recording, and writing
  // nothing while exiting 0 looks exactly like the script having worked.
  if (!picked.length) {
    die(
      native.length === 1
        ? `"${native[0].name}" is a native recording, and this script only generates Playwright specs.`
        : `all ${native.length} matching tests are native recordings, and this script only generates Playwright specs.`,
    );
  }

  // Two tests can share a name — the app allows it, and both would otherwise
  // write to the same file with the second silently winning.
  const used = new Map();
  const dirOf = (t) => {
    const dir = suiteIndex(projects).get(t.suiteId) || 'unfiled';
    let file = specName(t.name);
    const key = path.posix.join(dir, file);
    const seen = used.get(key) || 0;
    used.set(key, seen + 1);
    if (seen) file = file.replace(/\.spec\.ts$/, `-${seen + 1}.spec.ts`);
    return path.posix.join(opts.out, dir, file);
  };
  const files = picked.map((t) => ({ test: t, rel: dirOf(t) }));
  // reviewNotes re-asks for each path; hand it the ones already assigned rather
  // than letting the de-duplicating counter run a second time.
  const relOf = new Map(files.map((f) => [f.test, f.rel]));

  // Generated as a Page Object Model: locators on a class per page, specs that
  // name only methods.
  //
  // One shared registry across every test in the run, which is the whole reason
  // this is worth doing here rather than one POM per spec. Two recordings that
  // both visit /signup contribute to a single SignupPage — so a rotted selector
  // is one edit for the suite, and neither spec silently overwrites the other's
  // page object on the way to disk.
  const pagesRel = path.posix.join(opts.out, 'pages');
  const registry = newRegistry();
  const specs = files.map(({ test, rel }) => ({
    test,
    rel,
    // Specs are filed under their suite, page objects are not — so how many
    // levels up "pages" is depends on the spec, and a fixed "./pages" would
    // emit imports that resolve to nothing.
    pom: toPlaywrightPom(test, START_URL, setFor(testData, test), {
      registry,
      pagesDir: relative(path.posix.dirname(rel), pagesRel),
    }),
  }));

  const pageFiles = registry.pages.map((p) => ({
    rel: path.posix.join(pagesRel, p.fileName),
    source: pwPageImport(p) + '\n' + playwrightPageClass(p, null),
  }));

  const notes = path.posix.join(opts.out, 'REVIEW.md');
  const written = [...pageFiles.map((f) => f.rel), ...files.map((f) => f.rel), notes];

  if (opts.dryRun) {
    console.log(`Would write ${written.length} file(s):`);
    written.forEach((f) => console.log(`  ${f}`));
    return;
  }

  pageFiles.forEach(({ rel, source }) => {
    const abs = path.join(ROOT, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, source, 'utf8');
    console.log(`  ${rel}`);
  });
  specs.forEach(({ test, rel, pom }) => {
    const abs = path.join(ROOT, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, pom.spec.source, 'utf8');
    console.log(`  ${rel}  (${(test.steps || []).length} steps)`);
  });
  fs.writeFileSync(path.join(ROOT, notes), reviewNotes(picked, (t) => path.posix.relative(opts.out, relOf.get(t))), 'utf8');
  console.log(`  ${notes}`);

  const branch = opts.branch || `review/tests-${picked.length === 1 ? slug(picked[0].name, 'test') : `${picked.length}-tests`}`;
  const base = opts.base || git(['rev-parse', '--abbrev-ref', 'HEAD']);
  const title = opts.title || (picked.length === 1 ? `Review: ${picked[0].name}` : `Review: ${picked.length} recorded tests`);

  if (!opts.pr) {
    console.log(`\n${written.length} file(s) written. To send them for review:\n`);
    console.log(`  npm run tests:review -- ${JSON.stringify(opts.file)} --pr\n`);
    console.log(`or by hand:\n`);
    console.log(`  git switch -c ${branch}`);
    console.log(`  git add ${opts.out}`);
    console.log(`  git commit -m ${JSON.stringify(title)}`);
    console.log(`  git push -u origin ${branch}`);
    console.log(`  gh pr create --base ${base} --title ${JSON.stringify(title)} --body-file ${notes}`);
    return;
  }

  // Only ever stage <out>. This working tree carries thousands of unrelated
  // modified files (node_modules among them), and a blanket `git add` would put
  // every one of them in a pull request about three test cases.
  console.log(`\nBranch ${branch} (from ${base})`);
  if (git(['rev-parse', '--verify', branch], true)) git(['switch', branch]);
  else git(['switch', '-c', branch]);
  git(['add', '--', opts.out]);
  const staged = git(['diff', '--cached', '--name-only']);
  if (!staged) {
    console.log('Nothing changed — the specs on this branch already match the export.');
    return;
  }
  git(['commit', '-m', title, '-m', `Generated from ${path.basename(opts.file)} by scripts/review-tests.js.`]);
  console.log(git(['push', '-u', 'origin', branch]) || `pushed ${branch}`);

  try {
    const url = execFileSync(
      'gh',
      ['pr', 'create', '--base', base, '--head', branch, '--title', title, '--body-file', notes],
      { cwd: ROOT, encoding: 'utf8' },
    ).trim();
    console.log(`\nOpen for review: ${url}`);
  } catch (err) {
    const msg = (err.stderr || err.message || '').toString().trim();
    // An existing PR is the normal case on a second push, not a failure.
    if (/already exists/i.test(msg)) {
      console.log(`\n${msg}`);
      console.log(git(['rev-parse', '--abbrev-ref', 'HEAD']) && 'Pushed to the existing pull request.');
    } else {
      console.error(`\ngh pr create failed: ${msg}`);
      console.error(`The branch is pushed — open the PR by hand if gh is not set up.`);
      process.exit(1);
    }
  }
}

main();
