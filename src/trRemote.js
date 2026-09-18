// Client for the real-browser test engine (src/Backend/routes/testrunner.js).
//
// The  engine drives an <iframe> and is therefore confined to this origin
// by the same-origin policy. This one drives a real Playwright browser on the
// backend, so any URL on any origin can be recorded and replayed. Both produce
// and consume the same step objects.

const BASE = "/api/testrunner";

// Viewport the backend gives every session, in css pixels. Forwarded clicks are
// mapped back into it, so this must match VIEWPORT in routes/testrunner.js.
//
// The frames themselves are larger than this — the backend captures at a device
// scale factor of 2 so the pane can fill a big monitor without upscaling. That
// is a pixel-density difference only and deliberately does not appear here:
// coordinates are css pixels at both ends, and toViewportCoords maps from the
// element's rect proportionally, so the image's own resolution never enters into
// it. Scaling the frame is free; changing this number is not.
export const REMOTE_VIEWPORT = { width: 1280, height: 720 };

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
    // A proxy error or an HTML error page — surface it as-is rather than as
    // "Unexpected token <", which tells the user nothing.
    throw new Error(`backend returned non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) throw new Error((data && data.error) || `request failed (${res.status})`);
  return data;
}

// Is the engine installed and usable? Returns
// { available, reason, browsers: [{ id, name, engine, installed, reason }] }.
// Never throws: an unreachable backend is a normal answer here, not an error,
// because the UI only uses this to decide what to offer.
export async function remoteCapabilities() {
  try {
    const caps = await call("/capabilities");
    return { browsers: [], ...caps };
  } catch (err) {
    return {
      available: false,
      browsers: [],
      reason:
        `cannot reach the backend at ${BASE} — is it running? ` +
        `(npm run dev starts it on :5000)\n${err.message}`,
    };
  }
}

// What a browser is called in the UI, for an id that arrived from a stored
// preference or an old report rather than from `capabilities`.
export const browserLabel = (id) =>
  ({ chromium: "Chromium", firefox: "Firefox", webkit: "WebKit" })[id] || id || "Chromium";

// One recording/playback session against one real browser page.
export class RemoteSession {
  constructor(state) {
    this.id = state.id;
    this.state = state;
  }

  static async open({ url, headless, browser, device }) {
    const state = await call("/session", {
      method: "POST",
      body: { url, headless, browser, device },
    });
    return new RemoteSession(state);
  }

  // Which engine this session is actually running in — the backend's answer,
  // not what was asked for, so a fallback can never be reported as the choice.
  get browser() {
    return this.state.browser || "chromium";
  }

  // Same rule for the device: the backend downgrades an unsupported
  // engine/device pair to viewport-only, and `deviceNote` says so. Reading the
  // request back instead would report emulation that never happened.
  get device() {
    return this.state.device || "desktop";
  }

  get deviceName() {
    return this.state.deviceName || "Desktop";
  }

  get deviceNote() {
    return this.state.deviceNote || null;
  }

  get url() {
    return this.state.url;
  }

  async close() {
    // Best-effort: a reaped or already-closed session is not a failure worth
    // reporting to someone who is just closing the recorder.
    try {
      await call(`/session/${this.id}`, { method: "DELETE" });
    } catch {
      /* already gone */
    }
  }

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

  // Replace the server's buffer after the user edits, reorders or deletes steps
  // in the panel — the client owns the canonical list.
  async putSteps(steps) {
    this.state = await call(`/session/${this.id}/steps`, { method: "POST", body: { steps } });
    return this.state;
  }

  async runStep(step, { resetImplicit, selfHeal } = {}) {
    return call(`/session/${this.id}/step`, {
      method: "POST",
      // selfHeal travels with every step rather than with the session: it is a
      // preference the user can change between runs without relaunching a
      // browser. Undefined means the backend's default, which matches the
      //  engine's.
      body: { step, resetImplicit: !!resetImplicit, selfHeal },
    });
  }

  // Describe the element at a point in the viewport without clicking it, as the
  // locator bundle a step carries. This is how the target of a hover is chosen
  // on this engine: the user is looking at a screenshot, so the page has to be
  // asked what is under the pointer.
  async pick(x, y) {
    return call(`/session/${this.id}/pick`, { method: "POST", body: { x, y } });
  }

  async sendInput(input) {
    return call(`/session/${this.id}/input`, { method: "POST", body: input });
  }

  // Cache-busted so the <img> actually refetches; the route sends no-store too.
  screenshotUrl(nonce) {
    return `${BASE}/session/${this.id}/screenshot?n=${nonce}`;
  }

  // The viewport right now, as a data URL. The live preview pane can just point
  // an <img> at the endpoint, but a screenshot kept as evidence has to outlive
  // the session — once it is reaped, the URL 404s and the report is left with a
  // broken image where its proof used to be. Returns null rather than throwing:
  // a missing shot must never fail the step it belongs to.
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

  // Long-poll for steps the user just produced in the real browser. Resolves
  // with { steps, revision, url, … } as soon as anything changes, or after the
  // wait budget elapses. `signal` lets the caller stop cleanly on unmount.
  async pollSteps(since, { wait = 20000, signal } = {}) {
    const data = await call(
      `/session/${this.id}/steps?since=${since}&wait=${wait}`,
      { signal },
    );
    this.state = { ...data, steps: undefined };
    return data;
  }
}

// Map a click inside the preview <img> onto viewport coordinates in the real
// page. The image is rendered at whatever width the layout gives it, so the
// ratio — not the raw offset — is what transfers.
//
// `viewport` is a parameter rather than the constant because the mobile engine
// shares this pane and a device reports its own screen size — a Pixel is
// 1080x2092, not 1280x720. Mapping a phone frame against the browser's viewport
// would send every tap to the wrong place.
export function toViewportCoords(img, clientX, clientY, viewport = REMOTE_VIEWPORT) {
  const rect = img.getBoundingClientRect();
  if (!rect.width || !rect.height) return { x: 0, y: 0 };
  return {
    x: Math.round(((clientX - rect.left) / rect.width) * viewport.width),
    y: Math.round(((clientY - rect.top) / rect.height) * viewport.height),
  };
}

// Keys worth forwarding as key presses rather than inserted text.
const NAMED_KEYS = new Set([
  "Enter",
  "Tab",
  "Backspace",
  "Delete",
  "Escape",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);

// Turn a React keydown into the input message the backend expects, or null when
// the event is not something to forward (a modifier on its own, a shortcut).
export function keyInputFor(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  if (NAMED_KEYS.has(e.key)) return { type: "key", key: e.key };
  if (e.key.length === 1) return { type: "text", text: e.key };
  return null;
}
