// Playwright export for TestExpress recordings — the single home for turning a
// recorded test into a spec file.
//
// This lives outside TestRunner.jsx because two callers need it and they cannot
// share a browser: the in-app "Export spec" button, and scripts/review-tests.js,
// which converts an exported workspace into reviewable spec files from Node. A
// second copy of the step-to-Playwright mapping would drift from the recorder
// the first time a new step action was added, and the drift would only surface
// as a spec that silently omits a step.
//
// Deliberately CommonJS and free of any React or DOM reference: `require`d by
// the Node CLI, and imported by name from the app (webpack 5 interops).

const {
  DYNAMIC,
  stepTexts,
  isDynamic,
  iterationsOf,
  normKey,
  refScanner,
  refsIn,
  rowKeys,
  rowValues,
  rowsOf,
  soleRef,
  varMap,
  varsOf,
} = require('./testdata');

// The REST step's model. Only the parts this file needs to write code from —
// the operators, the evaluation and the transports stay over there.
const {
  describeApi,
  isSecretHeader,
  normalize: normalizeApi,
  parseHeaders,
} = require('./apiStep');

// ---- owner ----------------------------------------------------------------
// Validated on the way out, not trusted on the way in. `Import` takes a
// hand-editable JSON file, so `owner` can arrive as {}, as a bare string, or as
// null — and every reader downstream goes straight to `.name`. One bad object
// would otherwise throw inside the tree renderer and take the whole rail with
// it, which is a spectacular way to lose access to your tests over a decoration.
const ownerOf = (test) => {
  const owner = test && test.owner;
  if (!owner) return null;
  if (typeof owner === 'string') return { name: owner, email: null };
  const name = typeof owner.name === 'string' ? owner.name.trim() : '';
  const email = typeof owner.email === 'string' ? owner.email.trim() : '';
  if (!name && !email) return null;
  return { name: name || email, email: email || null };
};
const ownerLabel = (owner) =>
  owner ? `${owner.name}${owner.email ? ` — ${owner.email}` : ''}` : 'No owner recorded';

// ---- tags ----------------------------------------------------------------
// A test case carries a flat list of tags — @smoke, @regression — the same
// labels Playwright understands, so a recording exported as a spec can be
// selected with `--grep @smoke` without anyone re-tagging it there.
//
// Stored WITHOUT the leading "@" and case-folded. The "@" is punctuation that
// marks a tag when you write one, not part of its name, and a list holding
// both "@Smoke" and "@smoke" is a list where you have to remember which way
// you typed it before you can filter by it.
const normTag = (raw) =>
  String(raw)
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '');

// Whitespace or commas separate tags, so "@smoke @regression" and
// "smoke, regression" both parse — pasted from a ticket either way.
const parseTags = (text) => {
  const out = [];
  String(text || '')
    .split(/[\s,]+/)
    .forEach((piece) => {
      const tag = normTag(piece);
      if (tag && !out.includes(tag)) out.push(tag);
    });
  return out;
};

// How a tag is written wherever it is shown or exported.
const tagLabel = (tag) => `@${tag}`;
const tagsOf = (test) => (Array.isArray(test && test.tags) ? test.tags : []);

// ---- Playwright export ---------------------------------------------------
// The in-browser runner is limited to this origin by the same-origin policy.
// Real Playwright has no such limit, and every recorded step has a direct
// equivalent in its API — so a recording can be lifted out and run anywhere.
const q = (v) => JSON.stringify(String(v ?? ''));

// Where a recording starts when it carries no start URL of its own. The app
// passes its own START_URL; a spec generated from a hand-edited export should
// still land somewhere runnable rather than at "undefined".
const DEFAULT_START_URL = '/';

const slug = (name, fallback) =>
  String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || fallback;

const specName = (name) => `${slug(name, 'test')}.spec.ts`;

// ---- test data in a generated spec ---------------------------------------
// A step referring to {{email}} must not export as the literal string
// "{{email}}" — that would fill a form with braces. It becomes a reference to a
// DATA object emitted at the top of the spec, and a dynamic token becomes the
// expression that generates it, so a spec keeps the property that made the
// recording re-runnable rather than freezing one run's values into source.

// The environment variable that overrides a value, so a generated spec can be
// pointed at another environment without editing it.
const envName = (key) => `TD_${normKey(key).toUpperCase()}`;

// Escaping for the literal parts of a template literal — a backtick or a `${`
// arriving from recorded text would otherwise end the string or open an
// interpolation.
const tpl = (s) =>
  String(s == null ? '' : s)
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');

const refExpr = (key) => (isDynamic(key) ? DYNAMIC[key].js : `DATA.${normKey(key)}`);

// A recorded string as a JavaScript expression: a plain quoted literal when it
// holds no references, a bare lookup when it is exactly one, and a template
// literal when it mixes the two.
function expr(text) {
  const str = String(text == null ? '' : text);
  const only = soleRef(str);
  if (only) return refExpr(only);
  if (!refsIn(str).length) return q(str);
  // Alternating literal / key, because the pattern's capture group is included
  // in a split's output.
  const parts = str.split(refScanner());
  let out = '';
  parts.forEach((piece, i) => {
    out += i % 2 ? `\${${refExpr(piece.trim())}}` : tpl(piece);
  });
  return `\`${out}\``;
}

// Which dynamic tokens a test actually uses. Only the helpers a spec needs get
// emitted — an unused `uid()` in every generated file is noise, and a lint rule
// in the repo it lands in will flag it.
function dynamicUsed(steps) {
  const used = [];
  (steps || []).forEach((st) => {
    stepTexts(st).forEach((text) => {
      refsIn(text).forEach((key) => {
        if (isDynamic(key) && !used.includes(key)) used.push(key);
      });
    });
  });
  return used;
}

// Which non-dynamic keys a recording refers to, in the order they first appear.
// Shared by the DATA block and by the decision below about whether this spec
// iterates at all, which must be answered from exactly the same list — a spec
// that emitted ROWS for a column no step mentions would loop without varying
// anything.
function wantedKeys(steps) {
  const wanted = [];
  (steps || []).forEach((st) => {
    stepTexts(st).forEach((text) => {
      refsIn(text).forEach((raw) => {
        if (isDynamic(raw)) return;
        const key = normKey(raw);
        if (key && !wanted.includes(key)) wanted.push(key);
      });
    });
  });
  return wanted;
}

// Does this recording run more than once against this set?
//
// Both halves are required. A set with rows exports as an ordinary single test
// when the recording never mentions a column — looping four times over a spec
// that does the identical thing each time is four times the runtime for one
// result. And a recording full of {{refs}} exports as a single test when the
// set has no rows, which is what keeps every spec generated before rows existed
// byte-for-byte what it was.
function iteratesOver(steps, set) {
  if (!rowsOf(set).length) return false;
  const wanted = wantedKeys(steps);
  return rowKeys(set).some((key) => wanted.includes(key));
}

// Indent a block that is being nested inside a `for`. Blank lines are left
// blank rather than filled with trailing spaces, which is what most linters in
// the repo a spec lands in would flag first.
const indent = (text, pad) =>
  String(text)
    .split('\n')
    .map((line) => (line ? pad + line : line))
    .join('\n');

// The loop a data-driven spec's test sits inside. `DATA` is deliberately the
// name it always had: every step expression already reads `DATA.email`, so
// shadowing the shared object per iteration means the whole step-to-Playwright
// mapping is untouched by the existence of rows.
const ITER_OPEN =
  '// One run per row of the data set. Each is a separate test, so a report\n' +
  '// names the row that failed rather than just the test.\n' +
  'for (const ROW of ROWS) {\n' +
  '  const DATA = { ...BASE, ...ROW.values };\n\n';

const ITER_CLOSE = '}\n';

// The test title for one iteration — the recording's name with the row's label
// after it, which is what makes a Playwright report readable when twelve
// entries would otherwise share one name.
//
// The ${…} is source code being emitted, not a template meant to interpolate
// here — the same reason the DYNAMIC table further up disables this rule.
// eslint-disable-next-line no-template-curly-in-string
const iterTitle = (title) => '`' + tpl(title) + ' — ${ROW.label}`';

// The DATA block. Built from the keys this test actually refers to rather than
// the whole workspace's data — a spec should carry its own inputs and nothing
// else, which also keeps unrelated credentials out of a file heading for a repo.
//
// A secret is emitted as an environment read with no default. Writing it into
// the file would put a password in version control, and the recording it came
// from is not worth that.
//
// When the set is a table this emits two objects instead of one: BASE for the
// values shared by every row, ROWS for the columns that vary. The split is not
// cosmetic — it is what stops a twelve-row spec repeating the base URL twelve
// times, and it is the same split the app runs under, so a spec and the
// in-browser run resolve identically.
//
// `runner` is the command the emitted comments tell the reader to use. It is a
// parameter because the same block is embedded in both a Playwright spec and an
// Appium one, and a mobile spec telling you to run `npx playwright test` is an
// instruction that does not work.
function dataBlock(steps, set, runner = 'npx playwright test') {
  const vars = varMap(set);
  const secret = {};
  varsOf(set).forEach((v) => {
    if (v && v.secret) secret[normKey(v.key)] = true;
  });

  // Names an API step writes into DATA at runtime. They are deliberately taken
  // out of `wanted`: a later step referring to {{token}} makes it a referenced
  // key, and left alone it would be emitted into BASE under the "no value for
  // this key — fill it in here" comment, telling the reader to hardcode a value
  // that the sign-in step is about to produce. What it needs is not a value but
  // somewhere to land, which is what the DATA object below gives it.
  const produced = extractedNames(steps);
  const wanted = wantedKeys(steps).filter((key) => !produced.includes(key));

  const helpers = dynamicUsed(steps).length
    ? '// Fresh on every run, so this spec can be run more than once.\n' +
      'const uid = () =>\n' +
      "  Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);\n\n"
    : '';

  // Nothing is read from the data set, but an API step still has to have
  // somewhere to put what it extracts. `let` rather than `const` is not needed —
  // only its properties are ever written — but it must exist before the first
  // assignment, which is why this is not simply an early return.
  if (!wanted.length) {
    return produced.length
      ? helpers +
          '// Values the API steps below extract from their responses. Empty at\n' +
          '// the start of every run and filled in as each call returns.\n' +
          'const DATA = {};\n\n'
      : helpers;
  }

  const iterating = iteratesOver(steps, set);
  // A secret never becomes a column, however it is marked. Its whole point is
  // that it is not written into this file, and a per-row value has nowhere to
  // come from but this file — so it stays in BASE as an environment read and
  // the rows leave it alone.
  const perRow = iterating ? rowKeys(set).filter((key) => wanted.includes(key) && !secret[key]) : [];
  const shared = wanted.filter((key) => !perRow.includes(key));

  const rows = shared.map((key) => {
    const env = `process.env.${envName(key)}`;
    if (secret[key]) {
      return (
        `  // Secret — deliberately not written into this file.\n` +
        `  //   ${envName(key)}=… ${runner}\n` +
        `  ${key}: ${env} ?? '',\n`
      );
    }
    if (!Object.prototype.hasOwnProperty.call(vars, key)) {
      return (
        `  // No value for this key in the data set it was recorded against —\n` +
        `  // fill it in here or pass ${envName(key)}.\n` +
        `  ${key}: ${env} ?? '',\n`
      );
    }
    return `  ${key}: ${env} ?? ${q(vars[key])},\n`;
  });

  const named = set && set.name ? ` "${set.name}"` : '';

  if (!iterating) {
    return (
      helpers +
      `// Test data${named}, as recorded. Override any value from the environment:\n` +
      `//   ${envName(wanted[0])}=… ${runner}\n` +
      `const DATA = {\n${rows.join('')}};\n\n`
    );
  }

  // One entry per enabled row. A disabled row is left out entirely rather than
  // emitted commented-out: the app already treats it as not part of the suite,
  // and a spec that disagreed would run a case nobody asked for.
  const table = iterationsOf(set).map((iter) => {
    const values = rowValues(iter.row);
    const cells = perRow
      .map((key) => `${key}: ${q(Object.prototype.hasOwnProperty.call(values, key) ? values[key] : '')}`)
      .join(', ');
    return `  { label: ${q(iter.label)}, values: { ${cells} } },\n`;
  });

  // Every key a recording uses may be a column, in which case there is nothing
  // shared left to describe — but BASE still has to exist, because the merge
  // inside the loop spreads it.
  const base = shared.length
    ? `// Test data${named}. Shared by every row — override from the environment:\n` +
      `//   ${envName(shared[0])}=… ${runner}\n` +
      `const BASE = {\n${rows.join('')}};\n\n`
    : `// Test data${named}. Every value this recording uses varies by row.\n` +
      `const BASE = {};\n\n`;
  return (
    helpers +
    base +
    `// The rows this recording was written against, one test each.\n` +
    `const ROWS = [\n${table.join('')}];\n\n`
  );
}

/**
 * The DATA keys the API steps in a recording produce at runtime.
 *
 * Separate from wantedKeys, which answers the opposite question — what a
 * recording consumes. A key can be both: sign in, extract `token`, then send it
 * as a header on every later call.
 *
 * @param {Array<object>} steps the recording's steps
 * @returns {Array<string>} normalised key names, in first-seen order
 */
function extractedNames(steps) {
  const out = [];
  (steps || []).forEach((st) => {
    if (!st || st.action !== 'api' || !Array.isArray(st.extract)) return;
    st.extract.forEach((rule) => {
      const name = normKey(rule && rule.name);
      if (name && !out.includes(name)) out.push(name);
    });
  });
  return out;
}

// ---- REST steps -----------------------------------------------------------
// The model, the operators and the runtime evaluation all live in ./apiStep.js.
// What is here is only the translation of that model into Playwright source,
// which is this module's job and cannot be shared with the engines — they
// execute the step, this writes the code that will.

/**
 * A JSON path as a JavaScript accessor, optional-chained at every hop.
 *
 * `data.items[0].id` becomes `json?.data?.items?.[0]?.id`. The chaining is not
 * decoration: a generated assertion that threw a TypeError on a missing field
 * would fail the test with "cannot read property of undefined" pointing at the
 * spec, when the thing worth reporting is that the response lacked the field.
 * Optional chaining turns that into a clean `expected X, received undefined`.
 *
 * @param {string} path dotted/bracketed path, as ./apiStep.js getPath reads it
 * @returns {string} a JavaScript expression over the local `json`
 */
function jsonAccess(path) {
  const raw = String(path == null ? '' : path).trim();
  if (!raw) return 'json';
  return raw
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter((p) => p !== '')
    .reduce((acc, part) => (/^\d+$/.test(part) ? `${acc}?.[${part}]` : `${acc}?.${part}`), 'json');
}

// One assertion -> one expect(). The operator list is ./apiStep.js's; this maps
// each to the closest Playwright matcher, and where none fits exactly it
// asserts the same boolean that module's applyOp would compute. Keeping the
// semantics identical is the whole point: a check that passed in the recorder
// and failed in CI over a matcher nuance would destroy trust in the export.
function assertToExpect(a, val) {
  const expected = val(a.expected);
  // Numbers stay numbers; everything else is compared as text, matching the
  // loose equality ./apiStep.js documents.
  switch (a.type) {
    case 'status':
      if (a.op === 'eq') return `    expect(res.status()).toBe(${Number(a.expected) || 0});\n`;
      if (a.op === 'ne') return `    expect(res.status()).not.toBe(${Number(a.expected) || 0});\n`;
      if (a.op === 'lt') return `    expect(res.status()).toBeLessThan(${Number(a.expected) || 0});\n`;
      if (a.op === 'gt') return `    expect(res.status()).toBeGreaterThan(${Number(a.expected) || 0});\n`;
      return `    // unsupported status assertion: ${a.op}\n`;
    case 'responseTime':
      // "is greater than" was falling through to toBeLessThan regardless of
      // a.op — the exact "passes in the recorder, wrong in CI" bug the header
      // comment on apiToPlaywright warns about, just for the op this switch
      // forgot to read.
      if (a.op === 'gt') return `    expect(ms).toBeGreaterThan(${Number(a.expected) || 0});\n`;
      return `    expect(ms).toBeLessThan(${Number(a.expected) || 0});\n`;
    case 'bodyContains':
      if (a.op === 'contains') return `    expect(body).toContain(${expected});\n`;
      if (a.op === 'matches') return `    expect(body).toMatch(new RegExp(${expected}));\n`;
      if (a.op === 'empty') return `    expect(body).toBe('');\n`;
      return `    expect(body).toBe(${expected});\n`;
    case 'header': {
      // Playwright lowercases the names it hands back, so the lookup is folded
      // here rather than trusting whatever case the header was recorded in.
      const acc = `res.headers()[${q(String(a.path || '').toLowerCase())}]`;
      if (a.op === 'exists') return `    expect(${acc}).toBeTruthy();\n`;
      if (a.op === 'contains') return `    expect(String(${acc} ?? '')).toContain(${expected});\n`;
      if (a.op === 'matches') return `    expect(String(${acc} ?? '')).toMatch(new RegExp(${expected}));\n`;
      if (a.op === 'ne') return `    expect(String(${acc} ?? '')).not.toBe(String(${expected}));\n`;
      return `    expect(String(${acc} ?? '')).toBe(String(${expected}));\n`;
    }
    case 'jsonPath': {
      const acc = jsonAccess(a.path);
      if (a.op === 'exists') return `    expect(${acc} ?? null).not.toBeNull();\n`;
      if (a.op === 'empty')
        return `    expect(${acc} == null || String(${acc}) === '').toBeTruthy();\n`;
      if (a.op === 'contains') return `    expect(String(${acc} ?? '')).toContain(${expected});\n`;
      if (a.op === 'matches')
        return `    expect(String(${acc} ?? '')).toMatch(new RegExp(${expected}));\n`;
      if (a.op === 'ne') return `    expect(String(${acc} ?? '')).not.toBe(String(${expected}));\n`;
      if (a.op === 'lt') return `    expect(Number(${acc})).toBeLessThan(Number(${expected}));\n`;
      if (a.op === 'gt') return `    expect(Number(${acc})).toBeGreaterThan(Number(${expected}));\n`;
      return `    expect(String(${acc} ?? '')).toBe(String(${expected}));\n`;
    }
    default:
      return `    // unsupported assertion type: ${a.type}\n`;
  }
}

/**
 * A recorded REST step as a block of Playwright.
 *
 * Three decisions worth stating, because none is the obvious first choice:
 *
 * `page.request` rather than the standalone `request` fixture. It shares the
 * browser context's cookie jar, so an API call made after a UI sign-in is
 * already authenticated, and a session established by an API call is visible to
 * the UI steps that follow. A recording that mixes the two — the common case,
 * and the reason this feature exists — would otherwise need the token moved
 * between two separate jars by hand.
 *
 * A braced block per step. `res`, `body` and `json` are wanted by name in every
 * step, and a counter (res1, res2…) would have to be threaded through this
 * function's signature and every caller, including the page object emitter.
 * Scoping them instead costs two braces and keeps the step mapping a pure
 * function of one step, which is what lets ./pom.js reuse it untouched.
 *
 * Extractions assign into `DATA`, the object every other generated expression
 * already reads. A second namespace for response-derived values would mean
 * `{{token}}` resolving differently depending on where the value came from —
 * which is precisely the distinction the recording author does not want to make.
 *
 * @param {object} st the API step
 * @param {function} val how a recorded value becomes an expression
 * @returns {string} Playwright source
 */
function apiToPlaywright(st, val) {
  const step = normalizeApi(st);
  const asserts = step.asserts;
  const extract = step.extract;
  const headers = parseHeaders(step.headersText);
  // Only what is used: an unused `body` or `json` in every generated file is
  // noise, and a no-unused-vars rule in the repo it lands in would flag it.
  const needsBody =
    asserts.some((a) => a.type === 'bodyContains') || extract.some((e) => e.from === 'body');
  const needsJson =
    asserts.some((a) => a.type === 'jsonPath') ||
    extract.some((e) => !e.from || e.from === 'json');
  const needsTime = asserts.some((a) => a.type === 'responseTime');

  const opts = [`      method: ${q(step.method)},\n`];
  if (headers.length) {
    // ApiStepEditor promises a credential header "is never … written into an
    // exported spec as a literal" — true only for one typed as a {{ref}}. A
    // secret typed straight into the box has no ref for `val` to resolve, so
    // without this check it would still get baked into this file verbatim,
    // which is the one place that promise most needs to hold: this file is
    // what "Export spec" hands you to commit.
    const pairs = headers
      .map((h) => {
        if (isSecretHeader(h.key) && !refsIn(h.value).length && h.value) {
          return (
            `        // "${h.key}" was recorded as a literal value, not a {{reference}} —\n` +
            `        // a credential is never written into this file. Move the real value\n` +
            `        // into a secret test-data entry and refer to it here as {{name}}.\n` +
            `        ${q(h.key)}: ${q('REDACTED — see comment above')},\n`
          );
        }
        return `        ${q(h.key)}: ${val(h.value)},\n`;
      })
      .join('');
    opts.push(`      headers: {\n${pairs}      },\n`);
  }
  // The body goes out as the exact text that was recorded rather than as a
  // parsed object. Playwright would re-serialise an object, and a request whose
  // bytes differ from the ones the recording captured is not the request that
  // was tested — key order, whitespace and a deliberately malformed payload all
  // matter to somebody.
  if (step.body) opts.push(`      data: ${val(step.body)},\n`);

  let out = `  // ${describeApi(step)}\n  {\n`;
  out += `    const url = ${val(step.url)};\n`;
  if (needsTime) out += `    const t0 = Date.now();\n`;
  out +=
    `    const res = await page.request.fetch(/^https?:\\/\\//i.test(url) ? url : BASE_URL + url, {\n` +
    opts.join('') +
    `    });\n`;
  if (needsTime) out += `    const ms = Date.now() - t0;\n`;
  if (needsBody || needsJson) out += `    const body = await res.text();\n`;
  if (needsJson) {
    // Parsed from the text rather than via res.json(), and tolerant of failure,
    // for the same reason ./apiStep.js summarize is: a server that answers JSON
    // under the wrong content type is common, and res.json() throwing would
    // fail the test with a parse error instead of the assertion that was meant
    // to report the problem.
    out +=
      `    let json;\n` +
      `    try { json = JSON.parse(body); } catch { json = undefined; }\n`;
  }
  out += asserts.map((a) => assertToExpect(a, val)).join('');
  extract.forEach((e) => {
    const name = normKey(e.name);
    if (!name) return;
    let src;
    if (e.from === 'status') src = 'res.status()';
    else if (e.from === 'header') src = `res.headers()[${q(String(e.path || '').toLowerCase())}]`;
    else if (e.from === 'body') src = 'body';
    else src = jsonAccess(e.path);
    out += `    DATA.${name} = String(${src} ?? '');\n`;
  });
  out += `  }\n`;
  return out;
}

/**
 * One recorded step -> one or more lines of Playwright.
 *
 * @param {object} st       the recorded step
 * @param {string} [locExpr] the expression naming the element, when the caller
 *   has somewhere better to get it from than a raw selector. The page object
 *   emitter passes `this.emailInput`, which is what lets a page object and a
 *   flat spec share this one mapping instead of keeping two that drift.
 * @param {function} [valueFn] how a recorded value becomes an expression.
 *   Defaults to resolving {{refs}} against DATA; a page object passes the name
 *   of the method parameter instead, so the value arrives from the caller.
 */
function stepToPlaywright(st, locExpr, valueFn) {
  const sel = (st.selectors && st.selectors[0]) || st.selector;
  const loc = locExpr || `page.locator(${q(sel)})`;
  const val = valueFn || expr;
  // Remaining candidates are worth keeping as a comment: if the first selector
  // rots, the next one is usually the fix.
  const alts = (st.selectors || []).slice(1);
  const note = alts.length ? `    // fallbacks: ${alts.join('  |  ')}\n` : '';

  switch (st.action) {
    // Before the element-based cases and outside the `loc` they share: a REST
    // step has no locator, and reading st.selectors for one would be meaningless.
    case 'api':
      return apiToPlaywright(st, val);
    case 'navigate':
      return `  await page.goto(BASE_URL + ${expr(st.url)});\n`;
    case 'click':
      return `${note}  await ${loc}.click();\n`;
    case 'fill':
      return `${note}  await ${loc}.fill(${val(st.value)});\n`;
    case 'select':
      return `${note}  await ${loc}.selectOption(${val(st.value)});\n`;
    case 'check':
      return `${note}  await ${loc}.setChecked(${st.value ? 'true' : 'false'});\n`;
    case 'upload':
      return (
        `${note}  // Recorded upload: ${st.name || 'file'}. Point this at a real fixture —\n` +
        `  // the browser never exposes the original path.\n` +
        `  await ${loc}.setInputFiles(${q(`fixtures/${st.name || 'upload.bin'}`)});\n`
      );
    case 'wait':
      return `  await page.waitForTimeout(${Number(st.ms) || 0});\n`;
    case 'implicitWait':
      return `  page.setDefaultTimeout(${Number(st.ms) || 5000});\n`;
    case 'scroll':
      return `  await page.mouse.wheel(0, ${(Number(st.amount) || 500) * (st.direction === 'up' ? -1 : 1)});\n`;
    case 'reload':
      return `  await page.reload();\n`;
    case 'hover':
      return `${note}  await ${loc}.hover();\n`;
    case 'assert':
      if (st.assertType === 'exists') return `${note}  await expect(${loc}).toBeVisible();\n`;
      if (st.assertType === 'value')
        return `${note}  await expect(${loc}).toHaveValue(${val(st.expected)});\n`;
      return `${note}  await expect(${loc}).toContainText(${val(st.expected)});\n`;
    default:
      return `  // unsupported step: ${st.action}\n`;
  }
}

// `set` is the test data set the recording refers to — see ./testdata. Optional
// and last, so the two existing callers keep working: a test with no {{refs}}
// exports byte-identically with or without it.
function toPlaywrightSpec(test, startUrl, set) {
  const start = test.startUrl || startUrl || DEFAULT_START_URL;
  const steps = test.steps || [];
  const body = steps.map((st) => stepToPlaywright(st)).join('');
  const data = dataBlock(steps, set);
  const tags = tagsOf(test);
  // Tags go in the title rather than the `tag` option: the option only exists
  // from Playwright 1.42, whereas `--grep @smoke` has matched against the
  // title for as long as there has been a grep, so this runs on any version.
  const title = tags.length ? `${test.name} ${tags.map(tagLabel).join(' ')}` : test.name;
  const grepHint = tags.length ? `//   npx playwright test --grep ${tagLabel(tags[0])}\n` : '';
  // Whose recording this was. A spec that lands in a repo outlives the browser
  // it was recorded in, and the first question anyone asks of a failing
  // generated test is who to ask about it.
  const owner = ownerOf(test);
  const ownerLine = owner ? `// Owner: ${ownerLabel(owner)}\n` : '';
  // A data-driven recording emits its test inside a loop over ROWS. The block
  // is built once and indented into the loop rather than written twice: two
  // copies of the same emitter is how a step type ends up supported in the
  // single-run spec and silently missing from the data-driven one.
  const iterating = iteratesOver(steps, set);
  const block =
    `test(${iterating ? iterTitle(title) : q(title)}, async ({ page }) => {\n` +
    `  await page.goto(BASE_URL + ${q(start)});\n` +
    body +
    `});\n`;
  const runBlock = iterating ? ITER_OPEN + indent(block, '  ') + ITER_CLOSE : block;
  return `import { test, expect } from '@playwright/test';

// Generated from the in-browser recording "${test.name}".
${ownerLine}// Point it at any site by setting BASE_URL — real Playwright is not bound by
// the same-origin policy the in-browser runner is.
//   BASE_URL=https://staging.example.com npx playwright test
// Run it in another engine the same way the runner does — these are the three
// Playwright drives, and a spec is engine-agnostic:
//   npx playwright test --project=firefox      (or chromium, webkit)
${grepHint}const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

${data}${runBlock}`;
}

module.exports = {
  DEFAULT_START_URL,
  ITER_CLOSE,
  ITER_OPEN,
  dataBlock,
  envName,
  expr,
  indent,
  iterTitle,
  iteratesOver,
  // Exported for ./mobileSpec, which emits a different runner from the same
  // recordings and must quote, name and describe them identically.
  q,
  normTag,
  ownerLabel,
  ownerOf,
  parseTags,
  slug,
  specName,
  stepToPlaywright,
  tagLabel,
  tagsOf,
  toPlaywrightSpec,
};
