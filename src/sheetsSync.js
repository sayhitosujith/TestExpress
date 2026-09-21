// Keeps localStorage and the Google Sheet in step.
//
// The sheet is the source of truth: on boot we pull every collection down and
// write it into localStorage, so opening the app on a different port, browser
// or machine shows the same data. From then on the pages carry on reading and
// writing localStorage exactly as before, and a background pass pushes anything
// that changed back up.
//
// Why a diff-and-push loop rather than a save hook in each page: there are a
// dozen screens writing these keys, and every one of them would need the same
// call. One loop watching the keys is the same behaviour in one place — and it
// also catches writes made by code we don't control, like the test recorder.
import { getSheetsStatus, pullTab, pushTab } from "./api/sheets";

// tab name -> localStorage key. Mirrors TABS in src/Backend/sheetsDb.js; the
// backend rejects anything not in its own list, so a drift here fails loudly
// on the first sync rather than silently skipping a collection.
export const TAB_KEYS = {
  recordedTests: "testrunner.recordedTests",
  testProjects: "testrunner.projects",
  appointments: "appointments",
  doctors: "doctors",
  patients: "allProfiles",
  users: "registeredUsers",
};

const PUSH_INTERVAL_MS = 10000;

// Last value we know the sheet holds, per tab. A key whose JSON still matches
// this is not re-uploaded — without it every pass would burn the Sheets write
// quota (60/min) rewriting identical rows.
const synced = new Map();

const readLocal = (key) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/**
 * Pulls every collection into localStorage. Returns the tabs that actually had
 * rows. A tab that errors is skipped, not fatal: one unreadable collection
 * must not stop the others from loading.
 */
export async function pullAll() {
  const loaded = [];
  for (const [tab, key] of Object.entries(TAB_KEYS)) {
    try {
      const rows = await pullTab(tab);
      // An empty sheet must not wipe good local data — that would turn a
      // first run against a blank spreadsheet into data loss.
      if (!rows.length) continue;
      const json = JSON.stringify(rows);
      localStorage.setItem(key, json);
      synced.set(tab, json);
      loaded.push({ tab, count: rows.length });
    } catch (err) {
      console.warn(`[sheetsSync] pull ${tab} failed:`, err.message);
    }
  }
  return loaded;
}

/** Pushes any collection whose local contents differ from the sheet. */
export async function pushChanged() {
  const pushed = [];
  for (const [tab, key] of Object.entries(TAB_KEYS)) {
    const rows = readLocal(key);
    const json = JSON.stringify(rows);
    if (synced.get(tab) === json) continue;
    // Nothing local yet: leave the sheet alone rather than clearing it.
    if (!rows.length && !synced.has(tab)) continue;
    try {
      await pushTab(tab, rows);
      synced.set(tab, json);
      pushed.push({ tab, count: rows.length });
    } catch (err) {
      console.warn(`[sheetsSync] push ${tab} failed:`, err.message);
    }
  }
  return pushed;
}

let timer = null;

/**
 * Pulls once, then pushes changes on an interval. Safe to call when the backend
 * is down or unconfigured — it reports why and leaves the app on localStorage,
 * which is exactly how it behaved before any of this existed.
 */
export async function startSheetsSync() {
  let status;
  try {
    status = await getSheetsStatus();
  } catch (err) {
    console.warn("[sheetsSync] backend unreachable, staying local:", err.message);
    return { active: false, reason: "backend-unreachable" };
  }
  if (!status.configured) {
    console.warn("[sheetsSync] Google Sheets not configured, staying local.");
    return { active: false, reason: "not-configured" };
  }

  const loaded = await pullAll();
  console.info("[sheetsSync] pulled:", loaded);

  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    if (document.hidden) return;
    pushChanged().then((p) => p.length && console.info("[sheetsSync] pushed:", p));
  }, PUSH_INTERVAL_MS);

  return { active: true, loaded };
}

export function stopSheetsSync() {
  if (timer) clearInterval(timer);
  timer = null;
}
