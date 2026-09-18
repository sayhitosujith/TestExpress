// The Qase REST client. Its only job is to talk to api.qase.io — it knows
// nothing about how a case was written, so the same client serves an
// AI-generated case, a hand-written one, and anything added later.
//
// This is the reason the token lives here rather than in the browser: a Qase
// API token is a full-write credential for every project in the account, and
// REACT_APP_* variables are compiled into the JavaScript bundle. The frontend
// talks to routes/qase.js, which talks to this.
//
// No SDK: Node 22 ships fetch, and four endpoints do not justify a dependency.

const { severityInt, priorityInt, behaviorInt } = require('./qaseFields');

const BASE = 'https://api.qase.io/v1';

// Qase caps paged endpoints at 100 per page. Projects and suites are pulled to
// fill two dropdowns, so one page each is the right trade — an account with
// more than 100 suites in one project types the id instead.
const PAGE = 100;

/** Whether a token is present. Checked before every call so an unconfigured install can say so. */
const isConfigured = () => Boolean(process.env.QASE_API_TOKEN);

/**
 * One Qase request. Throws an Error whose message is Qase's own, because the
 * useful failures here — bad token, unknown project code, suite in another
 * project — are all things Qase words better than a generic 502 would.
 */
async function call(path, { method = 'GET', body, params } = {}) {
  if (!isConfigured()) throw new Error('QASE_API_TOKEN is not set');

  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  }

  const res = await fetch(url, {
    method,
    headers: {
      Token: process.env.QASE_API_TOKEN,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  // Qase answers errors as JSON, but a proxy or an outage can answer HTML —
  // parsing defensively keeps "Unexpected token <" out of the UI.
  const text = await res.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = null;
  }

  if (!res.ok || (payload && payload.status === false)) {
    const reason =
      (payload && (payload.errorMessage || payload.error || payload.message)) ||
      `Qase answered ${res.status}`;
    throw new Error(reason);
  }
  return payload ? payload.result : null;
}

/** Projects the token can see, as {code, title} — code is what every other call takes. */
async function listProjects() {
  const result = await call('/project', { params: { limit: PAGE } });
  return (result?.entities || []).map((p) => ({ code: p.code, title: p.title }));
}

/** Suites in one project. parentId is kept so the UI can show nesting. */
async function listSuites(code) {
  const result = await call(`/suite/${encodeURIComponent(code)}`, { params: { limit: PAGE } });
  return (result?.entities || []).map((s) => ({
    id: s.id,
    title: s.title,
    parentId: s.parent_id ?? null,
    casesCount: s.cases_count ?? 0,
  }));
}

/** Creates a suite and returns its id, so a story can land somewhere named after it. */
async function createSuite(code, title, description) {
  const result = await call(`/suite/${encodeURIComponent(code)}`, {
    method: 'POST',
    body: { title, description },
  });
  return result?.id;
}

/**
 * Translates one generated case into Qase's wire shape.
 *
 * Only fields with a confirmed meaning are sent — see the caveat in
 * qaseFields.js. Anything undefined is omitted rather than nulled, so Qase
 * applies its own default instead of being told "no value".
 */
function toQaseCase(c, suiteId) {
  const steps = (c.steps || []).map((s, i) => ({
    position: i + 1,
    action: s.action || '',
    expected_result: s.expected_result || '',
    ...(s.data ? { data: s.data } : {}),
  }));

  const out = {
    // Qase rejects titles over 255 characters, and a generated title that long
    // is a symptom of a bad story rather than something to fail the push over.
    title: String(c.title || 'Untitled case').slice(0, 255),
    severity: severityInt(c.severity),
    priority: priorityInt(c.priority),
    behavior: behaviorInt(c.behavior),
    steps_type: 'classic',
    steps,
  };
  if (c.description) out.description = c.description;
  if (c.preconditions) out.preconditions = c.preconditions;
  if (c.postconditions) out.postconditions = c.postconditions;
  if (Array.isArray(c.tags) && c.tags.length) out.tags = c.tags;
  if (suiteId) out.suite_id = Number(suiteId);

  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return out;
}

/**
 * Bulk-creates cases and returns the new Qase ids.
 *
 * One request for the whole batch rather than one per case: Qase's bulk
 * endpoint either accepts the batch or rejects it, which is the behaviour you
 * want when a suite is being created from a single story — a partial suite is
 * worse than none, because the missing halves are invisible.
 */
async function bulkCreateCases(code, cases, suiteId) {
  const result = await call(`/case/${encodeURIComponent(code)}/bulk`, {
    method: 'POST',
    body: { cases: cases.map((c) => toQaseCase(c, suiteId)) },
  });
  return result?.ids || [];
}

module.exports = {
  isConfigured,
  listProjects,
  listSuites,
  createSuite,
  bulkCreateCases,
  toQaseCase,
};
