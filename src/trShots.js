// Failure evidence for the test runner: what the page looked like at the moment
// a step failed, captured during the run and shown in the report.
//
// Only the failing step is shot. A passing step's picture is looked at
// approximately never, while shooting every step costs a round-trip per step on
// the remote engine and megabytes per run in storage — so playback captures the
// one frame that gets used. Since a run stops at its first failure, that is at
// most one shot per run.
//
// ---- where it is kept ----------------------------------------------------
// Reports themselves live in localStorage: they are small, synchronous, and
// read on every render. Shots cannot go there. A single snapshot of a real page
// is hundreds of kilobytes, and that ~5MB origin quota is shared with the
// recordings the report is evidence *for* — a screenshot that evicts the test it
// documents is worse than no screenshot. So shots go to IndexedDB, which is
// asynchronous and orders of magnitude larger, one record per run, fetched only
// when someone actually opens the report.
//
// ---- what a "shot" is ----------------------------------------------------
// It depends on the engine, because the two have very different powers:
//
//   remote  — a real Chromium on the backend, so a real JPEG of the viewport.
//    — a page cannot rasterise itself. Canvas cannot draw a DOM, and the
//             APIs that photograph a tab (getDisplayMedia and friends) need a
//             permission prompt per run and see nothing at all during a
//             headless run, where the frame is deliberately offscreen. So the
//             picture *is* the DOM: markup plus live form state, serialized
//             here and re-rendered later in a sandboxed iframe with the app's
//             own CSS, images and fonts. It looks like a screenshot and, unlike
//             one, can be inspected. What it is not is a pixel record —
//             anything the DOM does not carry (canvas contents, a video frame,
//             the scroll position of an inner container) will not come back.

import localforage from "localforage";

const store = localforage.createInstance({
  name: "testrunner",
  storeName: "shots",
  description: "failure screenshots and DOM snapshots for playback reports",
});

// IndexedDB or nothing. localforage's default driver chain falls back to
// localStorage, which is the one place these must never be written — that
// fallback would quietly do the exact damage this module exists to avoid.
const ready = store.setDriver(localforage.INDEXEDDB).then(
  () => true,
  (err) => {
    console.warn("[TestRunner] IndexedDB unavailable — failure shots are off:", err);
    return false;
  },
);

export const KIND_IMAGE = "image"; // JPEG of the real viewport (remote engine)
export const KIND_DOM = "dom"; // serialized DOM, re-rendered on view ()

const key = (runId) => `run:${runId}`;

// A bundle is { css, steps: { [stepIndex]: shot } } — keyed by step index, and
// in practice holding the one failing step, so a run that later starts shooting
// more than that needs no change here. The stylesheets sit beside the steps
// rather than inside each one for the same reason.
export async function saveShots(runId, bundle) {
  if (!runId || !bundle || !(await ready)) return false;
  try {
    await store.setItem(key(runId), bundle);
    return true;
  } catch (err) {
    // Losing the evidence must never fail the run that produced it.
    console.warn("[TestRunner] step shots not stored:", err);
    return false;
  }
}

export async function loadShots(runId) {
  if (!runId || !(await ready)) return null;
  try {
    return await store.getItem(key(runId));
  } catch (err) {
    console.warn("[TestRunner] step shots could not be read:", err);
    return null;
  }
}

// Drop every bundle whose run is no longer kept — including runs of tests that
// have since been deleted. Driven by the list of runs that still exist rather
// than by a delete call at each site: one rule instead of five, and it also
// cleans up after a reload that interrupted a write.
export async function pruneShots(keepRunIds) {
  if (!(await ready)) return;
  try {
    const keep = new Set(Array.from(keepRunIds || []).map(key));
    const stale = (await store.keys()).filter((k) => !keep.has(k));
    await Promise.all(stale.map((k) => store.removeItem(k)));
  } catch (err) {
    console.warn("[TestRunner] could not prune old step shots:", err);
  }
}

// ---- capture:  engine --------------------------------------------

const ATTR_ESC = { "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;" };
const escAttr = (s) => String(s).replace(/[&"<>]/g, (c) => ATTR_ESC[c]);

// The app's stylesheets, captured once per run. <link>s stay links — resolved
// to absolute URLs so they still load from inside a snapshot — and <style>
// blocks are inlined, which is how a dev build injects its CSS.
export function captureCss(doc) {
  const out = [];
  doc.querySelectorAll('style,link[rel~="stylesheet" i]').forEach((n) => {
    if (n.tagName === "STYLE") out.push(`<style>${n.textContent}</style>`);
    else if (n.href) out.push(`<link rel="stylesheet" href="${escAttr(n.href)}">`);
  });
  return out.join("\n");
}

// How large a snapshot's markup may be before it is dropped. Past this it is
// nearly always a page inlining its data (a base64 image per row) rather than a
// page worth this much space — and this is the only ceiling there is, since one
// failure per run is all that is ever stored.
const MAX_HTML = 1_500_000;

// cloneNode copies *attributes*, and what a step typed is a *property* — the
// value attribute still holds whatever the markup shipped with. Without this
// pass every field in the snapshot is empty in exactly the places the test
// filled in, which is the opposite of evidence.
function copyFormState(from, to) {
  const live = from.querySelectorAll("input,textarea,select");
  const copy = to.querySelectorAll("input,textarea,select");
  live.forEach((el, i) => {
    const c = copy[i];
    if (!c) return; // structures diverged — a plain snapshot beats a wrong one
    if (el.tagName === "SELECT") {
      Array.from(c.options).forEach((opt, k) => {
        if (el.options[k] && el.options[k].selected) opt.setAttribute("selected", "");
        else opt.removeAttribute("selected");
      });
    } else if (el.type === "checkbox" || el.type === "radio") {
      if (el.checked) c.setAttribute("checked", "");
      else c.removeAttribute("checked");
    } else if (el.tagName === "TEXTAREA") {
      c.textContent = el.value;
    } else if (el.type !== "file") {
      // A file input only ever reports "C:\fakepath\…" — noise, not evidence.
      c.setAttribute("value", el.value);
    }
  });
}

export function captureDomShot(win) {
  const doc = win.document;
  if (!doc || !doc.body) return null;
  const clone = doc.body.cloneNode(true);
  // A snapshot is evidence; it must never be able to run anything.
  clone.querySelectorAll("script,noscript,template").forEach((n) => n.remove());
  copyFormState(doc.body, clone);
  const base = {
    kind: KIND_DOM,
    base: win.location.href,
    w: win.innerWidth || 1280,
    h: win.innerHeight || 800,
    sx: Math.round(win.scrollX || 0),
    sy: Math.round(win.scrollY || 0),
  };
  const html = clone.outerHTML;
  // Recorded rather than silently skipped: "no snapshot" and "the snapshot was
  // 4MB of inlined images" call for completely different responses.
  return html.length > MAX_HTML ? { ...base, tooBig: html.length } : { ...base, html };
}

// ---- capture: remote engine ---------------------------------------------

// The backend hands back a full-size JPEG of the real viewport. Re-encode it
// smaller before storing: at 1280px a frame is ~80KB, and 900px is still more
// than enough to read a failed page off — this is evidence, not a wallpaper.
export function shrinkJpeg(dataUrl, maxW = 900, quality = 0.5) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || maxW;
      const h = img.naturalHeight || Math.round((maxW * 9) / 16);
      try {
        const scale = Math.min(1, maxW / w);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(w * scale));
        canvas.height = Math.max(1, Math.round(h * scale));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve({ kind: KIND_IMAGE, dataUrl: canvas.toDataURL("image/jpeg", quality), w, h });
      } catch {
        // Re-encoding failed — the original is still perfectly good evidence,
        // just larger. Never trade the shot for the optimisation.
        resolve({ kind: KIND_IMAGE, dataUrl, w, h });
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

// ---- rebuild -------------------------------------------------------------

// A standalone document for one DOM snapshot. Meant for an iframe sandboxed to
// `allow-same-origin` and nothing else: that blocks scripts, forms and
// navigation — a snapshot must not be able to *do* anything — while still
// letting the viewer reach in to restore the scroll position.
export function snapshotSrcDoc(shot, css) {
  return (
    `<!doctype html><html><head>` +
    `<base href="${escAttr((shot && shot.base) || "/")}">` +
    `<meta name="viewport" content="width=${(shot && shot.w) || 1280}">` +
    (css || "") +
    // A snapshot is a still. Without this, everything that was mid-animation
    // when it was taken restarts — and keeps going — in every thumbnail on the
    // page, and a blinking caret makes a static picture look live.
    `<style>*,*::before,*::after{animation:none!important;transition:none!important}` +
    `input,textarea{caret-color:transparent!important}</style>` +
    `</head>${(shot && shot.html) || "<body></body>"}</html>`
  );
}
