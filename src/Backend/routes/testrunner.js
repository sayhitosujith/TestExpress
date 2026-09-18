'use strict';

// Real-browser engine for TestExpress.
//
// The  engine drives the app through an <iframe> and reads
// iframe.contentDocument, which the same-origin policy limits to this origin —
// and most external sites refuse to be framed at all. This router runs the same
// recorded steps against a real Playwright browser instead, so any URL on any
// origin can be recorded and replayed.
//
// The step schema is unchanged. A test recorded here replays in the browser
// engine and vice versa; the existing Playwright export still describes both.

const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const { installRecorder } = require('../testrunner/recorder');
const { runStep, resolveUrl } = require('../testrunner/replay');

const router = express.Router();

// Playwright is a heavy optional dependency. Requiring it at module scope would
// take the whole backend down on a checkout where `npm install` has not run yet,
// so resolve it lazily and answer with the fix instead of a stack trace.
let playwright = null;
let playwrightError = null;
function getPlaywright() {
  if (playwright) return playwright;
  if (playwrightError) throw playwrightError;
  try {
    playwright = require('playwright');
    return playwright;
  } catch (err) {
    playwrightError = new Error(
      'Playwright is not installed. From the project root run:\n' +
        '  npm --prefix src/Backend install playwright\n' +
        '  npx playwright install            (all three engines)\n' +
        '  npx playwright install chromium   (or just one)',
    );
    playwrightError.status = 501;
    throw playwrightError;
  }
}

const VIEWPORT = { width: 1280, height: 720 };
// A recording session is idle whenever nobody is polling it. Chromium is far too
// expensive to leak, so an abandoned tab must not keep one alive indefinitely.
const IDLE_TIMEOUT_MS = 10 * 60 * 1000;
const REAP_INTERVAL_MS = 60 * 1000;
// Cap the step buffer: a runaway page firing input events must not grow the
// server's memory without bound.
const MAX_BUFFERED_STEPS = 2000;

// ---- browsers -------------------------------------------------------------
// The three engines Playwright drives. This is the whole point of the real
// browser engine over the  one: the  engine can only ever be the
// browser you are already sitting in, so "does this work in Safari" is a
// question it cannot answer. WebKit is what powers Safari and Firefox is Gecko,
// so a recording can be run against all three renderers from here.
const BROWSERS = [
  { id: 'chromium', name: 'Chromium', engine: 'Blink — Chrome, Edge' },
  { id: 'firefox', name: 'Firefox', engine: 'Gecko' },
  { id: 'webkit', name: 'WebKit', engine: 'WebKit — Safari' },
];
const DEFAULT_BROWSER = 'chromium';
const browserId = (raw) =>
  BROWSERS.some((b) => b.id === raw) ? raw : DEFAULT_BROWSER;

// ---- devices --------------------------------------------------------------
// A device is a second, independent axis from the engine: the same recording
// can run as desktop Chromium or as a Pixel, and the phone descriptors are
// Playwright's own (viewport, device pixel ratio, user agent, touch support),
// so a layout that only breaks at a phone's width and DPR breaks here too.
//
// This is real emulation, not a narrow window. `hasTouch` in particular changes
// which events the app receives, and a UI that listens for click but not touch
// is exactly the kind of thing a resized desktop window would pass and a real
// phone would fail.
const DEVICES = [
  { id: 'desktop', name: 'Desktop', playwright: null, engines: ['chromium', 'firefox', 'webkit'] },
  { id: 'iphone', name: 'iPhone 14', playwright: 'iPhone 14', engines: ['webkit', 'chromium'] },
  { id: 'pixel', name: 'Pixel 7', playwright: 'Pixel 7', engines: ['chromium'] },
  { id: 'ipad', name: 'iPad (gen 7)', playwright: 'iPad (gen 7)', engines: ['webkit', 'chromium'] },
];
const DEFAULT_DEVICE = 'desktop';
const deviceById = (raw) =>
  DEVICES.find((d) => d.id === raw) || DEVICES.find((d) => d.id === DEFAULT_DEVICE);

/**
 * Context options for an (engine, device) pair.
 *
 * Firefox is the constraint: Playwright refuses `isMobile` on Gecko and throws
 * on newContext. Rather than fail the run, fall back to the device's viewport
 * alone and report the downgrade, so "run my phone test in Firefox" gets the
 * right size with an honest note instead of an error.
 */
function contextOptions(engineId, deviceId) {
  const device = deviceById(deviceId);
  // Capture at twice the CSS resolution. The layout viewport is untouched — the
  // page still lays out at exactly VIEWPORT css pixels, so what a step sees and
  // how it replays is bit-for-bit the same — but each frame carries 4x the
  // pixels. That is what lets the recorder pane show the page at the size of a
  // large monitor: it is then downscaling a sharp image rather than blowing up a
  // 1280-wide JPEG. Device descriptors spread in after this and keep their own
  // deviceScaleFactor, which is correct — a phone's DPR is part of the emulation
  // being tested, not a display preference.
  const base = { ignoreHTTPSErrors: true, deviceScaleFactor: 2 };
  if (!device.playwright) return { options: { ...base, viewport: VIEWPORT }, note: null };

  const descriptor = getPlaywright().devices[device.playwright];
  if (!descriptor) {
    return {
      options: { ...base, viewport: VIEWPORT },
      note: `unknown device "${device.playwright}" — ran at desktop size`,
    };
  }
  if (!device.engines.includes(engineId)) {
    return {
      options: { ...base, viewport: descriptor.viewport },
      note: `${device.name} emulation is not supported on ${engineId} — ran at its viewport (${descriptor.viewport.width}×${descriptor.viewport.height}) without touch or mobile user agent`,
    };
  }
  return { options: { ...base, ...descriptor }, note: null };
}

/** @type {Map<string, object>} */
const sessions = new Map();
// One process per (engine, headedness), shared by every session that wants it.
// Keyed by both because launching is expensive enough to pool but a headless
// process cannot serve a request for a headed one — the old single-slot cache
// answered "give me a headed browser" with whichever one already existed.
/** @type {Map<string, import('playwright').Browser>} */
const browsers = new Map();

async function getBrowser(type, headless) {
  const pw = getPlaywright();
  const id = browserId(type);
  const key = `${id}:${headless ? 'headless' : 'headed'}`;
  const open = browsers.get(key);
  // Relaunch if a previous one was closed — the user shutting the headed
  // window, typically.
  if (open && open.isConnected()) return open;
  try {
    const launched = await pw[id].launch({ headless: !!headless });
    browsers.set(key, launched);
    return launched;
  } catch (err) {
    // Playwright's own message here is "Executable doesn't exist at …" followed
    // by the install command, which is the right answer — but it arrives as a
    // 500 from a fetch the user cannot see. Name the browser and keep the fix.
    const e = new Error(`could not start ${id}: ${err.message}`);
    e.status = 501;
    throw e;
  }
}

// Which engines are actually usable. Checked by looking for the executable
// rather than launching one of each: launching three browsers to answer a
// question the UI asks on every page load would cost more than the feature.
function browserSupport() {
  const pw = getPlaywright();
  return BROWSERS.map((b) => {
    let installed = false;
    let path = null;
    try {
      path = pw[b.id].executablePath();
      installed = !!path && fs.existsSync(path);
    } catch {
      /* not downloaded, or a channel build with no bundled binary */
    }
    return {
      ...b,
      installed,
      reason: installed ? null : `not installed — run: npx playwright install ${b.id}`,
    };
  });
}

const touch = (s) => {
  s.lastSeen = Date.now();
  return s;
};

function get(req, res) {
  const s = sessions.get(req.params.id);
  if (!s) {
    res.status(404).json({ error: 'session not found — it may have been reaped after being idle' });
    return null;
  }
  return touch(s);
}

// Mirror of pushStep() in src/TestRunner.jsx: fold consecutive edits of one
// field into a single fill, and drop a click that exactly repeats the last one.
function appendStep(s, step) {
  const last = s.steps[s.steps.length - 1];
  if (step.coalesce && last && last.action === 'fill' && last.selector === step.selector) {
    s.steps[s.steps.length - 1] = step;
    s.revision++;
    return;
  }
  if (
    last &&
    step.action === 'click' &&
    last.action === 'click' &&
    last.selector === step.selector &&
    last.value === step.value
  ) {
    return; // duplicate identical click
  }
  if (s.steps.length >= MAX_BUFFERED_STEPS) return;
  s.steps.push(step);
  s.revision++;
}

// Record the hop when the page moves between steps. Same rule as the 
// engine: never as the very first step, since the run's start URL covers that.
//
// `url` is the portable form that goes into steps — a path when the page is on
// the session's own origin. `href` is always the full address, because a bare
// "/" in the address bar does not tell the user which host they are looking at.
function noteUrl(s, url, href) {
  if (href) s.curHref = href;
  if (!url || url === s.curUrl) return;
  s.curUrl = url;
  if (s.recording && s.steps.length > 0) {
    const last = s.steps[s.steps.length - 1];
    if (!last || last.url !== url) {
      appendStep(s, { action: 'navigate', url, label: url });
    }
  }
}

// A step recorded on the session's own origin is stored as a path so the test
// stays portable across environments; anywhere else keeps its full address.
function stepUrl(s, payload) {
  try {
    if (new URL(payload.href).origin === new URL(s.baseUrl).origin) return payload.path;
  } catch {
    /* fall through */
  }
  return payload.href || payload.path;
}

async function createSession({ url, headless, browser, device }) {
  const target = resolveUrl(url || '/', 'http://localhost:3000/');
  const type = browserId(browser);
  const dev = deviceById(device);
  const br = await getBrowser(type, headless);
  const { options, note } = contextOptions(type, dev.id);
  const context = await br.newContext(options);
  const id = crypto.randomUUID();
  const s = {
    id,
    context,
    page: null,
    baseUrl: target,
    curUrl: target,
    curHref: target,
    steps: [],
    revision: 0,
    recording: false,
    assertMode: false,
    implicit: 0,
    browser: type,
    device: dev.id,
    deviceName: dev.name,
    // Surfaced to the client so a downgraded run says so rather than silently
    // reporting a pass that never exercised the emulation asked for.
    deviceNote: note,
    headless: !!headless,
    lastSeen: Date.now(),
    lastError: null,
  };

  // The binding is what the injected recorder talks through, and both must be in
  // place before any page script runs.
  await context.exposeBinding('__trEvent', (source, payload) => {
    try {
      if (!payload || typeof payload !== 'object') return;
      const url = stepUrl(s, payload);
      if (payload.action === '__route') {
        noteUrl(s, url, payload.href);
        return;
      }
      if (!s.recording) {
        // Not recording: still worth knowing where the user has navigated to.
        s.curUrl = url;
        if (payload.href) s.curHref = payload.href;
        return;
      }
      noteUrl(s, url, payload.href);
      const step = { ...payload, url };
      delete step.path;
      delete step.href;
      appendStep(s, step);
    } catch (err) {
      s.lastError = err.message;
    }
  });
  await context.addInitScript(installRecorder);

  const page = await context.newPage();
  s.page = page;

  // Full page loads (link clicks, form posts, redirects) never reach the 
  // recorder for the *new* document, so track them here.
  page.on('framenavigated', (frame) => {
    if (frame !== page.mainFrame()) return;
    try {
      const u = frame.url();
      if (!u || u === 'about:blank') return;
      const parsed = new URL(u);
      const same = parsed.origin === new URL(s.baseUrl).origin;
      noteUrl(s, same ? parsed.pathname + parsed.search : u, u);
    } catch {
      /* unparseable url */
    }
  });
  // Assert mode lives in the page and a fresh document resets it, so re-apply on
  // every load.
  page.on('domcontentloaded', () => {
    if (!s.assertMode) return;
    page.evaluate(() => {
      window.__trAssert = true;
    }).catch(() => {});
  });
  page.on('close', () => {
    s.closed = true;
  });

  await page.goto(target, { waitUntil: 'domcontentloaded' }).catch((err) => {
    s.lastError = err.message;
  });

  sessions.set(id, s);
  return s;
}

async function destroySession(id) {
  const s = sessions.get(id);
  if (!s) return;
  sessions.delete(id);
  await s.context.close().catch(() => {});
  // Last one out closes up: an idle machine should be running no browsers at
  // all, and with three engines poolable that is now up to six processes rather
  // than one.
  if (sessions.size === 0) {
    const open = [...browsers.values()];
    browsers.clear();
    await Promise.all(open.map((b) => b.close().catch(() => {})));
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now - s.lastSeen > IDLE_TIMEOUT_MS) destroySession(id);
  }
}, REAP_INTERVAL_MS).unref();

const state = (s) => ({
  id: s.id,
  url: s.curUrl, // portable: a path on the session's own origin
  href: s.curHref, // always the full address, for display
  baseUrl: s.baseUrl,
  recording: s.recording,
  assertMode: s.assertMode,
  revision: s.revision,
  stepCount: s.steps.length,
  browser: s.browser,
  device: s.device,
  deviceName: s.deviceName,
  deviceNote: s.deviceNote,
  headless: s.headless,
  closed: !!s.closed,
  error: s.lastError,
});

// Is the real-browser engine usable at all? The UI asks before offering it.
router.get('/capabilities', (req, res) => {
  try {
    getPlaywright();
    const list = browserSupport();
    // Playwright being installed is not the same as any browser being usable:
    // `npm install playwright` without `npx playwright install` leaves the
    // package present and every engine missing. Answer on what can actually be
    // launched, so the UI does not offer an engine that cannot start.
    const usable = list.filter((b) => b.installed);
    res.json({
      available: usable.length > 0,
      reason: usable.length
        ? undefined
        : 'Playwright is installed but no browser is. Run: npx playwright install',
      browsers: list,
      defaultBrowser: (usable[0] || { id: DEFAULT_BROWSER }).id,
      // Which engine each device can be fully emulated on, so the UI can warn
      // about a downgrade before the run instead of after it.
      devices: DEVICES.map(({ id, name, engines, playwright }) => ({
        id,
        name,
        engines,
        viewport: playwright
          ? getPlaywright().devices[playwright]?.viewport || null
          : VIEWPORT,
      })),
      defaultDevice: DEFAULT_DEVICE,
      sessions: sessions.size,
    });
  } catch (err) {
    res.json({ available: false, reason: err.message, browsers: [] });
  }
});

router.post('/session', async (req, res) => {
  try {
    const s = await createSession({
      url: req.body?.url,
      headless: req.body?.headless,
      browser: req.body?.browser,
      device: req.body?.device,
    });
    res.json(state(s));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/session/:id', (req, res) => {
  const s = get(req, res);
  if (s) res.json(state(s));
});

router.delete('/session/:id', async (req, res) => {
  await destroySession(req.params.id);
  res.json({ ok: true });
});

router.post('/session/:id/goto', async (req, res) => {
  const s = get(req, res);
  if (!s) return;
  try {
    const target = resolveUrl(req.body?.url, s.baseUrl);
    await s.page.goto(target, { waitUntil: 'domcontentloaded' });
    res.json(state(s));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Recording is a server-side flag: the page always reports its events, and a
// fresh document cannot be trusted to remember anything.
router.post('/session/:id/recording', async (req, res) => {
  const s = get(req, res);
  if (!s) return;
  s.recording = !!req.body?.on;
  res.json(state(s));
});

router.post('/session/:id/assert', async (req, res) => {
  const s = get(req, res);
  if (!s) return;
  s.assertMode = !!req.body?.on;
  await s.page
    .evaluate((on) => {
      window.__trAssert = on;
    }, s.assertMode)
    .catch(() => {});
  res.json(state(s));
});

// Long-poll for newly recorded steps. `since` is a revision, so a client that
// misses a poll still catches up rather than losing steps.
router.get('/session/:id/steps', async (req, res) => {
  const s = get(req, res);
  if (!s) return;
  const since = Number(req.query.since) || 0;
  const waitMs = Math.min(Number(req.query.wait) || 0, 25_000);
  const deadline = Date.now() + waitMs;
  while (s.revision === since && Date.now() < deadline && !s.closed) {
    await new Promise((r) => setTimeout(r, 200));
    touch(s);
  }
  res.json({ ...state(s), steps: s.steps });
});

router.post('/session/:id/steps', (req, res) => {
  const s = get(req, res);
  if (!s) return;
  // Editing on the client is authoritative — it owns undo, reorder and delete.
  s.steps = Array.isArray(req.body?.steps) ? req.body.steps : [];
  s.revision++;
  res.json(state(s));
});

// Replay exactly one step, so the client keeps ownership of pacing, per-step
// timing and the report — the same loop it runs for the  engine.
router.post('/session/:id/step', async (req, res) => {
  const s = get(req, res);
  if (!s) return;
  const step = req.body?.step;
  if (!step || typeof step !== 'object') {
    res.status(400).json({ error: 'no step supplied' });
    return;
  }
  if (req.body?.resetImplicit) s.implicit = 0;
  // Whether a dead locator may repair itself. The client's preference, sent
  // with the step rather than fixed when the session opened, so turning it off
  // takes effect on the next run instead of the next browser launch.
  s.selfHeal = req.body?.selfHeal !== false;
  const t0 = Date.now();
  try {
    const meta = await runStep(s.page, step, s);
    res.json({
      ok: true,
      holdMs: meta.holdMs || 0,
      // The repair, when this step only ran because its locator was healed.
      // The client owns the recording, so it decides what to do with it.
      healed: meta.healed || null,
      // The response an API step produced: status, timings, per-assertion
      // verdicts and anything it extracted. Null for every other kind of step.
      // The client needs the extractions to resolve {{refs}} in the steps that
      // follow, which is why this is not merely report decoration.
      api: meta.api || null,
      durationMs: Date.now() - t0 - (meta.holdMs || 0),
      url: s.curUrl,
      href: s.curHref,
    });
  } catch (err) {
    res.json({
      ok: false,
      error: err.message,
      // A failed API assertion carries its response too — the body is the first
      // thing anyone asks to see, and re-sending the request to get it would
      // ask a question of a system that has already moved on.
      api: err.api || null,
      durationMs: Date.now() - t0,
      url: s.curUrl,
      href: s.curHref,
    });
  }
});

// A JPEG of the current viewport. This is how the UI shows a page it is
// forbidden to embed — the browser blocks framing, not screenshotting.
router.get('/session/:id/screenshot', async (req, res) => {
  const s = get(req, res);
  if (!s) return;
  try {
    const buf = await s.page.screenshot({ type: 'jpeg', quality: 60, timeout: 5000 });
    res.set('Content-Type', 'image/jpeg');
    res.set('Cache-Control', 'no-store');
    res.send(buf);
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

// Forward a click/keystroke/scroll from the preview pane into the real page, so
// the embedded view is interactive and recording works without the user having
// to switch to the Chromium window.
router.post('/session/:id/input', async (req, res) => {
  const s = get(req, res);
  if (!s) return;
  const { type, x, y, key, text, deltaY } = req.body || {};
  try {
    if (type === 'click') {
      await s.page.mouse.click(Number(x) || 0, Number(y) || 0);
    } else if (type === 'move') {
      await s.page.mouse.move(Number(x) || 0, Number(y) || 0);
    } else if (type === 'wheel') {
      await s.page.mouse.wheel(0, Number(deltaY) || 0);
    } else if (type === 'key') {
      await s.page.keyboard.press(String(key || ''));
    } else if (type === 'text') {
      // type(), not insertText(): insertText skips keydown/keyup entirely, so
      // autocompletes, masked fields and anything else keyed off keydown would
      // never react to a character the user actually typed.
      await s.page.keyboard.type(String(text || ''), { delay: 0 });
    } else {
      res.status(400).json({ error: `unknown input type: ${type}` });
      return;
    }
    res.json({ ok: true, url: s.curUrl, revision: s.revision });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// What is at this point in the viewport? Describes the element without touching
// it, and answers with the same locator bundle a recorded step carries, so the
// client can insert a step aimed at it. Used to pick the target of a hover,
// which cannot be recorded from a click — a click on the thing would perform the
// click instead.
router.post('/session/:id/pick', async (req, res) => {
  const s = get(req, res);
  if (!s) return;
  const { x, y } = req.body || {};
  try {
    const hit = await s.page.evaluate(
      ([px, py]) => (typeof window.__trPick === 'function' ? window.__trPick(px, py) : null),
      [Number(x) || 0, Number(y) || 0],
    );
    if (!hit) {
      res.status(404).json({ error: 'nothing at that point in the page' });
      return;
    }
    // A step's url must be the portable form, exactly as a recorded one is.
    res.json({ ...hit, url: s.curUrl });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
module.exports.viewport = VIEWPORT;
module.exports.browsers = BROWSERS;
