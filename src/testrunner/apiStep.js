// The REST step for TestExpress recordings — model, assertions and extraction.
//
// Why this is its own module rather than more `case` arms in the two engines:
// an API step is executed in three different places and none of them can share
// a transport. src/Backend/testrunner/replay.js drives it through Playwright's
// APIRequestContext, TestRunner.jsx drives it from the browser through the
// proxy in routes/testrunner.js (the same-origin policy forbids calling an
// arbitrary host from the page), and ./spec.js does not execute it at all — it
// writes the Playwright that will. Three copies of "did this response pass?"
// would disagree the first time somebody added an operator, and the
// disagreement would surface as a step that passes in the recorder and fails in
// CI, which is the single most expensive kind of bug this product can ship.
//
// So the split is: every engine turns its own response into the neutral summary
// documented at `evaluate`, and the pass/fail decision is made here, once.
//
// Deliberately CommonJS and free of any React or DOM reference, like its
// neighbours in this folder — `require`d by the Node backend and imported by
// name from the app bundle. It is under the same no-object-spread rule as
// ./spec.js and ./testdata.js, which is why Object.assign and concat appear
// below in place of `{ ...x }` — see the note at the top of ./testdata.js for
// what spread does to the production bundle here.

// ---- the step -------------------------------------------------------------
// {
//   action:      'api'
//   method:      'GET' | 'POST' | ...
//   url:         '/api/plans'  (relative to BASE_URL) or an absolute URL
//   headersText: 'Content-Type: application/json\nAuthorization: Bearer {{token}}'
//   body:        raw request body, may hold {{refs}}
//   asserts:     [{ type, path, op, expected }]
//   extract:     [{ name, from, path }]
//   label:       'POST /api/auth/login'
// }
//
// headersText and body are deliberately raw strings rather than arrays of
// pairs. Every {{ref}} in this product is found by scanning the string fields
// named in testdata.TEXT_FIELDS; a header list of {key,value} objects would be
// invisible to that scanner, so references inside it would silently fail to
// resolve — and "silently" is the whole problem. As flat text they are ordinary
// data-set-aware fields, and the audit, the resolver and the generated DATA
// block all work on them untouched. It is also the shape curl, Postman's raw
// view and .http files already use, so it is what a tester expects to paste.

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

// Methods where a body is meaningless. Sending one is not merely useless: fetch
// and Playwright both reject GET-with-body outright, so a recording that kept a
// stale body after switching method would fail on the transport rather than on
// anything to do with the test.
const BODYLESS = ['GET', 'HEAD'];

// What an assertion can look at. `type` chooses the source, `op` compares it.
const ASSERT_TYPES = [
  { id: 'status', label: 'Status code', needsPath: false },
  { id: 'jsonPath', label: 'JSON field', needsPath: true },
  { id: 'header', label: 'Response header', needsPath: true },
  { id: 'bodyContains', label: 'Raw body', needsPath: false },
  { id: 'responseTime', label: 'Response time (ms)', needsPath: false },
];

const OPS = [
  { id: 'eq', label: 'equals' },
  { id: 'ne', label: 'does not equal' },
  { id: 'contains', label: 'contains' },
  { id: 'matches', label: 'matches regex' },
  { id: 'exists', label: 'is present' },
  { id: 'empty', label: 'is empty' },
  { id: 'lt', label: 'is less than' },
  { id: 'gt', label: 'is greater than' },
];

// Header names whose value is a credential. Masked wherever a step is shown or
// reported: a recording is exported, attached to a CI run and pasted into a
// ticket, and a bearer token that rode along in the HTML report is a leak that
// nobody notices until it is used.
const SECRET_HEADERS = [
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'api-key',
  'proxy-authorization',
];

/**
 * Parse a raw header block into ordered pairs.
 *
 * Tolerant on purpose — this text is typed and pasted by hand. Blank lines and
 * `#` comments are skipped so a block can be commented out a line at a time,
 * and a line with no colon is dropped rather than producing a header with an
 * empty name, which some servers answer with a 400 that says nothing useful.
 *
 * @param {string} text raw "Key: value" lines
 * @returns {Array<{key: string, value: string}>}
 */
function parseHeaders(text) {
  const out = [];
  String(text == null ? '' : text)
    .split(/\r?\n/)
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.charAt(0) === '#') return;
      const at = trimmed.indexOf(':');
      if (at <= 0) return;
      const key = trimmed.slice(0, at).trim();
      const value = trimmed.slice(at + 1).trim();
      if (key) out.push({ key: key, value: value });
    });
  return out;
}

/**
 * The same headers as a plain object, which is what both transports want.
 *
 * Later wins on a repeated name. HTTP allows repeats and joins them with a
 * comma, but neither fetch's init nor Playwright's `headers` option can express
 * that, so last-one-wins is the honest approximation rather than a silent merge
 * that produces a value no one wrote.
 *
 * @param {string} text raw "Key: value" lines
 * @returns {Object<string,string>}
 */
function headersObject(text) {
  const out = {};
  parseHeaders(text).forEach((h) => {
    out[h.key] = h.value;
  });
  return out;
}

/** Whether this header's value is a credential that must not be displayed. */
function isSecretHeader(key) {
  return SECRET_HEADERS.indexOf(String(key || '').toLowerCase()) !== -1;
}

/**
 * A header block safe to put in a report, a log line or an exported file.
 *
 * @param {string} text raw "Key: value" lines
 * @returns {string} the same block with credential values replaced
 */
function maskHeaders(text) {
  return parseHeaders(text)
    .map((h) => `${h.key}: ${isSecretHeader(h.key) ? '****' : h.value}`)
    .join('\n');
}

/**
 * Read a dotted/bracketed path out of a parsed JSON body.
 *
 * Supports `a.b`, `a[0].b` and a bare `[0]` at the root, which covers what a
 * recorded assertion actually needs. Deliberately not JSONPath: a filter
 * expression would need a parser and an evaluator here, in the generated spec,
 * and in the head of anyone reading a failure — and no recording has wanted it.
 *
 * Returns undefined for any path that does not resolve, including one that
 * walks through a null — the caller distinguishes "absent" from "present and
 * falsy" via the `exists` operator rather than by inspecting this.
 *
 * @param {*} json parsed body
 * @param {string} path e.g. 'data.items[0].id'
 * @returns {*} the value, or undefined
 */
function getPath(json, path) {
  const raw = String(path == null ? '' : path).trim();
  if (!raw) return json;
  const parts = raw
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter((p) => p !== '');
  let cur = json;
  for (let i = 0; i < parts.length; i += 1) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[parts[i]];
  }
  return cur;
}

// How a value reads in a failure message. Objects are JSON so that a mismatch
// on a nested field shows the shape that arrived rather than "[object Object]",
// which tells the reader nothing about what to fix.
function show(v) {
  if (v === undefined) return '(absent)';
  if (v === null) return 'null';
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v);
    } catch (err) {
      return String(v);
    }
  }
  return String(v);
}

// Loose equality on purpose. Everything typed into the assertion box arrives as
// a string, while a JSON body holds real numbers and booleans — comparing them
// strictly would fail `status equals 200` for every recording ever made. So
// both sides are compared as text, with a numeric fast path so that "200" and
// 200 agree and so do "1.0" and 1.
function looseEq(actual, expected) {
  if (actual === expected) return true;
  const a = Number(actual);
  const b = Number(expected);
  if (
    !Number.isNaN(a) &&
    !Number.isNaN(b) &&
    String(actual).trim() !== '' &&
    String(expected).trim() !== ''
  ) {
    return a === b;
  }
  return String(actual) === String(expected);
}

/**
 * Apply one operator. Exported so the recorder can preview an assertion against
 * the last response without re-sending the request.
 *
 * @param {string} op one of OPS
 * @param {*} actual the value the response produced
 * @param {*} expected the recorded comparison value
 * @returns {boolean}
 */
function applyOp(op, actual, expected) {
  switch (op) {
    case 'eq':
      return looseEq(actual, expected);
    case 'ne':
      return !looseEq(actual, expected);
    case 'contains':
      return String(actual == null ? '' : show(actual)).indexOf(String(expected)) !== -1;
    case 'matches':
      try {
        return new RegExp(String(expected)).test(String(actual == null ? '' : actual));
      } catch (err) {
        // An invalid regex is the author's mistake, not the app's. Failing the
        // assertion with the reason beats throwing out of the whole run.
        return false;
      }
    case 'exists':
      return actual !== undefined && actual !== null;
    case 'empty':
      return (
        actual === undefined ||
        actual === null ||
        String(actual) === '' ||
        (Array.isArray(actual) && actual.length === 0)
      );
    case 'lt':
      return Number(actual) < Number(expected);
    case 'gt':
      return Number(actual) > Number(expected);
    default:
      return false;
  }
}

// The value one assertion looks at, pulled from the neutral summary.
function actualFor(assertion, res) {
  switch (assertion.type) {
    case 'status':
      return res.status;
    case 'jsonPath':
      return getPath(res.json, assertion.path);
    case 'header': {
      // HTTP header names are case-insensitive and engines disagree about the
      // case they hand back, so look it up folded rather than trusting either.
      const want = String(assertion.path || '').toLowerCase();
      const headers = res.headers || {};
      const hit = Object.keys(headers).find((k) => k.toLowerCase() === want);
      return hit === undefined ? undefined : headers[hit];
    }
    case 'bodyContains':
      return res.body;
    case 'responseTime':
      return res.ms;
    default:
      return undefined;
  }
}

/** A human sentence for one assertion, used in the runner list and the report. */
function describeAssert(assertion) {
  const type = ASSERT_TYPES.find((t) => t.id === assertion.type);
  const op = OPS.find((o) => o.id === assertion.op);
  const subject =
    type && type.needsPath
      ? `${type.label} ${assertion.path}`
      : type
        ? type.label
        : assertion.type;
  const verb = op ? op.label : assertion.op;
  const needsValue = assertion.op !== 'exists' && assertion.op !== 'empty';
  return needsValue ? `${subject} ${verb} ${show(assertion.expected)}` : `${subject} ${verb}`;
}

/**
 * Decide whether a response satisfies a step's assertions.
 *
 * This is the one place that decision is made. Both engines call it with the
 * same neutral summary so that a step cannot pass in the recorder and fail in
 * CI for any reason other than the app itself behaving differently.
 *
 * The summary every caller must build:
 *   { status: number, statusText: string, headers: Object<string,string>,
 *     body: string, json: *|undefined, ms: number }
 * `json` is undefined when the body was not JSON — which is itself assertable,
 * because a jsonPath check against a non-JSON body then reports "(absent)"
 * rather than throwing.
 *
 * A step with no assertions passes as long as the request itself completed.
 * That is intentional: the first thing anyone records is the call, and a step
 * that failed merely for not having been finished yet would make the recorder
 * unusable mid-authoring.
 *
 * @param {object} step the API step
 * @param {object} res the neutral response summary
 * @returns {{ok: boolean, results: Array<{ok: boolean, text: string, detail: string}>}}
 */
function evaluate(step, res) {
  const list = Array.isArray(step && step.asserts) ? step.asserts : [];
  const results = list.map((assertion) => {
    const actual = actualFor(assertion, res);
    const ok = applyOp(assertion.op, actual, assertion.expected);
    return {
      ok: ok,
      text: describeAssert(assertion),
      detail: ok ? '' : `expected ${describeAssert(assertion)}, got ${show(actual)}`,
    };
  });
  return { ok: results.every((r) => r.ok), results: results };
}

/**
 * Pull named values out of a response so later steps can use them as {{refs}}.
 *
 * This is what makes a suite rather than a pile of calls: sign in, take the
 * token, send it as a header on everything after. The names land in the same
 * reference namespace as the test data set, so `{{token}}` in a later step's
 * header block resolves with no further wiring.
 *
 * Absent values are recorded as '' rather than skipped. A later step that
 * refers to a failed extraction then sends an empty header and fails its own
 * assertion, which points at the real problem — whereas a missing key would
 * leave the literal text "{{token}}" on the wire and produce a puzzling 401
 * about a malformed credential.
 *
 * @param {object} step the API step
 * @param {object} res the neutral response summary
 * @returns {Object<string,string>} extracted name -> value
 */
function extractFrom(step, res) {
  const out = {};
  const list = Array.isArray(step && step.extract) ? step.extract : [];
  list.forEach((rule) => {
    const name = String(rule && rule.name ? rule.name : '').trim();
    if (!name) return;
    let value;
    if (rule.from === 'status') value = res.status;
    else if (rule.from === 'header') value = actualFor({ type: 'header', path: rule.path }, res);
    else if (rule.from === 'body') value = res.body;
    else value = getPath(res.json, rule.path);
    out[name] =
      value === undefined || value === null
        ? ''
        : typeof value === 'object'
          ? show(value)
          : String(value);
  });
  return out;
}

/** One-line summary, matching the style of the recorder's other step rows. */
function describeApi(step) {
  const src = step || {};
  const n = Array.isArray(src.asserts) ? src.asserts.length : 0;
  const checks = n ? ` · ${n} check${n === 1 ? '' : 's'}` : '';
  return `${String(src.method || 'GET').toUpperCase()} ${src.url || ''}${checks}`;
}

/**
 * Fill in everything a partially-specified step leaves out.
 *
 * Called on the way in from the recorder, from an imported workspace and from
 * the spec generator, so that every reader downstream can assume the shape.
 * Hand-edited exports are the reason this is defensive: `method` arrives
 * lowercase, `asserts` arrives as null, and a reader that trusted either would
 * throw inside the run loop.
 *
 * @param {object} raw a possibly-incomplete API step
 * @returns {object} a complete one
 */
function normalize(raw) {
  const src = raw || {};
  const method =
    METHODS.indexOf(String(src.method || '').toUpperCase()) !== -1
      ? String(src.method).toUpperCase()
      : 'GET';
  const step = {
    action: 'api',
    method: method,
    url: String(src.url == null ? '' : src.url),
    headersText: String(src.headersText == null ? '' : src.headersText),
    // Dropped rather than carried for a method that cannot send it, so the
    // step's own display and the generated spec agree with what goes on the
    // wire.
    body: BODYLESS.indexOf(method) !== -1 ? '' : String(src.body == null ? '' : src.body),
    asserts: Array.isArray(src.asserts) ? src.asserts.filter((a) => a && a.type && a.op) : [],
    extract: Array.isArray(src.extract) ? src.extract.filter((e) => e && e.name) : [],
  };
  step.label = src.label ? String(src.label) : describeApi(step);
  return step;
}

/**
 * Every authored string an API step keeps outside its flat fields.
 *
 * testdata.TEXT_FIELDS finds references in `url`, `headersText` and `body`
 * because those are plain properties. An assertion comparing against a data-set
 * value, and an extraction whose path is parameterised, live inside arrays that
 * a field-name scanner cannot see into — so without this they would resolve at
 * run time (resolveApiStep does that) but be invisible to everything that
 * *reasons* about references beforehand: the pre-run audit that warns about a
 * missing key, and the export's decision about which DATA columns to emit.
 *
 * The effect of the gap was narrow but bad in a specific way — a check written
 * against {{expectedTotal}} with no such key in the set would not be reported as
 * missing, and would instead fail at run time comparing against the literal text
 * "{{expectedTotal}}". This closes it.
 *
 * @param {object} step any step; a non-API one has none of these
 * @returns {Array<string>} the strings, in the order they are authored
 */
function apiTexts(step) {
  if (!step || step.action !== 'api') return [];
  const out = [];
  const push = (v) => {
    if (typeof v === 'string' && v !== '') out.push(v);
  };
  (Array.isArray(step.asserts) ? step.asserts : []).forEach((a) => {
    if (!a) return;
    push(a.expected);
    push(a.path);
  });
  (Array.isArray(step.extract) ? step.extract : []).forEach((e) => {
    if (!e) return;
    push(e.path);
  });
  return out;
}

/**
 * A copy of the step with {{refs}} resolved everywhere they can appear.
 *
 * testdata.resolveStep already covers the flat string fields — that is what
 * listing headersText and body in TEXT_FIELDS buys. This covers the two nested
 * places it cannot reach: an assertion comparing against a data-set value, and
 * an extraction whose path is itself parameterised.
 *
 * @param {object} step the API step
 * @param {{text: function(string): string}} resolver from testdata.makeResolver
 * @returns {object} the step with references resolved
 */
function resolveApiStep(step, resolver) {
  if (!step || !resolver || step.action !== 'api') return step;
  const text = (v) => (typeof v === 'string' ? resolver.text(v) : v);
  const out = Object.assign({}, step);
  out.asserts = (Array.isArray(step.asserts) ? step.asserts : []).map((a) =>
    Object.assign({}, a, { expected: text(a.expected), path: text(a.path) }),
  );
  out.extract = (Array.isArray(step.extract) ? step.extract : []).map((e) =>
    Object.assign({}, e, { path: text(e.path) }),
  );
  return out;
}

/**
 * Build the neutral summary from a raw body string and the parts every
 * transport already has. Keeps the "is this JSON?" rule in one place — both
 * engines would otherwise each decide it, and they would decide it differently
 * the first time a server answered JSON with a text/plain content type.
 *
 * The body is parsed on its own merits rather than on the content type for
 * exactly that reason: a mislabelled body is common, and refusing to look
 * inside it would make every jsonPath assertion against that server impossible.
 *
 * @param {{status: number, statusText: string, headers: object, body: string, ms: number}} parts
 * @returns {object} the summary `evaluate` and `extractFrom` expect
 */
function summarize(parts) {
  const body = String(parts && parts.body != null ? parts.body : '');
  let json;
  try {
    json = body === '' ? undefined : JSON.parse(body);
  } catch (err) {
    json = undefined;
  }
  return {
    status: Number(parts && parts.status) || 0,
    statusText: String(parts && parts.statusText ? parts.statusText : ''),
    headers: (parts && parts.headers) || {},
    body: body,
    json: json,
    ms: Number(parts && parts.ms) || 0,
  };
}

module.exports = {
  METHODS,
  BODYLESS,
  ASSERT_TYPES,
  OPS,
  apiTexts,
  applyOp,
  describeApi,
  describeAssert,
  evaluate,
  extractFrom,
  getPath,
  headersObject,
  isSecretHeader,
  maskHeaders,
  normalize,
  parseHeaders,
  resolveApiStep,
  summarize,
};
