// Test data for TestExpress recordings — the named values a test refers to
// instead of the literal a tester happened to type while recording.
//
// A recording captures what you did: `fill "priya@example.com"`. That literal is
// then baked into the test, which causes three problems this module exists to
// solve:
//   * the same address is repeated across a dozen recordings, so changing it is
//     a dozen edits;
//   * a signup test only passes once, because the second run hits "that email is
//     already registered";
//   * a password ends up in plain sight in the steps list and in any spec file
//     exported from it.
// So a step's value can instead be a reference — `{{email}}` — resolved from a
// named data set when the test runs.
//
// Lives outside TestRunner.jsx for the same reason ./spec.js does: three callers
// need it and they cannot share a browser. The app resolves references at
// playback, ./spec.js turns them into Playwright source, and scripts/review-
// tests.js generates specs from Node. A second copy of the substitution rules
// would drift from the recorder the first time a token was added, and the drift
// would surface only as a spec that silently fills the wrong value.
//
// Deliberately CommonJS and free of any React or DOM reference.
//
// One constraint that is not obvious and bites hard: no object spread in this
// file. `{ ...x }` needs a Babel helper, and babel-preset-react-app injects that
// helper as an ESM `import`. One import statement is enough for webpack to class
// the whole file as an ES module — at which point `module.exports` below is a
// plain assignment to nothing, the file appears to export *nothing at all*, and
// every named import in TestRunner.jsx fails to compile with "is not exported
// from ./testrunner/testdata". Nothing in the message points at the spread.
// Object.assign is the workaround, and the reason it is used below instead.
// ./spec.js is under the same rule and stays clear of spread for the same reason.

// ---- references ----------------------------------------------------------
// `{{key}}` — doubled braces because a single brace is ordinary text in the
// fields being recorded (JSON pasted into a textarea, "{}" in a message), while
// a doubled brace next to a bare word is not something anyone types by accident.
// There is deliberately no escape sequence: one would have to be understood by
// the recorder, both engines and the export, and the case it serves — asserting
// on the literal text "{{email}}" — has never come up. If it does, the
// workaround is a data set entry whose value is that text.
// The API step keeps some of its authored text inside arrays rather than in
// named fields, and stepTexts below needs to see into them. One-way: ./apiStep
// requires nothing, so this cannot become a cycle.
const { apiTexts } = require('./apiStep');

const REF_SOURCE = '\\{\\{\\s*([$a-zA-Z0-9_.\\- ]+?)\\s*\\}\\}';
// Two objects from one source rather than one shared object. A global regex
// carries a mutable lastIndex, and `.test()` on one resumes from where the last
// call left off — so a single shared instance would answer "does this contain a
// reference?" correctly, then answer "no" for the identical string next time.
// `replace` needs the g flag; `test` must not have it.
const REF_PATTERN = new RegExp(REF_SOURCE, 'g');
const REF_TEST = new RegExp(REF_SOURCE);

// Keys are normalised on the way in so that a set cannot hold both "Email" and
// "email" — a list where you have to remember which way you typed it before you
// can use it. Folded to the character class a JavaScript identifier allows,
// because the Playwright export writes them as property names (`DATA.first_name`)
// and a quoted-and-bracketed form there would be noise in every generated spec.
function normKey(raw) {
  return String(raw == null ? '' : raw)
    .trim()
    .toLowerCase()
    .replace(/[\s.-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/^_+|_+$/g, '')
    .replace(/^(\d)/, '_$1'); // a leading digit is not a legal identifier
}

// Which keys a piece of text refers to, in the order they appear.
const refsIn = (text) => {
  const out = [];
  String(text == null ? '' : text).replace(REF_PATTERN, (_m, key) => {
    const k = key.trim();
    if (!out.includes(k)) out.push(k);
    return _m;
  });
  return out;
};

const hasRef = (text) => REF_TEST.test(String(text == null ? '' : text));

// A fresh scanner for callers that need to walk the matches themselves. Handing
// out the module's own global instance would let two callers interleave and
// corrupt each other's lastIndex — the bug the pair above exists to avoid.
const refScanner = () => new RegExp(REF_SOURCE, 'g');

// The key, when the whole string is exactly one reference and nothing else:
// "{{email}}" yes, "user {{email}}" no. The Playwright export turns the first
// into `DATA.email` and only the second into a template literal.
const soleRef = (text) => {
  const m = new RegExp(`^${REF_SOURCE}$`).exec(String(text == null ? '' : text));
  return m ? m[1].trim() : null;
};

// ---- dynamic tokens ------------------------------------------------------
// Values that have to be different on every run. `{{$uuid}}` and friends are
// generated rather than stored, which is what makes a signup test re-runnable:
// the address it registers has never been used before.
//
// Reserved test ranges on purpose, not made-up-looking numbers. An email at
// example.com can never be delivered (RFC 2606 reserves the domain) and a phone
// number in 07700 9000xx can never be dialled (Ofcom reserves the range for
// drama and testing). A test that leaks into a real send therefore cannot reach
// a real person — which a plausible-looking address or mobile number can.
const pad = (n, width) => String(n).padStart(width, '0');

// Base36 of a counter and a random tail. Short enough to read in a report and
// to fit a field with a length limit, unique enough for the job — this is
// labelling test rows, not minting primary keys.
let seq = 0;
const uid = () => {
  seq = (seq + 1) % 1e6;
  return (
    Date.now().toString(36) +
    pad(seq.toString(36), 2) +
    Math.floor(Math.random() * 1296).toString(36)
  );
};

const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)}`;

// token -> { label, hint, gen, js }
//   gen — how the app and the backend produce a value
//   js  — the equivalent expression in an exported Playwright spec, so a spec
//         generated from a recording stays re-runnable instead of freezing one
//         run's value into source.
//
// The `js` strings contain ${…} on purpose: they are source code this module
// emits into a generated spec, not templates meant to be interpolated here.
/* eslint-disable no-template-curly-in-string */
const DYNAMIC = {
  $uuid: {
    label: 'Unique id',
    hint: 'A short id that has never been used before — "m8x3k2a9"',
    gen: uid,
    js: 'uid()',
  },
  $email: {
    label: 'Unique email',
    hint: 'test-m8x3k2a9@example.com — a reserved domain, so it can never be delivered',
    gen: () => `test-${uid()}@example.com`,
    js: '`test-${uid()}@example.com`',
  },
  $phone: {
    label: 'Test phone',
    hint: "07700 900xxx — Ofcom's drama range, so it can never be dialled",
    gen: () => `07700900${pad(Math.floor(Math.random() * 1000), 3)}`,
    js: "`07700900${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`",
  },
  $timestamp: {
    label: 'Timestamp',
    hint: 'Milliseconds since 1970 — useful appended to a name',
    gen: () => String(Date.now()),
    js: 'String(Date.now())',
  },
  $today: {
    label: "Today's date",
    hint: 'YYYY-MM-DD — what a date input expects',
    gen: () => isoDate(new Date()),
    js: 'new Date().toISOString().slice(0, 10)',
  },
  $tomorrow: {
    label: "Tomorrow's date",
    hint: 'YYYY-MM-DD — booking a slot that has not already passed',
    gen: () => isoDate(new Date(Date.now() + 86400000)),
    js: 'new Date(Date.now() + 86400000).toISOString().slice(0, 10)',
  },
  $number: {
    label: 'Random number',
    hint: 'A number from 1000 to 9999',
    gen: () => String(1000 + Math.floor(Math.random() * 9000)),
    js: 'String(1000 + Math.floor(Math.random() * 9000))',
  },
};
/* eslint-enable no-template-curly-in-string */

// The list the picker shows, in a deliberate order — the two that make a test
// re-runnable first.
// Object.assign, not spread — see the note at the top of the file.
const DYNAMIC_TOKENS = Object.keys(DYNAMIC).map((token) =>
  Object.assign({ token, ref: `{{${token}}}` }, DYNAMIC[token]),
);

const isDynamic = (key) => Object.prototype.hasOwnProperty.call(DYNAMIC, key);

// ---- data sets -----------------------------------------------------------
// { id, name, vars: [{ key, value, secret }] }
//
// A set rather than one flat list of variables, because the same test wants to
// run against staging and against a local server with different logins, and the
// difference between those two worlds is exactly a set of values. Which set is
// live is a workspace-wide choice; a test can pin one when it only ever makes
// sense against a particular set (see setFor).

const varsOf = (set) => (set && Array.isArray(set.vars) ? set.vars : []);

// A set's values as a plain lookup. Later duplicates lose — the editor prevents
// them, a hand-edited import may not.
const varMap = (set) => {
  const map = {};
  varsOf(set).forEach((v) => {
    const key = normKey(v && v.key);
    if (key && !Object.prototype.hasOwnProperty.call(map, key)) {
      map[key] = v.value == null ? '' : String(v.value);
    }
  });
  return map;
};

const setById = (data, id) => (data && Array.isArray(data.sets) ? data.sets : []).find((s) => s && s.id === id) || null;

// Which set a test runs against: the one it pins, falling back to the
// workspace's active set. The fallback is what keeps every test recorded before
// test data existed working untouched, and it is deliberately forgiving in one
// direction — a test pinning a set that has since been deleted runs against the
// active one rather than refusing to run.
const setFor = (data, test) => {
  const pinned = test && test.dataSetId ? setById(data, test.dataSetId) : null;
  return pinned || setById(data, data && data.activeId) || null;
};

// ---- rows: data-driven iterations ---------------------------------------
// A set's `vars` are a single row of values, so a test pinned to it runs once.
// `rows` turns the same set into a table: the test runs once per row, and each
// run is reported on its own.
//
// Two levels rather than one flat table, because a flat one repeats itself. A
// login test varying only the password still needs the base URL, and a table
// where every row carries the unchanging columns is a table where changing the
// base URL is twelve edits — the exact problem this module exists to remove. So
// a var is shared across every iteration unless it is marked `perRow`, and only
// the marked ones become columns.
//
// What a blank cell means is the decision everything else here follows from. It
// means an empty value, not "inherit" — a column is shown in the grid, so what
// the grid shows is what the run types. The alternative reading costs more than
// it gives: "submit the form with no email and expect the validation error" is
// one of the commonest reasons to want a table in the first place, and under an
// inherit rule there is no way to write it. Sharing is expressed by not marking
// the var `perRow` at all, which is clearer than a blank cell ever could be.
//
// A set with no rows yields exactly one iteration carrying no row. That is what
// keeps every test recorded before rows existed running once, against `vars`,
// unchanged — and it means callers loop over iterations unconditionally rather
// than branching on whether a table exists.
//
// { id, label, enabled, values: { key: value } }

const rowsOf = (set) => (set && Array.isArray(set.rows) ? set.rows : []);

const hasRows = (set) => rowsOf(set).length > 0;

// The keys that vary per row, in the order the set declares them — the columns
// of the grid, of an exported ROWS table, and of nothing else.
function rowKeys(set) {
  const out = [];
  varsOf(set).forEach((v) => {
    if (!v || !v.perRow) return;
    // A secret is never a column, however it is flagged.
    //
    // The whole point of `secret` is that the value is not written into a
    // generated file — the shared one becomes `process.env.TD_PASSWORD`. A row
    // cell has no such escape: it is one of several values, so it can only be
    // emitted literally, and the ROWS block of every exported spec would then
    // carry the password in plain text into whatever repository the spec is
    // committed to. Enforced here rather than only in the editor because this
    // is the one function the row table, the merge and the exporters all agree
    // through, and a hand-edited import can set both flags whatever the UI does.
    if (v.secret) return;
    const key = normKey(v.key);
    if (key && !out.includes(key)) out.push(key);
  });
  return out;
}

// A row's cells as a normalised lookup. Keys are folded exactly as a var's key
// is, so a row arriving from a hand-edited export written as "First Name" lines
// up with the column called `first_name` instead of silently overriding
// nothing. An empty string survives — see the note above on why it is a value.
function rowValues(row) {
  const out = {};
  const src = row && row.values && typeof row.values === 'object' ? row.values : {};
  Object.keys(src).forEach((raw) => {
    const key = normKey(raw);
    if (!key) return;
    const value = src[raw];
    if (value == null) return;
    out[key] = String(value);
  });
  return out;
}

// What a row is called in a report, in the run header, and in a generated
// spec's test title. The label someone typed wins; failing that the row's own
// values identify it far better than its position does, because a report read a
// week later says "expired@example.com failed" rather than "row 7 failed".
function rowLabel(set, row, index) {
  const explicit = row && typeof row.label === 'string' ? row.label.trim() : '';
  if (explicit) return explicit;
  const values = rowValues(row);
  const shown = rowKeys(set)
    .map((key) => values[key])
    .filter((v) => v != null && v !== '');
  return shown.length ? shown.join(' \u00b7 ') : `Row ${index + 1}`;
}

// The iterations a set produces: one per enabled row, or a single row-less one
// when there is no table. `index` is the position among the iterations that
// will actually run, not among all rows — a disabled row must not leave a gap
// in "2 of 5".
//
// Disabling rather than deleting exists because the row that reproduces a bug
// is worth keeping while the bug is being fixed, and re-typing it afterwards is
// how it stops being kept.
function iterationsOf(set) {
  const rows = rowsOf(set).filter((r) => r && r.enabled !== false);
  if (!rows.length) return [{ index: 0, total: 1, row: null, label: null }];
  return rows.map((row, i) => ({
    index: i,
    total: rows.length,
    row: row,
    label: rowLabel(set, row, rowsOf(set).indexOf(row)),
  }));
}

// The values one iteration resolves against: the set's shared values, with
// every per-row column replaced by that row's cell. A column the row never had
// typed into resolves to empty for the same reason a blank cell does.
function mergedVars(set, row) {
  const base = varMap(set);
  if (!row) return base;
  const values = rowValues(row);
  rowKeys(set).forEach((key) => {
    base[key] = Object.prototype.hasOwnProperty.call(values, key) ? values[key] : '';
  });
  return base;
}

// ---- resolving -----------------------------------------------------------
// A resolver is made once per run and remembers what each dynamic token
// produced. Without the memory, `{{$email}}` typed into the signup form and the
// same `{{$email}}` in the assertion that the confirmation shows it would be two
// different addresses, and the test would fail on a difference it invented
// itself. One value per token per run is therefore the useful rule, and the
// resolver's lifetime is what encodes it.
function makeResolver(set, opts) {
  // opts.row — the iteration being run, when the set is a table. Merging here
  // rather than at every call site means the substitution rules stay in one
  // place: a resolver is handed a set and which row of it, and everything
  // downstream is unchanged by the existence of rows.
  const vars = mergedVars(set, opts && opts.row);
  const cache = {};
  const missing = [];
  const used = [];
  // A preview resolves stored values but leaves dynamic tokens standing. Two
  // reasons: a fresh value on every keystroke makes the preview flicker, and —
  // more to the point — the value a token will have is genuinely not known until
  // the run. Showing a sample would be inventing one.
  const frozen = opts && opts.frozen;

  const valueFor = (key) => {
    if (isDynamic(key)) {
      if (frozen) return null;
      if (!Object.prototype.hasOwnProperty.call(cache, key)) {
        cache[key] = DYNAMIC[key].gen();
      }
      return cache[key];
    }
    const k = normKey(key);
    if (Object.prototype.hasOwnProperty.call(vars, k)) return vars[k];
    if (!missing.includes(key)) missing.push(key);
    // An unresolved reference is left standing rather than blanked. A field
    // filled with "{{email}}" fails the app's validation and says why in the
    // report; a field filled with "" fails somewhere further along, looking
    // like the app dropped the value.
    return null;
  };

  const text = (input) => {
    if (input == null) return input;
    const str = String(input);
    if (!hasRef(str)) return input;
    return str.replace(REF_PATTERN, (whole, rawKey) => {
      const key = rawKey.trim();
      const value = valueFor(key);
      if (value == null) return whole;
      if (!used.includes(key)) used.push(key);
      return value;
    });
  };

  return {
    text,
    // Reported by the runner before a run so a missing key is a sentence rather
    // than a mysterious failure four steps later.
    missing: () => missing.slice(),
    used: () => used.slice(),
    /**
     * Teach this resolver a value the run itself produced — what an API step
     * pulled out of a response (see ./apiStep.js extractFrom).
     *
     * It joins the same namespace as the data set rather than a second one, so
     * `{{token}}` means the same thing in a later step whether the value was
     * typed into a set or returned by a sign-in call. The recording author is
     * not asked to know which, and does not have to change the reference if the
     * value later starts coming from the other place.
     *
     * Scoped to this resolver, and the runner builds a fresh one per iteration
     * — so a token extracted in row 1 cannot leak into row 2, for the same
     * reason a dynamic {{$email}} is regenerated per row.
     *
     * @param {string} name the key, normalised like any other
     * @param {*} value the extracted value
     */
    learn: (name, value) => {
      const k = normKey(name);
      if (k) vars[k] = value == null ? '' : String(value);
    },
  };
}

// The fields of a step that hold authored text. Everything else a step carries
// is either machinery (selectors, tag) or payload (an inlined upload) and must
// be left exactly as recorded — running a selector through the substitution
// would corrupt a locator containing braces.
// `headersText` and `body` belong to the API step (./apiStep.js) and are listed
// here rather than handled there on purpose: they are the fields a REST call
// parameterises most — a bearer token in a header, an id in a JSON body — and
// listing them is the whole reason that step models them as flat text instead
// of as {key,value} pairs this scanner could not see into.
const TEXT_FIELDS = ['value', 'expected', 'url', 'name', 'headersText', 'body'];

/**
 * Every authored string in a step — the one definition of "where can a
 * {{reference}} be written?".
 *
 * Three separate scanners used to answer this by looping TEXT_FIELDS
 * themselves: the audit below, and the export's wantedKeys and dynamicUsed.
 * Three loops meant a field added to one was missed by the other two, which is
 * exactly what happened to the API step's nested assertion values — resolved at
 * run time, invisible to the audit. One accessor, three callers.
 *
 * @param {object} step a recorded step
 * @returns {Array<string>} the authored strings it holds
 */
function stepTexts(step) {
  const out = [];
  TEXT_FIELDS.forEach((field) => {
    const raw = step && step[field];
    // `check` carries a boolean here; only text can hold a reference.
    if (typeof raw === 'string' && raw !== '') out.push(raw);
  });
  // The parts a field-name scan cannot reach. Safe to require from here: that
  // module imports nothing, so there is no cycle to create.
  return out.concat(apiTexts(step));
}

// A copy of the step with its references resolved. Returns the step itself when
// there is nothing to do, so the overwhelmingly common case allocates nothing
// and the object identity a caller may be keying on survives.
function resolveStep(step, resolver) {
  if (!step || !resolver) return step;
  let out = null;
  TEXT_FIELDS.forEach((field) => {
    const raw = step[field];
    // `check` carries a boolean here; only text can hold a reference.
    if (typeof raw !== 'string' || !hasRef(raw)) return;
    const next = resolver.text(raw);
    if (next === raw) return;
    // Object.assign, not spread — see the note at the top of the file.
    if (!out) out = Object.assign({}, step);
    out[field] = next;
  });
  return out || step;
}

// Every key a test refers to, and which of them no set entry provides. Used to
// warn before a run, and to mark the offending step in the list.
function auditSteps(steps, set, row) {
  const vars = mergedVars(set, row);
  const referenced = [];
  const missing = [];
  (Array.isArray(steps) ? steps : []).forEach((st) => {
    stepTexts(st).forEach((text) => {
      refsIn(text).forEach((key) => {
        if (!referenced.includes(key)) referenced.push(key);
        if (isDynamic(key)) return;
        if (Object.prototype.hasOwnProperty.call(vars, normKey(key))) return;
        if (!missing.includes(key)) missing.push(key);
      });
    });
  });
  return { referenced, missing };
}

// How a value is shown. A secret is masked wherever it would otherwise be
// readable over a shoulder or in a screen share.
//
// Masking is presentation, not protection: the value is in localStorage in plain
// text like everything else here, and anything running in this origin can read
// it. The flag is worth having anyway — it keeps a password out of the steps
// list, out of reports and out of exported specs — but it must never be
// described to the user as encryption.
const MASK = '••••••••';
const showValue = (v) => (v && v.secret ? MASK : v && v.value != null ? String(v.value) : '');

module.exports = {
  DYNAMIC,
  DYNAMIC_TOKENS,
  MASK,
  REF_PATTERN,
  TEXT_FIELDS,
  stepTexts,
  auditSteps,
  hasRef,
  hasRows,
  isDynamic,
  iterationsOf,
  makeResolver,
  mergedVars,
  normKey,
  refScanner,
  refsIn,
  resolveStep,
  rowKeys,
  rowLabel,
  rowValues,
  rowsOf,
  soleRef,
  setById,
  setFor,
  showValue,
  varMap,
  varsOf,
};
