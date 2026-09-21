// Page Object Model generation for TestExpress recordings.
//
// A recording is a flat list of steps against raw selectors. Exported flat, one
// spec holds every locator it touches, and the same button recorded in six tests
// is six copies of the same selector — so when it rots, the fix is six edits
// that have to be found first. This module turns the same recording into the
// shape that problem has a standard answer for: a class per page holding the
// locators and the actions, and a spec that only names methods.
//
// Nothing here decides *what* a step does. The step-to-code mapping stays in
// ./spec.js and ./mobileSpec.js, which this module calls with a locator
// expression of its own — that is the whole reason those two grew a `locExpr`
// parameter. A second copy of the mapping here would drift the first time a step
// type was added, and the drift would surface as a page object silently missing
// a method the flat export still emitted.
//
// Deliberately CommonJS and free of any React or DOM reference, for the same
// reason its two neighbours are: the Node CLI requires it and the app imports it.
//
// Same no-object-spread rule as ./spec.js and ./testdata.js — `{ ...x }` pulls in
// a Babel helper imported as ESM, which reclassifies the whole file and makes
// `module.exports` export nothing at all. Object.assign throughout.

const {
  ITER_CLOSE,
  ITER_OPEN,
  dataBlock,
  expr,
  indent,
  iterTitle,
  iteratesOver,
  ownerLabel,
  ownerOf,
  q,
  slug,
  stepToPlaywright,
  tagLabel,
  tagsOf,
} = require('./spec');
const { stepToAppium } = require('./mobileSpec');

// ---- identifiers ---------------------------------------------------------
// Everything named here ends up as a class name, a member or a method in a file
// that has to compile, so a name is folded to something legal before it is
// unique-ified rather than after — otherwise two labels differing only in
// punctuation ("E-mail" and "E mail") collide after folding, and the collision
// is invisible in the list of names that were checked.

// Words that cannot be a member or a local without breaking the file. `page`
// and `driver` are not reserved by the language but are taken by the generated
// classes, and a locator called `this.page` would overwrite the one every method
// goes through.
const TAKEN = [
  'break', 'case', 'catch', 'class', 'const', 'constructor', 'continue', 'debugger',
  'default', 'delete', 'do', 'else', 'enum', 'export', 'extends', 'false', 'finally',
  'for', 'function', 'if', 'implements', 'import', 'in', 'instanceof', 'interface',
  'let', 'new', 'null', 'package', 'private', 'protected', 'public', 'return',
  'static', 'super', 'switch', 'this', 'throw', 'true', 'try', 'typeof', 'var',
  'void', 'while', 'with', 'yield', 'page', 'driver', 'path', 'goto', 'expect',
];

// Split on anything that is not a letter or digit, and on camelCase humps, so
// "data-testid", "First Name" and "firstName" all arrive as the same word list.
function words(text) {
  return String(text == null ? '' : text)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .slice(0, 6); // a whole sentence of a label makes an unreadable method name
}

const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();

/** "First name" -> "FirstName". Falls back rather than returning an empty name. */
function pascal(text, fallback) {
  const out = words(text).map(cap).join('');
  if (!out) return fallback;
  return /^[0-9]/.test(out) ? `X${out}` : out;
}

/** "First name" -> "firstName". Never collides with a keyword or a taken name. */
function camel(text, fallback) {
  const parts = words(text);
  if (!parts.length) return fallback;
  const out = parts[0].toLowerCase() + parts.slice(1).map(cap).join('');
  const safe = /^[0-9]/.test(out) ? `x${out}` : out;
  return TAKEN.indexOf(safe) >= 0 ? `${safe}Element` : safe;
}

/**
 * A name not already in `used`, by appending a counter.
 *
 * Numbering rather than refusing: two different elements really can carry the
 * same label — "Delete" beside every row of a table — and a generator that gave
 * up on the second would emit a file that does not compile.
 */
function unique(name, used) {
  if (!used[name]) {
    used[name] = true;
    return name;
  }
  let n = 2;
  while (used[`${name}${n}`]) n++;
  used[`${name}${n}`] = true;
  return `${name}${n}`;
}

// ---- naming an element ---------------------------------------------------
// In priority order, because the point is a name a person would recognise. What
// the recorder captured as the element's label beats anything scraped out of a
// selector: "Email address" reads better than "input-3" however stable the id.
//
// `last` marks the patterns that can legitimately match more than once in one
// selector. ".row .delete" is a delete button inside a row, not a row: in a
// descendant selector the element being acted on is the rightmost part, so the
// last match names it and the first names its container. The attribute forms
// are not marked because a selector carrying two testids is already ambiguous
// and the first is as good a guess as any.
const SELECTOR_HINTS = [
  { re: /\[data-testid=["']?([^"'\]]+)/i },
  { re: /\[data-test=["']?([^"'\]]+)/i },
  { re: /\[data-cy=["']?([^"'\]]+)/i },
  { re: /\[name=["']?([^"'\]]+)/i },
  { re: /\[aria-label=["']?([^"'\]]+)/i },
  { re: /\[placeholder=["']?([^"'\]]+)/i },
  { re: /#([A-Za-z][\w-]*)/, last: true },
  { re: /:has-text\(["']([^"')]+)/i },
  { re: /(?:^|[\s>])text=["']?([^"'\]]+)/i },
  // An Appium accessibility id, which is the mobile equivalent of a testid.
  { re: /^~(.+)$/ },
  { re: /\.([A-Za-z][\w-]*)/, last: true },
];

// A fresh global regex per call rather than a shared one: a global instance
// carries lastIndex between calls, so the second selector asked about would
// start scanning from wherever the first one stopped.
function lastCapture(re, text) {
  const scan = new RegExp(re.source, re.flags.indexOf('g') >= 0 ? re.flags : `${re.flags}g`);
  let found = null;
  let m = scan.exec(text);
  while (m) {
    if (m[1] && words(m[1]).length) found = m[1];
    m = scan.exec(text);
  }
  return found;
}

/** The human-facing name of the element a step acted on. */
function elementName(st) {
  const label = [st && st.label, st && st.text, st && st.name].find(
    (t) => typeof t === 'string' && t.trim() && words(t).length,
  );
  if (label) return label;
  const sel = selectorOf(st);
  for (let i = 0; i < SELECTOR_HINTS.length; i++) {
    const hint = SELECTOR_HINTS[i];
    if (hint.last) {
      const found = lastCapture(hint.re, sel);
      if (found) return found;
      continue;
    }
    const m = hint.re.exec(sel);
    if (m && m[1] && words(m[1]).length) return m[1];
  }
  return 'element';
}

const selectorOf = (st) => String((st && st.selectors && st.selectors[0]) || (st && st.selector) || '');

// What kind of thing this is, appended to the member name so a page object reads
// as a list of controls rather than a list of nouns. Keyed by the action that
// first introduced the element — an input filled and later asserted on is an
// input, because that is what it was the first time anyone touched it.
const ROLE = {
  fill: 'Input',
  select: 'Select',
  check: 'Checkbox',
  upload: 'Input',
  click: 'Button',
  tap: 'Button',
  hover: 'Target',
  assert: 'Text',
};

/** "Email address" + fill -> "emailAddressInput", without doubling the suffix. */
function memberName(st, used) {
  const base = elementName(st);
  const role = ROLE[st.action] || '';
  const parts = words(base);
  const last = parts.length ? parts[parts.length - 1].toLowerCase() : '';
  // "Submit button" must not become submitButtonButton — the recorded label
  // often already says what the control is.
  const name = camel(role && last !== role.toLowerCase() ? `${base} ${role}` : base, 'element');
  return unique(name, used);
}

// ---- naming a method -----------------------------------------------------
// Verb first, so a spec reads as a sentence and so the methods of a page object
// sort into the things you can do to it.
const VERB = {
  fill: 'fill',
  select: 'select',
  check: 'set',
  upload: 'upload',
  click: 'click',
  tap: 'tap',
  hover: 'hover',
};

/** The method a step becomes, and the parameter it takes, if any. */
function methodShape(st) {
  const subject = pascal(elementName(st), 'Element');
  if (st.action === 'assert') {
    // An assertion is a method on the page object like any other, so the spec
    // never imports `expect` and never names a selector. What is being checked
    // goes in the name, because "expectEmailText" and "expectEmailValue" are
    // different questions about the same element.
    if (st.assertType === 'exists') return { name: `expect${subject}Visible`, param: null };
    // `expectedText`, not `expected`: the Appium assertion template declares a
    // local called `expected`, and a parameter of the same name turns the
    // generated body into `const expected = expected;` — a dead reference the
    // generator would emit happily and the device would only fail on.
    if (st.assertType === 'value') return { name: `expect${subject}Value`, param: 'expectedText' };
    return { name: `expect${subject}Text`, param: 'expectedText' };
  }
  // A checkbox keeps its recorded state rather than taking a parameter: what a
  // row table varies is text, and a boolean parameter here would be a knob no
  // caller ever turns.
  if (st.action === 'check') return { name: `${VERB.check}${subject}`, param: null };
  const verb = VERB[st.action];
  if (!verb) return null;
  const param = st.action === 'fill' || st.action === 'select' ? 'value' : null;
  return { name: `${verb}${subject}`, param };
}

// ---- pages ---------------------------------------------------------------
// Which page a step happened on. A recording carries the address on every step,
// so grouping is a matter of reading it rather than guessing where a navigation
// happened — and a step recorded before that field existed inherits the page the
// run was already on, which is where it must have been.

/** The path part of a recorded address, which is what names a page. */
function pathOf(url) {
  const raw = String(url == null ? '' : url).trim();
  if (!raw) return '/';
  // A query string is state, not identity: /patients?tab=2 and /patients?tab=3
  // are the same page and must not become two page objects.
  const noQuery = raw.split('?')[0].split('#')[0];
  const m = /^[a-z]+:\/\/[^/]+(\/.*)?$/i.exec(noQuery);
  return (m ? m[1] || '/' : noQuery) || '/';
}

/**
 * A class name for a page, from its path.
 *
 * Numeric and id-shaped segments are dropped: /patients/8f2c/edit is the same
 * page as /patients/9a10/edit, and a page object per record id is a directory
 * full of identical classes.
 */
function pageClassName(url, suffix) {
  const segments = pathOf(url)
    .split('/')
    .filter(Boolean)
    .filter((seg) => !/^\d+$/.test(seg) && !/^[0-9a-f]{6,}$/i.test(seg));
  const base = segments.length ? segments.map((s) => pascal(s, '')).join('') : 'Home';
  return `${base || 'Home'}${suffix}`;
}

/**
 * A registry that lets several recordings contribute to the same page objects.
 *
 * Without one, two tests that both visit /signup produce two SignupPage classes
 * — and written to the same directory, the second silently overwrites the first,
 * taking its locators with it. Sharing is also the point of the pattern: one
 * SignupPage used by every spec that touches signup is what makes a rotted
 * selector one edit for the whole suite rather than one edit per spec.
 *
 * The in-app export does not pass one, because a single download is a single
 * test and there is nothing to share with.
 */
const newRegistry = () => ({ byKey: {}, classNames: {}, pages: [] });

/**
 * Group a recording into page objects and the sequence of calls that drives them.
 *
 * @param {object} test the recording
 * @param {object} opts `{ suffix, registry }` — "Page" for the web, "Screen" for
 *   a device, which is the only thing about this that differs between the two
 *   runners; `registry` accumulates page objects across several recordings.
 * @returns {{pages: object[], calls: object[], registry: object}}
 *   `pages` are the ones THIS recording used, which is what its imports need;
 *   `registry.pages` is everything accumulated so far, which is what gets
 *   written to disk.
 */
function planPom(test, opts) {
  const suffix = (opts && opts.suffix) || 'Page';
  const registry = (opts && opts.registry) || newRegistry();
  const steps = (test && test.steps) || [];
  const pages = [];
  const byKey = registry.byKey;
  const classNames = registry.classNames;
  const calls = [];
  let currentUrl = (test && test.startUrl) || '/';

  const pageFor = (url) => {
    const key = pathOf(url);
    if (byKey[key]) {
      // Seen by an earlier recording in the same run: reuse the class, and note
      // that this one uses it too so its spec imports it.
      const seen = byKey[key];
      if (pages.indexOf(seen) < 0) pages.push(seen);
      return seen;
    }
    const className = unique(pageClassName(url, suffix), classNames);
    const page = {
      key,
      url: key,
      className,
      varName: camel(className, 'pageObject'),
      fileName: `${className}.ts`,
      locators: [],
      methods: [],
      // Only pages a navigate actually landed on get a goto(). One on every
      // page object would be a method that claims a page is reachable directly
      // when the recording only ever arrived at it by clicking.
      needsGoto: false,
      // Every member and method name in this class shares one namespace.
      used: {},
      bySelector: {},
      byMethod: {},
    };
    byKey[key] = page;
    registry.pages.push(page);
    pages.push(page);
    return page;
  };

  steps.forEach((st) => {
    if (!st || !st.action) return;
    // A REST step's `url` is the address it sends a request to, not a page the
    // browser is on. Letting it move currentUrl would invent a page object for
    // the endpoint — an ApiAuthLoginPage with no locators, imported by the spec
    // and instantiated by nothing — and would file the UI steps that follow
    // under it, scattering one screen's locators across two classes.
    if (st.url && st.action !== 'api') currentUrl = st.url;
    const page = pageFor(currentUrl);

    if (st.action === 'navigate' || st.action === 'launchApp') {
      page.needsGoto = true;
      calls.push({ kind: 'goto', page });
      return;
    }

    const sel = selectorOf(st);
    if (!sel) {
      // A pause, a scroll, a reload — nothing to own, because there is no
      // element involved and therefore no selector that could leak into the
      // spec. These stay inline, emitted by the runner's own step mapping.
      calls.push({ kind: 'raw', page, step: st });
      return;
    }

    // One member per selector, however many times it is used and whatever is
    // done to it. The whole value of this is that a rotted locator is one edit,
    // which a second member for the same element would undo.
    let locator = page.bySelector[sel];
    if (!locator) {
      locator = {
        member: memberName(st, page.used),
        selector: sel,
        alts: ((st.selectors || []).slice(1)),
        label: elementName(st),
      };
      page.bySelector[sel] = locator;
      page.locators.push(locator);
    }

    const shape = methodShape(st);
    if (!shape) {
      calls.push({ kind: 'raw', page, step: st });
      return;
    }
    // Identical steps on the same element are one method called twice, not two
    // methods. The key is what makes the emitted body identical — a fill and a
    // fill differ only in the value, which is the parameter.
    const sig = `${st.action}|${st.assertType || ''}|${sel}|${st.action === 'check' ? String(!!st.value) : ''}`;
    let method = page.byMethod[sig];
    if (!method) {
      method = {
        name: unique(shape.name, page.used),
        param: shape.param,
        step: st,
        locator,
      };
      page.byMethod[sig] = method;
      page.methods.push(method);
    }
    calls.push({
      kind: 'method',
      page,
      method,
      // The argument is resolved at the call site, not in the page object: the
      // page object must not know what a data set is, and this is what lets the
      // same method be called with a different row's value on every iteration.
      arg: method.param ? expr(st.action === 'assert' ? st.expected : st.value) : null,
    });
  });

  return { pages, calls, registry };
}

// ---- rendering: Playwright ------------------------------------------------

const docComment = (lines, pad) =>
  `${pad}/**\n${lines.map((l) => `${pad} * ${l}`.replace(/\s+$/, '')).join('\n')}\n${pad} */\n`;

/** One Playwright page object class, without its imports. */
function playwrightPageClass(page, testName) {
  const fields = page.locators
    .map((l) => `  readonly ${l.member}: Locator;\n`)
    .join('');

  const assigns = page.locators
    .map((l) => {
      // The remaining candidates are kept beside the locator rather than beside
      // its uses: this is the one line that has to change when the first one
      // rots, so it is the line the alternatives belong on.
      const note = l.alts.length ? `    // fallbacks: ${l.alts.join('  |  ')}\n` : '';
      return `${note}    this.${l.member} = page.locator(${q(l.selector)});\n`;
    })
    .join('');

  const goto = page.needsGoto
    ? '  /** Open this page directly, without walking there from another. */\n' +
      `  async goto(baseUrl: string): Promise<void> {\n` +
      `    await this.page.goto(baseUrl + this.path);\n` +
      `  }\n\n`
    : '';

  const methods = page.methods
    .map((m) => {
      const sig = m.param ? `${m.param}: string` : '';
      // The step mapping is asked for the body, with `this.member` as the
      // element and the parameter as the value. The selector list is trimmed to
      // one first so it does not re-emit the fallbacks comment already sitting
      // in the constructor.
      const bare = Object.assign({}, m.step, { selectors: [m.locator.selector] });
      const body = stepToPlaywright(
        bare,
        `this.${m.locator.member}`,
        m.param ? () => m.param : undefined,
      );
      return (
        // One line, and it carries the selector rather than restating the
        // method name: which element this drives is the one thing the name
        // cannot say, and it saves scrolling back to the constructor.
        `  /** ${describeMethod(m)} (recorded as \`${m.locator.selector}\`). */\n` +
        `  async ${m.name}(${sig}): Promise<void> {\n` +
        indent(body.replace(/\n$/, ''), '  ') +
        `\n  }\n\n`
      );
    })
    .join('');

  return (
    docComment(
      [
        `Page object for ${page.url}.`,
        '',
        // Named only when one recording produced this class. A page object
        // merged from a whole suite belongs to no single recording, and naming
        // one of them would point a reader at the wrong place.
        `${testName ? `Generated from the recording "${testName}".` : 'Generated from the recorded suite.'} Every locator this page`,
        'needs lives here, so a selector that rots is one edit rather than one',
        'per spec that touched the element.',
      ],
      '',
    ) +
    `export class ${page.className} {\n` +
    `  readonly page: Page;\n` +
    `  readonly path = ${q(page.url)};\n` +
    fields +
    `\n  constructor(page: Page) {\n    this.page = page;\n` +
    assigns +
    `  }\n\n` +
    goto +
    methods.replace(/\n+$/, '\n') +
    `}\n`
  );
}

/** How a method is described in its doc comment. */
function describeMethod(m) {
  const st = m.step;
  if (st.action === 'assert') {
    if (st.assertType === 'exists') return `Assert ${m.locator.label} is visible`;
    if (st.assertType === 'value') return `Assert the value of ${m.locator.label}`;
    return `Assert ${m.locator.label} contains the expected text`;
  }
  if (st.action === 'check') return `${st.value ? 'Tick' : 'Untick'} ${m.locator.label}`;
  return `${cap(VERB[st.action] || st.action)} ${m.locator.label}`;
}

// Worked out per page rather than fixed: a page object carrying no assertion
// must not import `expect`, because an unused import is the first thing the lint
// rules of whatever repo a generated file lands in will reject.
const asserts = (page) => page.methods.some((m) => m.step.action === 'assert');

const pwPageImport = (page) =>
  asserts(page)
    ? "import { expect, type Locator, type Page } from '@playwright/test';\n"
    : "import { type Locator, type Page } from '@playwright/test';\n";

/** The spec body: page objects constructed, then driven by name. */
/**
 * The pages a spec actually instantiates.
 *
 * A page whose every call is `raw` — a REST step, a wait, a scroll — owns no
 * locator and is never constructed, so emitting its class and importing it
 * would leave a spec that does not compile under a no-unused-imports rule and a
 * file in pages/ that nothing references. One definition, used both by the
 * emitter below and by the file list, so the two cannot disagree about which
 * pages exist.
 *
 * @param {object} plan the POM plan
 * @returns {Array<object>} the pages worth emitting
 */
function pagesUsedBy(plan) {
  return plan.pages.filter((p) => plan.calls.some((c) => c.page === p && c.kind !== 'raw'));
}

function playwrightCalls(plan, indentPad) {
  const used = pagesUsedBy(plan);
  let out = used.map((p) => `${indentPad}const ${p.varName} = new ${p.className}(page);\n`).join('');
  if (used.length) out += '\n';
  plan.calls.forEach((c) => {
    if (c.kind === 'goto') {
      out += `${indentPad}await ${c.page.varName}.goto(BASE_URL);\n`;
    } else if (c.kind === 'method') {
      out += `${indentPad}await ${c.page.varName}.${c.method.name}(${c.arg || ''});\n`;
    } else {
      // Emitted by the runner's own mapping, which already indents by two.
      out += indent(stepToPlaywright(c.step).replace(/\n$/, ''), indentPad.slice(2)) + '\n';
    }
  });
  return out;
}

/**
 * A recording as a Playwright Page Object Model.
 *
 * @param {object} test the recording
 * @param {string} [startUrl] fallback start address
 * @param {object} [set] the data set its {{refs}} resolve against
 * @returns {{pages: {fileName: string, className: string, source: string}[],
 *            spec: {fileName: string, source: string},
 *            bundle: string}}
 *   `pages` + `spec` are the conventional multi-file layout, for a writer that
 *   has a filesystem. `bundle` is the same code in one file, for the in-browser
 *   export — a browser download is one file, and a POM split across four of them
 *   that arrive one click at a time is worse than a single file that compiles.
 */
function toPlaywrightPom(test, startUrl, set, opts) {
  const plan = planPom(test, { suffix: 'Page', registry: opts && opts.registry });
  const steps = (test && test.steps) || [];
  const start = (test && test.startUrl) || startUrl || '/';
  const tags = tagsOf(test);
  const title = tags.length ? `${test.name} ${tags.map(tagLabel).join(' ')}` : test.name;
  const owner = ownerOf(test);
  const ownerLine = owner ? `// Owner: ${ownerLabel(owner)}\n` : '';
  const grepHint = tags.length ? `//   npx playwright test --grep ${tagLabel(tags[0])}\n` : '';
  const data = dataBlock(steps, set);
  const iterating = iteratesOver(steps, set);

  // Nothing navigated, so nothing opened the page under test. Every recording
  // starts somewhere, so the first page object gets the goto rather than the
  // spec quietly beginning on whatever page the browser happened to be on.
  if (plan.pages.length && !plan.calls.some((c) => c.kind === 'goto')) {
    const first = plan.pages[0];
    first.needsGoto = true;
    first.url = pathOf(start);
    plan.calls.unshift({ kind: 'goto', page: first });
  }

  const body = playwrightCalls(plan, '  ');
  const block =
    `test(${iterating ? iterTitle(title) : q(title)}, async ({ page }) => {\n` +
    body +
    `});\n`;
  const runBlock = iterating ? ITER_OPEN + indent(block, '  ') + ITER_CLOSE : block;

  const header =
    `// Generated from the in-browser recording "${test.name}".\n` +
    `${ownerLine}// Page objects hold every locator; this spec holds none, so a selector that\n` +
    `// rots is fixed in one place.\n` +
    `//   BASE_URL=https://staging.example.com npx playwright test\n` +
    `${grepHint}const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';\n\n`;

  const emitted = pagesUsedBy(plan);

  const pages = emitted.map((p) => ({
    fileName: p.fileName,
    className: p.className,
    source: pwPageImport(p) + '\n' + playwrightPageClass(p, test.name),
  }));

  const imports = emitted
    // Where the page objects sit relative to this spec. Configurable because a
    // writer that files specs into suite directories needs "../pages", and a
    // spec importing from the wrong depth is a suite that does not compile.
    .map((p) => `import { ${p.className} } from '${(opts && opts.pagesDir) || './pages'}/${p.className}';\n`)
    .join('');

  return {
    pages,
    spec: {
      fileName: `${slug(test.name, 'test')}.spec.ts`,
      // `expect` only when the spec body actually calls it. Asked of the
      // generated text rather than inferred from the step list, so it cannot
      // drift: a REST step asserts inline here (the page objects hold the UI
      // assertions and import expect themselves), and a spec that emitted
      // expect() without importing it would fail at the first check with a
      // ReferenceError pointing at the generator rather than the app.
      source:
        `import { ${/\bexpect\(/.test(runBlock) ? 'expect, test' : 'test'} } from '@playwright/test';\n` +
        `${imports}\n${header}${data}${runBlock}`,
    },
    bundle:
      // The bundle carries every class, so it imports whatever any of them
      // needs. `asserts(page)` only sees a UI assert step turned into a page
      // object method — an API step's expect() calls are emitted straight
      // into runBlock instead (the `raw` call kind), so a check here that
      // ignored runBlock would produce a bundle that calls expect() with no
      // import for any test whose only checks are on a REST step: exactly the
      // shape "Web app > API" seeds by default.
      (plan.pages.some(asserts) || /\bexpect\(/.test(runBlock)
        ? "import { expect, test, type Locator, type Page } from '@playwright/test';\n"
        : "import { test, type Locator, type Page } from '@playwright/test';\n") +
      '\n' +
      header +
      data +
      plan.pages.map((p) => playwrightPageClass(p, test.name)).join('\n') +
      '\n' +
      runBlock,
  };
}

// ---- rendering: Appium ----------------------------------------------------
// The same plan, rendered for a device. Screen objects rather than page objects
// — the word every mobile suite uses — and getters rather than constructor
// assignment, because WebdriverIO resolves an element when it is asked for
// rather than holding a lazy handle the way a Playwright Locator does.

/** One WebdriverIO screen object class. */
function appiumScreenClass(page, testName) {
  const getters = page.locators
    .map((l) => {
      const note = l.alts.length ? `  // fallbacks: ${l.alts.join('  |  ')}\n` : '';
      return (
        note +
        `  get ${l.member}() {\n    return driver.$(${q(l.selector)});\n  }\n\n`
      );
    })
    .join('');

  const methods = page.methods
    .map((m) => {
      const sig = m.param ? `${m.param}` : '';
      const bare = Object.assign({}, m.step, { selectors: [m.locator.selector] });
      const body = stepToAppium(
        bare,
        `await this.${m.locator.member}`,
        m.param ? () => m.param : undefined,
      );
      return (
        // One line, and it carries the selector rather than restating the
        // method name: which element this drives is the one thing the name
        // cannot say, and it saves scrolling back to the constructor.
        `  /** ${describeMethod(m)} (recorded as \`${m.locator.selector}\`). */\n` +
        `  async ${m.name}(${sig}) {\n` +
        indent(body.replace(/\n$/, ''), '  ') +
        `\n  }\n\n`
      );
    })
    .join('');

  return (
    docComment(
      [
        `Screen object for ${page.url}.`,
        '',
        `${testName ? `Generated from the recording "${testName}".` : 'Generated from the recorded suite.'} Every locator this screen`,
        'needs lives here, so a native id that changes is one edit.',
      ],
      '',
    ) +
    `export class ${page.className} {\n` +
    getters +
    (page.needsGoto
      ? '  /** Bring the app under test to the front. */\n' +
        `  async open(appId) {\n    await driver.activateApp(appId);\n  }\n\n`
      : '') +
    methods.replace(/\n+$/, '\n') +
    `}\n`
  );
}

function appiumCalls(plan, indentPad) {
  const used = plan.pages.filter((p) => plan.calls.some((c) => c.page === p && c.kind !== 'raw'));
  let out = used.map((p) => `${indentPad}const ${p.varName} = new ${p.className}();\n`).join('');
  if (used.length) out += '\n';
  plan.calls.forEach((c) => {
    if (c.kind === 'goto') {
      out += `${indentPad}await ${c.page.varName}.open(APP);\n`;
    } else if (c.kind === 'method') {
      out += `${indentPad}await ${c.page.varName}.${c.method.name}(${c.arg || ''});\n`;
    } else {
      out += indent(stepToAppium(c.step).replace(/\n$/, ''), indentPad.slice(2)) + '\n';
    }
  });
  return out;
}

/**
 * A mobile recording as a WebdriverIO Screen Object Model.
 *
 * Same return shape as toPlaywrightPom, and for the same reasons.
 */
function toAppiumPom(test, defaultApp, set, opts) {
  const plan = planPom(test, { suffix: 'Screen', registry: opts && opts.registry });
  const steps = (test && test.steps) || [];
  const app =
    (test && test.startUrl) ||
    (steps.find((s) => s.action === 'launchApp' || s.action === 'navigate') || {}).app ||
    (steps.find((s) => s.url) || {}).url ||
    defaultApp ||
    'com.example.app';
  const tags = tagsOf(test);
  const title = tags.length ? `${test.name} ${tags.map(tagLabel).join(' ')}` : test.name;
  const owner = ownerOf(test);
  const ownerLine = owner ? `// Owner: ${ownerLabel(owner)}\n` : '';
  const fileName = `${slug(test.name, 'test')}.mobile.spec.js`;
  const data = dataBlock(steps, set, `npx mocha ${fileName}`);
  const iterating = iteratesOver(steps, set);

  if (plan.pages.length && !plan.calls.some((c) => c.kind === 'goto')) {
    plan.pages[0].needsGoto = true;
    plan.calls.unshift({ kind: 'goto', page: plan.pages[0] });
  }

  const block =
    `it(${iterating ? iterTitle(title) : q(title)}, async function () {\n` +
    `  this.timeout(180000);\n` +
    appiumCalls(plan, '  ') +
    `});\n`;
  const runBlock = iterating ? ITER_OPEN + indent(block, '  ') + ITER_CLOSE : block;

  const header =
    `// Generated from the in-browser recording "${test.name}".\n` +
    `${ownerLine}// Screen objects hold every locator; this spec holds none.\n` +
    `//   appium --address 127.0.0.1 --port 4723\n` +
    `//   APP_PACKAGE=com.example.staging npx mocha ${fileName}\n` +
    `const APPIUM_URL = process.env.APPIUM_URL ?? 'http://127.0.0.1:4723';\n` +
    `const APP = process.env.APP_PACKAGE ?? ${q(app)};\n` +
    `const DEVICE_UDID = process.env.DEVICE_UDID;\n\n`;

  const platform = test && test.platform === 'iOS' ? 'iOS' : 'Android';
  const automation = platform === 'iOS' ? 'XCUITest' : 'UiAutomator2';

  const harness =
    `let driver;\n\n` +
    `before(async function () {\n` +
    `  this.timeout(120000);\n` +
    `  const url = new URL(APPIUM_URL);\n` +
    `  driver = await remote({\n` +
    `    protocol: url.protocol.replace(':', ''),\n` +
    `    hostname: url.hostname,\n` +
    `    port: Number(url.port) || 4723,\n` +
    `    path: '/',\n` +
    `    logLevel: 'error',\n` +
    `    capabilities: {\n` +
    `      platformName: ${q(platform)},\n` +
    `      'appium:automationName': ${q(automation)},\n` +
    `      ...(DEVICE_UDID ? { 'appium:udid': DEVICE_UDID } : {}),\n` +
    `      'appium:noReset': true,\n` +
    `      'appium:newCommandTimeout': 600,\n` +
    `    },\n` +
    `  });\n` +
    `  // The screen objects reach the session through this global, which is how\n` +
    `  // WebdriverIO's own page object examples are written.\n` +
    `  global.driver = driver;\n` +
    `});\n\n` +
    `after(async () => {\n` +
    `  if (driver) await driver.deleteSession();\n` +
    `});\n\n`;

  const screenImports = plan.pages
    .map((p) => `import { ${p.className} } from '${(opts && opts.pagesDir) || './screens'}/${p.className}';\n`)
    .join('');

  return {
    pages: plan.pages.map((p) => ({
      fileName: `${p.className}.js`,
      className: p.className,
      // `driver` needs no import — a screen object reaches the session through
      // the global the spec sets, which is how a standalone WebdriverIO session
      // is shared with the objects that drive it. `assert` is a real module and
      // does, but only where an assertion was actually recorded.
      source: (asserts(p) ? "import assert from 'node:assert/strict';\n\n" : '') +
        appiumScreenClass(p, test.name),
    })),
    spec: {
      fileName,
      source:
        `import { remote } from 'webdriverio';\n` +
        `import assert from 'node:assert/strict';\n` +
        screenImports +
        `\n${header}${data}${harness}${runBlock}`,
    },
    bundle:
      `import { remote } from 'webdriverio';\n` +
      `import assert from 'node:assert/strict';\n\n` +
      header +
      data +
      plan.pages.map((p) => appiumScreenClass(p, test.name)).join('\n') +
      '\n' +
      harness +
      runBlock,
  };
}

module.exports = {
  appiumScreenClass,
  camel,
  elementName,
  memberName,
  methodShape,
  pageClassName,
  pascal,
  pathOf,
  planPom,
  playwrightPageClass,
  newRegistry,
  pwPageImport,
  toAppiumPom,
  toPlaywrightPom,
  unique,
};
