// Client for the native-mobile test engine (src/Backend/routes/mobile.js).
//
// Deliberately the same method surface as RemoteSession in ./trRemote: open,
// close, goto, setRecording, setAssertMode, putSteps, runStep, pick, sendInput,
// screenshotUrl, screenshot, pollSteps. The recorder drives whichever of the two
// it is handed without branching on which engine it got, so the shared interface
// is the point rather than a coincidence — see the `driven` flag in TestRunner.
//
// Two things genuinely differ and cannot be hidden:
//
//   * A mobile screen has no URL. Its address is the foreground app package, so
//     `goto` takes a package name and `url` reports one.
//   * The viewport is the device's own and varies per device (a Pixel reports
//     1080x2092), where the browser engine hands every session the same 1280x720.
//     So the pane must map clicks against `session.viewport` rather than a
//     module-level constant.

const BASE = "/api/mobile";

async function call(path, { method = "GET", body, signal } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    signal,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`backend returned non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) throw new Error((data && data.error) || `request failed (${res.status})`);
  return data;
}

/**
 * Can the mobile engine run, and against what?
 *
 * Returns `{ available, reason, devices, apps, platforms, adb, appiumUrl }`.
 * Never throws: an unreachable backend is a normal answer here, because the UI
 * only uses this to decide whether to offer the engine.
 *
 * `reason` names the one missing piece of setup — webdriverio, the Appium
 * server, adb, or an attached device — rather than a generic failure, since each
 * has a different fix.
 */
export async function mobileCapabilities() {
  try {
    const caps = await call("/capabilities");
    return { devices: [], apps: [], platforms: ["Android"], ...caps };
  } catch (err) {
    return {
      available: false,
      devices: [],
      apps: [],
      platforms: [],
      reason:
        `cannot reach the backend at ${BASE} — is it running? ` +
        `(npm run dev starts it on :5000)\n${err.message}`,
    };
  }
}

/**
 * State of the local Appium server: is it up, did we start it, what would it be
 * started with. Never throws, for the same reason mobileCapabilities does not.
 */
export async function appiumServerStatus() {
  try {
    return await call("/server");
  } catch (err) {
    return { up: false, managed: false, canStart: false, missing: [err.message] };
  }
}

/**
 * Start a local Appium server, resolving only once it answers.
 *
 * Slow by nature — the first start loads every installed driver — so the caller
 * is expected to be showing something while it runs. The rejection carries the
 * tail of the server's own log, which is the only thing that explains a failure
 * like a missing driver or an occupied port.
 */
export async function startAppiumServer() {
  return call("/server/start", { method: "POST", body: {} });
}

/** Stop the server we started. Refused by the backend while a session is live. */
export async function stopAppiumServer() {
  return call("/server/stop", { method: "POST", body: {} });
}

/**
 * Which virtual devices this machine could boot, and what is missing if none.
 *
 * Never throws, matching mobileCapabilities: this is asked to decide what to
 * offer, and a screen that cannot render because the question failed is worse
 * than one that offers instructions.
 */
export async function emulatorOptions() {
  try {
    return await call("/emulator");
  } catch (err) {
    return { canStart: false, avds: [], emulator: null, adb: null, missing: [err.message] };
  }
}

/**
 * Boot an Android emulator, resolving only once it has finished starting.
 *
 * Minutes, not seconds, on a cold boot — the caller must be showing something
 * while it runs. Resolves on `sys.boot_completed` rather than on adb merely
 * seeing the device, because a session created in that gap fails in ways that
 * look like a broken app.
 */
export async function startEmulator(avd) {
  return call("/emulator/start", { method: "POST", body: { avd: avd || null } });
}

/** Installed packages on a device, so the app picker is a list and not a guess. */
export async function mobileApps(udid) {
  const data = await call(`/apps?udid=${encodeURIComponent(udid || "")}`);
  return data.apps || [];
}

/**
 * Install an APK the tester picked on their own machine, and report what it is.
 *
 * Uploaded as multipart rather than posted as JSON: an APK is routinely hundreds
 * of megabytes, which base64 in a JSON body would inflate by a third and the
 * body parser would reject outright.
 *
 * Uses XMLHttpRequest rather than fetch for one reason — upload progress. A
 * multi-hundred-megabyte transfer with no indication of movement is
 * indistinguishable from a hang, and this is the one call in the app slow enough
 * for that to matter.
 *
 * @param {File} file the chosen .apk
 * @param {string} udid device to install onto
 * @param {(pct: number) => void} [onProgress] 0-100, upload only
 * @returns {Promise<{package: string, activity: string|null, label: string|null}>}
 */
export function installApk(file, udid, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("apk", file);
    if (udid) form.append("udid", udid);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE}/apk`);
    xhr.upload.onprogress = (e) => {
      if (onProgress && e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let data = null;
      try {
        data = JSON.parse(xhr.responseText || "null");
      } catch {
        reject(new Error(`backend returned non-JSON (${xhr.status})`));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error((data && data.error) || `install failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("the upload failed — is the backend still running?"));
    xhr.send(form);
  });
}

// A package name is long and repetitive; the last segment is what identifies it
// to a human ("com.android.settings" -> "settings").
export const appLabel = (pkg) => {
  const s = String(pkg || "");
  const tail = s.split(".").pop();
  return tail && tail.length > 1 ? tail : s;
};

/** One recording/playback session against one device. */
export class MobileSession {
  constructor(state) {
    this.id = state.id;
    this.state = state;
  }

  static async open({ app, udid, platform = "Android", appiumUrl } = {}) {
    const state = await call("/session", {
      method: "POST",
      body: { app, udid, platform, appiumUrl },
    });
    return new MobileSession(state);
  }

  // The device's own screen size. The pane maps clicks against this, so it must
  // come from the session rather than a constant — an emulator and a tablet do
  // not share a viewport.
  get viewport() {
    return this.state.viewport || { width: 1080, height: 1920 };
  }

  // Named to match RemoteSession.browser so the report and the run header can
  // read one property for "what actually ran this".
  get browser() {
    return `${this.state.platform || "Android"} ${this.state.udid || ""}`.trim();
  }

  get device() {
    return this.state.udid || "device";
  }

  get deviceName() {
    return this.state.udid || "device";
  }

  // The browser engine reports a downgrade here (a phone emulated on Firefox).
  // Nothing on this engine is emulated, so there is never anything to disclaim.
  get deviceNote() {
    return null;
  }

  /** The foreground app package — a mobile screen's address. */
  get url() {
    return this.state.url;
  }

  get app() {
    return this.state.app;
  }

  async close() {
    try {
      await call(`/session/${this.id}`, { method: "DELETE" });
    } catch {
      /* already reaped */
    }
  }

  /** Bring an app to the foreground. `url` is a package name on this engine. */
  async goto(url) {
    this.state = await call(`/session/${this.id}/goto`, { method: "POST", body: { url } });
    return this.state;
  }

  async setRecording(on) {
    this.state = await call(`/session/${this.id}/recording`, { method: "POST", body: { on } });
    return this.state;
  }

  async setAssertMode(on) {
    this.state = await call(`/session/${this.id}/assert`, { method: "POST", body: { on } });
    return this.state;
  }

  async putSteps(steps) {
    this.state = await call(`/session/${this.id}/steps`, { method: "POST", body: { steps } });
    return this.state;
  }

  async runStep(step, { resetImplicit } = {}) {
    return call(`/session/${this.id}/step`, {
      method: "POST",
      body: { step, resetImplicit: !!resetImplicit },
    });
  }

  async pick(x, y) {
    return call(`/session/${this.id}/pick`, { method: "POST", body: { x, y } });
  }

  async sendInput(input) {
    return call(`/session/${this.id}/input`, { method: "POST", body: input });
  }

  /** The accessibility tree, for working out why a locator missed. */
  async source() {
    const res = await fetch(`${BASE}/session/${this.id}/source`);
    if (!res.ok) throw new Error(`could not read the screen's element tree (${res.status})`);
    return res.text();
  }

  screenshotUrl(nonce) {
    return `${BASE}/session/${this.id}/screenshot?n=${nonce}`;
  }

  // A frame kept as evidence has to outlive the session, so it is stored as a
  // data URL rather than a link that will 404 once the device is released.
  // Returns null rather than throwing: a missing shot must never fail its step.
  async screenshot() {
    try {
      const res = await fetch(this.screenshotUrl(`s${Date.now()}`));
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  async pollSteps(since, { wait = 20000, signal } = {}) {
    const data = await call(`/session/${this.id}/steps?since=${since}&wait=${wait}`, { signal });
    this.state = { ...data, steps: undefined };
    return data;
  }
}

// Keys worth forwarding to a device as key presses rather than inserted text.
// Shorter than the browser list on purpose: a phone has no page-up, and the
// arrow keys move a d-pad focus ring that most apps do not use.
const NAMED_KEYS = new Set(["Enter", "Tab", "Backspace", "Delete", "Escape"]);

/** Turn a React keydown into the input message the mobile backend expects. */
export function mobileKeyInputFor(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  if (NAMED_KEYS.has(e.key)) return { type: "key", key: e.key };
  if (e.key.length === 1) return { type: "text", text: e.key };
  return null;
}
