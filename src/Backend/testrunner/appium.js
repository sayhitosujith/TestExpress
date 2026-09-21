'use strict';

// Driver wrapper for the Appium (native mobile) engine.
//
// This is the mobile counterpart of the Playwright half of routes/testrunner.js:
// it owns one session against one device and exposes the handful of primitives
// the recorder and the replayer need. Everything that can be decided without
// talking to a device lives in ./mobileTree instead.
//
// Two differences from the web engines are structural, not incidental:
//
//   * There is no script to inject. The web recorder installs a listener in the
//     page and the page reports its own events; a native app cannot be asked to
//     do that. Instead every input is *forwarded through this process* — the
//     preview pane is the only way in — so a step is synthesised from the tap we
//     just performed plus the accessibility tree we read before performing it.
//     Consequence worth knowing: interacting with the device directly (touching
//     the emulator window) records nothing.
//
//   * There is no URL. The address of a mobile screen is the foreground app
//     package, so that is what a step's `url` field carries, which keeps the
//     existing per-step "am I on the right screen" plumbing working unchanged.

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { parseTree, nodeAt, describe } = require('./mobileTree');

const execFileAsync = promisify(execFile);

const DEFAULT_APPIUM_URL = process.env.APPIUM_URL || 'http://127.0.0.1:4723';
// Appium's own default. Long enough that a session survives the user thinking
// about what to record next, short enough that an abandoned one lets go of the
// device.
const NEW_COMMAND_TIMEOUT_S = 600;

// webdriverio is a heavy optional dependency, resolved lazily for the same
// reason playwright is in routes/testrunner.js: a checkout that has not run
// `npm install` must still serve the rest of the API.
let wdio = null;
let wdioError = null;
function getWdio() {
  if (wdio) return wdio;
  if (wdioError) throw wdioError;
  try {
    wdio = require('webdriverio');
    return wdio;
  } catch (err) {
    wdioError = new Error(
      'webdriverio is not installed. From the project root run:\n' +
        '  npm --prefix src/Backend install webdriverio',
    );
    wdioError.status = 501;
    throw wdioError;
  }
}

// ---- toolchain discovery --------------------------------------------------

/**
 * Every place an Android SDK is plausibly installed, most explicit first.
 *
 * Worth guessing rather than trusting the environment: Android Studio installs
 * the SDK to a well-known place but sets no environment variables, so a machine
 * that can clearly run an emulator routinely has neither ANDROID_HOME nor adb on
 * PATH. Both the tool lookups and the Appium launcher need this same list.
 *
 * @returns {string[]} candidate SDK roots, deduplicated, existing or not.
 */
function sdkRoots() {
  return [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk'),
    process.env.HOME && path.join(process.env.HOME, 'Library', 'Android', 'sdk'),
    process.env.HOME && path.join(process.env.HOME, 'Android', 'Sdk'),
  ].filter(Boolean);
}

/**
 * The SDK root that actually holds platform-tools.
 *
 * @returns {string|null} absolute path, or null when no SDK can be found.
 */
function findSdkRoot() {
  for (const root of sdkRoots()) {
    if (fs.existsSync(path.join(root, 'platform-tools'))) return root;
  }
  return null;
}

/**
 * Locate `adb`.
 *
 * @returns {string|null} absolute path to adb, or null if it cannot be found.
 */
function findAdb() {
  const exe = process.platform === 'win32' ? 'adb.exe' : 'adb';
  for (const root of sdkRoots()) {
    const p = path.join(root, 'platform-tools', exe);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Devices and emulators `adb` can currently see.
 *
 * @returns {Promise<Array<{udid: string, state: string, model: string|null}>>}
 */
async function listAndroidDevices() {
  const adb = findAdb();
  if (!adb) return [];
  try {
    const { stdout } = await execFileAsync(adb, ['devices', '-l'], { timeout: 10_000 });
    return stdout
      .split('\n')
      .slice(1)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('*'))
      .map((line) => {
        const [udid, state, ...rest] = line.split(/\s+/);
        const meta = rest.join(' ');
        const model = /model:(\S+)/.exec(meta);
        return { udid, state, model: model ? model[1].replace(/_/g, ' ') : null };
      })
      .filter((d) => d.udid && d.state);
  } catch {
    return [];
  }
}

/**
 * Locate a build-tools binary (`aapt`, `aapt2`).
 *
 * Versioned directories, newest first: the SDK keeps every build-tools release
 * it has ever downloaded, and an old `aapt` fails to parse an APK built against
 * a newer platform.
 *
 * @returns {string|null} absolute path, or null when build-tools is absent.
 */
function findBuildTool(name) {
  const exe = process.platform === 'win32' ? `${name}.exe` : name;
  for (const root of sdkRoots()) {
    const dir = path.join(root, 'build-tools');
    if (!fs.existsSync(dir)) continue;
    const versions = fs
      .readdirSync(dir)
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    for (const v of versions) {
      const p = path.join(dir, v, exe);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

/**
 * Read an APK's identity without installing it.
 *
 * The package name is what every later call needs — activateApp, the step's
 * `url`, the exported spec's APP constant — and the only place it exists is
 * inside the APK's manifest. Asking the device after installing would work only
 * for an app that was not already installed, so it is read from the file.
 *
 * @param {string} apkPath
 * @returns {Promise<{package: string, activity: string|null, label: string|null, versionName: string|null}>}
 */
async function readApkInfo(apkPath) {
  // aapt2 first: aapt (v1) fails outright on APKs using newer manifest
  // features, and the error it gives ("failed to open") does not say why.
  const tools = [findBuildTool('aapt2'), findBuildTool('aapt')].filter(Boolean);
  if (!tools.length) {
    const e = new Error(
      'could not find aapt/aapt2. Install Android SDK Build-Tools ' +
        '(Android Studio > SDK Manager > SDK Tools > Android SDK Build-Tools).',
    );
    e.status = 501;
    throw e;
  }
  let lastErr = null;
  for (const tool of tools) {
    try {
      const { stdout } = await execFileAsync(tool, ['dump', 'badging', apkPath], {
        timeout: 60_000,
        maxBuffer: 8 * 1024 * 1024,
      });
      const pkg = /package: name='([^']+)'/.exec(stdout);
      if (!pkg) throw new Error('no package name in the manifest');
      return {
        package: pkg[1],
        activity: (/launchable-activity: name='([^']+)'/.exec(stdout) || [])[1] || null,
        label: (/application-label:'([^']*)'/.exec(stdout) || [])[1] || null,
        versionName: (/versionName='([^']*)'/.exec(stdout) || [])[1] || null,
      };
    } catch (err) {
      lastErr = err;
    }
  }
  const e = new Error(
    `could not read that APK: ${String(lastErr && lastErr.message).split('\n')[0]}. ` +
      'An .aab or .apks bundle is not an APK — export a universal APK first.',
  );
  e.status = 400;
  throw e;
}

/**
 * Install an APK onto a device.
 *
 * `-r` reinstalls over an existing copy so re-uploading the same build is not an
 * error, and `-g` grants the manifest's runtime permissions up front — a
 * recording that opens with an unexpected permission dialog is a recording of
 * the dialog.
 */
async function installApk(apkPath, udid) {
  const adb = findAdb();
  if (!adb) {
    const e = new Error('could not find adb — install the Android SDK platform-tools.');
    e.status = 501;
    throw e;
  }
  const args = [...(udid ? ['-s', udid] : []), 'install', '-r', '-g', apkPath];
  const { stdout, stderr } = await execFileAsync(adb, args, {
    timeout: 10 * 60_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  const out = `${stdout}\n${stderr}`;
  // adb exits 0 even when the install failed, so the output is the only signal.
  if (/Failure \[([^\]]+)\]/.test(out)) {
    const why = /Failure \[([^\]]+)\]/.exec(out)[1];
    const e = new Error(`the device refused the install: ${why}`);
    e.status = 400;
    throw e;
  }
  if (!/Success/i.test(out)) {
    const e = new Error(`install did not report success:\n${out.trim().slice(0, 300)}`);
    e.status = 400;
    throw e;
  }
  return true;
}

/**
 * Packages installed on a device — the list of testable apps.
 *
 * Throws rather than answering `[]` when adb fails, which is the whole point of
 * this function's shape. An empty list and a failed command are completely
 * different facts: no real Android image ships zero packages, so `[]` can only
 * ever mean the question was not answered.
 *
 * The failure this was observed to hide is a wedged emulator. `adb devices`
 * keeps reporting `device` and `adb get-state` answers in 50ms, while every
 * `adb shell` hangs until it is killed — so capabilities said the engine was
 * available, offered the device, and handed the UI an empty app picker. Start
 * recording was then disabled forever behind the tooltip "choose a device and
 * an app first", with no app to choose and nothing on screen naming the cause.
 *
 * @param {string} [udid] which device, or the only one.
 * @returns {Promise<Array<{name: string, kind: 'app'|'system'}>>}
 * @throws {Error} tagged with `status`, carrying what to do about it.
 */
async function listPackages(udid) {
  const adb = findAdb();
  if (!adb) {
    const e = new Error('could not find adb — install the Android SDK platform-tools.');
    e.status = 501;
    throw e;
  }
  const args = udid ? ['-s', udid] : [];
  const where = udid ? `-s ${udid} ` : '';
  let third;
  let sys;
  try {
    // Both lists matter: -3 alone omits Settings and Calculator, which are
    // exactly what someone proving the engine works will reach for first.
    [third, sys] = await Promise.all([
      execFileAsync(adb, [...args, 'shell', 'pm', 'list', 'packages', '-3'], { timeout: 15_000 }),
      execFileAsync(adb, [...args, 'shell', 'pm', 'list', 'packages', '-s'], { timeout: 15_000 }),
    ]);
  } catch (err) {
    // A killed process is a timeout, and a timeout here means the shell is not
    // answering at all -- a different problem from adb refusing the command,
    // and one adb itself will not report because it never returns.
    const e = new Error(
      err.killed
        ? `the device is attached but not responding: \`adb ${where}shell\` did not answer ` +
          'within 15s. The emulator is usually still booting, or has hung — check ' +
          '`adb devices` for "offline", and cold boot it from Android Studio > Device ' +
          'Manager if it stays that way.'
        : `could not read the installed apps: ${String(err.message).split('\n')[0]}`,
    );
    e.status = 503;
    throw e;
  }
  const parse = (out, kind) =>
    out.stdout
      .split('\n')
      .map((l) => l.trim().replace(/^package:/, ''))
      .filter(Boolean)
      .map((name) => ({ name, kind }));
  return [...parse(third, 'app'), ...parse(sys, 'system')].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

/** Is an Appium server listening, and which drivers does it have? */
async function probeServer(url = DEFAULT_APPIUM_URL) {
  try {
    const res = await fetch(`${url}/status`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return { up: false, reason: `Appium answered ${res.status} at ${url}/status` };
    const body = await res.json();
    return { up: true, build: body?.value?.build?.version || null };
  } catch (err) {
    return {
      up: false,
      reason:
        `no Appium server at ${url}. Start one with:\n` +
        `  appium --address 127.0.0.1 --port 4723\n` +
        `and make sure ANDROID_HOME and JAVA_HOME are set in that shell ` +
        `(the uiautomator2 driver needs both).\n${err.message}`,
    };
  }
}

// Required at call time, not at load. ./emulator needs findAdb and
// listAndroidDevices from this module, so a top-level require in both
// directions would hand whichever loaded second a half-built exports object —
// and the symptom would be `preflight is not a function` from a module that is
// plainly there.
const emulatorPreflight = () => require('./emulator').preflight();

/**
 * Whether the mobile engine can run at all, and against what.
 *
 * Mirrors the shape of the Playwright engine's `/capabilities` so the UI can ask
 * the same question of both: `{ available, reason, devices, apps }`.
 *
 * A `device` or `adb` blocker also carries `deviceSetup` — the AVDs that could
 * be booted from here and, failing that, the Android-Studio-free instructions
 * for whatever is missing.
 */
async function capabilities(url = DEFAULT_APPIUM_URL) {
  const out = { available: false, appiumUrl: url, devices: [], apps: [], adb: findAdb() };
  try {
    getWdio();
  } catch (err) {
    out.reason = err.message;
    out.blocker = 'wdio';
    return out;
  }
  const server = await probeServer(url);
  if (!server.up) {
    out.reason = server.reason;
    // Named so the UI can offer the matching fix — starting a server is a button
    // it can actually own, where a missing SDK is not — without matching on the
    // wording of `reason`.
    out.blocker = 'server';
    return out;
  }
  out.serverBuild = server.build;
  out.devices = (await listAndroidDevices()).filter((d) => d.state === 'device');
  if (!out.adb) {
    out.deviceSetup = await emulatorPreflight();
    out.reason =
      'could not find adb. It ships in the SDK platform-tools, which install without ' +
      'Android Studio — see below — or set ANDROID_HOME to an SDK you already have.';
    out.blocker = 'adb';
    return out;
  }
  if (!out.devices.length) {
    // What this machine can actually do about it, worked out rather than
    // assumed. The old wording sent everyone to "Android Studio > Device
    // Manager", which names an IDE that need not be installed — adb, the
    // emulator and a system image all install without it — and which is a
    // detour even when it is installed, since an AVD that already exists can be
    // booted from here. deviceSetup carries the AVD list and the sdkmanager
    // lines for whatever is missing, so the UI can offer a button first and
    // instructions only when there is nothing to press.
    out.deviceSetup = await emulatorPreflight();
    out.reason = out.deviceSetup.canStart
      ? 'Appium is running but no device is attached. Start one below, or plug in a phone ' +
        'with USB debugging enabled.'
      : 'Appium is running but no device is attached. Plug in a phone with USB debugging ' +
        'enabled, or set up a virtual device — no Android Studio required.';
    out.blocker = 'device';
    return out;
  }
  // The last thing that can be wrong, and the one that used to pass silently: a
  // device adb lists as `device` whose shell does not actually answer. Reported
  // as a device blocker rather than swallowed, because `available: true` with an
  // empty app list is a screen you cannot start a recording from and cannot tell
  // why -- see listPackages.
  try {
    out.apps = await listPackages(out.devices[0].udid);
  } catch (err) {
    out.reason = err.message;
    out.blocker = 'device';
    return out;
  }
  if (!out.apps.length) {
    // Not a state a working device can reach — every Android image ships
    // Settings — so it is the same class of fault as the throw above.
    out.reason =
      `${out.devices[0].udid} reported no installed packages at all, which a working ` +
      'device cannot do. Treat it as unresponsive and cold boot it: ' +
      `adb -s ${out.devices[0].udid} reboot, or close the emulator and start it again below.`;
    out.blocker = 'device';
    return out;
  }
  out.available = true;
  // iOS is deliberately absent rather than offered-and-broken: XCUITest needs
  // macOS and Xcode, so on any other host an iOS option could only ever fail.
  out.platforms = process.platform === 'darwin' ? ['Android', 'iOS'] : ['Android'];
  return out;
}

// ---- session --------------------------------------------------------------

/** One recording/playback session against one device. */
class MobileDriver {
  constructor(driver, opts) {
    this.driver = driver;
    this.platform = opts.platform;
    this.udid = opts.udid;
    this.appiumUrl = opts.appiumUrl;
    this.size = opts.size;
  }

  /**
   * Start a session. The app is launched *after* the session exists rather than
   * through the `appPackage`/`appActivity` capabilities: passing an activity was
   * observed to leave the device sitting on the launcher without erroring, which
   * silently records the wrong screen. activateApp is checkable.
   */
  static async open({
    platform = 'Android',
    udid,
    app,
    appiumUrl = DEFAULT_APPIUM_URL,
    noReset = true,
  } = {}) {
    const { remote } = getWdio();
    const automationName = platform === 'iOS' ? 'XCUITest' : 'UiAutomator2';
    if (platform === 'iOS' && process.platform !== 'darwin') {
      const e = new Error('iOS automation requires macOS with Xcode — XCUITest cannot run on this host.');
      e.status = 501;
      throw e;
    }
    const parsed = new URL(appiumUrl);
    let driver;
    try {
      driver = await remote({
        protocol: parsed.protocol.replace(':', ''),
        hostname: parsed.hostname,
        port: Number(parsed.port) || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname === '/' ? '/' : parsed.pathname,
        logLevel: 'error',
        connectionRetryTimeout: 120_000,
        capabilities: {
          platformName: platform,
          'appium:automationName': automationName,
          ...(udid ? { 'appium:udid': udid } : {}),
          'appium:noReset': !!noReset,
          'appium:newCommandTimeout': NEW_COMMAND_TIMEOUT_S,
        },
      });
    } catch (err) {
      // Appium's failures are verbose but the first line is usually the real
      // cause ("A new session could not be created … device not found").
      const e = new Error(`could not start a mobile session: ${String(err.message).split('\n')[0]}`);
      e.status = 501;
      throw e;
    }
    const size = await driver.getWindowSize().catch(() => ({ width: 1080, height: 1920 }));
    const self = new MobileDriver(driver, { platform, udid, appiumUrl, size });
    if (app) await self.launchApp(app);
    return self;
  }

  async close() {
    try {
      await this.driver.deleteSession();
    } catch {
      /* already gone — not worth reporting to someone closing the recorder */
    }
  }

  /** Bring an app to the foreground, and confirm it actually arrived. */
  async launchApp(pkg) {
    await this.driver.activateApp(pkg);
    // activateApp resolves before the first frame is drawn; a step recorded or
    // replayed against a half-built screen fails for reasons that have nothing
    // to do with the app.
    await this.waitForPackage(pkg, 8000);
    return this.currentApp();
  }

  async waitForPackage(pkg, timeoutMs) {
    const end = Date.now() + timeoutMs;
    for (;;) {
      const cur = await this.currentApp();
      if (cur === pkg) return true;
      if (Date.now() >= end) return false;
      await this.driver.pause(200);
    }
  }

  /** Foreground package — the mobile equivalent of the current URL. */
  async currentApp() {
    if (this.platform === 'iOS') {
      // XCUITest has no getCurrentPackage; the active bundle id is the analogue.
      return this.driver
        .execute('mobile: activeAppInfo')
        .then((i) => i?.bundleId || null)
        .catch(() => null);
    }
    return this.driver.getCurrentPackage().catch(() => null);
  }

  async currentActivity() {
    if (this.platform === 'iOS') return null;
    return this.driver.getCurrentActivity().catch(() => null);
  }

  /** PNG bytes of the screen. Appium serves PNG only — there is no JPEG option. */
  async screenshot() {
    const b64 = await this.driver.takeScreenshot();
    return Buffer.from(b64, 'base64');
  }

  async source() {
    return this.driver.getPageSource();
  }

  /** The accessibility tree, parsed. Every hit-test and pick goes through this. */
  async tree() {
    return parseTree(await this.source());
  }

  /**
   * Describe whatever is at a point, as the locator bundle a step carries.
   * The mobile counterpart of the web engine's `__trPick`.
   */
  async pick(x, y) {
    const nodes = await this.tree();
    const hit = nodeAt(nodes, x, y);
    return hit ? describe(hit, nodes) : null;
  }

  async tapAt(x, y) {
    await this.driver
      .action('pointer', { parameters: { pointerType: 'touch' } })
      .move({ x: Math.round(x), y: Math.round(y) })
      .down()
      .pause(60)
      .up()
      .perform();
  }

  async typeText(text) {
    await this.driver.execute('mobile: type', { text: String(text) }).catch(async () => {
      // Not every driver build exposes `mobile: type`; keys always work.
      await this.driver.sendKeys([...String(text)]);
    });
  }

  async pressKey(key) {
    // Android keycodes for the handful of keys a form needs. Anything else is
    // sent as text by the caller.
    const codes = { Enter: 66, Backspace: 67, Tab: 61, Escape: 111 };
    if (this.platform === 'Android' && codes[key] != null) {
      await this.driver.pressKeyCode(codes[key]);
      return;
    }
    await this.driver.sendKeys([key]);
  }

  async back() {
    if (this.platform === 'iOS') {
      // iOS has no hardware back button; the navigation bar's leading button is
      // the closest equivalent and is what a user would actually tap.
      const el = await this.driver.$('~Back').catch(() => null);
      if (el && (await el.isExisting().catch(() => false))) {
        await el.click();
        return;
      }
      throw new Error('no Back button on this screen');
    }
    await this.driver.back();
  }

  /**
   * Scroll or swipe by a fraction of the screen.
   *
   * `direction` is the direction the *content* moves, matching the web engine's
   * scroll step, so "down" reveals what is below — the opposite of the finger
   * movement that achieves it.
   */
  async swipe(direction = 'down', percent = 0.6) {
    if (this.platform === 'iOS') {
      // `mobile: swipe` takes the finger's direction, which is the inverse of
      // the content direction the step records.
      const inverse = { down: 'up', up: 'down', left: 'right', right: 'left' };
      await this.driver.execute('mobile: swipe', { direction: inverse[direction] || 'up' });
      return;
    }
    const { width, height } = this.size;
    await this.driver.execute('mobile: scrollGesture', {
      left: Math.round(width * 0.1),
      top: Math.round(height * 0.2),
      width: Math.round(width * 0.8),
      height: Math.round(height * 0.6),
      direction,
      percent: Math.min(Math.max(Number(percent) || 0.6, 0.1), 1),
    });
  }

  /**
   * First selector in the bundle that matches, polled until the budget runs out.
   *
   * Same contract as firstMatch() in replay.js and for the same reason: a native
   * UI is rebuilt between OS versions much as markup is between releases, so a
   * step carries several locators and replay takes whichever still resolves.
   *
   * @returns {Promise<{el: object, how: string}|null>}
   */
  async findFirst(selectors, timeoutMs) {
    const list = (selectors || []).filter(Boolean);
    if (!list.length) return null;
    const end = Date.now() + timeoutMs;
    for (;;) {
      for (const sel of list) {
        try {
          const found = await this.driver.$$(sel);
          if (found.length) return { el: found[0], how: sel };
        } catch {
          /* selector does not parse on this driver — try the next */
        }
      }
      if (Date.now() >= end) return null;
      await this.driver.pause(150);
    }
  }

  /** All visible text on screen, for diagnosing a failed assertion. */
  async visibleText() {
    const nodes = await this.tree();
    return nodes
      .map((n) => n.attrs.text || n.attrs['content-desc'] || n.attrs.label || '')
      .filter(Boolean)
      .join(' ');
  }
}

module.exports = {
  MobileDriver,
  capabilities,
  listAndroidDevices,
  listPackages,
  findAdb,
  findBuildTool,
  findSdkRoot,
  sdkRoots,
  readApkInfo,
  installApk,
  probeServer,
  DEFAULT_APPIUM_URL,
};
