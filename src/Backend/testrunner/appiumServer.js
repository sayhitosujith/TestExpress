'use strict';

// Starting and stopping a local Appium server on the tester's behalf.
//
// Separate from ./appium, which talks *to* a server that already exists: this
// module's only job is the lifetime of a child process, and the two change for
// entirely different reasons.
//
// Why this exists at all. The engine's own diagnostic used to end in "start one
// with: appium --address 127.0.0.1 --port 4723, and make sure ANDROID_HOME and
// JAVA_HOME are set in that shell". That instruction is the hard part of the
// setup restated as homework: on a normal Android Studio install the SDK and a
// perfectly good JDK are both already on disk, and neither variable is set —
// Studio does not set them. So the tester is asked to go and discover two paths
// that this process can find in a few milliseconds. It finds them, injects them
// into the child's environment, and offers a button instead.
//
// Deliberately not a detached process: the server dies with the backend. An
// orphan holding port 4723 after the app closes is worse than having to press
// the button again, because the next start would silently attach to a server
// nobody can see the log of.

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { probeServer, findSdkRoot, DEFAULT_APPIUM_URL } = require('./appium');

// First start loads every installed driver, which on a cold filesystem is slow
// enough that an impatient timeout would report failure on a server that was
// about to come up.
const START_TIMEOUT_MS = 90_000;
const POLL_MS = 700;
// Enough log to explain a failed start ("driver not installed", "port in use")
// without holding a session's worth of request logging in memory.
const LOG_LINES = 60;

/** @type {{child: import('child_process').ChildProcess, url: string, startedAt: number, log: string[]}|null} */
let managed = null;

// ---- discovery ------------------------------------------------------------

/**
 * Locate the `appium` package's JS entry point.
 *
 * The entry point rather than the `appium` shim on PATH: the shim is a .cmd on
 * Windows, and running that means going through a shell. Spawning
 * `node <entry>` keeps the child out of any shell, so no argument this module
 * builds can ever be reinterpreted as a command.
 *
 * @returns {string|null} absolute path to appium's bin script.
 */
function findAppiumEntry() {
  // A local install wins: a project that pinned its own Appium meant it.
  try {
    const pkg = require.resolve('appium/package.json', { paths: [path.join(__dirname, '..')] });
    const dir = path.dirname(pkg);
    const entry = path.join(dir, require(pkg).bin?.appium || 'index.js');
    if (fs.existsSync(entry)) return entry;
  } catch {
    /* not installed alongside the backend — fall through to the global roots */
  }
  const roots = [
    process.env.APPDATA && path.join(process.env.APPDATA, 'npm', 'node_modules'),
    process.env.npm_config_prefix && path.join(process.env.npm_config_prefix, 'lib', 'node_modules'),
    '/usr/local/lib/node_modules',
    '/usr/lib/node_modules',
    process.env.HOME && path.join(process.env.HOME, '.npm-global', 'lib', 'node_modules'),
    process.env.HOME && path.join(process.env.HOME, '.nvm', 'versions'),
  ].filter(Boolean);
  for (const root of roots) {
    const entry = path.join(root, 'appium', 'index.js');
    if (fs.existsSync(entry)) return entry;
  }
  return null;
}

/**
 * Locate a JDK.
 *
 * Android Studio ships one (its "JetBrains Runtime") and it is the JDK the
 * uiautomator2 driver is actually tested against, so it is preferred over
 * whatever else is lying around — and it is present on exactly the machines that
 * have an emulator but no JAVA_HOME.
 *
 * @returns {string|null} a JAVA_HOME whose bin/java exists.
 */
function findJavaHome() {
  const exe = process.platform === 'win32' ? 'java.exe' : 'java';
  const ok = (home) => home && fs.existsSync(path.join(home, 'bin', exe)) && home;

  if (ok(process.env.JAVA_HOME)) return process.env.JAVA_HOME;

  const studios = [
    'C:\\Program Files\\Android\\Android Studio',
    'C:\\Program Files (x86)\\Android\\Android Studio',
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'Android Studio'),
    '/Applications/Android Studio.app/Contents',
    '/opt/android-studio',
    process.env.HOME && path.join(process.env.HOME, 'android-studio'),
  ].filter(Boolean);
  for (const s of studios) {
    // Studio has moved this between releases: jbr today, jre before it, and the
    // mac layout buries the real home two directories deeper.
    for (const rel of ['jbr', 'jre', path.join('jbr', 'Contents', 'Home')]) {
      if (ok(path.join(s, rel))) return path.join(s, rel);
    }
  }

  // A standalone JDK, newest version first.
  const jdkDirs = [
    'C:\\Program Files\\Java',
    'C:\\Program Files\\Eclipse Adoptium',
    '/usr/lib/jvm',
    '/Library/Java/JavaVirtualMachines',
  ];
  for (const dir of jdkDirs) {
    if (!fs.existsSync(dir)) continue;
    const names = fs
      .readdirSync(dir)
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    for (const n of names) {
      if (ok(path.join(dir, n))) return path.join(dir, n);
      // macOS bundles nest the home inside the version directory.
      if (ok(path.join(dir, n, 'Contents', 'Home'))) return path.join(dir, n, 'Contents', 'Home');
    }
  }
  return null;
}

/**
 * Can this machine start a server, and with what?
 *
 * Answered before offering the button rather than after pressing it: "Appium is
 * not installed" is a different problem from "Appium failed to start", and only
 * one of them is worth a button.
 *
 * @returns {{canStart: boolean, appium: string|null, javaHome: string|null,
 *            sdkRoot: string|null, missing: string[]}}
 */
function preflight() {
  const appium = findAppiumEntry();
  const javaHome = findJavaHome();
  const sdkRoot = findSdkRoot();
  const missing = [];
  if (!appium) {
    missing.push('Appium itself is not installed. Install it with:\n  npm install -g appium');
  }
  if (!javaHome) {
    missing.push(
      'no JDK found. Install Android Studio (it bundles one) or a JDK, ' +
        'or set JAVA_HOME to an existing one.',
    );
  }
  if (!sdkRoot) {
    missing.push(
      'no Android SDK found. Install it through Android Studio > SDK Manager, ' +
        'or set ANDROID_HOME.',
    );
  }
  return { canStart: !missing.length, appium, javaHome, sdkRoot, missing };
}

// ---- lifecycle ------------------------------------------------------------

/**
 * Split a URL into the address and port Appium's own flags want.
 *
 * Parsed rather than string-split so a malformed value fails here instead of
 * reaching the command line.
 */
function addressOf(url) {
  const u = new URL(url);
  const port = Number(u.port) || (u.protocol === 'https:' ? 443 : 80);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`"${url}" has no usable port`);
  }
  return { host: u.hostname, port };
}

const logTail = () => (managed ? managed.log.slice(-LOG_LINES).join('\n') : '');

/**
 * Current state of the server, from this module's point of view.
 *
 * `managed` distinguishes a server this process started from one the tester ran
 * themselves; only the former may be stopped from here.
 */
async function status(url = DEFAULT_APPIUM_URL) {
  const probe = await probeServer(url);
  return {
    up: probe.up,
    build: probe.build || null,
    url,
    managed: !!managed,
    pid: managed ? managed.child.pid : null,
    startedAt: managed ? managed.startedAt : null,
    log: logTail(),
    ...preflight(),
  };
}

function record(line) {
  if (!managed) return;
  for (const l of String(line).split(/\r?\n/)) {
    if (l.trim()) managed.log.push(l.trimEnd());
  }
  if (managed.log.length > LOG_LINES * 4) managed.log = managed.log.slice(-LOG_LINES * 2);
}

/**
 * Start a local Appium server and resolve once it answers `/status`.
 *
 * @param {string} url where the server should listen.
 * @returns {Promise<object>} the same shape as status().
 * @throws when the server is already running elsewhere, cannot be started, or
 *         exits or times out before answering — the log tail comes with it.
 */
async function start(url = DEFAULT_APPIUM_URL) {
  const already = await probeServer(url);
  if (already.up) return status(url);
  // A previous child that died leaves its handle behind; clear it rather than
  // refusing to start because of a process that no longer exists.
  if (managed && managed.child.exitCode !== null) managed = null;
  if (managed) {
    const e = new Error('a server is already starting up here');
    e.status = 409;
    throw e;
  }

  const pre = preflight();
  if (!pre.canStart) {
    const e = new Error(pre.missing.join('\n\n'));
    e.status = 501;
    throw e;
  }

  const { host, port } = addressOf(url);
  const child = spawn(
    process.execPath,
    [pre.appium, '--address', host, '--port', String(port), '--log-timestamp'],
    {
      // The whole point: Studio sets neither of these, so the child gets them
      // from what was found on disk instead of from a shell nobody configured.
      env: {
        ...process.env,
        JAVA_HOME: pre.javaHome,
        ANDROID_HOME: pre.sdkRoot,
        ANDROID_SDK_ROOT: pre.sdkRoot,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    },
  );

  managed = { child, url, startedAt: Date.now(), log: [] };
  child.stdout.on('data', (b) => record(b.toString()));
  child.stderr.on('data', (b) => record(b.toString()));
  child.on('error', (err) => record(`spawn failed: ${err.message}`));

  let exited = null;
  child.on('exit', (code, signal) => {
    exited = { code, signal };
    record(`appium exited (code ${code}${signal ? `, signal ${signal}` : ''})`);
  });

  const deadline = Date.now() + START_TIMEOUT_MS;
  for (;;) {
    if (exited) {
      const tail = logTail();
      managed = null;
      const e = new Error(
        `Appium exited before it was ready (code ${exited.code}).` + (tail ? `\n\n${tail}` : ''),
      );
      e.status = 500;
      throw e;
    }
    const probe = await probeServer(url);
    if (probe.up) return status(url);
    if (Date.now() >= deadline) {
      const tail = logTail();
      await stop();
      const e = new Error(
        `Appium did not answer at ${url} within ${Math.round(START_TIMEOUT_MS / 1000)}s.` +
          (tail ? `\n\n${tail}` : ''),
      );
      e.status = 504;
      throw e;
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

/**
 * Stop the server this process started.
 *
 * A server the tester started themselves is left alone: it is not ours to kill,
 * and it may be serving something else.
 */
async function stop() {
  if (!managed) return { stopped: false, reason: 'no server was started from here' };
  const { child } = managed;
  managed = null;
  if (child.exitCode !== null) return { stopped: true };
  await new Promise((resolve) => {
    const done = setTimeout(() => {
      // SIGTERM is ignored on Windows and Appium can also be mid-teardown of a
      // driver; escalate rather than leaving the port held.
      child.kill('SIGKILL');
      resolve();
    }, 5000);
    child.once('exit', () => {
      clearTimeout(done);
      resolve();
    });
    child.kill();
  });
  return { stopped: true };
}

// Never outlive the backend: an Appium nobody can see is worse than no Appium.
for (const sig of ['exit', 'SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    if (managed && managed.child.exitCode === null) managed.child.kill('SIGKILL');
  });
}

module.exports = {
  preflight,
  status,
  start,
  stop,
  findAppiumEntry,
  findJavaHome,
};
