import { useSyncExternalStore } from "react";
import { getBranding, putBranding } from "./api/settings";
import { getToken } from "./api/authToken";

/**
 * What the app calls itself: its mark, its name and the line under the name.
 *
 * Stored in the `settings` table on the server, with localStorage kept as this
 * browser's cache of it. The same contract the collections use -- the local
 * copy is what the first paint reads, the database is the one everybody shares.
 * It matters here because branding is not a preference: an administrator who
 * renames the app means to rename it for the practice, not for the machine they
 * happened to be sitting at.
 *
 * The cache is not just an optimisation. Every screen wears this, including the
 * loading overlay and the sign-in page, and those render before any request has
 * come back -- reading the server first would mean the app flashed its built-in
 * name on every load. So: paint from the cache, correct from the server, and if
 * the server has nothing to say (no DATABASE_URL, or not running) the cache is
 * simply the answer.
 *
 * A module rather than state in a page because none of the screens that wear
 * this are mounted at the same time. TestExpressMark and each header read from
 * here, so one edit reaches the runner, the landing page, the sign-in screen and
 * the loading overlay without any of them knowing about the others.
 */

/** Cache keys, one per field: a name edit must not rewrite the logo's base64. */
const KEYS = { logo: "appLogo", name: "appName", tagline: "appTagline" };

/** The largest logo accepted, before base64 expands it by about a third. */
export const LOGO_MAX_BYTES = 512 * 1024;

/** What the app is called when nobody has renamed it. */
export const DEFAULT_NAME = "TESTEXPRESS";

/** The line under the name, likewise. */
export const DEFAULT_TAGLINE = "AI Powered Test Automation Tool";

// Long enough for a real product name and its tagline, short enough that
// neither can wrap a header into two lines or push the controls off it.
export const NAME_MAX = 40;
export const TAGLINE_MAX = 80;

// Typing in the name field calls saveBranding on every keystroke. The cache is
// written each time -- it is free, and it keeps the header live under the
// cursor -- but the server is not: this settles the edit first, so a
// ten-character name is one row update rather than ten.
const PUSH_DELAY_MS = 400;

/**
 * The cached snapshot.
 *
 * useSyncExternalStore compares snapshots by identity and re-reads on every
 * render, so building a fresh object in getSnapshot would loop forever. Read
 * once, rebuilt only when something actually changed.
 */
let snapshot = read();

/** How the last push to the server went. A separate snapshot, for the same reason. */
let syncSnapshot = { saving: false, error: null };

const listeners = new Set();
const syncListeners = new Set();

/** One cached string, or the default. Never throws: storage can be disabled. */
function readText(key, fallback, max) {
  try {
    const stored = (localStorage.getItem(key) || "").trim();
    // Length is enforced on the way out as well as on the way in: this is
    // hand-editable storage, and an overlong name breaks a header rather than
    // just looking wrong.
    return stored && stored.length <= max ? stored : fallback;
  } catch {
    return fallback;
  }
}

/** The cached logo as a data URL, or null. */
function readLogo() {
  try {
    const stored = localStorage.getItem(KEYS.logo);
    // Anything that is not an image data URL is dropped rather than rendered:
    // this is hand-editable storage feeding an img src.
    return stored && stored.startsWith("data:image/") ? stored : null;
  } catch {
    return null;
  }
}

function read() {
  return {
    logo: readLogo(),
    name: readText(KEYS.name, DEFAULT_NAME, NAME_MAX),
    tagline: readText(KEYS.tagline, DEFAULT_TAGLINE, TAGLINE_MAX),
  };
}

/** Writes one cache key, or clears it. Throws if storage refuses. */
function writeKey(key, value) {
  if (value) localStorage.setItem(key, value);
  else localStorage.removeItem(key);
}

/** Applies a whole branding to the cache, silently. Used when adopting the server's copy. */
function cache(branding) {
  try {
    writeKey(KEYS.logo, branding.logo);
    writeKey(KEYS.name, branding.name);
    writeKey(KEYS.tagline, branding.tagline);
  } catch (err) {
    // A full or blocked store costs this browser its fast first paint and
    // nothing else -- the server still has the value.
    console.warn("[appBranding] not cached:", err);
  }
}

/** Re-reads the cache, replacing the snapshot only if a field actually moved. */
function refresh() {
  const next = read();
  const same =
    next.logo === snapshot.logo &&
    next.name === snapshot.name &&
    next.tagline === snapshot.tagline;
  if (same) return;
  snapshot = next;
  listeners.forEach((fn) => fn());
}

function setSync(next) {
  if (next.saving === syncSnapshot.saving && next.error === syncSnapshot.error) return;
  syncSnapshot = next;
  syncListeners.forEach((fn) => fn());
}

// ---------------------------------------------------------------------------
// Pushing to the server
// ---------------------------------------------------------------------------

/** Fields edited since the last push, merged. Null when nothing is waiting. */
let pending = null;
let pushTimer = null;

/**
 * Sends everything that has accumulated in `pending`.
 *
 * The server answers with the branding as it stored it -- trimmed and capped --
 * and that is adopted, but only when nothing new arrived while the request was
 * in flight. Adopting a stale answer over a fresher keystroke is how a field
 * ends up fighting the person typing in it.
 */
async function flush() {
  pushTimer = null;
  const patch = pending;
  pending = null;
  if (!patch) return;

  setSync({ saving: true, error: null });
  try {
    const stored = await putBranding(patch);
    if (!pending && stored) {
      cache({
        logo: stored.logo || null,
        name: stored.name || "",
        tagline: stored.tagline || "",
      });
      refresh();
    }
    setSync({ saving: false, error: null });
  } catch (err) {
    // Reported rather than swallowed. The edit is in this browser either way,
    // so silence would leave an administrator believing they had renamed the
    // app for everybody when they had renamed it only for themselves.
    setSync({ saving: false, error: err.message });
  }
}

/** Queues a patch for the server, coalescing it with anything already waiting. */
function push(patch) {
  pending = { ...(pending || {}), ...patch };
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(flush, PUSH_DELAY_MS);
}

// ---------------------------------------------------------------------------
// Reading from the server
// ---------------------------------------------------------------------------

/** So a page with five components wearing the branding still fetches once. */
let hydrated = false;

/**
 * Takes the server's copy, or offers this browser's when the server has none.
 *
 * That second half is a one-time migration rather than a general rule: branding
 * chosen before it was stored server-side lives only in whoever configured it,
 * and without this it would disappear behind the built-in name the moment this
 * shipped. Only attempted with a session in hand, because the write needs a
 * Super Admin and firing a request that is certain to be refused, on every page
 * load, for everybody else, is just noise.
 */
async function hydrate() {
  if (hydrated) return;
  hydrated = true;

  let stored;
  try {
    stored = await getBranding();
  } catch (err) {
    // A configured database that is failing. Worth a line in the console; not
    // worth an error on a screen, because the cache has already rendered.
    console.warn("[appBranding] could not read the shared branding:", err.message);
    return;
  }
  if (!stored) return; // nothing shared to have: keep this browser's copy

  if (stored.logo || stored.name || stored.tagline) {
    cache({
      logo: stored.logo || null,
      name: stored.name || "",
      tagline: stored.tagline || "",
    });
    refresh();
    return;
  }

  const local = read();
  const custom = {};
  if (local.logo) custom.logo = local.logo;
  if (local.name !== DEFAULT_NAME) custom.name = local.name;
  if (local.tagline !== DEFAULT_TAGLINE) custom.tagline = local.tagline;
  if (Object.keys(custom).length && getToken()) push(custom);
}

// ---------------------------------------------------------------------------
// The public surface
// ---------------------------------------------------------------------------

/**
 * Writes one field, or clears it back to the default.
 *
 * A blank name or tagline is a request for the built-in one, not an empty
 * header: the field is the only control, so emptying it has to mean something
 * useful. `logo` takes null for the same reason.
 *
 * Returns as soon as the cache is written, so the header updates under the
 * cursor. The server write is queued and settles a moment later; whether it
 * arrived is reported through `useBrandingSync`, not through this return value,
 * which answers only "could this browser hold it" -- quota being the realistic
 * failure, a few hundred KB of base64 on top of whatever else is stored here.
 *
 * @param {{logo?: string|null, name?: string, tagline?: string}} patch
 * @returns {string|null} why it could not be cached, or null on success.
 */
export function saveBranding(patch) {
  const clean = {};
  if ("logo" in patch) clean.logo = patch.logo || null;
  if ("name" in patch) clean.name = String(patch.name || "").trim().slice(0, NAME_MAX);
  if ("tagline" in patch) {
    clean.tagline = String(patch.tagline || "").trim().slice(0, TAGLINE_MAX);
  }
  if (!Object.keys(clean).length) return null;

  // Queued before the cache is touched, so a browser that refuses to store the
  // logo still shares it -- that failure costs this tab its copy, not everyone
  // else's.
  push(clean);

  try {
    if ("logo" in clean) writeKey(KEYS.logo, clean.logo);
    if ("name" in clean) writeKey(KEYS.name, clean.name);
    if ("tagline" in clean) writeKey(KEYS.tagline, clean.tagline);
  } catch (err) {
    console.warn("[appBranding] not cached:", err);
    refresh();
    // Only the logo is ever big enough for a browser to refuse it, so the
    // advice is about the file rather than about the field.
    return "This browser would not store that. Try a smaller image.";
  }
  refresh();
  return null;
}

/** Restores the built-in mark, name and tagline, for everyone. */
export function resetBranding() {
  return saveBranding({ logo: null, name: "", tagline: "" });
}

/**
 * Subscribes to changes, including ones made in another tab.
 *
 * The `storage` event only fires in the tabs that did not make the change,
 * which is exactly the half `saveBranding` cannot reach on its own. Another
 * browser's change arrives on its next load rather than live -- the same terms
 * as every other record this app mirrors.
 */
function subscribe(onChange) {
  listeners.add(onChange);
  // Here rather than at import, so a module that only wants the constants does
  // not open a request, and a test that never mounts anything is not reaching
  // for a backend.
  hydrate();
  const onStorage = (e) => {
    if (!e.key || Object.values(KEYS).includes(e.key)) refresh();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function subscribeSync(onChange) {
  syncListeners.add(onChange);
  return () => syncListeners.delete(onChange);
}

const getSnapshot = () => snapshot;
const getSyncSnapshot = () => syncSnapshot;

/**
 * The branding every header should render.
 *
 * @returns {{logo: string|null, name: string, tagline: string}}
 */
export function useBranding() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Whether the last edit reached the server, for the one screen that edits it.
 *
 * Separate from `useBranding` so the four screens that only wear the branding
 * do not re-render while a save is in flight, and do not have to know that
 * saving is a thing which can fail.
 *
 * @returns {{saving: boolean, error: string|null}}
 */
export function useBrandingSync() {
  return useSyncExternalStore(subscribeSync, getSyncSnapshot, getSyncSnapshot);
}
