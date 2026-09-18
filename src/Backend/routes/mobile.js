'use strict';

// Native-mobile engine for TestExpress.
//
// Deliberately the same HTTP surface as routes/testrunner.js — capabilities,
// session, recording, assert, steps, step, screenshot, input, pick — so the
// frontend client is the web one with a different base path, and the recorder UI
// does not need a third code path for a third engine.
//
// The one structural difference is where recorded steps come from. The web engine
// injects a listener and the page reports its own events; a native app cannot do
// that, so /input is the recorder: every forwarded tap resolves the accessibility
// tree, synthesises a step, and only then performs the gesture. Touching the
// emulator window directly therefore records nothing, which is worth knowing.

const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const multer = require('multer');
const {
  MobileDriver,
  capabilities,
  installApk,
  listPackages,
  readApkInfo,
  DEFAULT_APPIUM_URL,
} = require('../testrunner/appium');
const appiumServer = require('../testrunner/appiumServer');
const emulator = require('../testrunner/emulator');
const { runStep, stepForTap } = require('../testrunner/mobileReplay');

const router = express.Router();

// APKs run to hundreds of megabytes, so the upload goes to disk rather than
// through the JSON body parser — buffering one in memory would be a way to run
// the server out of it, and express.json's 25mb limit would reject most real
// builds anyway.
//
// diskStorage rather than plain `dest` for one reason: `dest` names the file
// with a bare random hash, and `adb install` refuses outright to install
// anything whose name does not end in .apk. The name is generated here rather
// than taken from the upload so that a crafted `originalname` cannot steer the
// write out of the temp directory.
const APK_DIR = path.join(os.tmpdir(), 'testexpress-apk');
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      fs.mkdir(APK_DIR, { recursive: true }, (err) => cb(err, APK_DIR));
    },
    filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}.apk`),
  }),
  limits: { fileSize: 2 * 1024 * 1024 * 1024 },
});

// A device is a far scarcer resource than a browser process — there is usually
// exactly one emulator — so an abandoned session must let go of it promptly.
const IDLE_TIMEOUT_MS = 10 * 60 * 1000;
const REAP_INTERVAL_MS = 60 * 1000;
const MAX_BUFFERED_STEPS = 2000;

/** @type {Map<string, object>} */
const sessions = new Map();

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

// Mirror of appendStep() in routes/testrunner.js and pushStep() in
// src/TestRunner.jsx: fold consecutive edits of one field into a single fill, and
// drop a tap that exactly repeats the last one.
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
    return;
  }
  if (s.steps.length >= MAX_BUFFERED_STEPS) return;
  s.steps.push(step);
  s.revision++;
}

// The foreground app is a mobile screen's address. Record the hop when it
// changes, on the same rule the web engines use: never as the very first step,
// since the run's starting app already covers that.
function noteApp(s, app) {
  if (!app || app === s.curApp) return;
  s.curApp = app;
  if (s.recording && s.steps.length > 0) {
    appendStep(s, { action: 'launchApp', app, url: app, label: app });
  }
}

async function createSession({ platform, udid, app, appiumUrl }) {
  const driver = await MobileDriver.open({ platform, udid, app, appiumUrl });
  const id = crypto.randomUUID();
  const s = {
    id,
    driver,
    baseApp: app || (await driver.currentApp()),
    curApp: await driver.currentApp(),
    curActivity: await driver.currentActivity(),
    steps: [],
    revision: 0,
    recording: false,
    assertMode: false,
    implicit: 0,
    platform: driver.platform,
    udid: driver.udid,
    size: driver.size,
    // Where the next keystrokes belong. Set when a tap lands on a text field, so
    // typing becomes a fill against that element rather than a loose gesture.
    editTarget: null,
    editBuffer: '',
    lastSeen: Date.now(),
    lastError: null,
  };
  sessions.set(id, s);
  return s;
}

async function destroySession(id) {
  const s = sessions.get(id);
  if (!s) return;
  sessions.delete(id);
  await s.driver.close();
}

setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now - s.lastSeen > IDLE_TIMEOUT_MS) destroySession(id);
  }
}, REAP_INTERVAL_MS).unref();

const state = (s) => ({
  id: s.id,
  // `url` and `href` carry the app package so the recorder's existing address
  // plumbing works unchanged; `app` is the same value under an honest name.
  url: s.curApp,
  href: s.curActivity ? `${s.curApp}/${s.curActivity}` : s.curApp,
  app: s.curApp,
  activity: s.curActivity,
  baseApp: s.baseApp,
  recording: s.recording,
  assertMode: s.assertMode,
  revision: s.revision,
  stepCount: s.steps.length,
  platform: s.platform,
  udid: s.udid,
  viewport: s.size,
  editing: !!s.editTarget,
  closed: false,
  error: s.lastError,
});

// Refresh the cached foreground app. Cheap enough to do on every poll, and it is
// the only way to notice the user navigating out of the app under test.
async function refresh(s) {
  try {
    const app = await s.driver.currentApp();
    s.curActivity = await s.driver.currentActivity();
    noteApp(s, app);
  } catch (err) {
    s.lastError = err.message;
  }
}

router.get('/capabilities', async (req, res) => {
  try {
    const caps = await capabilities(req.query.appiumUrl || DEFAULT_APPIUM_URL);
    // Composed here rather than inside capabilities(): whether a server *could*
    // be started is a fact about this host's install, not about the engine, and
    // the engine module has no business knowing how to spawn one.
    const pre = appiumServer.preflight();
    res.json({
      ...caps,
      sessions: sessions.size,
      canStartServer: caps.blocker === 'server' && pre.canStart,
      serverSetup: { javaHome: pre.javaHome, sdkRoot: pre.sdkRoot, missing: pre.missing },
    });
  } catch (err) {
    res.json({ available: false, devices: [], apps: [], reason: err.message });
  }
});

// ---- the local Appium server ----------------------------------------------
//
// Offered because the alternative is asking the tester to find ANDROID_HOME and
// JAVA_HOME by hand — see the header of ../testrunner/appiumServer.

router.get('/server', async (req, res) => {
  try {
    res.json(await appiumServer.status(req.query.appiumUrl || DEFAULT_APPIUM_URL));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/server/start', async (req, res) => {
  try {
    res.json(await appiumServer.start(req.body?.appiumUrl || DEFAULT_APPIUM_URL));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/server/stop', async (req, res) => {
  try {
    // Refuse while a session is live: killing the server underneath one turns a
    // recording into a stream of unexplained failures.
    if (sessions.size) {
      res.status(409).json({ error: `${sessions.size} session(s) are still using it` });
      return;
    }
    res.json(await appiumServer.stop());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// The virtual devices this machine could boot, and what is missing if it cannot.
// Asked separately from /capabilities so the "no device" panel can refresh its
// AVD list after somebody creates one without re-probing Appium.
router.get('/emulator', async (req, res) => {
  try {
    res.json(await emulator.preflight());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Boot an AVD and wait until it has genuinely finished starting.
//
// Slow by nature — a cold boot runs into minutes — so the client needs a
// generous timeout on this one. It answers once the device reports
// sys.boot_completed, not merely once adb can see it: a session created in that
// gap fails in ways that look like a broken app rather than a device that was
// not ready yet.
router.post('/emulator/start', async (req, res) => {
  try {
    res.json(await emulator.start(req.body?.avd));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Installed packages on a given device, so the UI can offer a picker rather than
// making the user type a package name from memory.
router.get('/apps', async (req, res) => {
  try {
    res.json({ apps: await listPackages(req.query.udid) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Install an APK chosen on the tester's own machine and report what it is.
 *
 * The browser will not disclose a picked file's real path — so the bytes are
 * uploaded rather than a path being passed to adb. The package name is read from
 * the APK itself rather than by diffing the device's package list, because
 * reinstalling an app that is already there would produce no diff at all.
 *
 * The temporary copy is always removed: an abandoned recording must not leave
 * hundreds of megabytes in the system temp directory.
 */
router.post('/apk', upload.single('apk'), async (req, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'no APK was uploaded' });
    return;
  }
  try {
    if (!/\.apk$/i.test(file.originalname || '')) {
      const e = new Error(
        `"${file.originalname}" is not an .apk. An .aab or .apks bundle cannot be installed ` +
          'directly — export a universal APK from it first.',
      );
      e.status = 400;
      throw e;
    }
    const info = await readApkInfo(file.path);
    await installApk(file.path, req.body?.udid || undefined);
    res.json({
      ...info,
      fileName: file.originalname,
      sizeBytes: file.size,
      installed: true,
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  } finally {
    fs.promises.unlink(file.path).catch(() => {});
  }
});

router.post('/session', async (req, res) => {
  try {
    const s = await createSession({
      platform: req.body?.platform,
      udid: req.body?.udid,
      app: req.body?.app,
      appiumUrl: req.body?.appiumUrl,
    });
    res.json(state(s));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/session/:id', async (req, res) => {
  const s = get(req, res);
  if (!s) return;
  await refresh(s);
  res.json(state(s));
});

router.delete('/session/:id', async (req, res) => {
  await destroySession(req.params.id);
  res.json({ ok: true });
});

// The mobile analogue of goto: bring an app to the foreground.
router.post('/session/:id/goto', async (req, res) => {
  const s = get(req, res);
  if (!s) return;
  try {
    const app = String(req.body?.url || req.body?.app || '').trim();
    if (!app) {
      res.status(400).json({ error: 'no app package supplied' });
      return;
    }
    await s.driver.launchApp(app);
    await refresh(s);
    res.json(state(s));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/session/:id/recording', (req, res) => {
  const s = get(req, res);
  if (!s) return;
  s.recording = !!req.body?.on;
  // A stint of recording ends whatever edit was in progress; otherwise the next
  // keystrokes would extend a fill recorded before the pause.
  if (!s.recording) flushEdit(s);
  res.json(state(s));
});

// Assert mode is a server-side flag here, as it is for the real-browser engine:
// there is nothing in the app that could hold it.
router.post('/session/:id/assert', (req, res) => {
  const s = get(req, res);
  if (!s) return;
  s.assertMode = !!req.body?.on;
  res.json(state(s));
});

router.get('/session/:id/steps', async (req, res) => {
  const s = get(req, res);
  if (!s) return;
  const since = Number(req.query.since) || 0;
  const waitMs = Math.min(Number(req.query.wait) || 0, 25_000);
  const deadline = Date.now() + waitMs;
  while (s.revision === since && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 250));
    touch(s);
  }
  await refresh(s);
  res.json({ ...state(s), steps: s.steps });
});

router.post('/session/:id/steps', (req, res) => {
  const s = get(req, res);
  if (!s) return;
  s.steps = Array.isArray(req.body?.steps) ? req.body.steps : [];
  s.revision++;
  res.json(state(s));
});

router.post('/session/:id/step', async (req, res) => {
  const s = get(req, res);
  if (!s) return;
  const step = req.body?.step;
  if (!step || typeof step !== 'object') {
    res.status(400).json({ error: 'no step supplied' });
    return;
  }
  if (req.body?.resetImplicit) s.implicit = 0;
  const t0 = Date.now();
  try {
    const meta = await runStep(s.driver, step, s);
    await refresh(s);
    res.json({
      ok: true,
      holdMs: meta.holdMs || 0,
      durationMs: Date.now() - t0 - (meta.holdMs || 0),
      url: s.curApp,
      href: state(s).href,
    });
  } catch (err) {
    await refresh(s);
    res.json({
      ok: false,
      error: err.message,
      durationMs: Date.now() - t0,
      url: s.curApp,
      href: state(s).href,
    });
  }
});

router.get('/session/:id/screenshot', async (req, res) => {
  const s = get(req, res);
  if (!s) return;
  try {
    const buf = await s.driver.screenshot();
    // Appium serves PNG only — there is no quality knob to trade away. The pane
    // requests one frame at a time and waits for it, so a heavier frame costs
    // frame rate rather than piling up requests.
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'no-store');
    res.send(buf);
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

// Commit a pending fill. Keystrokes arrive one at a time and each would
// otherwise be its own step, so they accumulate against the focused field and
// land as a single fill.
function flushEdit(s) {
  if (!s.editTarget || !s.editBuffer) {
    s.editTarget = null;
    s.editBuffer = '';
    return;
  }
  appendStep(s, {
    action: 'fill',
    selector: s.editTarget.selector,
    selectors: s.editTarget.selectors,
    tag: s.editTarget.tag,
    label: s.editTarget.label,
    value: s.editBuffer,
    url: s.curApp,
    coalesce: true,
  });
  s.editTarget = null;
  s.editBuffer = '';
}

/**
 * Forward an input from the preview pane into the device — and, while recording,
 * turn it into a step.
 *
 * Order matters: the tree is read *before* the gesture is performed, because
 * afterwards the screen the step describes may no longer exist.
 */
router.post('/session/:id/input', async (req, res) => {
  const s = get(req, res);
  if (!s) return;
  const { type, x, y, key, text, direction, percent } = req.body || {};
  try {
    if (type === 'click' || type === 'tap') {
      let step = null;
      // Resolve first: after the tap, the screen may have changed entirely.
      if (s.recording || s.assertMode) {
        step = await stepForTap(s.driver, Number(x) || 0, Number(y) || 0).catch(() => null);
      }
      if (s.assertMode) {
        // Assert mode inspects rather than acts, exactly as it does in the web
        // engines — tapping the thing would perform the tap instead.
        if (!step || step.coordinateOnly) {
          res.status(404).json({ error: 'nothing identifiable at that point — try the element itself' });
          return;
        }
        appendStep(s, {
          action: 'assert',
          assertType: step.text ? 'text' : 'exists',
          selector: step.selector,
          selectors: step.selectors,
          tag: step.tag,
          text: step.text,
          expected: step.text || undefined,
          label: step.label,
          url: s.curApp,
        });
        res.json({ ok: true, recorded: true, url: s.curApp, revision: s.revision });
        return;
      }
      // A tap moves focus, so whatever was being typed is finished.
      flushEdit(s);
      await s.driver.tapAt(Number(x) || 0, Number(y) || 0);
      if (s.recording && step) {
        if (step.editable) {
          // Do not record the focusing tap itself: the fill that follows implies
          // it, and replaying both would tap the field twice.
          s.editTarget = step;
          s.editBuffer = '';
        } else {
          appendStep(s, step);
        }
      }
    } else if (type === 'text') {
      if (s.recording && s.editTarget) s.editBuffer += String(text || '');
      await s.driver.typeText(String(text || ''));
    } else if (type === 'key') {
      // Enter submits, which ends the edit and usually changes the screen.
      if (String(key) === 'Enter' || String(key) === 'Tab') flushEdit(s);
      else if (String(key) === 'Backspace' && s.recording && s.editTarget) {
        s.editBuffer = s.editBuffer.slice(0, -1);
      }
      await s.driver.pressKey(String(key || ''));
    } else if (type === 'back') {
      flushEdit(s);
      await s.driver.back();
      if (s.recording) appendStep(s, { action: 'back', label: 'back', url: s.curApp });
    } else if (type === 'wheel' || type === 'swipe') {
      flushEdit(s);
      // A wheel from the pane is a scroll gesture on the device. deltaY > 0 in
      // the browser means "content moves up", i.e. scroll down.
      const dir = direction || (Number(req.body?.deltaY) < 0 ? 'up' : 'down');
      await s.driver.swipe(dir, percent);
      if (s.recording) appendStep(s, { action: 'scroll', direction: dir, label: `scroll ${dir}`, url: s.curApp });
    } else {
      res.status(400).json({ error: `unknown input type: ${type}` });
      return;
    }
    await refresh(s);
    res.json({ ok: true, url: s.curApp, revision: s.revision });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// What is at this point? Describes without touching, and answers with the same
// locator bundle a recorded step carries — the mobile twin of the web /pick.
router.post('/session/:id/pick', async (req, res) => {
  const s = get(req, res);
  if (!s) return;
  try {
    const hit = await s.driver.pick(Number(req.body?.x) || 0, Number(req.body?.y) || 0);
    if (!hit) {
      res.status(404).json({ error: 'nothing identifiable at that point on the screen' });
      return;
    }
    res.json({ ...hit, url: s.curApp });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// The accessibility tree as the device reports it. Not used by the recorder, but
// it is the only way to see why a locator did not match, and reading it beats
// guessing from a screenshot.
router.get('/session/:id/source', async (req, res) => {
  const s = get(req, res);
  if (!s) return;
  try {
    res.set('Content-Type', 'text/xml');
    res.send(await s.driver.source());
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

module.exports = router;
