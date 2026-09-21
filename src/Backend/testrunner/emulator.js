'use strict';

// Starting an Android emulator on the tester's behalf.
//
// The sibling of ./appiumServer, and it exists for the same reason. That module
// stopped telling people to run `appium --address …` in a shell with two
// environment variables they had to go and find; this one stops the capability
// probe ending in "start an emulator (Android Studio > Device Manager)".
//
// That instruction was wrong in two separate ways on a machine that is not the
// author's:
//
//   * it names a GUI that need not be installed. Android Studio is an IDE. The
//     pieces that actually matter — adb, the emulator binary, a system image —
//     ship in the command-line SDK and install without it, and plenty of CI
//     boxes and lightweight dev machines have exactly that. Telling someone to
//     open Device Manager on a machine with no Studio is a dead end.
//   * it is homework even when Studio *is* installed. An AVD that already
//     exists can be booted from here in one press; sending someone to another
//     application to press a button this process could press is the same
//     mistake ./appiumServer was written to undo.
//
// So: find the emulator binary, list the AVDs, boot one, and wait until it is
// genuinely ready rather than merely visible to adb.
//
// Deliberately detached, which is the opposite of what ./appiumServer does, and
// the difference is not an oversight. An Appium server is cheap to restart and
// an orphan holding port 4723 is actively confusing. An emulator takes minutes
// to boot, survives perfectly well on its own, and is routinely shared with
// whatever else the tester is doing — killing it because the backend restarted
// would be rude and expensive.

const { spawn, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { findAdb, listAndroidDevices, sdkRoots } = require('./appium');

const execFileAsync = promisify(execFile);

// A cold boot on a slow disk genuinely takes minutes. The cap is high because
// reporting failure on an emulator that was about to finish is worse than
// waiting: the tester then has two emulators booting and no idea why.
const BOOT_TIMEOUT_MS = 240_000;
const POLL_MS = 1500;
const LOG_LINES = 40;

/** @type {{child: import('child_process').ChildProcess, avd: string, startedAt: number, log: string[]}|null} */
let launched = null;

// ---- discovery ------------------------------------------------------------

const exe = (name) => (process.platform === 'win32' ? `${name}.exe` : name);

/**
 * Locate the `emulator` binary.
 *
 * Checked in the modern location first. `tools/emulator` is the pre-2018 layout
 * and still present on long-lived SDK installs, where it is a stub that refuses
 * to run from outside its own directory — but a machine that has it and not
 * `emulator/emulator` is a machine where the stub is the only thing to try.
 *
 * @returns {string|null} absolute path, or null when no SDK provides one.
 */
function findEmulator() {
  for (const root of sdkRoots()) {
    for (const rel of [['emulator', exe('emulator')], ['tools', exe('emulator')]]) {
      const p = path.join(root, ...rel);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

/**
 * The AVDs this machine has defined.
 *
 * Asked of the emulator binary rather than read out of ~/.android/avd, because
 * the binary is the thing that will be asked to boot one and its list is
 * therefore the only list that matters.
 *
 * @returns {Promise<string[]>} AVD names, empty when there are none or no binary.
 */
async function listAvds() {
  const bin = findEmulator();
  if (!bin) return [];
  try {
    const { stdout } = await execFileAsync(bin, ['-list-avds'], { timeout: 15_000 });
    return stdout
      .split('\n')
      .map((line) => line.trim())
      // The binary prints diagnostics to stdout on some builds ("INFO | …"),
      // which would otherwise be offered to the tester as bootable devices.
      .filter((line) => line && !line.includes(' ') && !/^(INFO|WARNING|ERROR)\b/.test(line));
  } catch {
    return [];
  }
}

/**
 * What this machine can and cannot do about attaching a device, and how to fix
 * whatever is missing — without naming an IDE.
 *
 * The install lines are `sdkmanager` invocations on purpose. That is the
 * supported way to get these packages, it works identically on every platform,
 * and it is the only route available on a machine that will never have Studio.
 *
 * @returns {{canStart: boolean, emulator: string|null, adb: string|null,
 *            avds: string[], missing: string[]}}
 */
async function preflight() {
  const emulator = findEmulator();
  const adb = findAdb();
  const avds = await listAvds();
  const missing = [];

  if (!adb) {
    missing.push(
      'adb is not installed. It ships in the SDK platform-tools, which do not ' +
        'need Android Studio:\n' +
        '  sdkmanager "platform-tools"\n' +
        'or download the platform-tools zip from developer.android.com and set ' +
        'ANDROID_HOME to the folder holding it.',
    );
  }
  if (!emulator) {
    missing.push(
      'no emulator binary. Only needed for a virtual device — a physical phone ' +
        'over USB needs adb and nothing else:\n' +
        '  sdkmanager "emulator" "system-images;android-34;google_apis;x86_64"',
    );
  } else if (!avds.length) {
    missing.push(
      'the emulator is installed but no virtual device is defined. Create one ' +
        'without Android Studio:\n' +
        '  sdkmanager "system-images;android-34;google_apis;x86_64"\n' +
        '  avdmanager create avd -n testexpress -k "system-images;android-34;google_apis;x86_64"',
    );
  }

  return { canStart: !!emulator && avds.length > 0, emulator, adb, avds, missing };
}

// ---- boot -----------------------------------------------------------------

const logTail = () => (launched ? launched.log.slice(-LOG_LINES).join('\n') : '');

function record(line) {
  if (!launched) return;
  String(line)
    .split('\n')
    .map((l) => l.trimEnd())
    .filter(Boolean)
    .forEach((l) => launched.log.push(l));
  if (launched.log.length > LOG_LINES * 4) launched.log = launched.log.slice(-LOG_LINES * 2);
}

/**
 * Is this device finished booting?
 *
 * `adb devices` reporting "device" is not the same thing and the gap is minutes
 * wide: an emulator answers adb long before Android has finished starting, and
 * a session created in that window fails with errors that look like a broken
 * app rather than a device that was not ready. `sys.boot_completed` is the
 * property the platform sets when it genuinely is.
 */
async function isBooted(udid) {
  const adb = findAdb();
  if (!adb) return false;
  try {
    const { stdout } = await execFileAsync(adb, ['-s', udid, 'shell', 'getprop', 'sys.boot_completed'], {
      timeout: 10_000,
    });
    return stdout.trim() === '1';
  } catch {
    // Perfectly normal while the device is still coming up — adb refuses the
    // shell until it is there.
    return false;
  }
}

/** Any device adb can see that has finished booting. */
async function bootedDevice() {
  const devices = (await listAndroidDevices()).filter((d) => d.state === 'device');
  for (const d of devices) {
    if (await isBooted(d.udid)) return d;
  }
  return null;
}

/**
 * Boot an AVD and wait until it can actually take a session.
 *
 * @param {string} [avd] which AVD; defaults to the first defined.
 * @returns {Promise<{udid: string, model: string|null, avd: string, alreadyRunning: boolean}>}
 */
async function start(avd) {
  // Already have one? Then there is nothing to do, and booting a second
  // emulator because the tester pressed a button twice is a five-minute mistake
  // on a machine that was already ready.
  const existing = await bootedDevice();
  if (existing) return { ...existing, avd: avd || null, alreadyRunning: true };

  const { canStart, emulator, avds, missing } = await preflight();
  if (!canStart) throw new Error(missing.join('\n\n') || 'no emulator available');

  const name = avd && avds.includes(avd) ? avd : avds[0];

  launched = { child: null, avd: name, startedAt: Date.now(), log: [] };
  const child = spawn(emulator, ['-avd', name, '-no-snapshot-save'], {
    // Detached: see the note at the top. stdio still piped so a refusal to boot
    // ("no space left", "HAXM is not installed") is reportable rather than
    // vanishing into a console nobody sees.
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  launched.child = child;
  child.stdout.on('data', record);
  child.stderr.on('data', record);
  // Unreferenced so the emulator outliving the backend cannot hold Node open.
  child.unref();

  let failed = null;
  child.on('error', (err) => {
    failed = err.message;
  });
  child.on('exit', (code) => {
    // A boot that exits at all has failed — a healthy emulator runs until it is
    // closed.
    if (code !== 0) failed = failed || `the emulator exited with code ${code}`;
  });

  const deadline = Date.now() + BOOT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (failed) throw new Error(`${failed}\n\n${logTail()}`.trim());
    const device = await bootedDevice();
    if (device) return { ...device, avd: name, alreadyRunning: false };
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  throw new Error(
    `"${name}" did not finish booting within ${Math.round(BOOT_TIMEOUT_MS / 1000)}s.\n\n${logTail()}`.trim(),
  );
}

module.exports = { preflight, start, listAvds, findEmulator, isBooted, bootedDevice };
