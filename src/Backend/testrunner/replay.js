'use strict';

// Server-side playback of a recorded step against a real Playwright page.
//
// Mirrors runStep() in src/TestRunner.jsx so a test behaves the same whichever
// engine runs it. Two differences are deliberate:
//   * Actionability, stability and retry-on-stale are Playwright's job here —
//     its locators already wait for attached/visible/enabled/stable before
//     acting, which is exactly what the  engine hand-rolls.
//   * Assertions are polled here rather than using @playwright/test's expect(),
//     so the backend needs only the `playwright` package, not the test runner.

// Self-healing loosens a recording's own selectors when every one of them has
// gone stale. Shared with the  engine so a test heals identically
// whichever one replays it — see src/testrunner/selfHeal.js for the rules.
const { VIA_TEXT, describeHeal, healCandidates } = require('../../testrunner/selfHeal');

// The REST step. Only the transport is this file's business — the model, the
// operators and the pass/fail decision are shared with the  engine and
// with the Playwright export, so that a check cannot mean one thing here and
// another in CI.
const apiStep = require('../../testrunner/apiStep');

const DEFAULT_TIMEOUT = 5000;
const ASSERT_TIMEOUT = 10000;
// Same deliberate post-action pauses as the  engine, so step timings and
// "did the save land?" behaviour match between engines.
const SAVE_HOLD_MS = 30_000;
const UPLOAD_HOLD_MS = 10_000;
const SAVE_HOLD_PATTERN = /\bsaves?\b/i;

const holdMsFor = (st) => {
  if (st.action === 'upload') return UPLOAD_HOLD_MS;
  return (st.action === 'click' || st.action === 'check') &&
    SAVE_HOLD_PATTERN.test(`${st.label || ''} ${st.text || ''}`)
    ? SAVE_HOLD_MS
    : 0;
};

const normText = (s) => (s || '').trim().replace(/\s+/g, ' ');

// A step's url is either a path (portable — resolved against the session's base)
// or a full address recorded on another origin.
const isAbsolute = (u) => /^https?:\/\//i.test(String(u || ''));
function resolveUrl(url, baseUrl) {
  if (!url) return baseUrl;
  if (isAbsolute(url)) return url;
  try {
    return new URL(url, baseUrl).href;
  } catch {
    return url;
  }
}

// Tests recorded before locators carried `text` still hold the element's text in
// the fields the UI labels with, so old recordings get the fallback too.
function fallbackText(st) {
  if (st.text) return st.text;
  if (st.action === 'assert' && st.assertType === 'text') return st.expected;
  if ((st.action === 'click' || st.action === 'check') && st.label) return st.label;
  return null;
}

function locatorSummary(st) {
  const list = (st.selectors && st.selectors.length ? st.selectors : [st.selector]).filter(Boolean);
  const tried = list.join('  |  ') || '(no selector recorded)';
  const text = fallbackText(st);
  return text ? `${tried}  |  text "${text}"` : tried;
}

// Candidate locators in recorded order — stable attributes first, structure
// last, then the element's original text. Text is often the most durable thing
// about a button, which is what rescues a recording after a markup reshuffle.
function candidates(page, st) {
  const list = (st.selectors && st.selectors.length ? st.selectors : [st.selector]).filter(Boolean);
  const out = list.map((sel) => ({ how: sel, loc: page.locator(sel).first() }));
  const text = fallbackText(st);
  if (text) {
    // Reaching this far means every recorded selector is already dead, so a
    // match here is a rescue and is reported and repaired as one — not left to
    // quietly carry the step until the copy changes too.
    if (st.tag && st.tag !== '*') {
      try {
        out.push({
          how: `<${st.tag}> containing "${text}"`,
          heal: VIA_TEXT,
          loc: page.locator(st.tag, { hasText: text }).first(),
        });
      } catch {
        /* invalid tag — skip */
      }
    }
    out.push({
      how: `text "${text}"`,
      heal: VIA_TEXT,
      loc: page.getByText(text, { exact: false }).first(),
    });
  }
  return out;
}

// First candidate that matches anything, polled until the budget runs out.
async function firstMatch(page, st, timeout) {
  const cands = candidates(page, st);
  if (!cands.length) return null;
  const end = Date.now() + timeout;
  for (;;) {
    for (const c of cands) {
      try {
        if ((await c.loc.count()) > 0) return c;
      } catch {
        /* selector no longer parses, or navigation mid-check — try the next */
      }
    }
    if (Date.now() >= end) return null;
    await page.waitForTimeout(120);
  }
}

// Loosened selectors, tried only once every recorded one and the text fallback
// have failed. A candidate is accepted only when it matches EXACTLY ONE
// element: a loosened selector is broader than the one that failed, and one
// matching nine elements would act on the wrong one and call the run green.
async function healMatch(page, st) {
  for (const cand of healCandidates(st)) {
    try {
      const loc = page.locator(cand.selector);
      if ((await loc.count()) === 1) return { how: cand.selector, heal: cand.id, why: cand.why, loc };
    } catch {
      /* loosening produced something Playwright will not parse — try the next */
    }
  }
  return null;
}

// What a heal writes back: not the loosened guess that found the element, but
// a locator bundle re-derived from the element itself by the very code that
// records one — so a repaired step is indistinguishable from a freshly
// recorded one, and is verified against the live DOM in the same way.
async function repairFrom(loc, st, cand) {
  const fresh = await loc
    .evaluate((el) => (typeof window.__trLocator === 'function' ? window.__trLocator(el) : null))
    .catch(() => null);
  if (!fresh || !fresh.selectors || !fresh.selectors.length) return null;
  return {
    via: cand.heal,
    why: describeHeal({ via: cand.heal, why: cand.why, selector: cand.how }),
    from: st.selector || null,
    to: fresh.selectors[0],
    selector: fresh.selectors[0],
    selectors: fresh.selectors,
    tag: fresh.tag,
    text: fresh.text,
  };
}

// Record the repair on the step's heal slot, when the match was a rescue.
// `heal` is the per-step holder runStep passes down; without one (or with
// healing switched off by the client) a rescue still runs the step, it is just
// not written back.
async function noteHeal(heal, cand, st) {
  if (!heal || !heal.enabled || heal.repair || !cand.heal) return;
  heal.repair = await repairFrom(cand.loc, st, cand);
}

async function requireMatch(page, st, timeout, heal) {
  const found =
    (await firstMatch(page, st, timeout)) ||
    (heal && heal.enabled ? await healMatch(page, st) : null);
  if (!found) {
    // "Not found" has two very different causes: the element moved, or the data
    // the step expects was never rendered. Saying which turns a dead end into a
    // lead — the same diagnosis the  engine gives.
    const text = fallbackText(st);
    let why = `on ${page.url()}`;
    if (text) {
      const body = normText(await page.textContent('body').catch(() => '')).toLowerCase();
      why += body.includes(normText(text).toLowerCase())
        ? ' — the text IS on the page, so the element moved; re-record this step'
        : ` — "${text}" appears nowhere on the page, so the expected data was never rendered`;
    }
    throw new Error(`no element matched ${why}\ntried ${locatorSummary(st)}`);
  }
  await noteHeal(heal, found, st);
  return found.loc;
}

// Does this element satisfy the step? Null when it does, the reason when it
// does not — factored out so the same comparison judges the recorded locator
// and, if it comes to it, a healed one.
async function assertAgainst(loc, st) {
  try {
    if (st.assertType === 'exists') {
      return (await loc.isVisible()) ? null : `element found but never became visible — ${locatorSummary(st)}`;
    }
    const actual =
      st.assertType === 'value' ? await loc.inputValue() : normText(await loc.textContent());
    return String(actual).includes(st.expected || '')
      ? null
      : `expected "${st.expected}", got "${String(actual).slice(0, 60)}"`;
  } catch (err) {
    return err.message;
  }
}

async function assertStep(page, st, timeout, heal) {
  const end = Date.now() + timeout;
  let last = `no element matched — tried ${locatorSummary(st)}`;
  let everMatched = false;
  for (;;) {
    const found = await firstMatch(page, st, 250);
    if (found) {
      everMatched = true;
      const why = await assertAgainst(found.loc, st);
      if (!why) {
        await noteHeal(heal, found, st);
        return;
      }
      last = why;
    }
    if (Date.now() >= end) {
      // Heal only when NOTHING ever matched. An element that WAS found and
      // holds the wrong text is a real failure — the comparison is the whole
      // point of the step, and satisfying it with some other element is the
      // one thing a self-healing runner must never do.
      if (!everMatched && heal && heal.enabled && !heal.repair) {
        const fix = await healMatch(page, st);
        if (fix && !(await assertAgainst(fix.loc, st))) {
          await noteHeal(heal, fix, st);
          return;
        }
      }
      throw new Error(last);
    }
    await page.waitForTimeout(150);
  }
}

function fileArg(st) {
  const buffer = st.dataUrl
    ? Buffer.from(String(st.dataUrl).split(',')[1] || '', 'base64')
    : // No inlined content (too big to store, or a legacy `fill` step): a
      // same-name placeholder still exercises the app's upload handler.
      Buffer.alloc(Math.min(Math.max(Number(st.size) || 0, 1), 4096));
  return {
    name: st.name || 'upload.bin',
    mimeType: st.mime || 'application/octet-stream',
    buffer,
  };
}

// Run one step. `session` carries the implicit-wait budget across steps, exactly
// as implicitRef does in the  engine. Returns { holdMs } so the report can
// separate deliberate waiting from the app's real response time.
/**
 * Send a recorded REST call and judge the response.
 *
 * The step arrives with its {{refs}} already resolved — the client owns the
 * data set and the resolver, exactly as it does for a `fill`. What it cannot
 * know in advance are the values this call produces, so they are extracted here
 * and handed back in the result for the client to merge into the resolver it
 * uses for the steps that follow. Keeping that state on the client rather than
 * on the session is deliberate: a run is already restartable and reorderable
 * there, and a server-side copy of the variables would be a second source of
 * truth that survives a step being deleted.
 *
 * A failed assertion throws, so the route reports it the same way it reports a
 * failed `assert` and the run stops where a tester expects it to.
 *
 * @param {import('playwright').Page} page the session's page
 * @param {object} st the API step
 * @param {object} session the replay session
 * @param {number} timeout the current implicit-wait budget, in ms
 * @returns {Promise<{holdMs: number, api: object}>}
 */
async function apiRequestStep(page, st, session, timeout) {
  const step = apiStep.normalize(st);
  const url = resolveUrl(step.url, session.baseUrl);
  const options = {
    method: step.method,
    headers: apiStep.headersObject(step.headersText),
    // Failures are the step's to report, not the transport's: without this a
    // 500 would throw out of fetch() as a protocol error and lose the body,
    // when asserting on a 500 is a perfectly ordinary thing to want to do.
    failOnStatusCode: false,
    // An API call that hangs should fail on the same budget an element lookup
    // would, rather than on Playwright's much longer default.
    timeout: Math.max(1000, timeout),
  };
  // Sent as the recorded bytes rather than a re-serialised object — key order
  // and whitespace are part of what was tested, and a deliberately malformed
  // payload has to survive the trip.
  if (step.body) options.data = step.body;

  const t0 = Date.now();
  let response;
  try {
    response = await page.request.fetch(url, options);
  } catch (err) {
    // Connection refused, DNS failure, timeout. Name the address: the usual
    // cause is a relative URL resolved against the wrong base, and the resolved
    // one is the fact that identifies it.
    throw new Error(`${step.method} ${url} could not be sent — ${err.message}`);
  }
  const body = await response.text();
  const summary = apiStep.summarize({
    status: response.status(),
    statusText: response.statusText(),
    headers: response.headers(),
    body: body,
    ms: Date.now() - t0,
  });

  const verdict = apiStep.evaluate(step, summary);
  const extracted = apiStep.extractFrom(step, summary);
  const meta = {
    holdMs: 0,
    api: {
      method: step.method,
      url: url,
      status: summary.status,
      statusText: summary.statusText,
      ms: summary.ms,
      ok: verdict.ok,
      results: verdict.results,
      extracted: extracted,
      // Capped: a response body is unbounded and this rides back on every step
      // of every run, into the report and the session log. The first part is
      // what a failure is diagnosed from; the rest is weight.
      bodyPreview: body.length > 2000 ? `${body.slice(0, 2000)}…` : body,
    },
  };

  if (!verdict.ok) {
    const failed = verdict.results.filter((r) => !r.ok);
    const err = new Error(
      `${step.method} ${url} returned ${summary.status} — ` +
        failed.map((r) => r.detail).join('; '),
    );
    // Carried on the error so the route can report the response alongside the
    // failure. Without it a failed assertion would lose the body that explains
    // why, which is the first thing anyone asks for.
    err.api = meta.api;
    throw err;
  }
  return meta;
}

async function runStep(page, st, session, onHold) {
  const timeout = session.implicit || DEFAULT_TIMEOUT;
  // Where a rescued lookup leaves its repair, read once at the end of the
  // step. Healing is the client's preference rather than this engine's
  // policy, so it arrives with the run; an older client that says nothing
  // gets the same default the  engine has.
  const heal = { enabled: session.selfHeal !== false };

  switch (st.action) {
    case 'navigate':
      await page.goto(resolveUrl(st.url, session.baseUrl), { waitUntil: 'domcontentloaded' });
      return { holdMs: 0 };

    case 'implicitWait':
      // Re-budgets auto-waiting for everything after it; does not pause.
      session.implicit = Math.max(250, Number(st.ms) || DEFAULT_TIMEOUT);
      return { holdMs: 0 };

    case 'wait': {
      const ms = Math.max(0, Number(st.ms) || 0);
      if (onHold) await onHold(ms, st.label || 'wait');
      else await page.waitForTimeout(ms);
      return { holdMs: ms };
    }

    case 'scroll':
      await page.mouse.wheel(0, (Number(st.amount) || 500) * (st.direction === 'up' ? -1 : 1));
      await page.waitForTimeout(150);
      return { holdMs: 0 };

    // Reload the page as it stands. Not a goto: a reload keeps the address —
    // query string included — and the point of the step is to prove that what
    // the previous one saved survived a round trip to the server.
    case 'reload':
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      return { holdMs: 0 };

    // A REST call, driven through the page's own request context rather than a
    // standalone one. That is what makes it share the browser's cookie jar: a
    // call made after a UI sign-in is already authenticated, and a session
    // established by an API step is visible to the UI steps after it. The
    // generated Playwright uses page.request for the same reason, so the two
    // agree about what "signed in" means.
    case 'api':
      return apiRequestStep(page, st, session, timeout);

    case 'assert':
      await assertStep(page, st, Math.max(ASSERT_TIMEOUT, timeout), heal);
      return { holdMs: 0, healed: heal.repair || null };

    default:
      break;
  }

  // Everything below acts on an element. A step recorded on another page means
  // the previous step navigated there; give client-side routing a moment to land
  // before forcing a reload, which would throw away in-memory state the previous
  // action just created.
  if (st.url) {
    const want = resolveUrl(st.url, session.baseUrl);
    if (page.url() !== want) {
      await page
        .waitForURL(want, { timeout: 3000, waitUntil: 'domcontentloaded' })
        .catch(async () => {
          await page.goto(want, { waitUntil: 'domcontentloaded' });
        });
    }
  }

  switch (st.action) {
    case 'upload': {
      // Uploads only wait for the input to exist: file inputs are very often
      // visually hidden behind a styled label, so a visibility check would
      // reject a perfectly working target.
      const loc = await requireMatch(page, st, timeout, heal);
      await loc.setInputFiles(fileArg(st), { timeout });
      break;
    }
    case 'fill': {
      const loc = await requireMatch(page, st, timeout, heal);
      // Legacy `fill` steps on a file input carry a "C:\fakepath\…" value the
      // browser refuses to take back — replay them as an upload instead.
      const isFile = await loc
        .evaluate((el) => el.tagName === 'INPUT' && el.type === 'file')
        .catch(() => false);
      if (isFile) {
        const name = String(st.value || '').split(/[\\/]/).pop();
        await loc.setInputFiles(fileArg({ name }), { timeout });
      } else {
        await loc.fill(String(st.value ?? ''), { timeout });
      }
      break;
    }
    case 'select': {
      const loc = await requireMatch(page, st, timeout, heal);
      await loc.selectOption(String(st.value ?? ''), { timeout });
      break;
    }
    case 'check': {
      const loc = await requireMatch(page, st, timeout, heal);
      await loc.setChecked(!!st.value, { timeout });
      break;
    }
    case 'click': {
      const loc = await requireMatch(page, st, timeout, heal);
      await loc.click({ timeout });
      break;
    }
    // A real pointer move, so unlike the  engine this also makes the CSS
    // :hover pseudo-class match — a menu that opens in pure CSS opens here.
    case 'hover': {
      const loc = await requireMatch(page, st, timeout, heal);
      await loc.hover({ timeout });
      break;
    }
    default:
      throw new Error(`unsupported step: ${st.action}`);
  }

  // Let the consequences finish — the request, the state update, the re-render,
  // any route change — before the next step looks at the page.
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});

  const hold = holdMsFor(st);
  if (hold) {
    if (onHold) await onHold(hold, st.label || 'save');
    else await page.waitForTimeout(hold);
  }
  return { holdMs: hold, healed: heal.repair || null };
}

module.exports = { runStep, resolveUrl, isAbsolute, holdMsFor };
