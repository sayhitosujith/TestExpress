import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import TestExpressMark from "./TestExpressMark";
// The name and tagline the headers render, chosen in Super Admin's settings and
// kept in this browser. Defaults are the ones this screen always showed.
import { useBranding } from "./appBranding";
import { useAuth } from "./context/AuthContext";
// Asked rather than hardcoded: the same table the router guards /SuperAdmin
// with decides whether this menu offers it, so the entry can never appear for
// a role RoleRoute would turn away at the door.
import { canVisit } from "./routeAccess";
// What the signed-in account's plan includes. One module answers it for every
// control here, so a capability cannot be enforced in one place and forgotten
// in another — see ./plans for the tier rules and the Super Admin exemption.
import { PLANS, can, planKind, planOfUser, priceLabel, refusalFor, refreshPlans } from "./plans";
// What a Corporate account sees that an individual one does not — see the note
// at the top of that module.
import TeamWorkspace from "./TeamWorkspace";
// Buying a plan from inside the app. The same checkout the registration flow
// uses — see src/Checkout.jsx — so an upgrade and a first purchase settle
// through one path rather than two that can disagree.
import { openCheckout } from "./api/checkout";
// What the Corporate plan buys. Every call is scoped to the signed-in account
// server-side — see src/api/corporate.js.
import {
  addTeamMember,
  createToken,
  getActivity,
  getTeam,
  getTokens,
  removeTeamMember,
  revokeToken,
} from "./api/corporate";
// The theme, now that the copy that used to live in this file has moved there —
// the tidy-up the old comment said was due. Both screens read one key, and only
// that module knows that "auto" has to keep re-resolving against the clock.
import { DARK_FROM_HOUR, DARK_UNTIL_HOUR, hourLabel, useAppTheme } from "./theme";
import {
  RemoteSession,
  browserLabel,
  remoteCapabilities,
  toViewportCoords,
  keyInputFor,
} from "./trRemote";
// The native-mobile engine. MobileSession implements the same interface as
// RemoteSession on purpose, so everything downstream of "a session the server
// drives" is shared rather than branched — see the `driven` flag below.
import {
  MobileSession,
  appLabel,
  emulatorOptions,
  installApk,
  mobileCapabilities,
  mobileKeyInputFor,
  startAppiumServer,
  startEmulator,
} from "./trMobile";
import {
  KIND_IMAGE,
  captureCss,
  captureDomShot,
  loadShots,
  pruneShots,
  saveShots,
  shrinkJpeg,
  snapshotSrcDoc,
} from "./trShots";
// The Playwright export, and the owner/tag helpers it reads. Shared with
// scripts/review-tests.js, which generates the same specs from Node.
import {
  ownerLabel,
  ownerOf,
  parseTags,
  specName,
  tagLabel,
  tagsOf,
} from "./testrunner/spec";
// The Appium export. A native recording cannot become a Playwright spec, so the
// two generators sit side by side and `isMobileTest` picks between them.
import { isMobileTest, mobileSpecName } from "./testrunner/mobileSpec";
// Page Object Model generation — what "Export spec" and the live code view both
// emit. A flat spec carries its selectors inline, so the same button recorded in
// six tests is six copies of one selector; a page object is the one place it
// lives. See ./testrunner/pom.
import { toAppiumPom, toPlaywrightPom } from "./testrunner/pom";
// CI pipeline generation for the specs above — the file that makes a recorded
// suite run without anybody remembering to. See ./testrunner/pipeline.
import { BROWSERS, PROVIDERS, TRIGGERS, secretEnv, toPipeline } from "./testrunner/pipeline";
// The downloadable run report — an Extent-style dashboard in one self-contained
// HTML file. See ./testrunner/reportDoc.
import { toReportHtml } from "./testrunner/reportDoc";
// Self-healing locators: what to try once every recorded selector has gone
// stale. Shared with the backend engine, which requires it straight from Node,
// so the module is CommonJS — and the bundler will only hand out its default
// here, not named bindings. Destructured below the imports for that reason.
// The localStorage home of the recorded tests and the Project › Suite tree.
// Shared with QaseImport, which files AI-generated cases into the same store.
import {
  RECORDED_KEY,
  SCHEDULES_KEY,
  TESTDATA_KEY,
  loadProjects,
  loadRecorded,
  persistProjects,
  persistRecorded,
} from "./testrunner/store";
// Named test data: {{email}} in a step, resolved from a data set at playback.
// Shared with the Playwright export and the Node CLI — see ./testrunner/testdata.
import {
  DYNAMIC_TOKENS,
  auditSteps,
  hasRef,
  hasRows,
  iterationsOf,
  makeResolver,
  normKey,
  resolveStep,
  rowKeys,
  rowLabel,
  rowValues,
  rowsOf,
  setFor,
  varsOf,
} from "./testrunner/testdata";
// The REST step. The model, the operators and the pass/fail decision are shared
// with the server engine and the Playwright export, so a check means the same
// thing in the recorder as it does in CI — see ./testrunner/apiStep.
import {
  describeApi,
  evaluate as evaluateApi,
  extractFrom as extractApi,
  headersObject,
  normalize as normalizeApi,
  resolveApiStep,
  summarize as summarizeApi,
} from "./testrunner/apiStep";
// The authoring panel for a REST step. Its own file because this one is already
// far too long to be taking on another editor — see the note at its head.
import ApiStepEditor from "./ApiStepEditor";
// The countdown behind the self-starting Appium server and emulator below.
// Shared by both starters, so it lives on its own — see the note at its head.
import useAutoStart, { AUTO_CANCEL_BTN } from "./useAutoStart";

// Self-healing locators: what to try once every recorded selector has gone
// stale. Required rather than imported because the module is CommonJS — the
// backend engine loads the same file straight from Node — and the bundler
// declines to hand out named ES bindings from it. Below the imports because a
// require is a statement, and a statement between imports is a lint error.
const { describeHeal, healInDocument, textMatch } = require("./testrunner/selfHeal");


/*
 * TestRunner — a Playwright-style test recorder with two interchangeable engines.
 *
 * Tests are authored by interacting with the *real* app: every click, keystroke
 * and select becomes a serializable step, and playback replays those steps with
 * Playwright-style auto-waiting. Recorded tests persist in localStorage.
 *
 * Engine "iframe" runs everything in this tab, inside a same-origin iframe. It
 * needs no server and is instant, but the same-origin policy confines it to this
 * origin, and most external sites refuse to be framed at all.
 *
 * Engine "remote" drives a real Chromium on the backend (see
 * src/Backend/routes/testrunner.js) and is bound by neither limit, so any URL on
 * any origin can be recorded and replayed. It costs a server round-trip per
 * step and shows the page as a streamed screenshot rather than live DOM.
 *
 * Both engines produce and consume identical step objects: a test recorded in
 * one replays in the other, and the Playwright export describes either.
 */

const mono = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
// ============= recorded tests: real DOM record & playback ==============
// A recorded test is a serializable list of DOM interactions captured from the
// live app running in a same-origin iframe. Playback replays them into that
// iframe (record → save → play back), so it drives the real pages.
//
// The store itself — the two localStorage keys and their read/write helpers —
// moved to ./testrunner/store.js when QaseImport began filing generated cases
// into the same hierarchy. See that file for the storage contract.

// Playback results for each test, keyed by test id: a list, newest first.
// Kept in localStorage so reports survive closing the player or reloading the
// page — the equivalent of Playwright writing its HTML report to disk.
//
// A history rather than just the last run, because the two questions a single
// report cannot answer are the ones that matter most: is this test *flaky*
// (does it pass and fail on the same code), and is the app getting slower. One
// report makes a failure look definitive when it may be the third flake this
// morning.
const RUNS_KEY = "testrunner.lastRuns";

// Deep enough to see a pattern, shallow enough that twenty tests' worth still
// fits alongside the recordings themselves in a ~5MB origin quota.
const RUN_HISTORY = 20;

// How many runs per test keep their screenshot. Shallower than the report
// history — the numbers are what you read a run of six weeks ago for, and those
// are kept in full — but not much shallower, because a run only shoots the step
// that failed, so this costs one picture per failed run rather than one per step.
const SHOT_RUNS = 5;

// Which runs are still entitled to their evidence. Everything else in the shot
// store is orphaned — an evicted run, or a test that has since been deleted.
const shotRunIds = (map) =>
  Object.values(map || {}).flatMap((list) =>
    (list || []).slice(0, SHOT_RUNS).map((r) => r && r.id).filter(Boolean),
  );

const loadRuns = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(RUNS_KEY)) || {};
    // Anything written before this was a history is a single report object.
    // Promote it to a one-entry list rather than discarding it — that report
    // is the only evidence the test ever ran.
    return Object.fromEntries(
      Object.entries(raw).map(([id, v]) => [id, Array.isArray(v) ? v : [v]]),
    );
  } catch {
    return {};
  }
};

// The run being shown by default: the most recent one.
const lastRun = (history) => (history && history.length ? history[0] : null);

/**
 * The colour a test's icon wears in the rail: its last run's verdict.
 *
 * Three states, not two. Never-run is grey rather than red because red already
 * means "this failed", and a rail where an untouched recording is
 * indistinguishable from a broken one sends you to look at the wrong thing.
 *
 * Resolved through the theme tokens rather than a hex, so the light theme gets
 * its own darker green and red — the dark theme's tints do not clear 4.5:1 on a
 * white panel.
 *
 * @param {object|null} latest the most recent run, or null if there is none.
 * @returns {string} a CSS colour.
 */
const verdictColor = (latest) => {
  if (!latest) return "var(--tr-muted)";
  return latest.status === "failed" ? "var(--tr-rec)" : "var(--tr-pass)";
};

/**
 * What kind of recording this is, as the rail labels it.
 *
 * Worth showing rather than leaving to be inferred from the name: it is the one
 * property of a test that changes what the buttons beside it do. Play opens a
 * device session for one and a browser for the other, and Download Spec writes
 * a WebdriverIO file for one and a Playwright file for the other — so a rail
 * that does not say which is which leaves both of those as a surprise.
 *
 * Derived through isMobileTest rather than read straight off `test.engine`,
 * because a recording made before that field existed carries no engine and is
 * identified from its steps. Same call the export and the replay path make, so
 * the label cannot disagree with what pressing play will actually do.
 *
 * @param {object} test a recorded test.
 * @returns {{label: string, Glyph: Function, title: string}}
 */
const testType = (test) =>
  isMobileTest(test)
    ? {
        label: "Mobile",
        Glyph: MobileIcon,
        title:
          "Native Android recording — replays through Appium on a device or " +
          "emulator, and exports as a WebdriverIO spec.",
      }
    : {
        label: "Web",
        Glyph: MonitorIcon,
        title:
          "Web recording — replays in this page or in a real browser, and " +
          "exports as a Playwright spec.",
      };

// How the recent past looks, for the rail and the history strip. "Flaky" is
// not a third outcome a run can have — it is what a *set* of runs looks like
// when the same test both passed and failed across them.
const runStats = (history) => {
  const runs = history || [];
  const failed = runs.filter((r) => r.status === "failed").length;
  return {
    total: runs.length,
    failed,
    passed: runs.length - failed,
    flaky: runs.length > 1 && failed > 0 && failed < runs.length,
  };
};
const persistRuns = (map) => {
  try {
    localStorage.setItem(RUNS_KEY, JSON.stringify(map));
  } catch (err) {
    // A report is derived data — losing it must never cost you the test itself.
    console.warn("[TestRunner] run report not persisted:", err);
  }
};

// ---- schedules -----------------------------------------------------------
// Per-test run schedules, keyed by test id. This is a page-resident scheduler,
// not cron: it can only fire while this tab is open, because playback needs the
// iframe. Missed windows are not backfilled — a schedule whose time passed
// while the tab was shut simply runs once on the next tick and re-arms.
//
// The key name and the stored shape live in ./testrunner/store: dbSync mirrors
// this collection to the database too, and both readers must spell it the same.

const loadSchedules = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(SCHEDULES_KEY));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};
const persistSchedules = (map) => {
  try {
    localStorage.setItem(SCHEDULES_KEY, JSON.stringify(map));
  } catch (err) {
    console.warn("[TestRunner] schedules not persisted:", err);
  }
};

// ---- test data -----------------------------------------------------------
// The named values recordings refer to instead of the literal that was typed
// while recording — see ./testrunner/testdata for the substitution rules and why
// they live outside this file.
//
// Workspace-wide rather than per-test, because the point of a data set is that
// several tests share it: changing the staging login should not mean editing
// nine recordings. Which set is live is one choice here; a test that only ever
// makes sense against a particular set pins it by id (test.dataSetId).
//
// Key name and stored shape live in ./testrunner/store, for the same reason as
// the schedules key above.

const EMPTY_TEST_DATA = { sets: [], activeId: null };

const loadTestData = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(TESTDATA_KEY));
    if (!parsed || typeof parsed !== "object") return EMPTY_TEST_DATA;
    // Normalised on the way in, like the project tree: this file is exportable
    // and therefore hand-editable, and every reader downstream indexes straight
    // into `vars`. One set written without it would throw inside the editor.
    const sets = (Array.isArray(parsed.sets) ? parsed.sets : [])
      .filter((s) => s && s.id)
      .map((s) => ({
        ...s,
        name: s.name || "Untitled",
        vars: (Array.isArray(s.vars) ? s.vars : [])
          .filter((v) => v && v.key)
          .map((v) => ({
            key: normKey(v.key),
            value: v.value == null ? "" : String(v.value),
            secret: !!v.secret,
            // Marks a value as a column of the row table rather than one shared
            // across every iteration — see ./testrunner/testdata.
            perRow: !!v.perRow,
          })),
        // The row table, normalised for the same reason the vars are: this file
        // is exportable and therefore hand-editable, and iterationsOf indexes
        // straight into `values`. A row written without one would throw inside
        // the grid. An id is minted when absent because React keys the rows by
        // it and a hand-written file has no reason to have supplied one.
        rows: (Array.isArray(s.rows) ? s.rows : [])
          .filter((r) => r && typeof r === "object")
          .map((r, i) => ({
            id: r.id || `dr-${i}-${Math.random().toString(36).slice(2, 8)}`,
            label: typeof r.label === "string" ? r.label : "",
            // Absent means enabled: a row that arrives without the flag is one
            // written before rows could be disabled, and silently skipping it
            // would drop an iteration nobody asked to drop.
            enabled: r.enabled !== false,
            values: rowValues(r),
          })),
      }));
    // An activeId naming a set that is gone would leave every test resolving
    // against nothing while the UI showed a set selected.
    const activeId = sets.some((s) => s.id === parsed.activeId)
      ? parsed.activeId
      : sets.length
        ? sets[0].id
        : null;
    return { sets, activeId };
  } catch (err) {
    console.warn("[TestRunner] test data could not be parsed:", err);
    return EMPTY_TEST_DATA;
  }
};

// Same contract as persistRecorded: null on success, a reason on failure. Worth
// reporting rather than warning to the console — a data set that silently failed
// to save takes every test that refers to it down with it on the next reload.
const persistTestData = (data) => {
  try {
    localStorage.setItem(TESTDATA_KEY, JSON.stringify(data));
    return null;
  } catch (err) {
    return /quota|exceeded/i.test(`${err.name} ${err.message}`)
      ? "Browser storage is full — this test data was NOT saved."
      : `Could not write to browser storage — this test data was NOT saved (${err.message}).`;
  }
};

// Headed vs headless playback. There is no second browser process to hide —
// "headless" moves the app frame offscreen at full size and shows only a small
// progress panel. Offscreen rather than display:none on purpose: a hidden
// iframe has no layout, so every element inside would report a zero-sized box
// and fail the actionability check.
// Which real browser to record and replay in. A preference rather than a
// property of a test: the steps are engine-agnostic by design, and the whole
// reason to have three engines is to run the same test in each. Storing it on
// the test would turn "run this in WebKit" into an edit of the test.
const BROWSER_KEY = "testrunner.browser";
const BROWSER_IDS = ["chromium", "firefox", "webkit"];
const loadBrowser = () => {
  try {
    const saved = localStorage.getItem(BROWSER_KEY);
    if (BROWSER_IDS.includes(saved)) return saved;
  } catch {
    /* fall through to the default */
  }
  return "chromium";
};
const persistBrowser = (id) => {
  try {
    localStorage.setItem(BROWSER_KEY, id);
  } catch {
    /* preference only */
  }
};

// Which device to emulate, alongside the engine. Same reasoning as the browser
// above: a preference, not a property of the test. The same recorded steps are
// what you want to run as a desktop and as a phone, and storing the device on
// the test would turn "check this on mobile" into an edit of the test.
//
// Ids match DEVICES in src/Backend/routes/testrunner.js; the backend falls back
// to desktop for anything it does not recognise, so a stale saved preference
// degrades rather than breaking the run.
const DEVICE_KEY = "testrunner.device";
const DEVICE_IDS = ["desktop", "iphone", "pixel", "ipad"];
const loadDevice = () => {
  try {
    const saved = localStorage.getItem(DEVICE_KEY);
    if (DEVICE_IDS.includes(saved)) return saved;
  } catch {
    /* fall through to the default */
  }
  return "desktop";
};
const persistDevice = (id) => {
  try {
    localStorage.setItem(DEVICE_KEY, id);
  } catch {
    /* preference only */
  }
};

// Whether a failing lookup may repair itself. A preference rather than a
// property of a test, like the browser and the device: the same recording is
// what you want healed on your own machine and left strictly alone in CI,
// where a locator quietly rewriting itself is a change nobody reviewed.
//
// Defaulted on, because the alternative default is a test that fails on a
// markup change it could have survived — and every heal is reported on the
// step and counted in the run, so it is never a silent one.
const SELFHEAL_KEY = "testrunner.selfHeal";
const loadSelfHeal = () => {
  try {
    return localStorage.getItem(SELFHEAL_KEY) !== "0";
  } catch {
    return true;
  }
};
const persistSelfHeal = (on) => {
  try {
    localStorage.setItem(SELFHEAL_KEY, on ? "1" : "0");
  } catch {
    /* preference only */
  }
};

// Whether a generated pipeline runs its tests at once or one at a time.
//
// A preference rather than a property of a suite, like the browser and the
// device above: the same recordings are what you want fanned across every core
// on a build machine and walked one at a time while you are working out which
// of them is order-dependent.
//
// It reaches CI and nowhere else — see the note on the control in User Settings.
// The in-app player is strictly one test at a time whatever this says, because
// playback needs the recorder's frame and there is exactly one of those.
//
// Defaulted on, matching the local `npm run test:e2e` script, so a pipeline
// generated by somebody who never opened this setting is the fast one.
const PARALLEL_KEY = "testrunner.parallel";
const loadParallel = () => {
  try {
    return localStorage.getItem(PARALLEL_KEY) !== "0";
  } catch {
    return true;
  }
};
const persistParallel = (on) => {
  try {
    localStorage.setItem(PARALLEL_KEY, on ? "1" : "0");
  } catch {
    /* preference only */
  }
};

const HEADLESS_KEY = "testrunner.headless";
const loadHeadless = () => {
  try {
    return localStorage.getItem(HEADLESS_KEY) === "1";
  } catch {
    return false;
  }
};
const persistHeadless = (on) => {
  try {
    localStorage.setItem(HEADLESS_KEY, on ? "1" : "0");
  } catch {
    /* preference only — not worth surfacing */
  }
};

// ---- where the insert-step palette sits ----------------------------------
// The palette floats over the recorder, and where it floats is in the way of
// something for somebody: pinned bottom-right it covers the steps list on a
// short window, and moved out of that corner it covers the page under test.
// There is no placement that is right for every screen, so it is draggable and
// the choice is remembered.
//
// `null` means the built-in corner, and is deliberately NOT stored as
// coordinates: the default is expressed as right/bottom so it stays in the
// corner when the window is resized, and freezing it into an x/y on first
// render would quietly break that for anyone who never drags it.
const PALETTE_KEY = "testrunner.palettePos";

// How much of the palette must stay on screen. It is dragged by its header, so
// the header is the part that has to remain reachable — a panel dropped past
// the edge and then reopened on a smaller monitor would otherwise be impossible
// to get back.
const PALETTE_MIN_VISIBLE = 56;

const loadPalettePos = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(PALETTE_KEY));
    return saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)
      ? { x: saved.x, y: saved.y }
      : null;
  } catch {
    return null; // unreadable storage costs the position, never the palette
  }
};

const persistPalettePos = (pos) => {
  try {
    if (pos) localStorage.setItem(PALETTE_KEY, JSON.stringify(pos));
    else localStorage.removeItem(PALETTE_KEY);
  } catch {
    /* preference only */
  }
};

/**
 * A palette position with the panel kept on screen.
 *
 * Applied when dragging AND when a stored position is read back, because the
 * window it was chosen in may have been larger than the one it is restored in —
 * an external monitor unplugged between sessions is the ordinary way to end up
 * with a panel parked past the right edge.
 *
 * The bottom edge is allowed to hang off — the panel is tall, and refusing that
 * would make it unplaceable on a short window — but the header never is.
 *
 * @param {{x: number, y: number}} pos the requested top-left, in viewport px.
 * @param {number} w measured width of the palette.
 * @returns {{x: number, y: number}}
 */
const clampPalette = (pos, w) => ({
  x: Math.max(0, Math.min(pos.x, Math.max(0, window.innerWidth - w))),
  y: Math.max(0, Math.min(pos.y, Math.max(0, window.innerHeight - PALETTE_MIN_VISIBLE))),
});

const RAIL_KEY = "testrunner.railOpen";
// Open unless it was explicitly closed. "0" is only ever written by
// collapsing the rail, so a browser that has never seen this app -- or one
// whose storage is unreadable -- still opens showing the tree, which is the
// only place a test can be selected from.
const loadRailOpen = () => {
  try {
    return localStorage.getItem(RAIL_KEY) !== "0";
  } catch {
    return true;
  }
};
const persistRailOpen = (open) => {
  try {
    localStorage.setItem(RAIL_KEY, open ? "1" : "0");
  } catch {
    /* preference only — not worth surfacing */
  }
};

// The suite-wide schedule lives in the same map under a reserved key, so it
// persists and re-arms through exactly the same code as a per-test one.
const ALL_TESTS_ID = "__all__";

// Fold key for the pseudo-group holding tests that belong to no suite. Not a
// real project — it is never stored, only derived from the tests themselves.
const UNFILED_ID = "__unfiled__";

// Test cases are shown a page at a time within their suite. Folding already
// handles a rail with many suites; what it cannot help with is one suite that
// has accumulated a hundred recordings, which pushes every other suite off the
// bottom the moment it is opened. Suites and projects are not paged — those
// are the rows you navigate *by*, so hiding one behind a pager would mean
// hunting for the pager before you could find the suite.
const TESTS_PER_PAGE = 10;

const SCHEDULE_PRESETS = [
  { id: "off", label: "Off" },
  { id: "15m", label: "Every 15m", mode: "interval", minutes: 15 },
  { id: "1h", label: "Hourly", mode: "interval", minutes: 60 },
  { id: "daily", label: "Daily", mode: "daily", time: "09:00" },
];

const scheduleId = (s) => {
  if (!s || !s.enabled) return "off";
  if (s.mode === "daily") return "daily";
  return s.minutes === 15 ? "15m" : s.minutes === 60 ? "1h" : "15m";
};

// Next firing time in epoch ms, or null when the schedule is off.
const computeNextRun = (s, from = Date.now()) => {
  if (!s || !s.enabled) return null;
  if (s.mode === "daily") {
    const [h, m] = String(s.time || "09:00").split(":").map(Number);
    const next = new Date(from);
    next.setHours(h || 0, m || 0, 0, 0);
    if (next.getTime() <= from) next.setDate(next.getDate() + 1);
    return next.getTime();
  }
  return from + Math.max(1, s.minutes || 15) * 60_000;
};

const fmtCountdown = (ms) => {
  if (ms == null) return "—";
  if (ms <= 0) return "due now";
  const mins = Math.round(ms / 60_000);
  if (mins < 1) return "in under a minute";
  if (mins < 60) return `in ${mins} min`;
  const hrs = Math.floor(mins / 60);
  return `in ${hrs}h ${mins % 60}m`;
};

// When the list comes up empty, guessing why is worse than looking. This
// reports what is actually in this origin's storage, and scans every other key
// for anything shaped like recorded tests — which recovers a list stranded
// under an old or unexpected key instead of declaring it lost.
function storageReport() {
  const out = { origin: "", raw: null, bytes: 0, error: null, candidates: [] };
  try {
    out.origin = window.location.origin;
    out.raw = localStorage.getItem(RECORDED_KEY);
    out.bytes = out.raw ? out.raw.length : 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key === RECORDED_KEY) continue;
      let parsed;
      try {
        parsed = JSON.parse(localStorage.getItem(key));
      } catch {
        continue; // not JSON — not ours
      }
      if (Array.isArray(parsed)) {
        const tests = parsed.filter((t) => t && Array.isArray(t.steps));
        if (tests.length) out.candidates.push({ key, tests });
      }
    }
  } catch (err) {
    out.error = err.message;
  }
  return out;
}

const START_URL = "/Customer_home";

// Turn whatever was typed in the address bar into something an iframe can load.
// Anything that names a host — with or without a scheme — becomes an absolute
// URL; everything else is a route on this origin. Without this, "google.com"
// would be read as the path "/google.com".
const HOSTISH =
  /^(?:localhost|\[[0-9a-f:]+\]|(?:[a-z0-9-]+\.)+[a-z]{2,}|\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?(?:[/?#]|$)/i;
// Dotted input that is really a file, not a host: "report.html" is a page here,
// not the .html TLD.
const FILE_EXT = /\.(html?|php|aspx?|jsx?|tsx?|json|css|png|jpe?g|gif|svg|pdf|txt|xml)$/i;

// Is this address on a different origin than the app? Those are exactly the
// addresses the  engine can never drive, so this is what decides which
// engine has to run — a path is always same-origin and always fine .
function isExternalUrl(url) {
  const u = String(url || "");
  if (!/^https?:\/\//i.test(u)) return false;
  try {
    return new URL(u).origin !== window.location.origin;
  } catch {
    return false;
  }
}

function toLoadableUrl(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw; // already absolute
  if (raw.startsWith("//")) return `https:${raw}`; // protocol-relative
  if (raw.startsWith("/")) return raw; // route on this origin
  const head = raw.split(/[/?#]/)[0];
  if (HOSTISH.test(raw) && !FILE_EXT.test(head)) return `https://${raw}`;
  return `/${raw}`; // bare route: "Customer_home"
}

// ---- ownership -----------------------------------------------------------
// Who is answerable for a test case. Stamped from the signed-in user when a
// recording is first saved and then left alone: editing someone else's test
// fixes their test, it does not take it over. A recording made before this
// existed has no owner until somebody saves it, at which point they become one —
// that is the only honest answer available, and better than "unknown" forever.
//
// Only the name and email are kept. The rest of the auth user (role, practice,
// whatever a future login adds) is nobody's business here, and `Export` writes
// these objects to a file that leaves the machine.
// The OTP login can only guarantee a phone number, so that is the last resort
// before giving up: a mobile-only session is signed in, and showing the number
// beats reporting it as anonymous.
const displayName = (user) =>
  [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
  user?.name ||
  (user?.email ? user.email.split("@")[0] : "") ||
  user?.mobile ||
  "";

const ownerFrom = (user) => {
  const name = displayName(user);
  if (!name && !user?.email) return null; // not signed in — nothing to claim it
  return { name: name || user.email, email: user?.email || null };
};

// ---- the user directory --------------------------------------------------
// Where an owner's face comes from.
//
// A test's owner record holds a name and an email and nothing else — see the
// note above ownerFrom, which is emphatic about why: Export writes these
// objects to a file that leaves the machine, and a base64 profile photo copied
// onto every recording would be both a privacy leak and a quick way to blow the
// storage quota that already limits how many tests fit.
//
// So the picture is not stored with the test; it is looked up when the row is
// drawn, from the same `registeredUsers` list the registration screen
// maintains. Keyed by email because that is the identity sign-in establishes
// (isMine reasons the same way), and case-folded because the field is free text
// on the registration form.
//
// A test whose owner is not in this browser's directory simply falls back to
// initials, which is the same thing that happens for a colleague's recording
// imported from a JSON export.
const OWNERS_KEY = "registeredUsers";

const loadOwnerDirectory = () => {
  try {
    const list = JSON.parse(localStorage.getItem(OWNERS_KEY));
    if (!Array.isArray(list)) return new Map();
    return new Map(
      list
        .filter((u) => u && u.email)
        .map((u) => [String(u.email).trim().toLowerCase(), u]),
    );
  } catch {
    return new Map(); // unreadable storage costs a face, never a test
  }
};

// ownerOf / ownerLabel live in ./testrunner/spec — the Playwright export stamps
// the owner into every generated spec, so they are shared with the Node CLI.

// Is this mine? By email, which is the identity the login actually establishes —
// two people can share a display name, and one person's name can change between
// the day they recorded a test and the day they come looking for it.
const isMine = (owner, user) => {
  if (!owner || !user) return false;
  if (owner.email && user.email) return owner.email.toLowerCase() === user.email.toLowerCase();
  return !!owner.name && owner.name === displayName(user);
};

// ---- tags ----------------------------------------------------------------
// normTag / parseTags / tagLabel / tagsOf live in ./testrunner/spec: a tag is
// written into an exported spec's title so `--grep @smoke` selects it there,
// which makes the export the reason the normalising rules have to be shared.

const stepVerb = {
  click: "click",
  fill: "fill",
  select: "select",
  check: "check",
  navigate: "goto",
  assert: "expect",
  upload: "upload",
  hover: "hover",
  // Manually inserted steps:
  wait: "wait", // explicit: pause for a fixed duration, unconditionally
  implicitWait: "timeout", // implicit: change the auto-wait budget for later steps
  scroll: "scroll",
  reload: "reload",
  api: "request", // a REST call, asserted on its response rather than the DOM
};

const attrEsc = (v) => String(v).replace(/"/g, '\\"');

const normText = (s) => (s || "").trim().replace(/\s+/g, " ");

// A single CSS selector is a single point of failure: an element with no id or
// aria-label falls back to a positional path, and the first wrapper <div> a
// refactor adds invalidates it. So a step records an *ordered list* of
// candidate locators — stable attributes first, structure last — each verified
// at record time to resolve to exactly this element. Playback tries them in
// turn, which is how a recording survives ordinary markup churn.
function locatorFor(el) {
  if (!el || el.nodeType !== 1) return { selector: null, selectors: [], tag: null, text: "" };
  const doc = el.ownerDocument;
  const win = doc.defaultView;
  const esc =
    win.CSS && win.CSS.escape
      ? win.CSS.escape
      : (s) => String(s).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  const tag = el.tagName.toLowerCase();

  const selectors = [];
  // Keep a candidate only if it actually resolves back to this element — an
  // ambiguous or malformed selector is worse than not having one.
  const add = (sel) => {
    if (!sel || selectors.includes(sel)) return;
    try {
      if (doc.querySelector(sel) === el) selectors.push(sel);
    } catch {
      /* invalid selector — skip */
    }
  };

  // The nearest ancestor carrying a test id acts as a scope, the way
  // `page.getByTestId(card).getByTestId(field)` does in Playwright. It is what
  // makes a repeated field id ("doctor-name", once per card) usable.
  const scope = el.parentElement && el.parentElement.closest("[data-testid]");
  const scopeSel = scope ? `[data-testid="${attrEsc(scope.getAttribute("data-testid"))}"]` : null;

  if (el.id) add(`#${esc(el.id)}`);
  const testid = el.getAttribute("data-testid");
  if (testid) {
    add(`[data-testid="${attrEsc(testid)}"]`); // kept only if unique on its own
    if (scopeSel) add(`${scopeSel} [data-testid="${attrEsc(testid)}"]`);
  }
  const aria = el.getAttribute("aria-label");
  if (aria) add(`${tag}[aria-label="${attrEsc(aria)}"]`);
  const nm = el.getAttribute("name");
  if (nm) add(`${tag}[name="${attrEsc(nm)}"]`);
  const ph = el.getAttribute("placeholder");
  if (ph) add(`${tag}[placeholder="${attrEsc(ph)}"]`);
  if (tag === "a" && el.getAttribute("href")) add(`a[href="${attrEsc(el.getAttribute("href"))}"]`);

  // Class names, when they pin the element down on their own. Hashed/generated
  // classes (CSS-modules style) are skipped — they change on every build.
  const classes = Array.from(el.classList || []).filter(
    (c) => c.length < 40 && !/[0-9a-f]{6,}/i.test(c),
  );
  if (classes.length) add(`${tag}.${classes.map(esc).join(".")}`);

  // One level of a structural path: tag plus position among same-tag siblings.
  const segment = (node) => {
    let sel = node.tagName.toLowerCase();
    const parent = node.parentElement;
    if (parent) {
      const sibs = Array.from(parent.children).filter((c) => c.tagName === node.tagName);
      if (sibs.length > 1) sel += `:nth-of-type(${sibs.indexOf(node) + 1})`;
    }
    return sel;
  };

  // Structure *relative to the test-id scope*. An untagged element inside a
  // tagged card survives layout changes anywhere outside that card, which a
  // body-anchored path does not.
  if (scopeSel) {
    const rel = [];
    for (let node = el; node && node !== scope; node = node.parentElement) rel.unshift(segment(node));
    if (rel.length) add(`${scopeSel} > ${rel.join(" > ")}`);
  }

  // Structural path, anchored at <body> and complete — no depth cap, so it is
  // unambiguous rather than merely plausible. Last resort.
  const path = [];
  for (let node = el; node && node.nodeType === 1 && node.tagName !== "BODY"; node = node.parentElement) {
    path.unshift(segment(node));
  }
  if (path.length) add(`body > ${path.join(" > ")}`);

  return { selector: selectors[0] || null, selectors, tag, text: normText(el.textContent).slice(0, 80) };
}

/**
 * What an assertion should actually be about.
 *
 * A click lands on whatever is painted under the pointer, which on a modern
 * form is the wrapper around the field rather than the field. Asserting on that
 * wrapper records `exists: div` — a step that passes on any page at all and
 * checks nothing. Observed on Agoda's sign-in, where clicking the Email box
 * produced exactly that.
 *
 * So a text-less element wrapping exactly one control is treated as that
 * control's box, and the control is what gets asserted. Both halves of the
 * condition earn their place: "exactly one" stops a whole form collapsing onto
 * whichever field it happens to contain, and "text-less" leaves an element you
 * meant to assert the text of — a labelled row, an error banner — as itself,
 * because its own text is the more specific check.
 *
 * The remote engine applies the same rule in Backend/testrunner/recorder.js.
 * It is written twice because that file is injected into the page under test
 * and has to stand alone; the two must agree, since a test recorded in one
 * engine replays in the other.
 *
 * @param {Element} t the element the click landed on.
 * @returns {Element} the element to assert about.
 */
function assertTarget(t) {
  if (!t || !t.querySelectorAll) return t;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return t;
  if (normText(t.textContent)) return t;
  const controls = t.querySelectorAll("input, textarea, select");
  return controls.length === 1 ? controls[0] : t;
}

// Short human label for the steps list.
function describeEl(el) {
  const aria = el.getAttribute("aria-label");
  const txt = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40);
  return aria || el.getAttribute("placeholder") || txt || el.tagName.toLowerCase();
}

// ---- file uploads -------------------------------------------------------
// `<input type="file">` rejects any programmatic non-empty value — the browser
// only ever reports "C:\fakepath\name.png" and refuses to take it back. So a
// chosen file is recorded by *content* and replayed by handing the input a
// reconstructed File through a DataTransfer, which is the one supported route.
// Files up to this size are inlined as a data URL (base64 inflates by ~33%, and
// localStorage caps out around 5MB); larger ones keep metadata only.
const UPLOAD_INLINE_LIMIT = 256 * 1024;

function captureUpload(pushStep, el, file, url) {
  const base = {
    action: "upload",
    ...locatorFor(el),
    name: file.name,
    mime: file.type,
    size: file.size,
    label: file.name,
    url,
  };
  if (file.size > UPLOAD_INLINE_LIMIT) {
    pushStep({ ...base, truncated: true });
    return;
  }
  const reader = new FileReader();
  reader.onload = () => pushStep({ ...base, dataUrl: reader.result });
  reader.onerror = () => pushStep({ ...base, truncated: true });
  reader.readAsDataURL(file);
}

// Rebuild the recorded file inside the iframe's realm. Without inlined content
// (too big to store, or a legacy `fill` step) we synthesize a same-name,
// same-type placeholder so the upload still exercises the app's handler.
async function fileFromStep(win, st) {
  let bytes;
  if (st.dataUrl) {
    bytes = await (await fetch(st.dataUrl)).arrayBuffer();
  } else {
    bytes = new ArrayBuffer(Math.min(Math.max(st.size || 0, 1), 4096));
  }
  return new win.File([bytes], st.name || "upload.bin", {
    type: st.mime || "application/octet-stream",
  });
}

// Assign a File to a file input the way a user picking one would, then fire the
// events React listens for.
async function setInputFile(win, el, st) {
  const dt = new win.DataTransfer();
  dt.items.add(await fileFromStep(win, st));
  el.files = dt.files;
  el.dispatchEvent(new win.Event("input", { bubbles: true }));
  el.dispatchEvent(new win.Event("change", { bubbles: true }));
}

// ---- hovering ------------------------------------------------------------
// Move the pointer onto an element, as far as a page can be told to believe it.
// Fired at the element's centre and in the browser's own order, because apps
// read the coordinates (tooltips and popovers position themselves from them)
// and React's onMouseEnter is delivered through delegated mouseover/mouseout,
// not a real enter event.
//
// One honest limit: a synthetic event cannot make the CSS `:hover` pseudo-class
// match — only a real pointer does that. So a menu that opens purely in CSS
// will not open here, while one opened by an onMouseEnter handler (the common
// React case) will. The remote engine moves the actual mouse and has neither
// limitation, which is the engine to replay a CSS-only hover in.
function hoverEl(win, el) {
  const r = el.getBoundingClientRect();
  const at = {
    bubbles: true,
    cancelable: true,
    view: win,
    clientX: Math.round(r.left + r.width / 2),
    clientY: Math.round(r.top + r.height / 2),
  };
  const fire = (Ctor, type, opts) => {
    if (!Ctor) return;
    try {
      el.dispatchEvent(new Ctor(type, { ...at, ...opts }));
    } catch {
      /* this event type is unsupported here — the rest still land */
    }
  };
  // Pointer events first, then the mouse events that mirror them: that is the
  // order a real pointer produces, and a listener bound to only one of the two
  // families must still hear it. `enter` does not bubble, by spec.
  fire(win.PointerEvent, "pointerover", {});
  fire(win.PointerEvent, "pointerenter", { bubbles: false });
  fire(win.MouseEvent, "mouseover", {});
  fire(win.MouseEvent, "mouseenter", { bubbles: false });
  fire(win.PointerEvent, "pointermove", {});
  fire(win.MouseEvent, "mousemove", {});
}

// Set a form value the way React notices (native setter + input/change events),
// using the iframe's own element prototypes and Event constructor.
function setNativeValue(win, el, value, kind) {
  const proto =
    kind === "select"
      ? win.HTMLSelectElement.prototype
      : el.tagName === "TEXTAREA"
        ? win.HTMLTextAreaElement.prototype
        : win.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
  setter.call(el, value);
  el.dispatchEvent(new win.Event("input", { bubbles: true }));
  el.dispatchEvent(new win.Event("change", { bubbles: true }));
}

const waitFor = async (getter, timeout = 5000, interval = 120) => {
  const end = Date.now() + timeout;
  for (;;) {
    const v = getter();
    if (v) return v;
    if (Date.now() > end) return null;
    await sleep(interval);
  }
};

// ---- auto-waiting -------------------------------------------------------
// Like Playwright, playback never does a single fire-and-hope check. Actions
// wait for the target to become *actionable* and assertions *poll* until the
// page reaches the expected state (or a timeout elapses), so a slow render,
// network round-trip or animation no longer makes a good test flake.
const AUTO_WAIT = { timeout: 5000, interval: 120 };
// Assertions get longer: they are the steps that wait for a save to come back
// and the UI to catch up, which can outlast a plain element lookup.
const ASSERT_WAIT = { timeout: 10000, interval: 150 };

// An unconditional pause after a save-style click, on top of the settle waits.
// Unlike waitForSettled this cannot finish early — it is a flat 30s by request,
// to give a save all the time it needs before the next step looks at the page.
const SAVE_HOLD_MS = 30_000;
// Uploads get their own hold: the app reads the file asynchronously
// (FileReader), renders a preview and may post it, none of which the settle
// waits can see finish reliably.
const UPLOAD_HOLD_MS = 10_000;
const SAVE_HOLD_PATTERN = /\bsaves?\b/i;
const holdMsFor = (st) => {
  if (st.action === "upload") return UPLOAD_HOLD_MS;
  return (st.action === "click" || st.action === "check") &&
    SAVE_HOLD_PATTERN.test(`${st.label || ""} ${st.text || ""}`)
    ? SAVE_HOLD_MS
    : 0;
};

// Why an element cannot be acted on, or null when it can be. The reason is worth
// keeping rather than collapsing to a boolean: "hidden or disabled" names five
// different causes with five different fixes, and which one it actually was is
// the entire useful content of the failure. A disabled submit button in
// particular is a statement about the steps *before* it, not about this step.
function whyNotActionable(el) {
  if (!el) return "no element";
  if (!el.isConnected) return "it is detached from the page";
  const win = el.ownerDocument.defaultView;
  const style = win.getComputedStyle(el);
  if (style.display === "none") return "it is display:none";
  if (style.visibility === "hidden") return "it is visibility:hidden";
  if (Number(style.opacity) === 0) return "it is fully transparent (opacity:0)";
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return "it has no size (0×0)";
  // Worth spelling out the consequence: the usual cause is a form precondition
  // an earlier step failed to satisfy, and the fix is never on this step.
  if (el.disabled)
    return "it is disabled — an earlier step probably did not fill everything the form requires";
  if (el.getAttribute("aria-disabled") === "true") return "it is aria-disabled";
  return null;
}

// An element is "actionable" when it's attached to the DOM, visible, and not
// disabled — the same preconditions Playwright waits for before it interacts.
const isActionable = (el) => !whyNotActionable(el);

// Resolve a step's target by trying each recorded locator in order, then — if
// every selector has gone stale — by looking for the element's original text.
// Text is often the most durable thing about a button or heading, so this is
// what rescues a recording after the markup around it has been reshuffled.
// Returns the element AND how it was found, because those are two different
// facts: an element reached through a recorded selector is a healthy step,
// while the same element reached through the text fallback is a step whose
// locators have died and that will die with them on the next markup change.
// Only the second is worth reporting and repairing.
function resolveWith(doc, st) {
  const list = st.selectors && st.selectors.length ? st.selectors : [st.selector];
  for (const sel of list) {
    if (!sel) continue;
    try {
      const el = doc.querySelector(sel);
      if (el) return { el, via: sel };
    } catch {
      /* selector no longer parses — try the next */
    }
  }
  const text = fallbackText(st);
  const found = text ? findByText(doc, text, st.tag) : null;
  // No selector to name: reaching the text fallback IS the finding, and the
  // absence of a `via` selector is what tells the caller so.
  return found ? { el: found, via: null } : null;
}

// The element alone. Every caller that only needs to act on it goes through
// here, so the extra fact stays out of the hot path.
function resolveEl(doc, st) {
  const hit = resolveWith(doc, st);
  return hit ? hit.el : null;
}

// ---- self-healing --------------------------------------------------------

// What a heal writes back into the test: not the loosened guess that found the
// element, but a freshly derived locator bundle for the element it found —
// verified against the live DOM by locatorFor, exactly as it would have been
// had this step been recorded today.
const repairFrom = (el, st, heal) => {
  const fresh = locatorFor(el);
  if (!fresh.selectors.length) return null;
  return {
    via: heal.via || heal.id,
    why: describeHeal(heal),
    from: st.selector || null,
    to: fresh.selectors[0],
    selector: fresh.selectors[0],
    selectors: fresh.selectors,
    tag: fresh.tag,
    text: fresh.text,
  };
};

// Comparison key for text matching: whitespace-collapsed and case-folded, so a
// value the app re-cases on render ("Sujith S" vs the recorded "sujith s")
// still matches. Only the assertion itself compares text strictly.
const canon = (s) => normText(s).toLowerCase();

// Of several elements containing the text, the useful one is the innermost —
// every ancestor up to <body> also "contains" it. Fewest descendants wins.
const mostSpecific = (nodes) =>
  nodes.reduce((best, n) =>
    n.querySelectorAll("*").length < best.querySelectorAll("*").length ? n : best,
  );

// Look for the element by its text: same tag first (most likely), then any tag,
// exact match before partial. Widening beyond the recorded tag matters when the
// app renders the same value in a different element than it did at record time.
function findByText(doc, text, tag) {
  const target = canon(text);
  if (!target) return null;
  const scopes = tag && tag !== "*" ? [tag, "*"] : ["*"];
  for (const scope of scopes) {
    let nodes;
    try {
      nodes = Array.from(doc.querySelectorAll(scope));
    } catch {
      continue;
    }
    const exact = nodes.filter((n) => canon(n.textContent) === target);
    if (exact.length) return mostSpecific(exact);
    const partial = nodes.filter((n) => canon(n.textContent).includes(target));
    if (partial.length) return mostSpecific(partial);
  }
  return null;
}

// "Not found" has two very different causes: the element moved, or the data the
// step expects was never rendered. Saying which turns a dead end into a lead.
function whyNotFound(doc, st) {
  const text = fallbackText(st);
  let where = "the page";
  try {
    where = doc.defaultView.location.pathname + doc.defaultView.location.search;
  } catch {
    /* cross-origin or torn down */
  }
  if (!text) return `on ${where}`;
  const body = doc.body ? canon(doc.body.textContent) : "";
  return body.includes(canon(text))
    ? `on ${where} — the text IS on the page, so the element moved; re-record this step`
    : `on ${where} — "${text}" appears nowhere on the page, so the expected data was never rendered`;
}

// Tests recorded before locators carried `text` still hold the element's text in
// the fields the UI uses for labelling, so old recordings get the fallback too.
function fallbackText(st) {
  if (st.text) return st.text;
  if (st.action === "assert" && st.assertType === "text") return st.expected;
  if ((st.action === "click" || st.action === "check") && st.label) return st.label;
  return null;
}

// What was tried, for an error message that points at the actual problem.
const locatorSummary = (st) => {
  const list = (st.selectors && st.selectors.length ? st.selectors : [st.selector]).filter(Boolean);
  const tried = list.join("  |  ") || "(no selector recorded)";
  const text = fallbackText(st);
  return text ? `${tried}  |  text "${text}"` : tried;
};

// Wait until the step's target exists AND is actionable.
const waitForActionable = (doc, st, opts = AUTO_WAIT) =>
  waitFor(
    () => {
      const el = resolveEl(doc, st);
      return el && isActionable(el) ? el : null;
    },
    opts.timeout,
    opts.interval,
  );

// ---- settling ------------------------------------------------------------
// A click that saves a record kicks off a request, a re-render and often a
// route change. Racing the next step against that is the main source of flake,
// so after every action we wait for the page to go quiet — the equivalent of
// Playwright's load + networkidle waits.
const SETTLE = { timeout: 8000, quietMs: 350, animationCap: 2000 };
// How long to let client-side routing reach the next step's URL before giving
// up and hard-navigating.
const SPA_NAV_WAIT = 3000;
// How many times to re-resolve and retry an action whose target keeps being
// replaced by a re-render before calling it a genuine failure.
const ACTION_RETRIES = 3;

// Count in-flight fetch/XHR so "no pending requests" is a real signal rather
// than a guess. Re-applied on every page load; idempotent per window.
function instrumentPage(win) {
  if (win.__trInstrumented) return;
  win.__trInstrumented = true;
  win.__trPending = 0;

  const origFetch = win.fetch;
  if (origFetch) {
    win.fetch = function (...args) {
      win.__trPending++;
      return origFetch.apply(this, args).finally(() => {
        win.__trPending--;
      });
    };
  }

  const OrigXHR = win.XMLHttpRequest;
  if (OrigXHR) {
    function TrackedXHR() {
      const xhr = new OrigXHR();
      let counted = false;
      xhr.addEventListener("loadstart", () => {
        counted = true;
        win.__trPending++;
      });
      xhr.addEventListener("loadend", () => {
        if (counted) {
          counted = false;
          win.__trPending--;
        }
      });
      return xhr;
    }
    TrackedXHR.prototype = OrigXHR.prototype;
    win.XMLHttpRequest = TrackedXHR;
  }
}

// Resolve once the DOM has stopped changing for `quietMs`, so we act on a
// settled render rather than a half-committed one.
const waitForDomQuiet = (doc, win, quietMs = SETTLE.quietMs, timeout = SETTLE.timeout) =>
  new Promise((resolve) => {
    let quiet;
    let obs;
    const finish = () => {
      clearTimeout(quiet);
      clearTimeout(hard);
      if (obs) obs.disconnect();
      resolve();
    };
    const bump = () => {
      clearTimeout(quiet);
      quiet = setTimeout(finish, quietMs);
    };
    const hard = setTimeout(finish, timeout);
    try {
      obs = new win.MutationObserver(bump);
      obs.observe(doc.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
      });
    } catch {
      /* no observer available — the hard timeout still resolves us */
    }
    bump();
  });

// Wait n animation frames, so we resume after the browser has actually laid
// out and painted. Raced against a timer because rAF is throttled to a crawl in
// a backgrounded tab and would otherwise stall the run.
const nextFrames = (win, n = 2) =>
  Promise.race([
    new Promise((resolve) => {
      let left = n;
      const tick = () => (--left <= 0 ? resolve() : win.requestAnimationFrame(tick));
      try {
        win.requestAnimationFrame(tick);
      } catch {
        resolve();
      }
    }),
    sleep(500),
  ]);

// Let CSS transitions and animations finish before treating the page as ready —
// an element sliding into place is a moving target. Infinite animations
// (spinners) never resolve, hence the cap.
const waitForAnimations = async (doc) => {
  if (typeof doc.getAnimations !== "function") return;
  let running;
  try {
    running = doc.getAnimations().filter((a) => a.playState === "running");
  } catch {
    return;
  }
  if (!running.length) return;
  await Promise.race([
    Promise.all(running.map((a) => a.finished.catch(() => {}))),
    sleep(SETTLE.animationCap),
  ]);
};

// Document parsed, no requests outstanding, DOM no longer mutating, animations
// done, and a frame painted. This is the full "the page has stopped moving"
// signal — anything less and we are acting on a page mid-flight.
const waitForSettled = async (doc, win) => {
  await waitFor(() => doc.readyState === "complete", SETTLE.timeout, 50);
  await waitFor(() => (win.__trPending || 0) === 0, SETTLE.timeout, 60);
  await waitForDomQuiet(doc, win);
  await waitForAnimations(doc);
  await nextFrames(win, 2);
};

// Playwright refuses to click an element whose box is still moving. Same idea:
// poll the bounding box across frames until two consecutive reads agree, so a
// click can't land where the element used to be.
const waitForStable = async (win, getEl, timeout = 3000) => {
  const end = Date.now() + timeout;
  let prev = null;
  while (Date.now() < end) {
    const el = getEl();
    if (!el || !el.isConnected) return el || null;
    const r = el.getBoundingClientRect();
    const box = `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)},${Math.round(r.height)}`;
    if (prev === box) return el;
    prev = box;
    await nextFrames(win, 2);
  }
  return getEl();
};

// Poll an assertion until it holds or the timeout elapses. `check()` should
// throw while the condition is unmet and return once it's satisfied; the last
// failure is re-thrown on timeout so the reported error is the real reason.
const waitForAssertion = async (check, opts = AUTO_WAIT) => {
  const end = Date.now() + opts.timeout;
  let lastErr;
  for (;;) {
    try {
      check();
      return;
    } catch (e) {
      lastErr = e;
    }
    if (Date.now() > end) throw lastErr || new Error("assertion timed out");
    await sleep(opts.interval);
  }
};

const REC = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(2,6,23,0.72)",
    backdropFilter: "blur(3px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    padding: 16,
  },
  // Two situations fill the viewport instead of sitting in the 1180px box.
  //
  // Playback, because the recorded flow was captured at your full window size,
  // so replaying it in a 1180px box changes the layout the app renders —
  // responsive breakpoints, wrapped rows, elements pushed offscreen — and the
  // test then fails for reasons that have nothing to do with the app.
  //
  // A server-driven engine, because its live view is a photograph of a
  // 1280x720 browser (or a whole phone screen) and the pane can only ever
  // shrink it to fit. Inside the boxed modal the frame column is ~850px, so an
  // external site is shown at roughly two-thirds scale — small text, fiddly
  // click targets. Maximised, the column clears 1280px on an ordinary display
  // and the frame renders 1:1. It is never scaled up — an upscaled JPEG reads
  // worse than a small sharp one — so on a narrow screen this only recovers
  // whatever room there is.
  modalMax: {
    width: "100vw",
    maxWidth: "100vw",
    height: "100vh",
    borderRadius: 0,
    border: "none",
  },
  modal: {
    width: 1180,
    maxWidth: "97vw",
    height: "90vh",
    background: "var(--tr-bg)",
    border: "1px solid var(--tr-border)",
    borderRadius: 16,
    boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  head: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 16px",
    borderBottom: "1px solid var(--tr-border)",
    background: "var(--tr-panel)",
  },
  recDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    background: "#ef4444",
    boxShadow: "0 0 0 4px rgba(239,68,68,0.2)",
    flexShrink: 0,
  },
  nameInput: {
    flex: 1,
    background: "var(--tr-bg)",
    border: "1px solid #334155",
    borderRadius: 9,
    padding: "9px 12px",
    color: "var(--tr-text)",
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
  },
  // ---- tag editor ---------------------------------------------------------
  tagBar: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    padding: "8px 16px",
    borderBottom: "1px solid var(--tr-border)",
    background: "var(--tr-panel-2)",
  },
  tagBarLabel: {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.1em",
    color: "var(--tr-muted)",
    flexShrink: 0,
  },
  // The chips and the input itself belong to TagEditor, which both this bar and
  // the details panel render — one editor, so a tag is added the same way
  // wherever you are. What stays here is only the bar around it.
  tagHint: { fontSize: 10.5, color: "var(--tr-muted)", flexShrink: 1, minWidth: 0 },
  body: { display: "flex", minHeight: 0, flex: 1 },
  frameWrap: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "var(--tr-panel)" },
  // Offscreen but fully laid out — see the note at HEADLESS_KEY.
  frameWrapHidden: {
    position: "fixed",
    left: -20000,
    top: 0,
    width: 1280,
    height: 800,
    display: "flex",
    flexDirection: "column",
    pointerEvents: "none",
  },
  headlessBackdrop: {
    position: "fixed",
    right: 16,
    bottom: 16,
    zIndex: 100,
    // No full-screen overlay: a headless run must leave the page usable.
  },
  headlessPanel: {
    width: 400,
    maxWidth: "94vw",
    maxHeight: "70vh",
    background: "var(--tr-bg)",
    border: "1px solid #1e293b",
    borderRadius: 14,
    boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  hintBar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "7px 12px",
    fontSize: 12,
    color: "var(--tr-soft)",
    borderBottom: "1px solid #1e293b",
    background: "var(--tr-panel-2)",
  },
  urlPill: {
    fontFamily: mono,
    fontSize: 11,
    color: "var(--tr-info)",
    background: "var(--tr-bg)",
    border: "1px solid #1e293b",
    borderRadius: 6,
    padding: "2px 8px",
  },
  addrBar: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flex: "1 1 auto",
    maxWidth: 420,
    marginLeft: "auto",
    background: "var(--tr-bg)",
    border: "1px solid #1e293b",
    borderRadius: 8,
    padding: "3px 4px 3px 8px",
  },
  addrInput: {
    flex: 1,
    minWidth: 0,
    background: "transparent",
    border: "none",
    outline: "none",
    color: "var(--tr-info)",
    fontFamily: mono,
    fontSize: 11,
  },
  addrGo: {
    background: "var(--tr-border)",
    color: "var(--tr-text-2)",
    border: "1px solid #334155",
    borderRadius: 6,
    padding: "3px 10px",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    flexShrink: 0,
  },
  iframe: { flex: 1, width: "100%", border: 0, background: "#fff" },
  // Shown in place of the frame before a page has been chosen.
  blankStart: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: 24,
    color: "var(--tr-text-2)",
    background: "var(--tr-bg-2)",
  },
  side: {
    width: 330,
    flexShrink: 0,
    borderLeft: "1px solid #1e293b",
    background: "var(--tr-sunken)",
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
  },
  sideHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 12px",
    borderBottom: "1px solid #1e293b",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.1em",
    color: "var(--tr-muted)",
  },
  stepsList: { flex: 1, overflowY: "auto", padding: 8, minHeight: 0 },
  // ---- the steps / code toggle and the code view --------------------------
  viewTabs: { display: "inline-flex", gap: 2, background: "var(--tr-bg)", borderRadius: 7, padding: 2 },
  viewTab: {
    background: "transparent",
    border: "none",
    borderRadius: 5,
    padding: "3px 7px",
    color: "var(--tr-muted)",
    fontFamily: "inherit",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.08em",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  viewTabOn: { background: "var(--tr-sunken)", color: "var(--tr-text)" },
  codePane: { flex: 1, display: "flex", flexDirection: "column", minHeight: 0 },
  codeBar: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 10px",
    borderBottom: "1px solid #1e293b",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.06em",
    color: "var(--tr-muted)",
  },
  codeBody: {
    flex: 1,
    margin: 0,
    padding: "10px 12px",
    overflow: "auto",
    minHeight: 0,
    fontFamily: mono,
    fontSize: 10.5,
    lineHeight: 1.55,
    color: "var(--tr-soft)",
    // Wrapping rather than a horizontal scrollbar: a 330px panel would put most
    // generated lines off the right edge, and reading code by scrolling
    // sideways one line at a time is not reading it.
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    tabSize: 2,
  },
  recStep: { display: "flex", alignItems: "center", gap: 8, padding: "6px 6px", borderRadius: 6 },
  recNum: { fontFamily: mono, fontSize: 11, color: "var(--tr-border-strong)", flexShrink: 0, width: 18 },
  recTag: { fontFamily: mono, fontSize: 11, fontWeight: 700, width: 44, flexShrink: 0 },
  emptyHint: { color: "var(--tr-border-strong)", fontSize: 12, fontStyle: "italic", padding: 14, textAlign: "center" },
  pace: {
    display: "flex",
    background: "var(--tr-bg)",
    border: "1px solid var(--tr-border-strong)",
    borderRadius: 8,
    padding: 2,
    flexShrink: 0,
  },
  paceBtn: {
    background: "transparent",
    border: "none",
    color: "var(--tr-dim)",
    fontSize: 11.5,
    fontWeight: 600,
    padding: "5px 9px",
    borderRadius: 6,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  paceBtnActive: { background: "var(--tr-border)", color: "var(--tr-text)" },
  palette: {
    position: "fixed",
    right: 18,
    bottom: 18,
    zIndex: 120, // above the modal, which is 100
    width: 268,
    background: "var(--tr-bg)",
    border: "1px solid #334155",
    borderRadius: 12,
    boxShadow: "0 18px 44px rgba(0,0,0,0.55)",
    padding: 10,
    display: "flex",
    flexDirection: "column",
    gap: 7,
  },
  paletteBrand: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    paddingBottom: 8,
    borderBottom: "1px solid #1e293b",
  },
  paletteBrandText: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.14em",
    color: "var(--tr-text)",
  },
  // Pushed to the far end of the header, and dim: it marks the handle without
  // competing with the name it sits beside.
  paletteGrip: {
    marginLeft: "auto",
    color: "var(--tr-muted)",
    display: "inline-flex",
    alignItems: "center",
    flexShrink: 0,
  },
  paletteHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.1em",
    color: "var(--tr-muted)",
  },
  paletteRow: { display: "flex", gap: 7 },
  paletteBtn: {
    flex: 1,
    background: "var(--tr-panel)",
    // A button does not inherit colour: without this it falls back to the UA's
    // ButtonText (near-black), which is unreadable on the dark panel. Callers
    // that want their own accent still override it — this is only the floor.
    color: "var(--tr-text)",
    border: "1px solid var(--tr-border-strong)",
    borderRadius: 8,
    padding: "7px 6px",
    fontSize: 11.5,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
  },
  paletteLabel: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: 5,
    fontSize: 10.5,
    color: "var(--tr-dim)",
  },
  paletteInput: {
    width: "100%",
    minWidth: 0,
    background: "var(--tr-panel)",
    border: "1px solid #334155",
    borderRadius: 6,
    padding: "3px 6px",
    color: "var(--tr-text)",
    fontFamily: mono,
    fontSize: 11,
    outline: "none",
  },
  stepTools: { display: "flex", gap: 2, flexShrink: 0 },
  toolBtn: {
    background: "transparent",
    border: "none",
    color: "var(--tr-muted)",
    cursor: "pointer",
    fontSize: 11,
    lineHeight: 1,
    padding: "3px 4px",
    borderRadius: 4,
    fontFamily: "inherit",
  },
  stepEdit: { padding: "2px 6px 8px 70px" },
  editInput: {
    width: "100%",
    background: "var(--tr-bg)",
    border: "1px solid #334155",
    borderRadius: 6,
    padding: "5px 8px",
    color: "var(--tr-text)",
    fontFamily: mono,
    fontSize: 11.5,
    outline: "none",
  },
  editHint: { fontSize: 10, color: "var(--tr-muted)", marginTop: 3 },
  foot: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "12px 16px",
    borderTop: "1px solid #1e293b",
    background: "var(--tr-panel)",
  },
};

/**
 * What to do about a lost live view, chosen from what the driver actually said.
 *
 * The two causes look identical in the pane and have completely different fixes,
 * and the wrong advice costs real time: when UiAutomator2's instrumentation dies
 * on the device — by far the most common way a mobile session ends — `adb
 * devices` still lists the emulator perfectly happily, so being told to check it
 * sends you looking at the one thing that is definitely fine.
 *
 * @param {string} err the driver's own message.
 * @returns {import('react').ReactNode} the hint to show beneath it.
 */
function frameHint(err) {
  const msg = String(err || "");
  if (/instrumentation|uiautomator2|not running \(probably crashed\)/i.test(msg)) {
    return (
      <>
        The automation bridge on the device has crashed — the device itself is fine, so{" "}
        <code style={{ fontFamily: mono }}>adb devices</code> will still list it. Reopen the
        recorder to start a fresh session, which reinstalls and relaunches the bridge.
      </>
    );
  }
  if (/session (not found|does not exist)|terminated|deleted/i.test(msg)) {
    return "The session has already been closed — reopen the recorder to start another.";
  }
  return (
    <>
      Most often the emulator or phone has disconnected. Check{" "}
      <code style={{ fontFamily: mono }}>adb devices</code>, then reopen the recorder.
    </>
  );
}

// ---- server-driven engines: the device under test, as a picture you can click -
// A cross-origin page cannot be embedded and a native app cannot be embedded at
// all, but both can be photographed. This pane polls the backend for frames of
// the real viewport and forwards clicks, typing and scrolling back into it — so
// recording happens here rather than in a separate window the UI knows nothing
// about.
//
// Shared by the real-browser and mobile engines, which is why `viewport` and
// `keyInput` are props: a phone reports its own screen size rather than the
// browser engine's fixed 1280x720, and a device takes a shorter list of named
// keys than a page does.
// Consecutive failed frames before the pane stops assuming it is a blip and
// goes and asks why. Three at ~900ms is a couple of seconds — long enough to
// ride out a navigation, short enough that a dead device is reported promptly.
const FRAME_FAIL_LIMIT = 3;

function RemotePane({
  session,
  paused,
  interactive,
  onError,
  onPick,
  viewport,
  keyInput = keyInputFor,
  waitingLabel = "waiting for the first frame from the real browser…",
}) {
  const [nonce, setNonce] = useState(1);
  const [ready, setReady] = useState(false);
  // Keystrokes are forwarded from this pane, so the user has to be able to see
  // whether it currently owns the keyboard.
  const [focused, setFocused] = useState(false);
  // Consecutive frames that failed to load, and why.
  //
  // A single failure is normal — a frame requested mid-navigation, or while the
  // screen is being torn down. A run of them is not: the device has gone away,
  // the session has been reaped, or the app has died. Retrying that silently
  // leaves the pane sitting on "waiting for the first frame…" indefinitely,
  // which is indistinguishable from a hang and says nothing about the cause.
  // Observed for real when an emulator disappeared mid-session: every frame
  // 503'd and the UI reported nothing at all.
  const [frameFails, setFrameFails] = useState(0);
  const [frameErr, setFrameErr] = useState(null);
  const paneRef = useRef(null);
  const timerRef = useRef(null);

  // Chase the live page, but only ask for the next frame once the previous one
  // has arrived. An interval would queue screenshot requests behind a slow
  // backend until both ends are saturated.
  const schedule = useCallback(
    (delay) => {
      clearTimeout(timerRef.current);
      if (paused) return;
      timerRef.current = setTimeout(() => setNonce((n) => n + 1), delay);
    },
    [paused],
  );

  useEffect(() => {
    if (!paused) schedule(0);
    return () => clearTimeout(timerRef.current);
  }, [paused, schedule]);

  const send = async (input, refreshIn = 120) => {
    if (!interactive) return;
    try {
      await session.sendInput(input);
      // Show the consequence promptly rather than waiting out the poll interval.
      schedule(refreshIn);
    } catch (err) {
      if (onError) onError(err.message);
    }
  };

  return (
    <div
      ref={paneRef}
      tabIndex={interactive ? 0 : -1}
      onKeyDown={(e) => {
        if (!interactive) return;
        const input = keyInput(e);
        if (!input) return;
        e.preventDefault();
        send(input);
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      // Focus on mousedown anywhere in the pane, before any click is forwarded.
      // This element owns tabIndex and onKeyDown but nothing in it is focusable
      // on its own, so without this the keydown handler never fires and
      // everything typed after a click goes nowhere. It belongs on the pane
      // rather than on the frame: the frame is letterboxed inside the pane, and
      // a mousedown on the surrounding margin would otherwise silently take
      // focus away from it.
      onMouseDown={() => paneRef.current && paneRef.current.focus()}
      style={{
        position: "relative",
        flex: 1,
        minHeight: 0,
        background: "#0b1220",
        outline: "none",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        overflow: "hidden",
      }}
      title={interactive ? "Click the page, then type — this is the real browser" : undefined}
    >
      <img
        src={session.screenshotUrl(nonce)}
        alt="live view of the page under test"
        draggable={false}
        onLoad={() => {
          setReady(true);
          setFrameFails(0);
          setFrameErr(null);
          schedule(paused ? 0 : 450);
        }}
        // A failed frame is normal mid-navigation; back off and keep going
        // rather than tearing the pane down. But an <img> error carries no
        // reason, so once failures stop looking incidental, ask the endpoint
        // directly — it answers with the driver's own message — and show it.
        onError={() => {
          setFrameFails((n) => {
            const next = n + 1;
            if (next === FRAME_FAIL_LIMIT) {
              fetch(session.screenshotUrl(`why${Date.now()}`))
                .then((r) => (r.ok ? null : r.json().catch(() => null)))
                .then((body) => setFrameErr((body && body.error) || "the frame request failed"))
                .catch(() => setFrameErr("the backend is unreachable"));
            }
            return next;
          });
          // Back off harder once it is clearly not a blip, so a dead device is
          // not hammered several times a second.
          schedule(frameFails >= FRAME_FAIL_LIMIT ? 4000 : 900);
        }}
        onClick={(e) => {
          const { x, y } = toViewportCoords(e.currentTarget, e.clientX, e.clientY, viewport);
          // While a hover target is being picked, this click aims rather than
          // acts: the backend describes whatever is under the pointer and
          // nothing is clicked in the real page.
          if (onPick) {
            onPick(x, y);
            return;
          }
          send({ type: "click", x, y });
        }}
        onWheel={(e) => {
          e.preventDefault();
          send({ type: "wheel", deltaY: e.deltaY }, 200);
        }}
        style={{
          // Sized so the element box is EXACTLY the rendered image box. With
          // objectFit the image is letterboxed inside a larger element, and
          // toViewportCoords — which maps against the element rect — would send
          // every click to the wrong place in the real page. Intrinsic-ratio
          // scaling under max-constraints keeps rect and image identical.
          //
          // This only ever scales the frame *down*, which is why the capture is
          // taken at 2x css resolution (see contextOptions in routes/testrunner
          // .js): a 1280-wide viewport arrives as a 2560-wide image, so the pane
          // has room to fill a large monitor by downscaling. Growing the element
          // past the intrinsic size instead would mean either upscaling a JPEG
          // into mush, or an aspect-ratio box — and a flex item's cross-size
          // clamp does not feed back into its main size, so that box can end up
          // the wrong shape and stretch the image, which is precisely the
          // rect-vs-image mismatch this sizing exists to prevent.
          maxWidth: "100%",
          maxHeight: "100%",
          width: "auto",
          height: "auto",
          display: "block",
          cursor: onPick ? "cell" : interactive ? "crosshair" : "default",
          opacity: ready ? 1 : 0.25,
          outline: interactive && focused ? "2px solid #5ff0c4" : "2px solid transparent",
          outlineOffset: -2,
        }}
      />
      {(!ready || frameErr) && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            textAlign: "center",
            color: frameErr ? "var(--tr-rec)" : "var(--tr-muted)",
            fontSize: 12.5,
            background: frameErr ? "rgba(2,6,23,0.82)" : undefined,
            // Purely a caption over the live view, so it must not take the
            // pointer. It covers the whole pane, and a frame that fails while
            // the page is navigating — routine, and self-clearing — used to
            // leave it swallowing every click for as long as it showed. That
            // also blocked the mousedown the pane gets its focus from, so the
            // keyboard died with the mouse and the pane looked completely
            // dead while plainly showing a working page underneath.
            pointerEvents: "none",
          }}
        >
          {frameErr ? (
            <>
              <span style={{ fontWeight: 800, fontSize: 13 }}>⚠ Lost the live view</span>
              <span style={{ whiteSpace: "pre-wrap", maxWidth: 460, lineHeight: 1.6 }}>{frameErr}</span>
              <span style={{ opacity: 0.75, maxWidth: 460, lineHeight: 1.6 }}>
                {frameHint(frameErr)}
              </span>
              <span style={{ opacity: 0.55 }}>still retrying, {frameFails} failed frames</span>
            </>
          ) : (
            waitingLabel
          )}
        </div>
      )}
      {/* Keystrokes only reach the page while this pane holds focus, so say so
          rather than letting the user type into nothing. */}
      {ready && interactive && !focused && (
        <div
          style={{
            position: "absolute",
            bottom: 8,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(2,6,23,0.85)",
            border: "1px solid #5ff0c455",
            color: "var(--tr-accent)",
            fontSize: 11.5,
            fontWeight: 700,
            padding: "4px 10px",
            borderRadius: 999,
            pointerEvents: "none",
          }}
        >
          click the page to type into it
        </div>
      )}
    </div>
  );
}

function Recorder({ mode, initialTest, onSave, onClose, onRunComplete, onHeal, selfHeal, autoPlay, onAutoDone, headless, browser, onBrowser, device, onDevice, suiteId, suitePath, dataSet, onDefineVar, initialEngine, initialApp, initialUdid, initialApiOnly, refusal }) {
  // No useBranding here: the palette's mark is drawn and its name is fixed, so
  // the recorder no longer subscribes to the branding store. The top bar still
  // does — see TestRunner below.
  const iframeRef = useRef(null);
  const [name, setName] = useState(initialTest?.name || "");
  const [tags, setTags] = useState(() => tagsOf(initialTest));
  // What is being typed but is not a tag yet — owned by the TagEditor, which
  // keeps a half-written "@regres" out of `tags` until a separator ends it. Held
  // here as a ref only so `save` can fold it in; nothing renders from it.
  const tagDraftRef = useRef("");
  const [steps, setSteps] = useState(initialTest?.steps || []);
  // Opening an existing test starts paused: you came to review and adjust it,
  // not to immediately append whatever you click.
  const [recording, setRecording] = useState(mode === "record" && !initialTest);
  const [editIdx, setEditIdx] = useState(null); // step whose value is being edited
  const [crossOrigin, setCrossOrigin] = useState(false); // frame is unreadable
  const [waitMs, setWaitMs] = useState(5000); // duration used by the insert panel
  const [scrollPx, setScrollPx] = useState(500);
  // Where the insert-step palette has been dragged to, or null for its corner.
  const [palettePos, setPalettePos] = useState(loadPalettePos);
  const paletteRef = useRef(null);
  // The grab offset within the header, so the panel does not jump so its corner
  // meets the pointer on the first move. Null when no drag is in progress.
  const paletteGrab = useRef(null);

  // Pointer events rather than mouse events, so a touch drag works too, and
  // setPointerCapture so a fast drag that outruns the header keeps tracking
  // instead of dropping the panel wherever the pointer left it.
  const startPaletteDrag = (e) => {
    if (!paletteRef.current) return;
    const box = paletteRef.current.getBoundingClientRect();
    paletteGrab.current = { dx: e.clientX - box.left, dy: e.clientY - box.top, w: box.width };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault(); // or the header's text selects as the pointer sweeps it
  };

  const paletteAt = (e) => {
    const grab = paletteGrab.current;
    return clampPalette({ x: e.clientX - grab.dx, y: e.clientY - grab.dy }, grab.w);
  };

  const movePalette = (e) => {
    if (!paletteGrab.current) return;
    setPalettePos(paletteAt(e));
  };

  const endPaletteDrag = (e) => {
    if (!paletteGrab.current) return;
    // Read off this event rather than back out of state, so what gets stored is
    // where the pointer was released — no dependence on the last move having
    // re-rendered first.
    const pos = paletteAt(e);
    paletteGrab.current = null;
    setPalettePos(pos);
    persistPalettePos(pos);
  };

  // Back to the default corner. A double-click rather than a button: the header
  // is 268px wide and already carries the mark and the name, and a reset control
  // living there permanently would cost more room than the gesture it replaces.
  const resetPalettePos = () => {
    setPalettePos(null);
    persistPalettePos(null);
  };

  // A stored position is only valid against the window it was chosen in — an
  // external monitor unplugged between sessions is the ordinary way to have one
  // parked past the right edge. Re-fitted on mount and on every resize.
  useEffect(() => {
    const fit = () =>
      setPalettePos((cur) => {
        if (!cur) return cur;
        const w = paletteRef.current ? paletteRef.current.getBoundingClientRect().width : 268;
        const next = clampPalette(cur, w);
        // Returning the same object when nothing moved is what keeps this from
        // re-rendering on every resize event.
        return next.x === cur.x && next.y === cur.y ? cur : next;
      });
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  const [assertMode, setAssertMode] = useState(false);
  // Armed by the palette's "Mouse hover" button: the next element clicked in the
  // frame becomes a hover step instead of being clicked. A hover has to name a
  // target and cannot be typed in usefully — a hand-written selector is how you
  // get a step that resolves to the wrong element — so pointing at it is the
  // only honest way to insert one. One-shot: it disarms itself on the pick, so
  // the frame goes straight back to being usable.
  const [hoverPick, setHoverPick] = useState(false);
  const [playing, setPlaying] = useState(false);
  // Which iteration of a row table is on screen, while a data-driven run is in
  // flight — null when the set has no rows, which is what keeps the header of
  // an ordinary single-pass run exactly as it was.
  const [iterNow, setIterNow] = useState(null); // { index, total, label }
  const [hold, setHold] = useState(null); // { secondsLeft, why } during an explicit pause
  // Current auto-wait budget. An `implicitWait` step rewrites this mid-run; it
  // resets at the start of every playback so runs stay independent.
  const implicitRef = useRef(AUTO_WAIT.timeout);
  // Extra pause between steps. Purely for watchability — correctness comes from
  // waitForSettled, never from these numbers.
  const [pace, setPace] = useState(1); // 0 = fast, 1 = normal, 2 = slow
  const paceMs = [0, 400, 1200][pace];
  const [status, setStatus] = useState({}); // idx -> passed|failed|running ; e<idx> -> message
  // A new recording starts with no address at all: the recorder should not
  // decide which page you meant to test. An existing test opens at the URL it
  // was recorded against.
  const [curUrl, setCurUrl] = useState(initialTest?.startUrl || "");
  const [addr, setAddr] = useState(initialTest?.startUrl || ""); // editable address bar

  const recordingRef = useRef(recording);
  recordingRef.current = recording;
  const assertRef = useRef(assertMode);
  assertRef.current = assertMode;
  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  // The frame's listeners are attached once per load, so anything they call has
  // to be reached through a ref — a captured copy of insertStep would keep
  // inserting at whatever was selected when that page loaded.
  const hoverPickRef = useRef(hoverPick);
  hoverPickRef.current = hoverPick;
  const insertRef = useRef(null);

  // Where this test begins. An existing test keeps what it was recorded with;
  // a new one adopts the first page actually opened, so the entry point is a
  // record of what happened rather than a default nobody chose.
  //
  // It matters beyond the address bar: replay and the Playwright export both
  // use this as the entry point, so leaving it empty on a saved test would
  // produce a spec that starts nowhere.
  const firstUrlRef = useRef(initialTest?.startUrl || "");
  if (!firstUrlRef.current && curUrl) firstUrlRef.current = curUrl;
  const startUrl = initialTest?.startUrl || firstUrlRef.current || "";

  // ---- test data ---------------------------------------------------------
  // Which {{keys}} these steps refer to, and which of them this test's data set
  // has no value for. Checked as you edit rather than only at run time: a
  // reference that resolves to nothing fails the step it is in, and finding that
  // out four steps into a playback — from a validation message about braces — is
  // a much longer way round than being told before pressing play.
  const dataAudit = useMemo(() => auditSteps(steps, dataSet), [steps, dataSet]);
  // How many iterations a run will do. One for an ordinary set; one per enabled
  // row for a table — see ./testrunner/testdata.
  const rowCount = useMemo(() => iterationsOf(dataSet).length, [dataSet]);

  // Turn the literal in a step into a named value: the value moves into the data
  // set and the step is rewritten to refer to it. This is the direction the work
  // actually happens in — you record with real values because that is how you
  // drive the app, and only afterwards notice that the email wants to be shared
  // between nine tests.
  const extractVar = (i, field) => {
    const literal = String(steps[i]?.[field] ?? "");
    if (!literal || !onDefineVar) return;
    const suggested = normKey(steps[i].label || field);
    const raw = window.prompt(
      `Name this value. Steps will refer to it as {{name}}, and it will live in ` +
        `test data where other tests can use it too.\n\nValue: ${literal}`,
      suggested,
    );
    if (raw == null) return;
    const key = normKey(raw);
    if (!key) return;
    // The parent owns the store and normalises the key again on the way in, so
    // it — not this — decides what the reference ends up being called.
    const saved = onDefineVar(key, literal);
    if (!saved) return;
    patchStep(i, { [field]: `{{${saved}}}` });
  };

  // ---- engine ------------------------------------------------------------
  // "iframe" is the zero-setup default and can only ever reach this origin;
  // "remote" drives a real Chromium on the backend and can reach anything;
  // "mobile" drives a native app on a real device or emulator through Appium.
  // Three sources, in order of authority:
  //   * what the new-test dialog was told, for a recording that has not started;
  //   * what an existing recording was made with — a native test replayed in an
  //     iframe would fail every step with "no element matched" until the user
  //     noticed the switch;
  //   * the zero-setup default.
  const [engine, setEngine] = useState(() => {
    if (initialEngine === "mobile") return "mobile";
    if (initialEngine === "web") return "iframe";
    return isMobileTest(initialTest) ? "mobile" : "iframe";
  });
  const [caps, setCaps] = useState(null); // null until the backend has answered
  const [session, setSession] = useState(null);
  const [remoteBusy, setRemoteBusy] = useState(false);
  const [remoteErr, setRemoteErr] = useState(null);
  // Full address of the remote page, for display only — see applyRemoteState.
  const [remoteHref, setRemoteHref] = useState(null);
  const remote = engine === "remote";
  const mobile = engine === "mobile";
  // Both server-side engines hand back a session object with the same interface,
  // so everything from here on that only cares "is the server driving this?"
  // tests `driven` rather than naming an engine. The distinction between `remote`
  // and `mobile` is kept only where the two genuinely differ: what an address
  // means, and which hardware knobs are worth showing.
  const driven = remote || mobile;
  // Whether the modal drops its 1180px box and takes the whole window — see the
  // note on REC.modalMax for why each case needs the room.
  const maximised = mode === "replay" || driven;

  // Mobile capabilities are a separate probe from the browser ones: the answers
  // are unrelated (Playwright browsers versus an Appium server, adb and an
  // attached device) and each names its own missing piece of setup.
  const [mobileCaps, setMobileCaps] = useState(null);
  // Which device and app the mobile engine opens against. Defaulted from
  // capabilities once they arrive rather than hardcoded, since the only honest
  // default is whatever is actually attached.
  const [mobileUdid, setMobileUdid] = useState(initialUdid || null);
  // A saved mobile test carries its app in startUrl — the same field a web test
  // keeps its start page in, because both answer "where does this begin". For a
  // new recording it is whatever the dialog installed or picked.
  const [mobileApp, setMobileApp] = useState(
    () => initialApp || (isMobileTest(initialTest) ? initialTest.startUrl || "" : ""),
  );

  // ---- the generated test --------------------------------------------------
  // Which half of the right-hand panel is showing: the recorded steps, or the
  // test code they generate.
  const [sideView, setSideView] = useState("steps");

  // The recording as it stands right now, in the shape the generators take. Not
  // saved and not persisted — this is the draft in the recorder, so the code
  // view can exist before the test has a name or has ever been saved.
  const draftTest = useMemo(
    () => ({
      id: initialTest?.id || "draft",
      name: name.trim() || "Untitled test",
      tags,
      steps,
      // On mobile the start "URL" is the app package — same field, because a
      // mobile screen's address is its foreground app.
      startUrl: mobile ? mobileApp || startUrl : startUrl,
      ...(mobile ? { engine: "mobile", platform: "Android" } : {}),
    }),
    [initialTest, name, tags, steps, mobile, mobileApp, startUrl],
  );

  // Regenerated whenever a step is added, edited, reordered or removed — which
  // is the point of showing it here rather than only at export. Code that
  // appears as you record is code you can see is wrong while the app is still
  // open on the page that produced it; the same mistake found at export time is
  // found after the recorder has been closed.
  //
  // Always a Page Object Model. The locators live on a class per page and the
  // spec names only methods, so the selector a recording captured has exactly
  // one home — see ./testrunner/pom.
  //
  // Guarded because this runs on every keystroke in the name box: a generator
  // that threw on a half-formed step would take the whole recorder down with it,
  // and losing an unsaved recording to a preview panel is not a trade worth
  // making.
  const generated = useMemo(() => {
    if (!steps.length) return null;
    try {
      return (mobile ? toAppiumPom(draftTest, mobileApp, dataSet) : toPlaywrightPom(draftTest, startUrl, dataSet))
        .bundle;
    } catch (err) {
      console.warn("[TestRunner] could not generate code for this recording:", err);
      return `// This recording could not be turned into code:\n//   ${err.message}\n`;
    }
  }, [draftTest, dataSet, mobile, mobileApp, startUrl, steps.length]);

  // What "headless" means depends on the engine, so the two cases are not the
  // same question:
  //
  //    — there is no second process to hide; headless moves the app
  //     frame offscreen. You cannot click a page you cannot see, so it can only
  //     ever apply to replay.
  //   remote  — the pane below already streams the real browser and forwards
  //     clicks and keystrokes to it, so recording headless works exactly like
  //     recording headed, minus the second OS window appearing over your work.
  //
  // Recording in the real browser is therefore always headless: the pane is the
  // recording surface, and a second OS window opening over your work adds
  // nothing it cannot already do. The headed/headless preference still governs
  // replay, where watching a real window is the point.
  const headlessRun = mode === "replay" ? !!headless : remote;

  // Whether to collapse to the compact "running headless" panel. Replay only:
  // a headless recording still needs its full UI on screen, because the pane is
  // the thing you click. Same flag stops the pane's screenshot polling — during
  // a recording that polling is the picture you are working from.
  const headlessChrome = headlessRun && mode === "replay";
  const sessionRef = useRef(null);
  sessionRef.current = session;

  useEffect(() => {
    let alive = true;
    remoteCapabilities().then((c) => alive && setCaps(c));
    return () => {
      alive = false;
    };
  }, []);

  // Mobile capabilities are probed on open too, so the engine button can be
  // offered or disabled with a reason before the user clicks it. A device can be
  // plugged in or an emulator started while this modal is open, so this is also
  // re-run whenever the mobile engine is selected.
  useEffect(() => {
    let alive = true;
    mobileCapabilities().then((c) => {
      if (!alive) return;
      setMobileCaps(c);
      // Adopt whatever is attached, unless the user has already chosen.
      setMobileUdid((cur) => cur || (c.devices && c.devices[0] ? c.devices[0].udid : null));
    });
    return () => {
      alive = false;
    };
  }, [engine]);

  // A stored preference can name a browser this backend does not have — the
  // machine changed, or the preference was set before someone ran
  // `npx playwright install webkit` and then didn't. Fall back to one that
  // exists rather than opening every session onto a 501, and persist it through
  // the same setter so the correction sticks.
  useEffect(() => {
    if (!caps || !caps.available || !onBrowser) return;
    const chosen = (caps.browsers || []).find((b) => b.id === browser);
    if (chosen && chosen.installed) return;
    const fallback = caps.defaultBrowser || (caps.browsers || []).find((b) => b.installed)?.id;
    if (fallback && fallback !== browser) onBrowser(fallback);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caps, browser]);

  // Every answer from the backend carries where the page now is; funnel them all
  // through one place so the address bar and the quick-open chips cannot drift.
  const applyRemoteState = (st) => {
    if (!st) return;
    if (st.url) setCurUrl(st.url);
    if (st.href) setRemoteHref(st.href);
  };

  // Where a newly opened session should land. Set by whatever decided to switch
  // engines, so the session does not depend on the address bar having
  // re-rendered first — an ordering bug that would silently open the browser on
  // the wrong page.
  const pendingTargetRef = useRef(null);
  // Bumped to ask for a session when there isn't one yet. The session effect is
  // deliberately not keyed on the address bar — that would relaunch the browser
  // on every keystroke — so a blank-start recording needs an explicit nudge once
  // a page is finally chosen.
  const [sessionNonce, setSessionNonce] = useState(0);

  // Anything off this origin can only be driven by the real browser. Switch to
  // it rather than showing the user an error they cannot act on. Returns true
  // when it took over, in which case the session effect loads `target`.
  const switchToRemoteFor = async (target) => {
    if (remote || !isExternalUrl(target)) return false;
    // Gated here as well as on the engine buttons, because this path never
    // touches them: type a foreign host into the address bar and the engine
    // used to change under you, plan or no plan.
    const denied = refusal("browsers");
    if (denied) {
      setRemoteErr(
        target + " is on another origin, so only a real browser can drive it.\n" + denied,
      );
      return false;
    }
    const c = caps || (await remoteCapabilities());
    if (!caps) setCaps(c);
    if (!c.available) {
      // Nothing can drive this page — say why, and what would fix it.
      setRemoteErr(
        `${target} is on another origin, so the  engine cannot read it — ` +
          `and the real-browser engine is unavailable:\n${c.reason}`,
      );
      return false;
    }
    pendingTargetRef.current = target;
    setEngine("remote");
    return true;
  };

  // A link inside the app can take the frame off-origin without ever touching
  // the address bar. The frame reports that it has become unreadable; take over
  // with the real browser instead of leaving a dead frame on screen.
  useEffect(() => {
    if (!crossOrigin || remote) return;
    switchToRemoteFor(remoteHref || curUrl || addr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crossOrigin, remote]);

  // One session per stint in remote mode, opened at whatever address is showing.
  // Deliberately not keyed on `addr`: navigating within a session is a goto, not
  // a relaunch — a new browser per keystroke would be absurd.
  useEffect(() => {
    if (!driven) return undefined;
    // On mobile the "address" is an app package, and it comes from the app
    // picker rather than the address bar — an emulator has no URL to fall back
    // on, so without a chosen app there is nothing to open a session against.
    const target = mobile
      ? pendingTargetRef.current || mobileApp
      : pendingTargetRef.current || toLoadableUrl(addr) || startUrl;
    // No address chosen yet on a new recording. Launching here would start a
    // real browser pointed at nothing and record its 404 as the entry point;
    // the effect re-runs once an address is entered.
    if (!target) return undefined;
    let cancelled = false;
    let opened = null;
    setRemoteBusy(true);
    setRemoteErr(null);
    pendingTargetRef.current = null;
    const opening = mobile
      ? MobileSession.open({ app: target, udid: mobileUdid })
      : RemoteSession.open({ url: target, headless: headlessRun, browser, device });
    opening
      .then(async (s) => {
        if (cancelled) {
          s.close();
          return;
        }
        // Seed the server with the steps already on screen, so opening an
        // existing test and hitting Record appends rather than starting over.
        await s.putSteps(stepsRef.current).catch(() => {});
        opened = s;
        setSession(s);
        applyRemoteState(s.state);
        if (s.state.error) setRemoteErr(s.state.error);
      })
      .catch((e) => !cancelled && setRemoteErr(e.message))
      .finally(() => !cancelled && setRemoteBusy(false));
    return () => {
      cancelled = true;
      if (opened) opened.close();
      setSession(null);
    };
    // Switching browser relaunches the session, which is the honest reading of
    // the request: there is no way to move a live page from Gecko to WebKit.
    // Device is in here for the same reason — emulation is fixed when the
    // context is created, so changing it needs a new one. The mobile pair
    // (device, app) is in for the same reason again: an Appium session is bound
    // to one device when it is created.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driven, mobile, headlessRun, browser, device, mobileUdid, mobileApp, sessionNonce]);

  // Recording and assert mode are server-side flags: a fresh document resets
  // anything held in the page, so the backend is the one place they can live.
  useEffect(() => {
    if (session) session.setRecording(recording).catch((e) => setRemoteErr(e.message));
  }, [session, recording]);
  useEffect(() => {
    if (session) session.setAssertMode(assertMode).catch((e) => setRemoteErr(e.message));
  }, [session, assertMode]);

  // Armed pick mode swallows the next click in the frame, so there has to be a
  // way out that does not involve clicking something and getting a step you did
  // not want.
  useEffect(() => {
    if (!hoverPick) return undefined;
    // Playback owns the frame while it runs; an armed pick left over from before
    // it started has nothing to aim at.
    if (playing) {
      setHoverPick(false);
      return undefined;
    }
    const onKey = (e) => e.key === "Escape" && setHoverPick(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [hoverPick, playing]);

  // Ownership split. While recording, the server's buffer is authoritative and
  // the panel mirrors it (steps are produced over there). While paused, the
  // panel is authoritative — it owns undo, reorder, delete and retyping — and is
  // pushed back. Without the split the two would fight over every keystroke.
  useEffect(() => {
    if (!session || recording) return;
    session.putSteps(stepsRef.current).catch(() => {});
  }, [session, recording, steps]);

  useEffect(() => {
    if (!session || !recording) return undefined;
    let alive = true;
    const ctl = new AbortController();
    (async () => {
      let since = session.state.revision;
      while (alive) {
        try {
          const data = await session.pollSteps(since, { signal: ctl.signal });
          if (!alive) break;
          if (data.revision !== since) {
            since = data.revision;
            setSteps(data.steps);
          }
          applyRemoteState(data);
        } catch {
          if (!alive) break;
          await sleep(1000); // backend hiccup — retry rather than stop recording
        }
      }
    })();
    return () => {
      alive = false;
      ctl.abort();
    };
  }, [session, recording]);

  const pushStep = (step, coalesceFill) =>
    setSteps((prev) => {
      const last = prev[prev.length - 1];
      if (coalesceFill && last && last.action === "fill" && last.selector === step.selector) {
        return [...prev.slice(0, -1), step];
      }
      if (
        last &&
        last.action === step.action &&
        last.selector === step.selector &&
        last.value === step.value &&
        step.action === "click"
      ) {
        return prev; // ignore duplicate identical click
      }
      return [...prev, step];
    });

  // Attach capture-phase listeners to the iframe document on every load.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return undefined;

    const onLoad = () => {
      let doc, win;
      try {
        doc = iframe.contentDocument;
        win = iframe.contentWindow;
      } catch {
        doc = null;
      }
      // Cross-origin: nothing can be attached, so flag it rather than silently
      // recording nothing while the user clicks around.
      if (!doc || !win) {
        setCrossOrigin(true);
        // The frame's location is unreadable, but the src we asked for is not.
        // Use it to keep the address bar honest and still record the hop, so an
        // external URL typed while recording becomes a real step.
        const requested = iframe.getAttribute("src") || "";
        if (requested) {
          setCurUrl(requested);
          if (recordingRef.current) {
            const last = stepsRef.current[stepsRef.current.length - 1];
            if (!last || last.url !== requested)
              pushStep({ action: "navigate", url: requested, label: requested });
          }
        }
        return;
      }
      setCrossOrigin(false);
      instrumentPage(win);
      const path = win.location.pathname + win.location.search;
      setCurUrl(path);

      // The URL must be read when a step happens, not when the page loaded.
      // React Router navigates with pushState, which fires no load event, so a
      // value captured here would still say "/AddDoctor" after the app had
      // moved on to "/DoctorList" — stamping every later step with the wrong
      // page and sending playback back to it.
      const pathNow = () => {
        try {
          return win.location.pathname + win.location.search;
        } catch {
          return path;
        }
      };

      // Keep the address bar honest across client-side route changes too.
      if (!win.__trRoutePatched) {
        win.__trRoutePatched = true;
        ["pushState", "replaceState"].forEach((method) => {
          const orig = win.history[method];
          win.history[method] = function (...args) {
            const result = orig.apply(this, args);
            win.dispatchEvent(new win.Event("__trroute"));
            return result;
          };
        });
        win.addEventListener("popstate", () => win.dispatchEvent(new win.Event("__trroute")));
      }
      win.addEventListener("__trroute", () => setCurUrl(pathNow()));

      // record a navigation step if the page changed mid-recording
      if (recordingRef.current) {
        const last = stepsRef.current[stepsRef.current.length - 1];
        if (stepsRef.current.length > 0 && (!last || last.url !== path)) {
          pushStep({ action: "navigate", url: path, label: path });
        }
      }

      const onClick = (e) => {
        // Picking a hover target is not recording — it is aiming. It therefore
        // runs whether or not the recorder is armed, which is the case that
        // matters: you come back to a test that failed on a menu item, pause on
        // the step, and point at the thing that has to be hovered first.
        // isTrusted separates a real pointer from playback's own el.click():
        // without it, an armed pick would swallow the first click of a replay
        // and report it as a chosen target.
        if (hoverPickRef.current && e.isTrusted) {
          e.preventDefault();
          e.stopPropagation();
          const t = e.target;
          // The nearest interactive ancestor, falling back to the exact node —
          // the same widening a recorded click does, because the element that
          // *reveals* a submenu is usually the link, not the text node in it.
          const el =
            (t.closest && t.closest("button, a, [role='button'], [role='menuitem'], li, [class*='menu'], [class*='nav']")) ||
            t;
          setHoverPick(false);
          if (insertRef.current) {
            insertRef.current({ action: "hover", ...locatorFor(el), label: describeEl(el) });
          }
          return;
        }
        if (!recordingRef.current) return;
        // Assert mode: capture an assertion about the clicked element instead
        // of performing/recording the click.
        //
        // preventDefault is what makes this describe rather than act — and it
        // also cancels the focus a click on a field would have given it, which
        // is why nothing can be typed while assert mode is on. Intended, not a
        // fault: pause asserting to type.
        if (assertRef.current) {
          e.preventDefault();
          e.stopPropagation();
          const t = assertTarget(e.target);
          const isForm = /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
          const expected = isForm ? t.value : normText(t.textContent).slice(0, 80);
          pushStep({
            action: "assert",
            ...locatorFor(t),
            assertType: expected ? (isForm ? "value" : "text") : "exists",
            expected,
            label: expected || describeEl(t),
            url: pathNow(),
          });
          return;
        }
        const el = e.target.closest("button, a, [role='button'], input[type='submit'], input[type='checkbox'], input[type='radio']");
        if (!el) return;
        if (el.tagName === "INPUT" && (el.type === "checkbox" || el.type === "radio")) {
          pushStep({ action: "check", ...locatorFor(el), value: el.checked, label: describeEl(el), url: pathNow() });
        } else {
          pushStep({ action: "click", ...locatorFor(el), label: describeEl(el), url: pathNow() });
        }
      };
      const onInput = (e) => {
        if (!recordingRef.current) return;
        const el = e.target;
        // File inputs are handled on `change` as an upload step — their value
        // is a read-only "C:\fakepath\…" that can never be replayed.
        if (el.tagName === "INPUT" && el.type === "file") return;
        if ((el.tagName === "INPUT" && el.type !== "checkbox" && el.type !== "radio") || el.tagName === "TEXTAREA") {
          pushStep({ action: "fill", ...locatorFor(el), value: el.value, label: describeEl(el) || el.placeholder, url: pathNow() }, true);
        }
      };
      const onChange = (e) => {
        if (!recordingRef.current) return;
        const el = e.target;
        if (el.tagName === "SELECT") {
          const opt = el.options[el.selectedIndex];
          pushStep({ action: "select", ...locatorFor(el), value: el.value, label: (opt && opt.text) || el.value, url: pathNow() });
          return;
        }
        if (el.tagName === "INPUT" && el.type === "file" && el.files && el.files[0]) {
          captureUpload(pushStep, el, el.files[0], pathNow());
        }
      };
      doc.addEventListener("click", onClick, true);
      doc.addEventListener("input", onInput, true);
      doc.addEventListener("change", onChange, true);
    };

    iframe.addEventListener("load", onLoad);
    return () => iframe.removeEventListener("load", onLoad);
  }, []);

  const safePath = () => {
    try {
      const w = iframeRef.current.contentWindow;
      return w.location.pathname + w.location.search;
    } catch {
      return null;
    }
  };

  // Full href, for steps whose url was edited to an absolute address.
  const safeHref = () => {
    try {
      return iframeRef.current.contentWindow.location.href;
    } catch {
      return null;
    }
  };

  const isAbsolute = (u) => /^https?:\/\//i.test(String(u || ""));
  // Compare like with like: an absolute step url is matched against the frame's
  // href, a path against its pathname. Mixing the two makes every step think it
  // is on the wrong page and re-navigate.
  const locationMatches = (target) =>
    isAbsolute(target) ? safeHref() === target : safePath() === target;

  const gotoUrl = (path) =>
    new Promise((resolve) => {
      const iframe = iframeRef.current;
      if (locationMatches(path)) return resolve();
      const onLoad = () => {
        iframe.removeEventListener("load", onLoad);
        resolve();
      };
      iframe.addEventListener("load", onLoad);
      iframe.src = path;
    });

  // Get to `path` without needlessly reloading. A step recorded on a different
  // URL usually means the *previous* step navigated there client-side, and that
  // routing is async — so wait for it to land first. Falling straight through
  // to gotoUrl would hard-reload the frame and throw away the in-memory state
  // the previous action just created (a freshly saved record, for instance),
  // which looks exactly like the app "not syncing".
  const ensureUrl = async (path) => {
    if (!path || locationMatches(path)) return;
    const landed = await waitFor(() => locationMatches(path), SPA_NAV_WAIT, 100);
    if (!landed) await gotoUrl(path);
  };

  // Keep the address bar in sync as the user clicks around the page — but not
  // while they're actively typing a URL into it (guarded by addrFocusRef).
  //
  // Remote sessions show the full address rather than the path: on a foreign
  // origin a bare "/" would not say which host you are looking at. Steps still
  // store the portable path — only the display differs.
  const addrFocusRef = useRef(false);
  useEffect(() => {
    if (!addrFocusRef.current) setAddr((driven && remoteHref) || curUrl);
  }, [curUrl, remoteHref, driven]);

  // Normalise whatever the user typed into a loadable target, then drive the
  // iframe there. A same-origin path keeps recording/playback working; anything
  // naming a host ("google.com", "localhost:5173", a full http(s) URL) loads as
  // an absolute address. While recording, the iframe's `load` handler captures
  // this as a `navigate` step automatically.
  // Navigate the real browser, opening a session first when there isn't one —
  // the blank-start case. The address bar and the quick-open chips both come
  // through here so they cannot disagree about what "no session yet" means.
  const remoteGoto = async (target) => {
    if (!sessionRef.current) {
      pendingTargetRef.current = target;
      setSessionNonce((n) => n + 1);
      return;
    }
    try {
      applyRemoteState(await sessionRef.current.goto(target));
      setRemoteErr(null);
    } catch (err) {
      setRemoteErr(err.message);
    }
  };

  const goToAddr = async () => {
    if (playing) return; // don't fight active playback
    // On the mobile engine the address bar holds an app package, not a URL:
    // normalising it as one would mangle "com.android.settings" into a path.
    if (mobile) {
      const pkg = addr.trim();
      if (!pkg) return;
      setMobileApp(pkg);
      await remoteGoto(pkg);
      return;
    }
    const target = toLoadableUrl(addr);
    if (!target) return;
    // Show what actually loaded, so a bare host visibly resolves to its URL.
    setAddr(target);
    // An off-origin address hands over to the real browser by itself. Making the
    // user notice a banner and click a button first is just an error message
    // wearing a hat.
    if (await switchToRemoteFor(target)) return;
    if (remote) {
      await remoteGoto(target);
      return;
    }
    await gotoUrl(target);
  };

  // Playback of one step in the real browser. The client keeps the loop, the
  // pacing and the report; the server only performs the step — so `play` below is
  // shared by both engines.
  const runStepRemote = async (st, opts) => {
    const s = sessionRef.current;
    if (!s) throw new Error("no browser session — switch engines and try again");
    const res = await s.runStep(st, { ...opts, selfHeal });
    applyRemoteState(res);
    if (!res.ok) {
      const err = new Error(res.error || "step failed");
      // A failed API assertion sends its response back with the failure. Carried
      // onto the error so the report shows the body that explains it, exactly
      // as it does when this engine is the one that ran the call.
      err.api = res.api || null;
      throw err;
    }
    // Same shape the  engine returns, so `play` neither knows nor cares
    // which engine repaired the locator — or which one sent the request.
    return { holdMs: res.holdMs || 0, healed: res.healed || null, api: res.api || null };
  };

  // A flat, uninterruptible pause with a visible countdown — without the
  // countdown a 30s hold is indistinguishable from a hung run.
  const holdFor = async (ms, why) => {
    const end = Date.now() + ms;
    for (;;) {
      const left = end - Date.now();
      if (left <= 0) break;
      setHold({ secondsLeft: Math.ceil(left / 1000), why });
      await sleep(Math.min(250, left));
    }
    setHold(null);
  };

  // A REST call, sent by this browser.
  //
  // Deliberately same-origin only, and deliberately not proxied through the
  // backend. A "fetch this URL for me" endpoint would make the server an open
  // relay into whatever it can reach — cloud metadata, an internal admin port,
  // localhost — and hand the body back to the caller, which is a far larger
  // thing to own than a test step. The real-browser engine already calls any
  // origin without that risk, because it runs in a browser the user started and
  // the request leaves from there.
  //
  // So the rule is exactly the one this engine already lives under for pages:
  // it can drive what this origin serves, and says plainly when it cannot.
  // Relative URLs — what a test of your own app uses — are unaffected.
  const runApiStep = async (st) => {
    const step = normalizeApi(st);
    let target;
    try {
      target = new URL(step.url || "/", window.location.origin);
    } catch {
      throw new Error(`"${step.url}" is not a URL this step can send.`);
    }
    if (target.origin !== window.location.origin) {
      throw new Error(
        `cannot call ${target.origin} from this engine — the browser blocks a ` +
          `cross-origin request from ${window.location.origin}, and proxying it ` +
          `through the server would turn the backend into an open relay. ` +
          `Switch to the real-browser engine, which calls any origin.`,
      );
    }

    const t0 = performance.now();
    let response;
    try {
      response = await fetch(target.href, {
        method: step.method,
        headers: headersObject(step.headersText),
        // Never an empty string: fetch rejects a body on GET/HEAD outright, and
        // normalize() has already dropped it for those methods.
        body: step.body || undefined,
        // The point of running in this browser rather than a detached client:
        // the app's own session cookie rides along, so an API step after a UI
        // sign-in is authenticated exactly as the page is.
        credentials: "same-origin",
      });
    } catch (err) {
      throw new Error(`${step.method} ${target.href} could not be sent — ${err.message}`);
    }

    const body = await response.text();
    const headers = {};
    response.headers.forEach((v, k) => {
      headers[k] = v;
    });
    const summary = summarizeApi({
      status: response.status,
      statusText: response.statusText,
      headers,
      body,
      ms: Math.round(performance.now() - t0),
    });

    const verdict = evaluateApi(step, summary);
    const api = {
      method: step.method,
      url: target.href,
      status: summary.status,
      statusText: summary.statusText,
      ms: summary.ms,
      ok: verdict.ok,
      results: verdict.results,
      extracted: extractApi(step, summary),
      // Capped for the same reason the server engine caps it: this goes into
      // the report and into storage, and a response body has no size limit.
      bodyPreview: body.length > 2000 ? `${body.slice(0, 2000)}…` : body,
    };
    if (!verdict.ok) {
      const err = new Error(
        `${step.method} ${target.pathname} returned ${summary.status} — ` +
          verdict.results
            .filter((r) => !r.ok)
            .map((r) => r.detail)
            .join("; "),
      );
      err.api = api;
      throw err;
    }
    return { holdMs: 0, api };
  };

  const runStep = async (st) => {
    if (st.action === "navigate") {
      await gotoUrl(st.url);
      return;
    }
    // A REST call needs no page, so it is handled before everything below that
    // reaches into the frame — asking for contentDocument here would fail a
    // perfectly valid API-only test for want of a document it never uses.
    if (st.action === "api") return runApiStep(st);
    await ensureUrl(st.url);
    const win = iframeRef.current.contentWindow;
    const doc = iframeRef.current.contentDocument;
    // A cross-origin frame hands back a null document — the same-origin policy
    // forbids reading it. Say that plainly instead of failing later with a
    // TypeError on `doc.querySelector`.
    if (!doc || !win) {
      throw new Error(
        `cannot drive ${safeHref() || st.url || "this page"} — it is on a different origin, ` +
          `so the browser blocks reading or clicking inside the frame. ` +
          `This runner can only test pages served from ${window.location.origin}.`,
      );
    }

    // An implicit wait just re-budgets the auto-waiting for everything after
    // it; it does not pause. Applied before settling so it takes effect at once.
    if (st.action === "implicitWait") {
      implicitRef.current = Math.max(250, Number(st.ms) || AUTO_WAIT.timeout);
      return;
    }

    // Never touch a page that is still loading, fetching or re-rendering.
    await waitForSettled(doc, win);

    // An explicit wait is an unconditional pause — no early exit. Use it only
    // where the settle waits genuinely cannot see what you're waiting for.
    if (st.action === "wait") {
      await holdFor(Math.max(0, Number(st.ms) || 0), describeStep(st));
      return { holdMs: Number(st.ms) || 0 };
    }

    if (st.action === "scroll") {
      const by = (Number(st.amount) || 500) * (st.direction === "up" ? -1 : 1);
      win.scrollBy({ top: by, behavior: "auto" });
      await waitForSettled(doc, win);
      return;
    }

    // Reload the page the step was recorded on — the F5 a tester presses to
    // check that what was just saved really persisted, rather than sitting in
    // React state looking saved. `ensureUrl` above has already put us on that
    // page, so this reloads it in place; it deliberately does NOT re-navigate,
    // because the point is to reload *this* URL including its query string.
    if (st.action === "reload") {
      const frame = iframeRef.current;
      win.location.reload();
      // The document is replaced, so the `doc` in hand is about to go stale —
      // wait for the new one to arrive rather than settling a corpse.
      const fresh = await waitFor(
        () => {
          try {
            const d = frame.contentDocument;
            return d && d !== doc && d.readyState === "complete" ? d : null;
          } catch {
            return null; // cross-origin mid-load — the next poll sees it
          }
        },
        SETTLE.timeout,
        80,
      );
      if (!fresh) throw new Error("the page did not finish reloading within 8s");
      await waitForSettled(fresh, frame.contentWindow);
      return;
    }

    // ---- self-healing ----------------------------------------------------
    // The step as executed. A heal swaps its locators for the rest of this
    // step only — the stored recording is never edited from in here. Repairs
    // are handed up at the end of the run and applied by whoever owns it.
    let target = st;
    let healed = null;

    // Adopt a repaired locator, once per step. A second heal would mean the
    // first found the wrong element, and chaining a guess off a wrong guess is
    // how a self-healing runner ends up confidently testing the wrong button.
    const adopt = (el, hint) => {
      const repair = repairFrom(el, st, hint);
      if (!repair) return false;
      healed = repair;
      target = { ...target, selector: repair.selector, selectors: repair.selectors, tag: repair.tag };
      return true;
    };

    // One escalation, shared by the assert, upload and action paths so all
    // three heal identically. `look` is whatever waiting that path already
    // does, so a healed element still has to clear the same visibility and
    // actionability bars as one found the ordinary way.
    const findWithHeal = async (look, ms) => {
      const first = await look(target, ms);
      if (first) {
        // Found — but perhaps only because the text fallback rescued it, which
        // means every recorded selector is already dead and the step is one
        // copy change from failing. Repair it now rather than on the run where
        // the text moves too.
        if (selfHeal && !healed) {
          const hit = resolveWith(doc, target);
          if (hit && !hit.via) adopt(hit.el, textMatch());
        }
        return first;
      }
      if (!selfHeal || healed) return null;
      const fix = healInDocument(doc, target);
      if (!fix || !adopt(fix.el, fix)) return null;
      // A short second look: healEl has already proved the element is there,
      // so this only waits for it to become actionable.
      return look(target, Math.min(2000, ms || 2000));
    };

    // Auto-waiting assertion: keep re-checking until the expectation holds or
    // we time out, so an assertion that fires before an async render settles
    // no longer flakes.
    if (st.action === "assert") {
      const check = (t) => () => {
        const el = resolveEl(doc, t);
        if (!el)
          throw new Error(
            `no element matched ${whyNotFound(doc, t)}\ntried ${locatorSummary(t)}`,
          );
        if (t.assertType === "exists") return;
        const actual = /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)
          ? el.value
          : normText(el.textContent);
        if (!actual.includes(t.expected))
          throw new Error(`expected "${t.expected}", got "${actual.slice(0, 60)}"`);
      };
      const budget = {
        timeout: Math.max(ASSERT_WAIT.timeout, implicitRef.current),
        interval: ASSERT_WAIT.interval,
      };
      try {
        await waitForAssertion(check(target), budget);
      } catch (err) {
        // Heal only when NOTHING matched. An element that WAS found and holds
        // the wrong text is a real failure — the comparison is the whole point
        // of the step, and satisfying it with a different element is the one
        // thing a self-healing runner must never do.
        const fix = selfHeal && !resolveEl(doc, target) ? healInDocument(doc, target) : null;
        if (!fix || !adopt(fix.el, fix)) throw err;
        await waitForAssertion(check(target), { timeout: 2000, interval: ASSERT_WAIT.interval });
      }
      return { healed };
    }

    // Uploads only wait for the input to *exist*: file inputs are very often
    // visually hidden behind a styled label, so the visibility check that other
    // actions use would reject a perfectly working target.
    if (st.action === "upload") {
      const input = await findWithHeal(
        (t, ms) => waitFor(() => resolveEl(doc, t), ms, AUTO_WAIT.interval),
        implicitRef.current,
      );
      if (!input)
        throw new Error(`file input not found ${whyNotFound(doc, target)}\ntried ${locatorSummary(target)}`);
      await setInputFile(win, input, st);
      await waitForSettled(doc, win);
      const uploadHold = holdMsFor(st);
      if (uploadHold) await holdFor(uploadHold, st.name || st.label || "upload");
      return { holdMs: uploadHold, healed };
    }

    // Actions auto-wait for the target to become actionable (present, visible,
    // enabled), then for it to stop moving, and are re-resolved immediately
    // before use. A React re-render between "found it" and "clicked it" leaves
    // the old node detached, and clicking a detached node does nothing at all —
    // silently. Retrying on a stale node is what makes this reliable rather
    // than usually-fine.
    let el = null;
    let staleErr = null;
    for (let attempt = 0; attempt < ACTION_RETRIES; attempt++) {
      // The lookup escalates to a healed locator only when the ordinary one
      // finds nothing — a target that is present but disabled is a statement
      // about the steps before it, and loosening the selector until some other
      // element answers would bury that.
      const found = await findWithHeal(
        (t, ms) => waitForActionable(doc, t, { timeout: ms, interval: AUTO_WAIT.interval }),
        implicitRef.current,
      );
      if (!found) {
        // Distinguish "gone" from "there but not clickable" — different fixes.
        const present = resolveEl(doc, target);
        // Name the precondition that never held. It can come back null if the
        // element turned actionable in the moment between the wait expiring and
        // this check, which is its own diagnosis: the timeout is too short.
        const why = present && whyNotActionable(present);
        throw new Error(
          present
            ? `element found but never became actionable — ${why || "it only became actionable after the wait expired, so the implicit wait is too short"}\ntried ${locatorSummary(target)}`
            : `no element matched ${whyNotFound(doc, target)}\ntried ${locatorSummary(target)}`,
        );
      }
      // The locator for this attempt, settled: findWithHeal has finished, so
      // any repair it made is already in `target` and will not change again
      // underneath the closures below.
      const at = target;
      found.scrollIntoView({ block: "center", inline: "center" });
      // Scrolling itself moves things; settle, then require a stable box.
      await waitForStable(win, () => resolveEl(doc, at));
      // Re-resolve one last time: this is the node we actually act on.
      const fresh = resolveEl(doc, at);
      if (fresh && fresh.isConnected && isActionable(fresh)) {
        el = fresh;
        break;
      }
      staleErr = new Error(
        "element kept being replaced while preparing to act (the page re-rendered mid-step)",
      );
      await sleep(250);
    }
    if (!el) throw staleErr || new Error(`could not act on element — ${locatorSummary(target)}`);

    if (st.action === "fill") {
      // Tests recorded before uploads were supported stored a `fill` carrying a
      // "C:\fakepath\…" value, which the browser refuses to accept back. Replay
      // those as an upload of a placeholder named after the original file.
      if (el.type === "file") {
        const legacyName = String(st.value || "").split(/[\\/]/).pop();
        await setInputFile(win, el, { name: legacyName });
        await waitForSettled(doc, win);
        // Same asynchronous aftermath as a real upload step, so same hold.
        await holdFor(UPLOAD_HOLD_MS, legacyName || "upload");
        return { holdMs: UPLOAD_HOLD_MS, healed };
      }
      setNativeValue(win, el, st.value, "input");
    } else if (st.action === "select") setNativeValue(win, el, st.value, "select");
    else if (st.action === "check") {
      // Assigning el.checked writes straight through React's value tracker, so
      // React then sees "no change" and never fires onChange — a controlled
      // checkbox re-renders back to its old state and the app never learns
      // anything was ticked. A real click runs the browser's activation
      // behaviour instead: it toggles, updates the tracker and fires
      // input + change, which React does hear.
      const want = !!st.value;
      if (el.checked !== want) el.click();
      // Controlled inputs silently revert when the handler doesn't run, so
      // confirm the state actually stuck rather than failing later somewhere
      // less obvious (a validation message at submit time, say).
      await waitForAssertion(
        () => {
          const now = resolveEl(doc, target);
          if (!now) throw new Error("checkbox disappeared after clicking it");
          if (now.checked !== want)
            throw new Error(
              `checkbox did not stay ${want ? "checked" : "unchecked"} — the app's onChange did not take effect`,
            );
        },
        { timeout: 2000, interval: 100 },
      );
    } else if (st.action === "hover") {
      hoverEl(win, el);
    } else if (el.tagName === "INPUT" && el.type === "file") {
      // Clicking a file input opens the OS picker, which would block playback
      // forever — the upload step that follows sets the file directly.
    } else {
      el.click();
    }

    // Let the consequences of the action finish — the save request, the state
    // update, the re-render, any route change — before the next step looks at
    // the page. This is what stops "clicked Save, asserted too early" flake.
    await waitForSettled(
      iframeRef.current.contentDocument || doc,
      iframeRef.current.contentWindow || win,
    );

    const holdMs = holdMsFor(st);
    if (holdMs) await holdFor(holdMs, st.label || "save");
    return { holdMs, healed };
  };

  // ---- failure evidence ----------------------------------------------------
  // The app's stylesheets, without which a DOM snapshot renders back as
  // unstyled markup (see trShots.js). Filled in while capturing, read out when
  // filing the shot, and cleared per playback — a dev-server rebuild between
  // runs changes them.
  const shotCssRef = useRef(null);

  // What the page looks like right now. Never throws and never rejects: a run
  // must not fail because its evidence did.
  const captureShot = async () => {
    try {
      if (driven) {
        const raw = sessionRef.current && (await sessionRef.current.screenshot());
        return raw ? await shrinkJpeg(raw) : null;
      }
      const win = iframeRef.current && iframeRef.current.contentWindow;
      // A cross-origin frame is unreadable, which is the same reason the
      //  engine cannot drive it — nothing to salvage here.
      if (!win || !win.document || !win.document.body) return null;
      if (!shotCssRef.current) shotCssRef.current = captureCss(win.document);
      return captureDomShot(win);
    } catch (err) {
      console.warn("[TestRunner] could not capture this step:", err);
      return null;
    }
  };

  // Shoot step `i` and file it in the run's bundle. Only ever called for the
  // step that failed — see the note above the catch in `play`. The report itself
  // records only that a shot exists, and of what kind; the payload never goes
  // near localStorage.
  const keepShot = async (shots, results, i) => {
    const shot = await captureShot();
    if (!shot) return;
    shots.css = shotCssRef.current;
    shots.steps[i] = shot;
    results[i].shot = shot.kind;
  };

  // Play back every step, timing each one, and hand the finished run up as a
  // report. Steps after a failure are reported as skipped, the way Playwright
  // abandons the rest of a test once one action throws.
  //
  // A data set carrying rows runs the whole list once per row — see
  // ./testrunner/testdata. Iterations are deliberately independent of each
  // other: a row that fails does not stop the rows after it, because the
  // question a table is asked — "which of these twelve inputs does it break
  // on?" — cannot be answered by a run that stops at the first one. Inside an
  // iteration the original rule still holds, and for the opposite reason: once
  // a step has failed the page is no longer where the rest of the recording
  // thinks it is, so continuing only produces failures that say nothing.

  // One iteration. Navigates, walks the steps, and returns their results
  // without writing them anywhere — aggregation belongs to the caller, and
  // keeping it there is what let this become a loop at all.
  const playOnce = async (iter, shots) => {
    setStatus({});
    implicitRef.current = AUTO_WAIT.timeout; // a previous iteration must not leak into this one
    const results = steps.map((st) => ({
      verb: stepVerb[st.action] || st.action,
      label: describeStep(st),
      url: st.url || null,
      status: "skipped",
      durationMs: null,
      holdMs: 0,
      error: null,
      shot: null, // kind of evidence stored for this step, if any
      // The repair, when this step only ran because its locator was healed.
      // Kept per step rather than only counted, because which step healed and
      // what it healed onto is the whole of what a reviewer needs to judge
      // whether the repair was right.
      healed: null,
      // What a REST step's call returned — status, timing and the verdict on
      // each check. Null for every other kind of step. Carried into the report
      // because "it failed" is not a diagnosis for an API call: which check
      // failed, and what came back instead, is the whole of what a reader needs.
      api: null,
    }));

    // One resolver per ITERATION, and this is the line that makes a row table
    // worth having. Within an iteration the memory is what makes a test
    // coherent: a signup form filled with {{$email}} and a confirmation checked
    // for {{$email}} have to agree, and they only do because the value is
    // generated once and remembered here. Across iterations that memory must
    // NOT survive — a fresh resolver per row is what gives row 2 an address row
    // 1 has not already registered, without which a twelve-row signup table
    // fails eleven times on "that email is already in use" and blames the app.
    //
    // Both engines resolve here rather than each doing its own: the remote
    // engine is handed one step at a time over HTTP, so the client is the last
    // place both share. The stored step keeps its {{reference}} — only the copy
    // that executes carries the value.
    const resolver = makeResolver(dataSet, { row: iter.row });
    // resolveStep covers the flat text fields, which for an API step is its URL,
    // header block and body. An assertion comparing against a data set value,
    // and an extraction whose path is parameterised, sit inside arrays it cannot
    // reach — resolveApiStep finishes the job. Both engines go through here, so
    // neither can be given a half-resolved step.
    const resolved = (i) => {
      const st = resolveStep(steps[i], resolver);
      return st && st.action === "api" ? resolveApiStep(st, resolver) : st;
    };

    if (driven) {
      // On mobile the run starts by bringing the app under test to the front;
      // `startUrl` is a package name there, and the first step's `url` is too.
      await sessionRef.current
        .goto(resolved(0)?.url || (mobile ? mobileApp : startUrl))
        .catch(() => {});
    } else {
      await gotoUrl(resolved(0)?.url || startUrl);
    }
    await sleep(300);
    for (let i = 0; i < steps.length; i++) {
      setStatus((p) => ({ ...p, [i]: "running" }));
      const t0 = Date.now();
      try {
        // The implicit-wait budget lives with whichever engine is executing, so
        // tell the server to reset its own at the start of every iteration.
        const meta = driven
          ? await runStepRemote(resolved(i), { resetImplicit: i === 0 })
          : await runStep(resolved(i));
        // The explicit hold is reported separately — folding 30s of deliberate
        // waiting into the step time would bury how long the app actually took.
        results[i].holdMs = (meta && meta.holdMs) || 0;
        // A step that only completed because its locator was repaired is not
        // the same fact as one that simply passed, so it is recorded apart
        // rather than folded silently into the green count.
        results[i].healed = (meta && meta.healed) || null;
        // What a REST step saw, kept for the report: status, timings and the
        // per-assertion verdicts. Null for every other kind of step.
        results[i].api = (meta && meta.api) || null;
        // Anything it pulled out of the response joins the data namespace, so a
        // later {{token}} resolves to the one this call just returned. Done
        // here rather than inside either engine because the resolver is the
        // client's, and the remote engine only ever sees one step at a time.
        if (meta && meta.api && meta.api.extracted) {
          Object.keys(meta.api.extracted).forEach((k) => resolver.learn(k, meta.api.extracted[k]));
        }
        results[i].status = "passed";
        results[i].durationMs = Date.now() - t0 - results[i].holdMs;
        // `a<idx>` alongside the existing `e<idx>`: the response an API step
        // saw, so the step's own panel can show what it got back without
        // re-sending the request.
        setStatus((p) => ({ ...p, [i]: "passed", [`a${i}`]: results[i].api }));
      } catch (err) {
        results[i].status = "failed";
        results[i].durationMs = Date.now() - t0;
        results[i].error = err.message;
        // The response behind a failed REST assertion, whichever engine sent it.
        results[i].api = err.api || null;
        setStatus((p) => ({ ...p, [i]: "failed", [`e${i}`]: err.message, [`a${i}`]: results[i].api }));
        // The only step that gets photographed. A passing step's picture is
        // looked at approximately never, and shooting all of them costs a
        // round-trip per step on the remote engine and megabytes per run in
        // storage. The page as it stood when a step *failed* is the single most
        // useful thing in the report, and it is gone the moment this closes —
        // so it is captured here, before breaking out of the loop.
        //
        // Once per run, not once per iteration: twenty rows failing the same
        // way would otherwise be twenty pictures of the same page, and the
        // evidence store is budgeted at one picture per run. The first failure
        // is the one worth keeping, so a later iteration finding the store
        // already occupied leaves it alone.
        if (!Object.keys(shots.steps).length) {
          await keepShot(shots, results, i);
          shots.iteration = iter.index;
        }
        break;
      }
      // Purely so the run is watchable — the real waiting is done by
      // waitForSettled inside the step, not by a hopeful fixed pause.
      if (paceMs) await sleep(paceMs);
    }
    return results;
  };

  const play = async () => {
    if (playing) return;
    // Checked once for the whole run rather than per iteration: the session
    // does not come and go between rows, and a table of twenty would otherwise
    // print the same complaint twenty times.
    if (driven && !sessionRef.current) {
      setRemoteErr(
        mobile
          ? "the device session is not ready yet — give it a moment"
          : "the browser session is not ready yet — give it a moment",
      );
      return;
    }
    setPlaying(true);
    shotCssRef.current = null;
    const startedAt = Date.now();
    // Evidence is collected apart from the report and stored apart from it: the
    // report goes to localStorage on every run and is read on every render,
    // which is exactly what a pile of screenshots must not be part of. At most
    // one entry ends up in here — see the note in playOnce.
    const shots = { css: null, steps: {} };
    const iterations = iterationsOf(dataSet);
    const passes = [];

    for (let k = 0; k < iterations.length; k++) {
      const iter = iterations[k];
      // Only announced when there is more than one, so an ordinary single-pass
      // run's header stays exactly what it was before rows existed.
      setIterNow(iterations.length > 1 ? iter : null);
      // eslint-disable-next-line no-await-in-loop
      const results = await playOnce(iter, shots);
      passes.push({
        index: iter.index,
        label: iter.label,
        status: results.some((r) => r.status === "failed") ? "failed" : "passed",
        // wall-clock minus the deliberate pauses between steps, so the number
        // reflects the app's real response time rather than the player's pacing
        durationMs: results.reduce((n, r) => n + (r.durationMs || 0), 0),
        steps: results,
      });
    }

    setIterNow(null);
    setPlaying(false);

    // Repairs go up as a batch once the run is over, never mid-run: a heal is
    // only worth keeping if the step it rescued went on to do something, and
    // writing to the recording while it is being replayed would edit the very
    // list the loop above is walking.
    //
    // One repair per step, however many iterations found it. The same rotted
    // locator healing onto the same replacement on every row is one edit to the
    // recording, and sending twelve would have the last one win anyway — after
    // eleven redundant writes to the store.
    const heals = [];
    passes.forEach((pass) =>
      pass.steps.forEach((r, i) => {
        if (r.healed && !heals.some((h) => h.index === i)) heals.push({ index: i, ...r.healed });
      }),
    );
    if (heals.length && onHeal && initialTest) onHeal(initialTest.id, heals);

    if (onRunComplete && initialTest) {
      const report = {
        // Names the run so its evidence can be found again. Test id plus start
        // time, rather than a random string, so it stays the same if this report
        // is ever rebuilt and cannot collide across tests.
        id: `${initialTest.id}-${startedAt}`,
        testName: initialTest.name,
        startedAt,
        durationMs: passes.reduce((n, pass) => n + pass.durationMs, 0),
        // One red row makes the run red. A data-driven run that passed eleven
        // of twelve is a failing run — the twelfth input is a bug someone has
        // to look at, and a green verdict is how it goes unlooked-at.
        status: passes.some((pass) => pass.status === "failed") ? "failed" : "passed",
        // How many locators this run had to repair. A green run with repairs
        // in it is a different fact from a green run without, and the count is
        // what makes that visible from the history strip rather than only from
        // opening the run and reading down it.
        healed: heals.length,
        // Where it ran. With three engines available, "it failed" is only half
        // an answer — the same test passing in Chromium and failing in WebKit is
        // the finding, and a history of reports that does not say which browser
        // each one used cannot show it. Reports written before this say nothing,
        // which is why every reader treats the field as optional.
        browser: driven ? sessionRef.current?.browser || browser : "",
      };
      // The two shapes are exclusive, and that is a storage decision rather
      // than a stylistic one. Twenty reports are kept per test inside a ~5MB
      // origin quota, so a twelve-row table writing its steps twice — once
      // under `steps` for the old readers and once under `iterations` — would
      // halve how much history fits. A single-iteration run therefore writes
      // exactly the shape it has always written, and only a table writes the
      // new one; Report reads whichever it finds.
      if (passes.length > 1) {
        report.iterations = passes;
        // Which set produced these rows. A report read next month is otherwise
        // a list of labels with nothing saying what they varied.
        report.dataSet = dataSet ? dataSet.name : null;
        // Which iteration the screenshot belongs to, so it is shown against the
        // row that actually failed rather than whichever row is on screen.
        report.shotIteration = shots.iteration == null ? null : shots.iteration;
      } else {
        report.steps = passes[0].steps;
      }
      onRunComplete(initialTest.id, report, shots);
    }
  };

  // Scheduled runs open this modal and drive it themselves. The scheduler owns
  // closing it — onAutoDone fires whether the run passed or blew up, so a
  // failing test can never wedge the queue with a modal nobody closes.
  useEffect(() => {
    if (!autoPlay) return undefined;
    let cancelled = false;
    (async () => {
      await sleep(800); // let the iframe reach its start URL first
      if (cancelled) return;
      try {
        await play();
      } catch (err) {
        console.warn("[TestRunner] scheduled run failed:", err);
      }
      if (!cancelled && onAutoDone) onAutoDone();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay]);

  const undo = () => setSteps((prev) => prev.slice(0, -1));
  const clearAll = () => setSteps([]);

  // ---- step editing ----
  const removeStep = (i) => {
    setSteps((prev) => prev.filter((_, k) => k !== i));
    setEditIdx(null);
  };
  const moveStep = (i, dir) =>
    setSteps((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const patchStep = (i, patch) =>
    setSteps((prev) => prev.map((s, k) => (k === i ? { ...s, ...patch } : s)));

  // Insert a synthetic step directly after the one being edited, or at the end
  // when nothing is selected — so it lands where you were just looking.
  const insertStep = (step) =>
    setSteps((prev) => {
      const at = editIdx !== null ? editIdx + 1 : prev.length;
      const next = [...prev];
      // `url` means two different things depending on the step, and only one of
      // them is the page the recorder happens to be on.
      //
      // For every UI step it is "where this runs", stamped from the frame so
      // playback can return there first. For a REST step it is the request
      // target the author typed — stamping over it would silently replace
      // /api/plans with whatever page the recorder was showing, and the step
      // would then call the app's own HTML and fail its checks against it.
      //
      // A server-driven engine has no readable frame — its current address is
      // whatever the backend last reported (a URL for the browser engine, the
      // foreground app package for the mobile one).
      next.splice(
        at,
        0,
        step.action === "api" ? step : { ...step, url: (driven ? curUrl : safePath()) || undefined },
      );
      return next;
    });
  // Reachable from the frame's long-lived listeners; see hoverPickRef.
  insertRef.current = insertStep;

  // Seeds the recording with one API step when the new-test dialog's "API"
  // choice opened it — see NewTestDialog. Guarded by a ref rather than
  // `steps.length === 0` alone: inserting sets steps to length 1, which would
  // otherwise fail that check on the very next render and never fire again,
  // but also never actually re-run since `initialApiOnly` doesn't change —
  // the ref is what keeps a StrictMode double-invoke from inserting twice.
  const apiSeededRef = useRef(false);
  useEffect(() => {
    if (apiSeededRef.current) return;
    if (!initialApiOnly || mode !== "record" || steps.length > 0) return;
    apiSeededRef.current = true;
    insertStep(
      normalizeApi({
        method: "GET",
        url: "/api/",
        headersText: "Accept: application/json",
        asserts: [{ type: "status", op: "eq", expected: 200 }],
      }),
    );
    setEditIdx(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialApiOnly, mode]);

  // The remote engine's pick. A screenshot cannot be inspected here, so the
  // backend is asked what is at that point and answers with the same locator
  // bundle the  pick builds itself — which is what keeps a hover step
  // recorded in one engine replayable in the other.
  const pickHoverTarget = async (x, y) => {
    setHoverPick(false);
    try {
      const hit = await session.pick(x, y);
      if (!hit || !(hit.selectors || []).length) {
        setRemoteErr("nothing identifiable at that point — try clicking the element itself");
        return;
      }
      setRemoteErr(null);
      insertStep({ action: "hover", ...hit });
    } catch (err) {
      setRemoteErr(err.message);
    }
  };

  // Which field a step's editable text lives in — assertions compare `expected`,
  // everything else types/selects a `value`.
  const editField = (st) => {
    if (st.action === "assert") return st.assertType === "exists" ? null : "expected";
    if (st.action === "fill" || st.action === "select") return "value";
    if (st.action === "wait" || st.action === "implicitWait") return "ms";
    if (st.action === "scroll") return "amount";
    return null;
  };
  // ms and amount are numeric; everything else is free text.
  const isNumericField = (f) => f === "ms" || f === "amount";

  // Engines cannot be swapped mid-run or mid-recording: the two hold their own
  // idea of where the page is, and a half-recorded test would end up split
  // across both.
  const engineHint = playing
    ? "Cannot switch engines during playback"
    : recording
      ? "Pause recording before switching engines"
      : ": instant, but this origin only (same-origin policy).\n" +
        "Real browser: Playwright on the backend — any URL, any origin, and\n" +
        "Chromium, Firefox or WebKit rather than only the browser you are in.\n" +
        "Mobile app: Appium driving a native app on a real device or emulator.";

  // Why the mobile engine cannot be used, if it cannot. The backend names the
  // one missing piece — webdriverio, the Appium server, adb, or a device — and
  // each has a different fix, so the reason is passed through rather than
  // flattened into "unavailable".
  const mobileHint =
    mobileCaps && !mobileCaps.available
      ? `Mobile engine unavailable — ${mobileCaps.reason}`
      : playing || recording
        ? "Finish the run or pause recording first — switching device relaunches the session"
        : "Record and replay against a native app. Taps and typing are forwarded to\n" +
          "the device and resolved against its accessibility tree.";

  // Devices adb can currently see. An emulator started while this modal is open
  // shows up on the next capabilities probe rather than needing a reload.
  const mobileDevices = (mobileCaps && mobileCaps.devices) || [];
  // Apps worth offering first: anything installed by the user, then the system
  // apps that make a good first proof (Settings, Calculator).
  const mobileAppChoices = ((mobileCaps && mobileCaps.apps) || []).filter(
    (a) => a.kind === "app" || /settings|calculator|contacts|dialer|clock/i.test(a.name),
  );

  // What the backend says it can launch. Falls back to the three names with
  // nothing marked installed only when capabilities have not answered yet — the
  // buttons then render disabled rather than the row popping into existence a
  // moment later and shifting the header under the pointer.
  const browserChoices =
    caps && caps.browsers && caps.browsers.length
      ? caps.browsers
      : BROWSER_IDS.map((id) => ({
          id,
          name: browserLabel(id),
          engine: "",
          installed: false,
          reason: "checking what is installed…",
        }));
  const missing = browserChoices.filter((b) => !b.installed);
  const browserHint =
    playing || recording
      ? "Finish the run or pause recording first — switching browser relaunches it"
      : "Record and replay in a different rendering engine. Switching relaunches\n" +
        "the page in that browser." +
        (missing.length
          ? `\nNot installed: ${missing.map((b) => b.name).join(", ")} — npx playwright install`
          : "");

  // Same shape whether or not capabilities have answered yet, so the row does
  // not appear a moment later and shift the header under the pointer.
  const deviceChoices =
    caps && caps.devices && caps.devices.length
      ? caps.devices
      : DEVICE_IDS.map((id) => ({ id, name: id, engines: null, viewport: null }));
  const activeDevice = deviceChoices.find((d) => d.id === device);
  const deviceDowngraded =
    activeDevice && activeDevice.engines && !activeDevice.engines.includes(browser);
  const deviceHint =
    playing || recording
      ? "Finish the run or pause recording first — switching device relaunches the page"
      : "Emulate a phone or tablet: viewport, pixel ratio, user agent and touch.\n" +
        "Switching relaunches the page in that device." +
        (deviceDowngraded
          ? `\n⚠ ${activeDevice.name} cannot be emulated on ${browserLabel(browser)} — it will run at that size only.`
          : "");

  const canSave = name.trim() && steps.length > 0;
  // Why Save is unavailable, in the user's terms. A disabled button with no
  // explanation is indistinguishable from a broken one — and both requirements
  // here are easy to miss, since the name box is a bare unlabelled field in the
  // header and steps arrive from the server on the driven engines.
  const saveBlockedReason = canSave
    ? null
    : !name.trim() && !steps.length
      ? "Name this test and record at least one step before saving."
      : !name.trim()
        ? "Name this test in the box at the top before saving."
        : recording
          ? "No steps recorded yet — interact with the app to produce some."
          : "Record at least one step before saving.";
  // An existing test keeps the suite it is already filed under; a new one takes
  // the suite whose "+ Test case" button opened the recorder. Editing must never
  // silently re-file a test, hence the initialTest value winning.
  const save = () => {
    if (!canSave) return;
    // Whatever is still in the box counts. Saving with a typed-but-uncommitted
    // tag silently dropped is the kind of loss you only notice much later.
    const finalTags = [...tags];
    parseTags(tagDraftRef.current).forEach((tag) => {
      if (!finalTags.includes(tag)) finalTags.push(tag);
    });
    onSave({
      id: initialTest?.id || `rec-${Date.now()}`,
      name: name.trim(),
      tags: finalTags,
      steps,
      // On mobile the start "URL" is the app package — the same field, because a
      // mobile screen's address is its foreground app.
      startUrl: mobile ? mobileApp || startUrl : startUrl,
      // Which engine recorded this. Kept because a native recording cannot be
      // exported as Playwright and cannot be replayed in an iframe, so the export
      // and the replay button both need to know without guessing from the steps.
      // Existing tests carry nothing here and are treated as web, which is what
      // they are.
      ...(mobile ? { engine: "mobile", platform: "Android" } : {}),
      suiteId: (initialTest ? initialTest.suiteId : suiteId) || null,
    });
  };

  return (
    <div
      style={
        headlessChrome
          ? REC.headlessBackdrop
          : maximised
            ? { ...REC.backdrop, padding: 0 } // no inset gutter when maximised
            : REC.backdrop
      }
      onClick={headlessChrome ? undefined : onClose}
    >
      <div
        style={
          headlessChrome
            ? REC.headlessPanel
            : maximised
              ? { ...REC.modal, ...REC.modalMax }
              : REC.modal
        }
        onClick={(e) => e.stopPropagation()}
      >
        <div style={REC.head}>
          <span style={{ ...REC.recDot, animation: recording ? "recpulse 1.4s ease-in-out infinite" : "none", background: recording ? "#ef4444" : "var(--tr-muted)" }} />
          {/* Where this test will be filed. Shown because the recorder is the
              one place the choice becomes permanent, and a test saved into the
              wrong suite is tedious to notice from the tree afterwards. */}
          {suitePath && (
            <span style={S.crumbChip} title={`This test case belongs to ${suitePath}`}>
              <LayersIcon size={11} />
              {suitePath}
            </span>
          )}
          <input
            autoFocus={mode === "record"}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name your test — e.g. Book whitening in London"
            style={REC.nameInput}
          />
          {/* Engine switch.  is instant but confined to this origin;
              the real browser can reach any URL at the cost of a server. */}
          <div style={REC.pace} title={engineHint}>
            {[
              { v: "iframe", label: "", blocked: null },
              {
                v: "remote",
                label: "Real browser",
                // Each engine is unavailable for its own reason, so the button
                // carries that reason rather than a shared "unavailable". The
                // plan is asked first: "not in your plan" is a truer answer
                // than "Playwright is not installed" for someone who could not
                // use it either way.
                blocked:
                  refusal("browsers") || (caps && !caps.available ? caps.reason : null),
              },
              {
                v: "mobile",
                label: "📱 Mobile app",
                blocked:
                  refusal("android") ||
                  (mobileCaps && !mobileCaps.available ? mobileCaps.reason : null),
              },
            ].map((o) => {
              const off = playing || recording || !!o.blocked;
              return (
                <button
                  key={o.v}
                  disabled={off}
                  onClick={() => setEngine(o.v)}
                  title={o.blocked || engineHint}
                  style={{
                    ...REC.paceBtn,
                    ...(engine === o.v ? REC.paceBtnActive : {}),
                    opacity: off ? 0.45 : 1,
                  }}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
          {/* Which device, and which app on it. Mobile only — the browser
              engines have no hardware to choose between. */}
          {mobile && (
            <div style={REC.pace} title={mobileHint}>
              {mobileDevices.length === 0 ? (
                <span style={{ fontSize: 11, color: "var(--tr-muted)", padding: "0 6px" }}>
                  no device attached
                </span>
              ) : (
                mobileDevices.map((d) => (
                  <button
                    key={d.udid}
                    disabled={playing || recording}
                    onClick={() => setMobileUdid(d.udid)}
                    title={`${d.model || d.udid} (${d.udid})`}
                    style={{
                      ...REC.paceBtn,
                      ...(mobileUdid === d.udid ? REC.paceBtnActive : {}),
                      opacity: playing || recording ? 0.45 : 1,
                    }}
                  >
                    📱 {d.model || d.udid}
                  </button>
                ))
              )}
              {/* The app under test. A package name is long and easy to mistype,
                  so it is chosen from what is actually installed. */}
              <select
                value={mobileApp}
                disabled={playing || recording || !mobileDevices.length}
                onChange={(e) => setMobileApp(e.target.value)}
                title="Which app to record against. Read from the device with adb."
                style={{
                  ...REC.paceBtn,
                  maxWidth: 210,
                  opacity: playing || recording ? 0.45 : 1,
                }}
              >
                <option value="">choose an app…</option>
                {mobileAppChoices.map((a) => (
                  <option key={a.name} value={a.name}>
                    {appLabel(a.name)} — {a.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {/* Which real browser. Only shown for the remote engine, because the
               one is whichever browser you are already sitting in and
              cannot be anything else. */}
          {remote && (
            <div style={REC.pace} title={browserHint}>
              {browserChoices.map((b) => {
                const Glyph = browserIconFor(b.id);
                return (
                  <button
                    key={b.id}
                    disabled={playing || recording || !b.installed}
                    onClick={() => onBrowser && onBrowser(b.id)}
                    style={{
                      ...REC.paceBtn,
                      ...S.btnIcon,
                      gap: 5,
                      ...(browser === b.id ? REC.paceBtnActive : {}),
                      opacity: playing || recording || !b.installed ? 0.45 : 1,
                    }}
                    title={
                      b.installed
                        ? `${b.name} — ${b.engine}${playing || recording ? " (finish first — switching relaunches the browser)" : ""}`
                        : b.reason
                    }
                  >
                    <Glyph size={12} /> {b.name}
                  </button>
                );
              })}
            </div>
          )}
          {/* Which device to emulate. Remote only, for the same reason as the
              browser row: the  engine is the window you are sitting in,
              and resizing it would not give touch or a mobile user agent. */}
          {remote && (
            <div style={REC.pace} title={deviceHint}>
              {deviceChoices.map((d) => {
                const downgraded = !d.engines || !d.engines.includes(browser);
                return (
                  <button
                    key={d.id}
                    disabled={playing || recording}
                    onClick={() => onDevice && onDevice(d.id)}
                    style={{
                      ...REC.paceBtn,
                      ...S.btnIcon,
                      gap: 5,
                      ...(device === d.id ? REC.paceBtnActive : {}),
                      opacity: playing || recording ? 0.45 : 1,
                    }}
                    title={
                      d.viewport
                        ? `${d.name} — ${d.viewport.width}×${d.viewport.height}` +
                          (downgraded
                            ? `\nNot emulatable on ${browserLabel(browser)}: runs at this size without touch or a mobile user agent.`
                            : "\nFull emulation: viewport, pixel ratio, user agent and touch.")
                        : d.name
                    }
                  >
                    {d.id === "desktop" ? "🖥" : d.id === "ipad" ? "📔" : "📱"} {d.name}
                    {downgraded ? " ⚠" : ""}
                  </button>
                );
              })}
            </div>
          )}
          {mode === "record" ? (
            <>
              <button
                style={{
                  ...S.btn,
                  background: assertMode ? "#a78bfa" : "var(--tr-border)",
                  color: assertMode ? "#1e1b4b" : "var(--tr-text-2)",
                  border: "1px solid #334155",
                }}
                onClick={() => setAssertMode((a) => !a)}
                title="Assert mode: click an element to check its text/value"
              >
                🎯 Assert{assertMode ? " ON" : ""}
              </button>
              <button
                style={{ ...S.btn, ...(recording ? S.btnStop : S.btnRun) }}
                onClick={() => setRecording((r) => !r)}
              >
                {recording ? "⏸ Pause" : "⏺ Record"}
              </button>
            </>
          ) : (
            <>
              <div style={REC.pace} title="Pause between steps — affects watchability only, not reliability">
                {[
                  { v: 0, label: "Fast" },
                  { v: 1, label: "Normal" },
                  { v: 2, label: "Slow" },
                ].map((o) => (
                  <button
                    key={o.v}
                    disabled={playing}
                    onClick={() => setPace(o.v)}
                    style={{ ...REC.paceBtn, ...(pace === o.v ? REC.paceBtnActive : {}) }}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <button
                style={{ ...S.btn, ...(playing ? S.btnStop : S.btnRun) }}
                onClick={play}
                disabled={playing || steps.length === 0}
              >
                {playing ? "▶ Playing…" : "▶ Play"}
              </button>
            </>
          )}
          <button style={{ ...S.btn, ...S.btnGhost }} onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Tags. Its own row rather than squeezed into the head: the head is
            already at capacity, and a tag list has no fixed width. Only while
            authoring — replay has nothing to change about them. */}
        {mode === "record" && (
          <div style={REC.tagBar}>
            <span style={REC.tagBarLabel}>TAGS</span>
            <TagEditor
              tags={tags}
              onChange={setTags}
              draftRef={tagDraftRef}
              // Already inside a bar with its own padding, so no top margin, and
              // it takes the slack so the hint sits at the far end.
              style={{ marginTop: 0, flex: "1 1 auto" }}
            />
            <span style={REC.tagHint}>
              space, comma or Enter separates · used by <code>--grep</code> in the exported spec
            </span>
          </div>
        )}

        <div style={REC.body}>
          {/* Headless: the frame stays mounted and full-size, just parked
              offscreen. Everything inside keeps a real bounding box, so the
              actionability and stability checks behave exactly as when headed. */}
          <div style={headlessChrome ? REC.frameWrapHidden : REC.frameWrap}>
            <div style={REC.hintBar}>
              {remoteErr ? (
                <span style={{ color: "var(--tr-rec)", fontWeight: 700, whiteSpace: "pre-wrap" }}>
                  ⚠ {remoteErr}
                </span>
              ) : hoverPick ? (
                // Ahead of every other hint: the frame is not behaving normally
                // right now — the next click is captured instead of performed —
                // and that has to be the thing the bar says.
                <span style={{ color: "var(--tr-pick)", fontWeight: 700 }}>
                  🖐 Hover — click the element to hover over (Esc to cancel)
                </span>
              ) : driven && remoteBusy ? (
                <span style={{ color: "var(--tr-info)", fontWeight: 700 }}>
                  {mobile
                    ? "⏳ Opening a session on the device…"
                    : "⏳ Launching a real browser on the backend…"}
                </span>
              ) : mobile && !session ? (
                <span style={{ color: "var(--tr-warn)", fontWeight: 700 }}>
                  📱 Choose an app above to start recording against it
                </span>
              ) : mobile ? (
                <span style={{ color: "var(--tr-accent)", fontWeight: 700 }}>
                  {recording && assertMode
                    ? "🎯 Assert mode — tap an element in the live view to check it"
                    : recording
                      ? `⏺ Recording on ${session.deviceName} — tap and type in the live view below`
                      : playing
                        ? `▶ Replaying on ${session.deviceName}…`
                        : `📱 ${curUrl || mobileApp} on ${session.deviceName}`}
                </span>
              ) : remote ? (
                <span style={{ color: "var(--tr-accent)", fontWeight: 700 }}>
                  {recording && assertMode
                    ? "🎯 Assert mode — click an element in the live view"
                    : recording
                      ? `⏺ Recording in ${browserLabel(browser)} — click and type in the live view below`
                      : playing
                        ? `▶ Replaying in ${browserLabel(browser)}…`
                        : `🖥 ${browserLabel(browser)} — any URL works here, cross-origin included`}
                </span>
              ) : crossOrigin ? (
                // Reached only when the hand-off could not happen — normally an
                // off-origin address switches engines before the frame is asked
                // to load it at all.
                <span style={{ color: "var(--tr-rec)", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                  ⚠ Off-origin page — the  engine cannot read this frame.
                  <button
                    type="button"
                    disabled={recording || playing || !!refusal("browsers") || (caps && !caps.available)}
                    onClick={() => setEngine("remote")}
                    title={refusal("browsers") || engineHint}
                    style={{ ...REC.paletteBtn, flex: "0 0 auto", color: "var(--tr-accent)", borderColor: "color-mix(in srgb, var(--tr-accent) 34%, transparent)" }}
                  >
                    🖥 Use a real browser
                  </button>
                </span>
              ) : recording && assertMode ? (
                <span style={{ color: "var(--tr-nav)", fontWeight: 700 }}>🎯 Assert mode — click an element to check its text/value</span>
              ) : recording ? (
                <span style={{ color: "var(--tr-rec)", fontWeight: 700 }}>⏺ Recording — interact with the page below</span>
              ) : hold ? (
                <span style={{ color: "var(--tr-warn)", fontWeight: 700 }}>
                  ⏳ Holding {hold.secondsLeft}s after “{hold.why}” before the next step…
                </span>
              ) : playing ? (
                <span style={{ color: "var(--tr-info)", fontWeight: 700 }}>▶ Replaying your steps…</span>
              ) : mode === "record" && initialTest ? (
                <span>
                  Editing — reorder, delete or retype step values on the right; press{" "}
                  <b style={{ color: "var(--tr-rec)" }}>⏺ Record</b> to append new ones.
                </span>
              ) : (
                <span>Interact with the real app; your clicks &amp; typing become steps.</span>
              )}
              <span style={{ flex: 1 }} />
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  goToAddr();
                }}
                style={REC.addrBar}
                title={
                  mobile
                    ? "The app under test. A mobile screen has no URL — its address is the foreground package, e.g. com.android.settings. Press Enter or hit Go to bring it to the front."
                    : "Load any address: a route (/Customer_home), a host (google.com, localhost:5173) or a full https:// URL. Press Enter or hit Go."
                }
              >
                <span style={{ color: "var(--tr-muted)", fontSize: 11 }}>{mobile ? "📦" : "🌐"}</span>
                <input
                  value={addr}
                  onChange={(e) => setAddr(e.target.value)}
                  onFocus={() => {
                    addrFocusRef.current = true;
                  }}
                  onBlur={() => {
                    addrFocusRef.current = false;
                  }}
                  placeholder={
                    mobile ? "com.android.settings" : "/Customer_home  or  https://example.com"
                  }
                  spellCheck={false}
                  disabled={playing}
                  style={{ ...REC.addrInput, opacity: playing ? 0.5 : 1 }}
                />
                <button
                  type="submit"
                  disabled={playing}
                  style={{ ...REC.addrGo, opacity: playing ? 0.5 : 1, cursor: playing ? "not-allowed" : "pointer" }}
                >
                  Go
                </button>
              </form>
            </div>
            {/* The iframe stays mounted in remote mode — hidden, not unmounted —
                so switching engines back does not reload the app from scratch. */}
            {/* src is omitted rather than set to "" when there is no address:
                an empty src makes the browser load the current document into
                the frame, which would show the recorder inside itself. */}
            <iframe
              ref={iframeRef}
              {...(startUrl ? { src: startUrl } : {})}
              title="app under test"
              style={driven ? { ...REC.iframe, display: "none" } : REC.iframe}
            />
            {!driven && !startUrl && (
              <div style={REC.blankStart}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
                  Choose a page to record against
                </div>
                <div style={{ fontSize: 13, opacity: 0.75, maxWidth: 420, lineHeight: 1.6 }}>
                  Type an address above and press <b>Go</b>. Whichever page you
                  open first becomes this test’s starting point.
                </div>
              </div>
            )}
            {driven && session && (
              <RemotePane
                session={session}
                paused={headlessChrome}
                interactive={!playing}
                onError={setRemoteErr}
                onPick={hoverPick ? pickHoverTarget : null}
                // A device reports its own screen size; the browser engine's is
                // fixed. Getting this wrong sends every tap to the wrong place.
                viewport={mobile ? session.viewport : undefined}
                keyInput={mobile ? mobileKeyInputFor : keyInputFor}
                waitingLabel={
                  mobile
                    ? "waiting for the first frame from the device…"
                    : "waiting for the first frame from the real browser…"
                }
              />
            )}
          </div>

          <div style={REC.side}>
            <div style={REC.sideHead}>
              {/* Steps or the code they generate. A toggle rather than a second
                  panel: both answer "what does this test do", and showing them
                  side by side in 330px would make neither readable. */}
              <span style={REC.viewTabs}>
                <button
                  style={{ ...REC.viewTab, ...(sideView === "steps" ? REC.viewTabOn : {}) }}
                  onClick={() => setSideView("steps")}
                  aria-pressed={sideView === "steps"}
                >
                  {mode === "record" ? "⏺ RECORDED" : "▶ STEPS"}
                </button>
                <button
                  style={{ ...REC.viewTab, ...(sideView === "code" ? REC.viewTabOn : {}) }}
                  onClick={() => setSideView("code")}
                  aria-pressed={sideView === "code"}
                  title="The test these steps generate, as a Page Object Model — rewritten as you record"
                >
                  {"</> CODE"}
                </button>
              </span>
              {/* Which data set these steps resolve against, named here because
                  the same recording behaves differently under a different set
                  and there is otherwise nothing on screen that says which one is
                  live. Silent when no step refers to any data. */}
              {dataAudit.referenced.length > 0 && (
                <span style={{ color: "var(--tr-muted)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <DatabaseIcon size={10} /> {dataSet ? dataSet.name : "no data set"}
                  {/* How many times ▶ Play will walk this list. Said before the
                      run rather than discovered halfway through it, because
                      pressing play on a twelve-row table is a materially
                      different act from pressing it on a single-pass test. */}
                  {rowCount > 1 && (
                    <span style={S.iterPill} title={`This set has ${rowCount} enabled rows — the test runs once per row`}>
                      ×{rowCount}
                    </span>
                  )}
                </span>
              )}
              {/* Which row is on screen, while a table is running. The steps
                  list below resets to grey at the start of every iteration, so
                  without this the run looks like it keeps starting over. */}
              {iterNow && (
                <span style={{ ...S.iterPill, borderColor: "var(--tr-accent)", color: "var(--tr-accent)" }}>
                  row {iterNow.index + 1}/{iterNow.total} · {iterNow.label}
                </span>
              )}
              <span style={{ color: "var(--tr-muted)" }}>{steps.length} step{steps.length === 1 ? "" : "s"}</span>
            </div>
            {/* Said before the run, not discovered during it. An unresolved
                reference is typed into the field verbatim, so the failure it
                causes is the app rejecting "{{email}}" as an address — which
                reads as a bug in the app rather than a gap in the data. */}
            {dataAudit.missing.length > 0 && (
              <div style={S.dataWarn}>
                <DatabaseIcon size={12} />
                <span>
                  {dataAudit.missing.map((k) => `{{${k}}}`).join(", ")} has no value in{" "}
                  {dataSet ? `"${dataSet.name}"` : "any data set"} — steps using it will type the
                  reference itself.
                </span>
              </div>
            )}
            {/* The generated test, rebuilt on every change to the steps. Shown
                in place of the step list rather than beside it: the panel is
                330px wide, and code squeezed into half of that is code nobody
                reads. */}
            {sideView === "code" ? (
              <div style={REC.codePane}>
                {!generated ? (
                  <div style={REC.emptyHint}>
                    Record a step and the test appears here, rewritten as you go.
                  </div>
                ) : (
                  <>
                    <div style={REC.codeBar}>
                      <span>{mobile ? "WebdriverIO · screen objects" : "Playwright · page objects"}</span>
                      <span style={{ flex: 1 }} />
                      <CopyButton text={generated} title="Copy this test" />
                    </div>
                    {/* Not editable. What is authoritative is the recording —
                        edit the code and the next step recorded would overwrite
                        it, which is a worse surprise than not offering it. */}
                    <pre style={REC.codeBody}>{generated}</pre>
                  </>
                )}
              </div>
            ) : (
            <div style={REC.stepsList}>
              {steps.length === 0 ? (
                <div style={REC.emptyHint}>
                  {mode === "record"
                    ? "Click and type in the page — steps appear here."
                    : "This test has no steps."}
                </div>
              ) : (
                steps.map((st, i) => {
                  const stt = status[i];
                  const field = editField(st);
                  const editing = editIdx === i;
                  return (
                    <div key={i}>
                      <div
                        style={{
                          ...REC.recStep,
                          background: editing
                            ? "rgba(56,189,248,0.1)"
                            : stt === "running"
                              ? "rgba(56,189,248,0.08)"
                              : "transparent",
                        }}
                      >
                        {mode === "replay" ? (
                          <StatusIcon status={stt || "idle"} />
                        ) : (
                          <span style={REC.recNum}>{String(i + 1).padStart(2, "0")}</span>
                        )}
                        <span style={{ ...REC.recTag, color: ACTION_COLORS[stepVerb[st.action]] || "var(--tr-soft)" }}>
                          {stepVerb[st.action] || st.action}
                        </span>
                        <span
                          onClick={() => setEditIdx(editing ? null : i)}
                          title="Click to edit this step"
                          style={{
                            color: "var(--tr-text)",
                            fontSize: 12.5,
                            minWidth: 0,
                            flex: 1,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            cursor: "text",
                            textDecoration: "underline dotted #334155",
                          }}
                        >
                          {describeStep(st)}
                        </span>
                        {mode === "record" && (
                          <span style={REC.stepTools}>
                            <button
                              style={{ ...REC.toolBtn, opacity: i === 0 ? 0.3 : 1 }}
                              disabled={i === 0}
                              onClick={() => moveStep(i, -1)}
                              title="Move up"
                            >
                              ▲
                            </button>
                            <button
                              style={{ ...REC.toolBtn, opacity: i === steps.length - 1 ? 0.3 : 1 }}
                              disabled={i === steps.length - 1}
                              onClick={() => moveStep(i, 1)}
                              title="Move down"
                            >
                              ▼
                            </button>
                            <button
                              style={{ ...REC.toolBtn, color: "var(--tr-rec)" }}
                              onClick={() => removeStep(i)}
                              title="Delete this step"
                            >
                              ✕
                            </button>
                          </span>
                        )}
                      </div>
                      {editing && (
                        <div style={REC.stepEdit}>
                          {/* A REST step carries a method, a header block, a
                              body, its checks and its extractions — more than
                              the single-field editor below can express, so it
                              brings its own panel rather than bending that one. */}
                          {st.action === "api" && (
                            <ApiStepEditor
                              step={st}
                              onChange={(next) => patchStep(i, next)}
                              lastRun={status[`a${i}`] || null}
                            />
                          )}
                          {field && (
                            <>
                              <input
                                autoFocus
                                type={isNumericField(field) ? "number" : "text"}
                                value={st[field] ?? ""}
                                onChange={(e) =>
                                  patchStep(i, {
                                    [field]: isNumericField(field)
                                      ? Number(e.target.value) || 0
                                      : e.target.value,
                                  })
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === "Escape") setEditIdx(null);
                                }}
                                style={REC.editInput}
                              />
                              <div style={REC.editHint}>
                                {field === "expected"
                                  ? "text this step asserts"
                                  : field === "ms"
                                    ? "milliseconds"
                                    : field === "amount"
                                      ? "pixels"
                                      : "value this step enters"}
                              </div>
                              {/* Test data. A literal can be lifted out into a
                                  named value; a reference shows what it will
                                  actually resolve to, because "{{email}}" on its
                                  own tells you nothing about whether the set
                                  still has an email in it. */}
                              {!isNumericField(field) && (
                                <DataFieldTools
                                  text={st[field]}
                                  dataSet={dataSet}
                                  onExtract={() => extractVar(i, field)}
                                  onInsert={(ref) =>
                                    patchStep(i, { [field]: `${st[field] ?? ""}${ref}` })
                                  }
                                />
                              )}
                            </>
                          )}

                          {/* Every step carries the URL it was recorded on;
                              playback goes there first. Editable as a path or a
                              full http(s) address.

                              Not for a REST step: its URL is the request target
                              rather than a page to be on first, and its own
                              panel already owns that field. Two inputs writing
                              one property would fight over it. */}
                          {st.action !== "api" && (
                          <input
                            autoFocus={!field}
                            value={st.action === "navigate" ? st.url ?? "" : st.url ?? ""}
                            placeholder="/DoctorList  or  https://host/path"
                            onChange={(e) => {
                              const raw = e.target.value;
                              // Same-origin absolute → store the path, so the
                              // step keeps matching client-side navigation.
                              let url = raw;
                              try {
                                if (isAbsolute(raw)) {
                                  const u = new URL(raw);
                                  if (u.origin === window.location.origin)
                                    url = u.pathname + u.search;
                                }
                              } catch {
                                /* half-typed URL — keep the raw text */
                              }
                              patchStep(i, st.action === "navigate" ? { url, label: url } : { url });
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === "Escape") setEditIdx(null);
                            }}
                            style={{ ...REC.editInput, marginTop: field ? 6 : 0 }}
                          />
                          )}
                          {st.action !== "api" && (
                          <div style={REC.editHint}>
                            url this step runs on · Enter to close
                          </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            )}
            {mode === "record" && (
              <div style={{ display: "flex", gap: 8, padding: 10, borderTop: "1px solid #1e293b" }}>
                <button onClick={undo} disabled={steps.length === 0} style={{ ...S.btn, ...S.btnGhost, flex: 1 }}>
                  ↶ Undo
                </button>
                <button onClick={clearAll} disabled={steps.length === 0} style={{ ...S.btn, ...S.btnGhost, flex: 1 }}>
                  ↺ Clear
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Docked step palette — always available while editing, so you can drop
            waits and scrolls in without re-recording the flow. */}
        {mode === "record" && (
          <div
            ref={paletteRef}
            style={{
              ...REC.palette,
              // A dragged palette is positioned from the top-left; the default
              // stays anchored to the corner in right/bottom, so it survives a
              // window resize without any of this being involved.
              ...(palettePos
                ? { left: palettePos.x, top: palettePos.y, right: "auto", bottom: "auto" }
                : null),
            }}
          >
            {/* Brand mark — the palette floats free of the top bar, so it
                carries its own logo to stay recognisable.

                It is also the drag handle. The header rather than the whole
                panel, because every other part of this thing is a control: a
                panel you could drag by its body would insert a scroll step
                whenever a drag started a pixel off.

                The name is fixed here rather than read from useBranding, by
                request: this one label says "Test Architect" whatever the app
                has been renamed to. Every other header still follows the
                branding setting, so the two can disagree — which is the whole
                point of pinning it, and the thing to remember if this palette
                ever needs to track a rename again. */}
            <div
              style={{
                ...REC.paletteBrand,
                cursor: paletteGrab.current ? "grabbing" : "grab",
                // Without this the browser claims the gesture for panning and
                // the drag never reaches these handlers on a touch screen.
                touchAction: "none",
                userSelect: "none",
              }}
              onPointerDown={startPaletteDrag}
              onPointerMove={movePalette}
              onPointerUp={endPaletteDrag}
              onPointerCancel={endPaletteDrag}
              onDoubleClick={resetPalettePos}
              title={
                palettePos
                  ? "Drag to move this panel · double-click to send it back to the corner"
                  : "Drag to move this panel"
              }
            >
              <TestExpressMark size={18} />
              <span style={REC.paletteBrandText}>TEST ARCHITECT</span>
              {/* Says the header is a handle without spending a word on it. */}
              <span style={REC.paletteGrip}>
                <GripIcon size={12} />
              </span>
            </div>
            <div style={REC.paletteHead}>
              <span>INSERT STEP</span>
              <span style={{ color: "var(--tr-info)", fontWeight: 600 }}>
                {editIdx !== null ? `after #${String(editIdx + 1).padStart(2, "0")}` : "at end"}
              </span>
            </div>
            <div style={REC.paletteRow}>
              <button
                style={{ ...REC.paletteBtn, color: "var(--tr-warn)", borderColor: "color-mix(in srgb, var(--tr-warn) 34%, transparent)" }}
                onClick={() => insertStep({ action: "wait", ms: waitMs })}
                title="Pause for a fixed time, unconditionally"
              >
                ⏸ Explicit wait
              </button>
              <button
                style={{ ...REC.paletteBtn, color: "var(--tr-nav)", borderColor: "color-mix(in srgb, var(--tr-nav) 34%, transparent)" }}
                onClick={() => insertStep({ action: "implicitWait", ms: waitMs })}
                title="Change how long every later step waits for its element"
              >
                ⏳ Implicit wait
              </button>
            </div>
            <div style={REC.paletteRow}>
              {/* A REST call alongside the UI steps rather than in a suite of
                  its own: the reason to want one here is almost always to set
                  up or verify something the clicks cannot reach — sign in, seed
                  a record, assert the row really landed. Inserted with a status
                  check already on it, because a call nobody asserts on is not
                  yet a test. */}
              <button
                style={{
                  ...REC.paletteBtn,
                  color: "var(--tr-ok)",
                  borderColor: "color-mix(in srgb, var(--tr-ok) 34%, transparent)",
                  opacity: refusal("apitesting") ? 0.4 : 1,
                }}
                disabled={!!refusal("apitesting")}
                onClick={() =>
                  insertStep(
                    normalizeApi({
                      method: "GET",
                      url: "/api/",
                      headersText: "Accept: application/json",
                      asserts: [{ type: "status", op: "eq", expected: 200 }],
                    }),
                  )
                }
                title={refusal("apitesting") || "Send a REST call and assert on its response"}
              >
                ⇄ API request
              </button>
            </div>
            <div style={REC.paletteRow}>
              <button
                style={{ ...REC.paletteBtn, color: "var(--tr-move)", borderColor: "color-mix(in srgb, var(--tr-move) 34%, transparent)" }}
                onClick={() => insertStep({ action: "scroll", direction: "up", amount: scrollPx })}
              >
                ↑ Scroll up
              </button>
              <button
                style={{ ...REC.paletteBtn, color: "var(--tr-move)", borderColor: "color-mix(in srgb, var(--tr-move) 34%, transparent)" }}
                onClick={() => insertStep({ action: "scroll", direction: "down", amount: scrollPx })}
              >
                ↓ Scroll down
              </button>
            </div>
            <div style={REC.paletteRow}>
              <button
                style={{ ...REC.paletteBtn, color: "var(--tr-nav)", borderColor: "color-mix(in srgb, var(--tr-nav) 34%, transparent)" }}
                onClick={() => insertStep({ action: "reload" })}
                title="Reload the current page — proves what was just saved really persisted, rather than only living in React state"
              >
                ⟳ Refresh
              </button>
              <button
                style={{
                  ...REC.paletteBtn,
                  color: hoverPick ? "#1f0a17" : "var(--tr-pick)",
                  background: hoverPick ? "#f9a8d4" : REC.paletteBtn.background,
                  borderColor: "color-mix(in srgb, var(--tr-pick) 34%, transparent)",
                }}
                onClick={() => setHoverPick((p) => !p)}
                title={
                  hoverPick
                    ? "Click the element to hover over — or press this again to cancel"
                    : "Mouse hover: click this, then click the element in the page that has to be hovered (a menu that reveals a submenu, a row that reveals its buttons)"
                }
              >
                {hoverPick ? "◎ Pick target…" : "🖐 Mouse hover"}
              </button>
            </div>
            <div style={REC.paletteRow}>
              <label style={REC.paletteLabel}>
                wait
                <input
                  type="number"
                  min={0}
                  step={500}
                  value={waitMs}
                  onChange={(e) => setWaitMs(Number(e.target.value) || 0)}
                  style={REC.paletteInput}
                />
                ms
              </label>
              <label style={REC.paletteLabel}>
                scroll
                <input
                  type="number"
                  min={50}
                  step={100}
                  value={scrollPx}
                  onChange={(e) => setScrollPx(Number(e.target.value) || 0)}
                  style={REC.paletteInput}
                />
                px
              </label>
            </div>
          </div>
        )}

        <div style={REC.foot}>
          {/* What stands between here and a saved test takes precedence over any
              tip — it is the thing the user is stuck on. */}
          {mode === "record" && saveBlockedReason ? (
            <span style={{ fontSize: 12, color: "var(--tr-warn)", fontWeight: 700 }}>
              ⚠ {saveBlockedReason}
            </span>
          ) : (
            <span style={{ fontSize: 12, color: "var(--tr-dim)" }}>
              {mode === "record"
                ? mobile
                  ? "Tip: tap and type in the live view above — the device's own window is not recorded."
                  : "Tip: if you see the login page, sign in inside the frame first."
                : "Playback drives the real page in the frame above."}
            </span>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ ...S.btn, ...S.btnGhost }} onClick={onClose}>
              Close
            </button>
            {mode === "record" && (
              <button
                style={{ ...S.btn, ...S.btnRun, opacity: canSave ? 1 : 0.4 }}
                disabled={!canSave}
                onClick={save}
                title={saveBlockedReason || (initialTest ? "Save your changes" : "Save this test")}
              >
                {initialTest ? "✓ Save changes" : "✓ Save test"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- action → color used for the step's action tag ----------------------
const ACTION_COLORS = {
  goto: "#a78bfa",
  fill: "#38bdf8",
  select: "#38bdf8",
  click: "#f472b6",
  check: "#f472b6",
  upload: "#fbbf24",
  expect: "#22c55e",
  wait: "#fbbf24",
  timeout: "#a78bfa",
  scroll: "#22d3ee",
  reload: "#a78bfa",
  // A shade off click's pink: hovering is the same pointer aimed at the same
  // kind of target, so it should read as a relative of click, not a new family.
  hover: "#f9a8d4",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default function TestRunner() {
  // Who is recording. Tolerates being mounted outside the provider — the same
  // allowance UserMenu makes — in which case tests are simply saved unowned.
  const user = (useAuth() || {}).user || null;
  const branding = useBranding();
  const [recorded, setRecorded] = useState(loadRecorded);
  const [projects, setProjects] = useState(loadProjects);
  // Faces for the owner stamps. Re-read on the storage event, which is how the
  // registration screen announces a change — so a photo added there appears
  // here without a reload.
  const [ownerDir, setOwnerDir] = useState(loadOwnerDirectory);
  const [collapsed, setCollapsed] = useState(() => new Set()); // ids of folded projects/suites
  const [pages, setPages] = useState({}); // container id -> page of test cases on show
  const [drag, setDrag] = useState(null); // the row currently in flight
  const [dropAt, setDropAt] = useState(null); // { id, pos: before|after|into }
  const [recorder, setRecorder] = useState(null); // { mode, test, suiteId } | null
  // The "web or mobile?" step that precedes a new recording. Held separately
  // from `recorder` because until it is answered there is nothing to record
  // against — a mobile test needs a device and an installed app first.
  const [newTest, setNewTest] = useState(null); // { suiteId } | null
  const [selectedId, setSelectedId] = useState(() => loadRecorded()[0]?.id || null);
  const [runs, setRuns] = useState(loadRuns); // testId -> playback reports, newest first
  const [runIdx, setRunIdx] = useState(0); // which run of the selected test is on show
  const [notice, setNotice] = useState(null); // storage / import-export feedback
  const [schedules, setSchedules] = useState(loadSchedules);
  const [headless, setHeadless] = useState(loadHeadless);
  const [selfHeal, setSelfHeal] = useState(loadSelfHeal);
  const [parallel, setParallel] = useState(loadParallel); // generated pipelines only
  const [browser, setBrowser] = useState(loadBrowser); // real-browser engine only
  const [device, setDevice] = useState(loadDevice); // real-browser engine only
  const [queue, setQueue] = useState([]); // test ids waiting to run in a suite pass
  // `themeChoice` is what the settings control shows selected -- possibly
  // "auto" -- and `theme` is what the runner paints.
  const { choice: themeChoice, theme, setTheme: applyTheme } = useAppTheme();
  const [railOpen, setRailOpen] = useState(loadRailOpen); // projects rail expanded?

  const [testData, setTestData] = useState(loadTestData);
  const [dataOpen, setDataOpen] = useState(false); // the test data editor
  const [cicdOpen, setCicdOpen] = useState(false); // the CI pipeline generator
  const [reportsOpen, setReportsOpen] = useState(false); // run history across every test

  // How many tests are red as of their last run. On the Reports button itself,
  // because a badge you have to open a modal to see is a badge that tells you
  // nothing — the point is noticing without looking.
  const failingCount = useMemo(
    () => recorded.filter((t) => lastRun(runs[t.id] || [])?.status === "failed").length,
    [recorded, runs],
  );
  // What the signed-in account's plan does not include. Held here and passed
  // down rather than each control importing the check for itself: the plan is
  // one fact about one session, and a control that asked its own question
  // could be told something different from the control beside it.
  const refusal = useCallback((capability) => refusalFor(user, capability), [user]);

  // index.js fetches the catalogue once, at the very first load of the whole
  // app -- a tab left open across a plan edit in Super Admin goes on reading
  // whatever it fetched then. Re-fetching on mount here means opening (or
  // returning to) the recorder is enough to pick up a capability an
  // administrator just added, without asking anyone to reload the page.
  const [, forceRefusalRecompute] = useState(0);
  useEffect(() => {
    let alive = true;
    refreshPlans().then(() => {
      if (alive) forceRefusalRecompute((n) => n + 1);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Whether this account is an organisation rather than a person. Drawn from
  // the plan's own kind rather than from a capability: "can hold seats" and
  // "is a company" are different facts, and only one of them belongs in a
  // header.
  const corporate = planKind(planOfUser(user)) === "corporate" && can(user, "team");
  const [teamOpen, setTeamOpen] = useState(false);

  const [, setTick] = useState(0); // bumped on a timer purely to refresh countdowns
  const importRef = useRef(null);

  const saveSchedules = (next) => {
    persistSchedules(next);
    setSchedules(next);
  };

  // Preferences are settable from two places now — the top-bar toggles and the
  // settings modal — so persisting them lives here rather than in either
  // caller. One route in means the two can never disagree about what was saved.
  const applyRailOpen = (next) => {
    persistRailOpen(next);
    setRailOpen(next);
  };
  const applyHeadless = (next) => {
    persistHeadless(next);
    setHeadless(next);
  };
  const applySelfHeal = (next) => {
    persistSelfHeal(next);
    setSelfHeal(next);
  };
  const applyParallel = (next) => {
    persistParallel(next);
    setParallel(next);
  };
  const applyBrowser = (next) => {
    persistBrowser(next);
    setBrowser(next);
  };
  const applyDevice = (next) => {
    persistDevice(next);
    setDevice(next);
  };

  // ---- test data ---------------------------------------------------------
  // One route in, like saveProjects: the editor, the per-test picker and the
  // recorder's "use test data" button all change the same store, and a second
  // write path is how two of them end up disagreeing about what was saved.
  const saveTestData = (next) => {
    setNotice(persistTestData(next));
    setTestData(next);
  };

  // The set the selected test will actually resolve against — its pinned one, or
  // the live one.
  const dataSetFor = (test) => setFor(testData, test || {});

  // Define (or overwrite) a value in the set a test runs against, and answer with
  // the key it ended up under. Called from the recorder when a literal is lifted
  // out of a step, which is why it has to cope with there being no set at all
  // yet: the first value anyone names is also the moment the first set is needed,
  // and making them stop to create one first would be a pointless detour.
  const defineVar = (rawKey, value) => {
    const key = normKey(rawKey);
    if (!key) return null;
    const sets = testData.sets.length
      ? testData.sets
      : [{ id: `ds-${Date.now()}`, name: "Default", vars: [] }];
    const targetId = setFor({ ...testData, sets }, {})?.id || sets[0].id;
    const next = {
      sets: sets.map((s) => {
        if (s.id !== targetId) return s;
        const vars = varsOf(s);
        const at = vars.findIndex((v) => v.key === key);
        // Reusing a name is how two steps come to share one value, so an
        // existing key is updated rather than duplicated — and its secret flag
        // survives, because re-recording a password field must not unmask it.
        const row = { key, value: String(value == null ? "" : value) };
        return {
          ...s,
          vars: at >= 0 ? vars.map((v, i) => (i === at ? { ...v, ...row } : v)) : [...vars, row],
        };
      }),
      activeId: testData.activeId || targetId,
    };
    saveTestData(next);
    return key;
  };

  // Which set a test pins, or null for "whatever is live".
  const pinDataSet = (testId, setId) => {
    const next = recorded.map((t) => (t.id === testId ? { ...t, dataSetId: setId || null } : t));
    setNotice(persistRecorded(next));
    setRecorded(next);
  };

  const setSchedule = (testId, presetId) => {
    const preset = SCHEDULE_PRESETS.find((p) => p.id === presetId);
    if (!preset || preset.id === "off") {
      const { [testId]: _off, ...rest } = schedules;
      saveSchedules(rest);
      return;
    }
    const sched = {
      mode: preset.mode,
      minutes: preset.minutes,
      time: schedules[testId]?.time || preset.time,
      enabled: true,
    };
    saveSchedules({ ...schedules, [testId]: { ...sched, nextRunAt: computeNextRun(sched) } });
  };

  const setScheduleTime = (testId, time) => {
    const sched = { ...(schedules[testId] || {}), mode: "daily", time, enabled: true };
    saveSchedules({ ...schedules, [testId]: { ...sched, nextRunAt: computeNextRun(sched) } });
  };

  // Drive the countdown text once a minute without touching stored state.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // Pick up a profile picture edited in another tab. Cheap — it only re-reads a
  // list this browser already holds, and only when something wrote to storage.
  useEffect(() => {
    const reload = () => setOwnerDir(loadOwnerDirectory());
    window.addEventListener("storage", reload);
    return () => window.removeEventListener("storage", reload);
  }, []);

  /**
   * The directory record for a test's owner, for drawing their face.
   *
   * Falls back to a stand-in carrying only the name, which is all AvatarFace
   * needs to draw initials — so an owner this browser has never heard of still
   * gets a monogram rather than a blank circle.
   */
  const ownerUser = (owner) =>
    (owner && owner.email && ownerDir.get(String(owner.email).trim().toLowerCase())) || {
      name: (owner && owner.name) || "",
    };

  // Looking at a different test means looking at its latest run, not at
  // whatever position in history the previous test happened to be showing.
  useEffect(() => setRunIdx(0), [selectedId]);

  // ---- the Project › Suite › Test case tree ------------------------------
  const saveProjects = (next) => {
    setNotice(persistProjects(next));
    setProjects(next);
  };

  const toggleFold = (id) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Where every suite sits, by suite id. Also the membership test used
  // everywhere else: a suiteId this map doesn't know is a dangling reference,
  // and its test is treated as unfiled.
  const suiteIndex = useMemo(() => {
    const map = new Map();
    projects.forEach((p) => p.suites.forEach((s) => map.set(s.id, { project: p, suite: s })));
    return map;
  }, [projects]);

  const suitePathOf = (suiteId) => {
    const at = suiteIndex.get(suiteId);
    return at ? `${at.project.name} › ${at.suite.name}` : null;
  };

  const testsInSuite = (suiteId) => recorded.filter((t) => t.suiteId === suiteId);
  const testsInProject = (p) => p.suites.flatMap((s) => testsInSuite(s.id));
  const isUnfiled = (t) => !t.suiteId || !suiteIndex.has(t.suiteId);
  const unfiled = recorded.filter(isUnfiled);

  // ---- paging the test cases inside a container --------------------------
  // Which page each suite (and Unfiled) is showing. Absent means the first
  // page, which is the overwhelmingly common case — so a fresh session stores
  // nothing, and this is deliberately not persisted: it is where you happen to
  // be looking right now, not a setting.
  const pageCount = (n) => Math.max(1, Math.ceil(n / TESTS_PER_PAGE));
  // Clamped on read rather than corrected on write. Deleting the last test on
  // the last page, or dragging one to another suite, changes the count without
  // going anywhere near this state — correcting it at every such site is how
  // you end up with a container stuck on an empty page.
  const pageOf = (id, total) => Math.min(pages[id] || 0, pageCount(total) - 1);
  const setPage = (id, n) => setPages((prev) => ({ ...prev, [id]: Math.max(0, n) }));

  // Turn to the page a given test is on. A recording that has just been saved
  // or moved must not land silently on a page nobody is looking at — from the
  // rail that is indistinguishable from it having been lost.
  const revealTest = (list, test) => {
    const containerId = isUnfiled(test) ? UNFILED_ID : test.suiteId;
    const siblings = list.filter((t) =>
      containerId === UNFILED_ID ? isUnfiled(t) : t.suiteId === containerId,
    );
    const idx = siblings.findIndex((t) => t.id === test.id);
    if (idx >= 0) setPage(containerId, Math.floor(idx / TESTS_PER_PAGE));
  };

  const addProject = () => {
    const name = (window.prompt("Name the new project — e.g. Patient Portal") || "").trim();
    if (!name) return;
    const project = { id: `proj-${Date.now()}`, name, suites: [] };
    saveProjects([...projects, project]);
  };

  const renameProject = (project) => {
    const name = (window.prompt("Rename project", project.name) || "").trim();
    if (!name || name === project.name) return;
    saveProjects(projects.map((p) => (p.id === project.id ? { ...p, name } : p)));
  };

  // Deleting a suite never deletes recordings — they are the expensive thing
  // here, and a suite is cheap to recreate. The tests fall back to Unfiled,
  // where they can be filed somewhere else. Deleting a *project* is the
  // deliberate exception: it takes its tests down with it.
  const unfileTests = (suiteIds) => {
    const dropped = new Set(suiteIds);
    if (!recorded.some((t) => dropped.has(t.suiteId))) return;
    const next = recorded.map((t) => (dropped.has(t.suiteId) ? { ...t, suiteId: null } : t));
    persistRecorded(next);
    setRecorded(next);
  };

  // Deletes the whole subtree: the project, its suites, and every test case
  // filed under them along with that test's run history and screenshots.
  // None of it is recoverable, so the confirm spells out the test count.
  const deleteProject = (project) => {
    const doomed = testsInProject(project);
    const warning = doomed.length
      ? `\n\nIts ${doomed.length} test case${doomed.length === 1 ? "" : "s"} will be deleted too, ` +
        `along with their run history. This cannot be undone.`
      : "";
    if (!window.confirm(`Delete project "${project.name}" and its ${project.suites.length} suite(s)?${warning}`))
      return;
    deleteRecordedTests(doomed.map((t) => t.id));
    saveProjects(projects.filter((p) => p.id !== project.id));
  };

  const addSuite = (project) => {
    const name = (window.prompt(`Name the new suite in "${project.name}" — e.g. Booking`) || "").trim();
    if (!name) return;
    const suite = { id: `suite-${Date.now()}`, name };
    saveProjects(projects.map((p) => (p.id === project.id ? { ...p, suites: [...p.suites, suite] } : p)));
    // A suite you just made is a suite you want to see into.
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.delete(project.id);
      return next;
    });
  };

  const renameSuite = (project, suite) => {
    const name = (window.prompt("Rename suite", suite.name) || "").trim();
    if (!name || name === suite.name) return;
    saveProjects(
      projects.map((p) =>
        p.id === project.id
          ? { ...p, suites: p.suites.map((s) => (s.id === suite.id ? { ...s, name } : s)) }
          : p,
      ),
    );
  };

  const deleteSuite = (project, suite) => {
    const count = testsInSuite(suite.id).length;
    const warning = count
      ? `\n\nIts ${count} test case${count === 1 ? "" : "s"} will be kept and moved to Unfiled.`
      : "";
    if (!window.confirm(`Delete suite "${suite.name}"?${warning}`)) return;
    unfileTests([suite.id]);
    saveProjects(
      projects.map((p) => (p.id === project.id ? { ...p, suites: p.suites.filter((s) => s.id !== suite.id) } : p)),
    );
  };

  // File (or re-file) an existing recording, landing it at the bottom of the
  // destination. This is how tests recorded before there were projects get into
  // one, and where a drop on a suite header (rather than between two rows) ends
  // up — bottom is where the eye looks for something just dropped onto a group.
  const fileTest = (testId, suiteId) => {
    const moved = recorded.find((t) => t.id === testId);
    if (!moved) return;
    const list = recorded.filter((t) => t.id !== testId);
    const inDest = (t) => (suiteId ? t.suiteId === suiteId : !t.suiteId || !suiteIndex.has(t.suiteId));
    let at = list.length;
    for (let i = list.length - 1; i >= 0; i--) {
      if (inDest(list[i])) {
        at = i + 1;
        break;
      }
    }
    const filed = { ...moved, suiteId: suiteId || null };
    list.splice(at, 0, filed);
    setNotice(persistRecorded(list));
    setRecorded(list);
    // It lands at the bottom of the destination, which on a paged suite is a
    // page you are almost certainly not on.
    revealTest(list, filed);
  };

  // Dropping a test case on a project. A project has no test cases of its own,
  // so it lands in the project's last suite — the bottom of the project, which
  // is where everything else in this tree appends to. A project with no suites
  // yet gets one, because the alternative is refusing a drop whose intent is
  // not in any doubt.
  const fileTestInProject = (testId, projectId) => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;
    if (project.suites.length) {
      fileTest(testId, project.suites[project.suites.length - 1].id);
      return;
    }
    const suite = { id: `suite-${Date.now()}`, name: "General" };
    saveProjects(projects.map((p) => (p.id === projectId ? { ...p, suites: [suite] } : p)));
    fileTest(testId, suite.id);
    // Creating a container the user did not ask for is worth one line of
    // explanation, so it does not look like the tree invented a suite by itself.
    setNotice(`Added a "General" suite to ${project.name} — a project holds suites, not test cases.`);
  };

  // Drop between two test cases: take the target's position, and its suite with
  // it. Order within a suite is just the order of `recorded`, since the tree
  // renders each suite by filtering that one list.
  const reorderTest = (testId, targetId, pos) => {
    const moved = recorded.find((t) => t.id === testId);
    const target = recorded.find((t) => t.id === targetId);
    if (!moved || !target) return;
    const list = recorded.filter((t) => t.id !== testId);
    const idx = list.findIndex((t) => t.id === targetId);
    if (idx < 0) return;
    list.splice(pos === "after" ? idx + 1 : idx, 0, { ...moved, suiteId: target.suiteId || null });
    setNotice(persistRecorded(list));
    setRecorded(list);
  };

  // Move a suite within its project, or into another one. Its test cases need
  // no touching — they point at the suite, and the suite is what moved.
  const moveSuite = (suiteId, toProjectId, targetSuiteId, pos) => {
    let moved = null;
    const stripped = projects.map((p) => ({
      ...p,
      suites: p.suites.filter((s) => {
        if (s.id !== suiteId) return true;
        moved = s;
        return false;
      }),
    }));
    if (!moved) return;
    saveProjects(
      stripped.map((p) => {
        if (p.id !== toProjectId) return p;
        const suites = [...p.suites];
        const idx = targetSuiteId ? suites.findIndex((s) => s.id === targetSuiteId) : -1;
        suites.splice(idx < 0 ? suites.length : pos === "after" ? idx + 1 : idx, 0, moved);
        return { ...p, suites };
      }),
    );
  };

  const moveProject = (projectId, targetId, pos) => {
    const moved = projects.find((p) => p.id === projectId);
    if (!moved) return;
    const list = projects.filter((p) => p.id !== projectId);
    const idx = list.findIndex((p) => p.id === targetId);
    list.splice(idx < 0 ? list.length : pos === "after" ? idx + 1 : idx, 0, moved);
    saveProjects(list);
  };

  // Run a set of tests through the existing suite queue, in listed order.
  const runTests = (tests) => {
    if (!tests.length || recorder || queue.length) return;
    setQueue(tests.map((t) => t.id));
  };

  // ---- dragging rows around the tree --------------------------------------
  // Native HTML5 drag and drop rather than a library: three levels and a
  // handful of rules do not justify the dependency. What is in flight lives in
  // `drag` rather than in dataTransfer, because dataTransfer is deliberately
  // unreadable during dragover — and dragover is exactly where a target has to
  // decide whether it will accept the drop.
  //
  // Rows describe themselves to these handlers as a target descriptor:
  //   { kind: "project" | "suite" | "test" | "unfiled", id, projectId? }

  // What would happen if the thing in flight were dropped here — or null for
  // "this is not a target", which is what makes the cursor show "no drop".
  const dropRule = (target) => {
    if (!drag || drag.id === target.id) return null;
    if (drag.kind === "test") {
      if (target.kind === "test") return "reorder";
      // Including a project: it holds suites rather than test cases, but
      // dropping one on it plainly means "put it in here", and refusing was
      // indistinguishable from the feature being broken. See fileTestInProject.
      return "into";
    }
    if (drag.kind === "suite") {
      if (target.kind === "suite") return "reorder";
      if (target.kind === "project") return "into";
      return null;
    }
    if (drag.kind === "project") return target.kind === "project" ? "reorder" : null;
    return null;
  };

  // Above or below the midline decides which side of the target it lands on.
  const edgeOf = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    return e.clientY - r.top < r.height / 2 ? "before" : "after";
  };

  // Spring-loaded folders: hover a folded project or suite for a moment while
  // dragging and it opens, so a drop deep in the tree doesn't need a separate
  // click to get there first.
  const spring = useRef({ id: null, timer: null });
  const cancelSpring = () => {
    clearTimeout(spring.current.timer);
    spring.current = { id: null, timer: null };
  };
  const springOpen = (id) => {
    if (spring.current.id === id || !collapsed.has(id)) return;
    clearTimeout(spring.current.timer);
    spring.current = {
      id,
      timer: setTimeout(() => {
        setCollapsed((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 550),
    };
  };
  useEffect(() => () => clearTimeout(spring.current.timer), []);

  const startDrag = (item) => (e) => {
    // Rows are siblings, not ancestors of one another, but the buttons and
    // labels inside them are — without this a drag begun on a row's ✎ would
    // report the button as the source.
    e.stopPropagation();
    e.dataTransfer.effectAllowed = "move";
    // Some browsers refuse to start a drag with an empty payload.
    e.dataTransfer.setData("text/plain", item.id);
    setDrag(item);
  };

  const endDrag = () => {
    cancelSpring();
    setDrag(null);
    setDropAt(null);
  };

  const overRow = (target) => (e) => {
    if (!drag) return;
    if (target.kind === "project" || target.kind === "suite") springOpen(target.id);
    const rule = dropRule(target);
    // No preventDefault means no drop here, which is how the cursor learns to
    // say so.
    if (!rule) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setDropAt({ id: target.id, pos: rule === "into" ? "into" : edgeOf(e) });
  };

  const dropOn = (target) => (e) => {
    const rule = dropRule(target);
    const moving = drag;
    const pos = rule === "into" ? "into" : dropAt && dropAt.id === target.id ? dropAt.pos : edgeOf(e);
    endDrag();
    if (!rule || !moving) return;
    e.preventDefault();
    e.stopPropagation();
    if (moving.kind === "test") {
      if (target.kind === "test") reorderTest(moving.id, target.id, pos);
      else if (target.kind === "project") fileTestInProject(moving.id, target.id);
      else fileTest(moving.id, target.kind === "unfiled" ? null : target.id);
    } else if (moving.kind === "suite") {
      if (target.kind === "suite") moveSuite(moving.id, target.projectId, target.id, pos);
      else moveSuite(moving.id, target.id, null, "after");
    } else if (moving.kind === "project") {
      moveProject(moving.id, target.id, pos);
    }
  };

  // Everything a draggable row needs, so the three row types cannot drift out
  // of step with each other.
  const rowDnd = (target) => ({
    draggable: true,
    onDragStart: startDrag(target),
    onDragEnd: endDrag,
    onDragOver: overRow(target),
    onDrop: dropOn(target),
  });

  // The insertion line, or the outline of the group being dropped into. An
  // inset shadow rather than a border: it cannot shift the row it marks.
  const dropStyle = (id) => {
    if (!dropAt || dropAt.id !== id) return null;
    if (dropAt.pos === "into") return { boxShadow: "inset 0 0 0 2px #5ff0c4", borderRadius: 9 };
    return dropAt.pos === "before"
      ? { boxShadow: "inset 0 2px 0 0 #5ff0c4" }
      : { boxShadow: "inset 0 -2px 0 0 #5ff0c4" };
  };

  const dragStyle = (id) => (drag && drag.id === id ? S.dragging : null);

  // The scheduler. Only ever launches one run at a time, and never while the
  // recorder is already open — a scheduled run must not interrupt you mid-edit.
  useEffect(() => {
    const id = setInterval(() => {
      if (recorder || queue.length) return; // already busy
      if (!can(user, "schedule")) return; // not on this plan — see ./plans
      const now = Date.now();

      // Suite schedule wins: it enqueues every test and re-arms immediately, so
      // the next window is measured from the start of the run, not the end.
      const all = schedules[ALL_TESTS_ID];
      if (all?.enabled && all.nextRunAt && all.nextRunAt <= now && recorded.length) {
        setQueue(recorded.map((t) => t.id));
        saveSchedules({ ...schedules, [ALL_TESTS_ID]: { ...all, nextRunAt: computeNextRun(all) } });
        return;
      }

      const dueId = Object.keys(schedules).find(
        (tid) =>
          tid !== ALL_TESTS_ID &&
          schedules[tid]?.enabled &&
          schedules[tid].nextRunAt &&
          schedules[tid].nextRunAt <= now &&
          recorded.some((t) => t.id === tid),
      );
      if (!dueId) return;
      const test = recorded.find((t) => t.id === dueId);
      setRecorder({ mode: "replay", test, autoPlay: true });
    }, 10_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedules, recorder, recorded, queue]);

  // Drain the suite queue one test at a time. Kept separate from the tick so a
  // long suite isn't at the mercy of the 10s interval between tests.
  useEffect(() => {
    if (recorder || !queue.length) return;
    const [nextId, ...rest] = queue;
    const test = recorded.find((t) => t.id === nextId);
    setQueue(rest);
    if (test) setRecorder({ mode: "replay", test, autoPlay: true, queued: true });
  }, [queue, recorder, recorded]);

  // A scheduled run finished: close the player, and re-arm — but only for a run
  // that fired from this test's own schedule. A test swept up in a suite pass
  // hasn't consumed its own window, so pushing it back would silently starve it.
  const finishScheduledRun = (testId, queued) => {
    const sched = schedules[testId];
    if (!queued && sched?.enabled) {
      saveSchedules({ ...schedules, [testId]: { ...sched, nextRunAt: computeNextRun(sched) } });
    }
    setRecorder(null);
  };

  // Closing the player by hand abandons the rest of the suite pass — otherwise
  // it would reopen a moment later and look broken.
  const closeRecorder = () => {
    setQueue([]);
    setRecorder(null);
  };

  // Recorded tests live in this origin's localStorage, so they vanish if the
  // dev server comes back on a different port or the profile is cleared.
  // Exporting writes them to a file that outlives all of that.
  // Exports carry the Project › Suite tree alongside the tests, so a list moved
  // to another origin arrives organised rather than as a flat pile. Older
  // exports are a bare array; importTests still reads those.
  // v3 adds `data`. A test referring to {{email}} is not portable without the
  // set that gives it a value, so the two travel together — an export that
  // carried only the steps would import as a workspace full of tests that fail
  // on their first fill.
  const exportTests = () =>
    download(
      JSON.stringify({ version: 3, projects, tests: recorded, data: testData }, null, 2),
      "testrunner-tests.json",
      "application/json",
    );

  // Lift a recording out of the browser so it can run anywhere. The data set goes
  // with it: {{email}} has to become something the runner can evaluate, and only
  // the set knows what.
  //
  // Which runner depends on what recorded it. A native test has no page to goto
  // and no CSS to select with, so it exports as WebdriverIO/Appium rather than as
  // a Playwright spec that could never run.
  //
  // Exported as a Page Object Model: the locators live on a class per page and
  // the spec names only methods. A flat spec puts every selector inline, so the
  // same button recorded in six tests is six copies of one selector and a repair
  // is six edits that have to be found first.
  //
  // One file rather than the conventional pages/ directory, because a browser
  // download is one file — a POM arriving as four separate downloads, each
  // needing its own click and landing wherever the browser puts it, is worse
  // than one file that compiles. `pom.pages` and `pom.spec` hold the split
  // layout for scripts/review-tests.js, which has a filesystem to write it to.
  const exportSpec = (t) =>
    isMobileTest(t)
      ? download(
          toAppiumPom(t, t.startUrl, dataSetFor(t)).bundle,
          mobileSpecName(t.name),
          "text/plain;charset=utf-8",
        )
      : download(
          toPlaywrightPom(t, START_URL, dataSetFor(t)).bundle,
          specName(t.name),
          "text/plain;charset=utf-8",
        );

  const importTests = async (file) => {
    try {
      const data = JSON.parse(await file.text());
      // v2 is { projects, tests }; a bare array is a pre-hierarchy export.
      const list = Array.isArray(data) ? data : data && data.tests;
      if (!Array.isArray(list)) throw new Error("expected a JSON array of tests, or { projects, tests }");
      // Merge by id so an import tops up the list rather than replacing it.
      const byId = new Map(recorded.map((t) => [t.id, t]));
      list.forEach((t) => t && t.id && byId.set(t.id, t));
      const next = [...byId.values()];
      const err = persistRecorded(next);
      setRecorded(next);

      // Same merge for the tree, so imported tests land in the suites they were
      // exported from. A project already here keeps its name and gains any
      // suites it was missing — nothing local is overwritten.
      const incoming = Array.isArray(data && data.projects) ? data.projects : [];
      let addedSuites = 0;
      if (incoming.length) {
        const byProject = new Map(projects.map((p) => [p.id, { ...p, suites: [...p.suites] }]));
        incoming.forEach((p) => {
          if (!p || !p.id) return;
          const mine = byProject.get(p.id) || { ...p, suites: [] };
          const have = new Set(mine.suites.map((s) => s.id));
          (Array.isArray(p.suites) ? p.suites : []).forEach((s) => {
            if (!s || !s.id || have.has(s.id)) return;
            mine.suites.push(s);
            addedSuites++;
          });
          byProject.set(p.id, mine);
        });
        saveProjects([...byProject.values()]);
      }

      // Test data (v3+). Merged by set id and, within a set, by key — so
      // importing somebody's suite tops up your data rather than replacing it,
      // and a value you have already corrected locally is not undone by theirs.
      // The live set is deliberately not adopted from the file: which set is
      // active is a choice about the machine you are sitting at.
      let addedVars = 0;
      let dataErr = null;
      const incomingData = data && data.data;
      if (incomingData && Array.isArray(incomingData.sets) && incomingData.sets.length) {
        const bySet = new Map(testData.sets.map((s) => [s.id, { ...s, vars: [...varsOf(s)] }]));
        incomingData.sets.forEach((s) => {
          if (!s || !s.id) return;
          const mine = bySet.get(s.id) || { ...s, name: s.name || "Untitled", vars: [] };
          const have = new Set(mine.vars.map((v) => v.key));
          varsOf(s).forEach((v) => {
            const key = normKey(v && v.key);
            if (!key || have.has(key)) return;
            mine.vars.push({ key, value: v.value == null ? "" : String(v.value), secret: !!v.secret });
            have.add(key);
            addedVars++;
          });
          bySet.set(s.id, mine);
        });
        const sets = [...bySet.values()];
        const merged = { sets, activeId: testData.activeId || sets[0].id };
        // Persisted directly rather than through saveTestData: that helper posts
        // its own notice, and the summary below would overwrite it — quietly
        // turning "storage is full" into "Imported 9 tests."
        dataErr = persistTestData(merged);
        setTestData(merged);
      }

      if (!selectedId && next.length) setSelectedId(next[0].id);
      setNotice(
        err ||
          dataErr ||
          `Imported ${list.length} test${list.length === 1 ? "" : "s"}` +
            (addedSuites ? ` and ${addedSuites} suite${addedSuites === 1 ? "" : "s"}` : "") +
            (addedVars ? ` and ${addedVars} test data value${addedVars === 1 ? "" : "s"}` : "") +
            ".",
      );
    } catch (err) {
      setNotice(`Import failed — ${err.message}`);
    }
  };

  // Adopt tests found under some other storage key back into the real one.
  const recoverTests = (tests) => {
    const byId = new Map(recorded.map((t) => [t.id, t]));
    tests.forEach((t, i) => byId.set(t.id || `rec-recovered-${i}`, t));
    const next = [...byId.values()];
    const err = persistRecorded(next);
    setRecorded(next);
    if (next.length) setSelectedId(next[0].id);
    setNotice(err || `Recovered ${tests.length} test${tests.length === 1 ? "" : "s"}.`);
  };

  /**
   * Takes a colleague's recording into this workspace, as a copy.
   *
   * A new id and a new owner, deliberately: the same id would make dbSync push
   * this browser's copy over theirs on the next tick, and the two people would
   * take turns overwriting one test. The suite is dropped for the same reason a
   * copy is not filed automatically — their tree is not this browser's tree.
   *
   * @param {object} test the recording, in full, from the team library.
   */
  const importTeamTest = (test) => {
    const copy = {
      ...test,
      id: `rec-${Date.now()}`,
      name: test.name + " (copy)",
      suiteId: null,
      owner: ownerFrom(user),
      // Where it came from, because a copy with no provenance is a test nobody
      // can ask a question about six months later.
      copiedFrom: { id: test.id, owner: test.owner || null, at: Date.now() },
    };
    const next = [...recorded, copy];
    setNotice(persistRecorded(next));
    setRecorded(next);
    setSelectedId(copy.id);
    revealTest(next, copy);
    setTeamOpen(false);
    setNotice(
      `Copied "${test.name}" from ${(test.owner && (test.owner.name || test.owner.email)) || "your team"} — it is yours to edit now.`,
    );
  };

  const saveRecordedTest = (incoming) => {
    // Ownership is settled here rather than in the recorder, because this is the
    // one function every save goes through. An existing owner always wins: an
    // edit is not a transfer.
    const prior = recorded.find((r) => r.id === incoming.id);
    const t = { ...incoming, owner: ownerOf(prior) || ownerOf(incoming) || ownerFrom(user) };
    // Replace in place. Position in this list is the order the tree shows, and
    // it is now something you can arrange by hand — editing a test must not
    // silently kick it to the bottom of its suite.
    const known = !!prior;
    const next = known ? recorded.map((r) => (r.id === t.id ? t : r)) : [...recorded, t];
    setNotice(persistRecorded(next));
    setRecorded(next);
    setSelectedId(t.id);
    revealTest(next, t);
    setRecorder(null);
  };
  // Tags, changed from the details panel rather than by reopening the recorder.
  // Written straight through — like a schedule, and unlike a step edit: labelling
  // a test is not authoring it, and making someone re-enter the recorder and
  // press Save to add "@smoke" is how tests end up untagged.
  //
  // Owner is deliberately untouched here. Tagging somebody else's test is not
  // taking it over, and saveRecordedTest's rule (an existing owner always wins)
  // would say the same thing.
  const setTestTags = (id, tags) => {
    const next = recorded.map((r) => (r.id === id ? { ...r, tags } : r));
    setNotice(persistRecorded(next));
    setRecorded(next);
  };
  // Write a run's repaired locators back into the recording. This is the auto
  // in auto-fix: the next run finds the element by a verified selector again
  // instead of limping through the same escalation every time, and the run
  // after that is a normal green run rather than a repair.
  //
  // The old selectors are kept behind the new ones rather than thrown away. A
  // repair is a well-founded guess, not a certainty, and markup that comes back
  // — a reverted deploy, a flag flipped off — then matches again on its own.
  //
  // Written straight through, like a schedule and unlike a step edit: the run
  // that produced it has already finished, and asking someone to confirm a
  // repair they cannot see the page for is a dialog nobody can answer.
  const applyHeals = (testId, heals) => {
    const byIndex = new Map(heals.map((h) => [h.index, h]));
    const test = recorded.find((t) => t.id === testId);
    if (!test) return;
    const next = recorded.map((t) =>
      t.id !== testId
        ? t
        : {
            ...t,
            steps: t.steps.map((st, i) => {
              const h = byIndex.get(i);
              if (!h) return st;
              const kept = (st.selectors && st.selectors.length ? st.selectors : [st.selector]).filter(
                Boolean,
              );
              return {
                ...st,
                selector: h.selector,
                selectors: [...h.selectors, ...kept.filter((sel) => !h.selectors.includes(sel))],
                tag: h.tag || st.tag,
                text: h.text || st.text,
                // Provenance, so a step that healed can be told from one that
                // was recorded that way — by a reviewer, and by anyone
                // wondering why the exported spec no longer matches the app's
                // markup from six months ago.
                healedAt: Date.now(),
                healedFrom: h.from || st.selector || null,
              };
            }),
          },
    );
    const err = persistRecorded(next);
    setRecorded(next);
    setNotice(
      err ||
        `Healed ${heals.length} step${heals.length === 1 ? "" : "s"} in "${test.name}" — ` +
          `the repaired locators are saved, and the old ones kept behind them.`,
    );
  };

  // Batch rather than a loop over the single-test delete: each removal has to
  // rewrite the whole recorded list, the whole run map and re-prune the shot
  // store, so doing it per test would persist N times and, worse, read a stale
  // `recorded` from this closure on every pass but the first.
  const deleteRecordedTests = (ids) => {
    const doomed = new Set(ids);
    if (!doomed.size) return;
    const next = recorded.filter((r) => !doomed.has(r.id));
    persistRecorded(next);
    setRecorded(next);
    setSelectedId((cur) => (cur && doomed.has(cur) ? next[0]?.id || null : cur));
    setRuns((prev) => {
      const rest = Object.fromEntries(Object.entries(prev).filter(([id]) => !doomed.has(id)));
      persistRuns(rest);
      // The next run would prune these anyway, but a deleted test should give
      // its space back now rather than whenever something else happens to run.
      pruneShots(shotRunIds(rest));
      return rest;
    });
  };

  const deleteRecordedTest = (id) => deleteRecordedTests([id]);
  const recordRun = (testId, report, shots) => {
    setRuns((prev) => {
      // Newest first, oldest evicted. Prepending rather than appending keeps
      // "the last run" at a fixed index no matter how deep the history is.
      const next = { ...prev, [testId]: [report, ...(prev[testId] || [])].slice(0, RUN_HISTORY) };
      persistRuns(next);
      // Evidence goes to IndexedDB, keyed by run. Pruning against the runs that
      // survived the cap is what stops the store growing without bound; it runs
      // after the save because `next` includes the run just added.
      if (shots && report.id) saveShots(report.id, shots);
      pruneShots(shotRunIds(next));
      return next;
    });
    setSelectedId(testId);
    setRunIdx(0); // a fresh run is what you want to be looking at
  };

  const current = recorded.find((t) => t.id === selectedId) || null;
  const history = (current && runs[current.id]) || [];
  // Clamped on read: history shortens when a run is evicted at the cap, and
  // switching tests can land on an index the new test has no run for.
  const shownIdx = Math.min(runIdx, Math.max(0, history.length - 1));
  const report = history[shownIdx] || null;

  // One test case in the tree. Identical under a suite and under Unfiled,
  // except that an unfiled one also offers somewhere to file it.
  //
  // `num`/`of` are the row's position within its container, counted across
  // pages rather than within the visible slice — the second page starts at 11,
  // not at 1 again. Numbers are positional on purpose: they are how you refer
  // to a case out loud ("case 4 fails"), so they must match what the rail shows
  // after a drag, which a stored id never would.
  const renderTestRow = (t, showAssign = false, num = null, of = null) => {
    const past = runs[t.id] || [];
    const latest = lastRun(past);
    const stats = runStats(past);
    const kind = testType(t);
    return (
    <div
      key={t.id}
      className={`tr-row tr-test${selectedId === t.id ? " is-selected" : ""}`}
      onClick={() => setSelectedId(t.id)}
      {...rowDnd({ kind: "test", id: t.id, suiteId: t.suiteId })}
      title="Drag to reorder, or onto another suite to move it there"
      style={{
        ...S.suiteRow,
        ...S.testRow,
        ...dragStyle(t.id),
        ...dropStyle(t.id),
      }}
    >
      {/* Case number, ahead of the icon so a column of them lines up down the
          rail. Fixed width and tabular figures, so 9 → 10 doesn't shift the
          names one pixel right. */}
      {num != null && (
        <span style={S.testNum} title={of ? `Test case ${num} of ${of}` : `Test case ${num}`}>
          {num}
        </span>
      )}
      {/* Replaces the old REC text badge. Under a suite every leaf is a
          recording, so the word was redundant, and a 300px rail wants those
          30px back for the name.

          The colour carries the last run's verdict — green passed, red failed —
          because the rail is scanned down a column and a colour is read before
          any text is. A test that has never run is neither: it is grey, not
          red, since "nobody has tried this yet" and "this is broken" are
          different facts and only one of them needs looking at. The verdict is
          also written out beside the name, so this is never the only place it
          is said. */}
      <span
        style={{ ...S.testIcon, color: verdictColor(latest) }}
        title={
          latest
            ? `Last run ${latest.status} in ${fmtMs(latest.durationMs)}`
            : "Recorded test case — not run yet"
        }
      >
        <BeakerIcon size={14} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={S.suiteName} title={t.name}>
          {t.name}
        </div>
        <div style={S.suiteDesc}>
          {t.steps.length} steps
          {latest ? (
            <span style={{ color: latest.status === "failed" ? "var(--tr-rec)" : "var(--tr-pass)" }}>
              {" · "}
              {latest.status === "failed" ? "✕ failed" : "✓ passed"} in {fmtMs(latest.durationMs)}
            </span>
          ) : (
            " · not run"
          )}
          {/* A test that both passes and fails on the same recording is a
              different problem from one that is simply broken, and the last
              run alone can never tell you which you have. */}
          {stats.flaky && (
            <span style={S.flakyChip} title={`${stats.failed} of the last ${stats.total} runs failed`}>
              flaky
            </span>
          )}
          {schedules[t.id]?.enabled && (
            <span style={{ color: "var(--tr-info)", display: "inline-flex", alignItems: "center", gap: 3, marginLeft: 5 }}>
              <ClockIcon size={10} />
              {schedules[t.id].mode === "daily"
                ? `daily ${schedules[t.id].time}`
                : `every ${schedules[t.id].minutes}m`}
            </span>
          )}
        </div>
        {/* The type, then the tags, on their own line. Inlined after "17 steps
            · failed in 47.1s" they were the first thing the ellipsis ate, which
            is backwards — these are how you will look this test up.

            The type chip is always drawn, unlike the tags: "no tags" is a fine
            thing for a row to say by staying quiet, but every test has a type,
            and one that appeared only on mobile recordings would leave a web
            test looking like a test whose type nobody had established. It is
            deliberately not styled as a tag — tags are accent-coloured and are
            something you wrote, this is neutral and is something the recording
            simply is. */}
        <div style={S.tagRow}>
          {/* One chip: the word says the type, the glyph says the browser.
              Spelling the browser out took a second chip, which wrapped onto a
              line of its own in a 300px rail — and "WEB · IN-PAGE" was the same
              fact twice, since every browser name already means web. The mark
              carries it instead: Chromium, Firefox and WebKit are each
              recognisable down a column at no extra width, and the tooltip
              names the one under the pointer.

              A mobile recording keeps its own glyph and word — its engine is a
              device driven through Appium, not a browser. */}
          {(() => {
            const mobileTest = isMobileTest(t);
            // Where it ran, when that is known; otherwise the engine selected
            // in User Settings, which is where a real-browser run would go.
            // Only the tooltip separates the two — a mark on its own is a hint,
            // and must not be read as a claim that the test has run.
            const ran = latest && latest.browser ? latest.browser : null;
            const id = mobileTest ? null : ran || browser;
            const Glyph = id ? browserIconFor(id) : kind.Glyph;
            const where = id === "in-page" ? "this browser, in-page" : id ? browserLabel(id) : null;
            return (
              <span
                style={S.typeChip}
                title={
                  mobileTest
                    ? kind.title
                    : ran
                      ? `${kind.title}\n\n${runBrowserTitle(ran)}`
                      : `${kind.title}\n\nNot run yet — a real-browser run would use ${where}`
                }
              >
                <Glyph size={9} /> {kind.label}
              </span>
            );
          })()}
          {tagsOf(t).map((tag) => (
            <span key={tag} style={S.tagChipSm} title={tagsOf(t).map(tagLabel).join(" ")}>
              {tagLabel(tag)}
            </span>
          ))}
        </div>
        {/* The keyboard route to the same thing dragging does. Always on an
            unfiled test, and on whichever test is selected — dragging is
            mouse-only, so there has to be a way in without one. */}
        {(showAssign || selectedId === t.id) && suiteIndex.size > 0 && (
          <select
            value=""
            draggable={false}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => fileTest(t.id, e.target.value === UNFILED_ID ? null : e.target.value)}
            style={S.assignSelect}
            title="File this test case under a suite"
            aria-label={`File ${t.name} under a suite`}
          >
            <option value="">file under…</option>
            {projects.map((p) =>
              p.suites.map((s) => (
                <option key={s.id} value={s.id}>
                  {p.name} › {s.name}
                </option>
              )),
            )}
            {!showAssign && <option value={UNFILED_ID}>— take out of its suite —</option>}
          </select>
        )}
      </div>
      {/* Who owns it, as their face. A 330px rail has no room for a name beside
          everything else on the row, and a photograph answers the question you
          actually ask of a list — "which of these are mine" — faster than any
          text, because it is recognised rather than read.

          The picture is looked up, not stored on the test: see loadOwnerDirectory
          for why an owner record deliberately carries no image. An owner with no
          photo, or one this browser has never seen, falls back to initials and
          then to a generic figure — all three handled by AvatarFace, which is
          the same component the account menu uses, so a face is drawn one way
          everywhere. The full name and email stay in the tooltip, and are
          spelled out in the header of whichever test is selected. */}
      {ownerOf(t) && (
        <span
          style={{ ...S.ownerDot, ...(isMine(ownerOf(t), user) ? S.ownerDotMine : {}) }}
          title={`Owner: ${ownerLabel(ownerOf(t))}${isMine(ownerOf(t), user) ? " (you)" : ""}`}
          aria-label={`Owner: ${ownerOf(t).name}`}
        >
          <AvatarFace user={ownerUser(ownerOf(t))} size={S.ownerDot.width} />
        </span>
      )}
      <span className="tr-fade">
        <button
          style={S.suiteEdit}
          onClick={(e) => {
            e.stopPropagation();
            setRecorder({ mode: "record", test: t });
          }}
          title="Edit this test — rename, reorder, retype values, append steps"
          aria-label={`Edit recorded test ${t.name}`}
        >
          <PencilIcon />
        </button>
        <button
          style={S.suiteDelete}
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm(`Delete recorded test "${t.name}"?`)) deleteRecordedTest(t.id);
          }}
          title="Delete this recorded test"
          aria-label={`Delete recorded test ${t.name}`}
        >
          <TrashIcon />
        </button>
      </span>
      {/* The recent past as five bars. Too small to read a number off, which
          is the point — it answers "has this been steady?" at a glance, and
          the history strip in the report answers everything else. */}
      {past.length > 1 && <Sparkline runs={past} />}
      <button
        style={S.suiteRun}
        onClick={(e) => {
          e.stopPropagation();
          setRecorder({ mode: "replay", test: t });
        }}
        title="Play back this recorded test"
        aria-label={`Play back ${t.name}`}
      >
        Run
        <PlayIcon size={11} />
      </button>
    </div>
    );
  };

  // The test cases of one container, one page at a time. Shared by every suite
  // and by Unfiled, so a page of tests behaves identically wherever it appears.
  const renderTestList = (containerId, tests, showAssign = false) => {
    const page = pageOf(containerId, tests.length);
    const from = page * TESTS_PER_PAGE;
    return (
      <>
        {tests
          .slice(from, from + TESTS_PER_PAGE)
          .map((t, i) => renderTestRow(t, showAssign, from + i + 1, tests.length))}
        {/* Shown for any non-empty container, not only ones that overflow a
            page. The count is worth reading on its own, and a control that
            appears once a suite crosses ten tests is a control you have to
            notice arriving — whereas one that is always in the same place
            below the last row is one you already know how to use. Its buttons
            simply sit disabled while everything fits. */}
        <TreePager
          page={page}
          pages={pageCount(tests.length)}
          from={from + 1}
          to={Math.min(from + TESTS_PER_PAGE, tests.length)}
          total={tests.length}
          onPage={(n) => setPage(containerId, n)}
        />
      </>
    );
  };

  return (
    <div style={S.page} data-tr-theme={theme}>
      {/* Top bar */}
      <header style={S.topbar}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <TestExpressMark />
          <div>
            <div style={S.wordmark}>{branding.name}</div>
            <div style={S.subtitle}>{branding.tagline}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Restoring this needs its suite back with it, which is why the
              derivation lives in here rather than above as an unused const. A
              new test recorded from the top bar lands beside the one you are
              looking at, which is nearly always the suite you are working in:

                const currentSuiteId =
                  current && suiteIndex.has(current.suiteId) ? current.suiteId : null;

          <button
            style={{ ...S.btn, ...S.btnRec }}
            onClick={() => setNewTest({ suiteId: currentSuiteId })}
            title={
              currentSuiteId
                ? `Record a new test case into ${suitePathOf(currentSuiteId)}`
                : "Record a new test — it lands in Unfiled until you file it under a suite"
            }
          >
            <span style={S.recDotSm} /> + New Test
          </button> */}
          {current && (
            <>
              {/* <button
                style={{ ...S.btn, ...S.btnRun }}
                onClick={() => setRecorder({ mode: "replay", test: current })}
                title={`Play back "${current.name}"`}
              >
                ▶ Play
              </button> */}
              <button
                style={{ ...S.btn, ...S.btnGhost, ...S.btnIcon }}
                onClick={() => exportSpec(current)}
                title="Download as a Page Object Model — page objects plus a spec, runs against any site, headless, in CI"
              >
                <FileCodeIcon size={14} />Download Spec
              </button>
            </>
          )}
          {/* Appearance and headed/headless are preferences, not actions — they
              live in User Settings (the account menu) rather than taking up top
              bar beside the things you do to a test. */}
          {/* Beside the things you do to a test rather than in User Settings:
              test data is an input to a run, not a preference about the runner. */}
          {/* Beside TDM because the two are the same kind of thing: what goes
              into a run, and what came out of one. The count is the headline —
              a number in red here is the reason you would open it. */}
          {/* Corporate only. Not disabled-with-a-reason like the plan-gated
              controls: this is not a feature an individual account is missing,
              it is a view of an organisation that does not exist for them —
              and a permanently greyed "Team" would imply otherwise. */}
          {corporate && (
            <button
              style={{ ...S.btn, ...S.btnGhost, ...S.btnIcon, ...S.btnCorporate }}
              onClick={() => setTeamOpen(true)}
              title="Your team: the seats, what they have recorded, and what they have been doing"
            >
              <UsersIcon size={14} /> Team
            </button>
          )}
          <button
            style={{ ...S.btn, ...S.btnGhost, ...S.btnIcon, opacity: recorded.length ? 1 : 0.4 }}
            disabled={!recorded.length}
            onClick={() => setReportsOpen(true)}
            title="Run history across every test — what is failing, what is flaky, what has never run"
          >
            <ChartIcon size={14} /> Reports
            {failingCount > 0 && (
              <span style={{ color: "var(--tr-rec)", fontWeight: 800 }}>{failingCount}</span>
            )}
          </button>
          <button
            style={{ ...S.btn, ...S.btnGhost, ...S.btnIcon, opacity: refusal("data") ? 0.4 : 1 }}
            disabled={!!refusal("data")}
            onClick={() => setDataOpen(true)}
            title={
              refusal("data") ||
              "Named values your tests use instead of hard-coded text — logins, emails, dates"
            }
          >
            <DatabaseIcon size={14} /> TDM
            {testData.sets.length > 0 && (
              <span style={{ color: "var(--tr-muted)", fontWeight: 700 }}>
                {setFor(testData, {})?.name}
              </span>
            )}
          </button>
          <button
            style={{ ...S.btn, ...S.btnGhost, ...S.btnIcon, opacity: recorded.length ? 1 : 0.4 }}
            disabled={!recorded.length}
            onClick={exportTests}
            title="Save all projects, suites and recorded tests to a JSON file"
          >
            <DownloadIcon size={14} /> Export
          </button>
          <button
            style={{ ...S.btn, ...S.btnGhost, ...S.btnIcon }}
            onClick={() => importRef.current && importRef.current.click()}
            title="Load tests from a previously exported JSON file"
          >
            <UploadIcon size={14} /> Import
          </button>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files && e.target.files[0];
              if (file) importTests(file);
              e.target.value = ""; // allow re-importing the same file
            }}
          />
          {/* <button style={{ ...S.btn, ...S.btnGhost }} onClick={() => navigate("/HomePage")}>
            ↗ Open app
          </button> */}
          <span style={S.topbarDivider} />
          <UserMenu
            refusal={refusal}
            themeChoice={themeChoice}
            theme={theme}
            onTheme={applyTheme}
            headless={headless}
            onHeadless={applyHeadless}
            selfHeal={selfHeal}
            onSelfHeal={applySelfHeal}
            parallel={parallel}
            onParallel={applyParallel}
            browser={browser}
            onBrowser={applyBrowser}
            device={device}
            onDevice={applyDevice}
            onCicd={() => setCicdOpen(true)}
          />
        </div>
      </header>

      {notice && (
        // Everything that is not a report of something going wrong reads as
        // good news. "Recovered …" was being shown in the failure colour.
        <div style={{ ...S.notice, ...(/^(Imported|Recovered|Added|Healed)/.test(notice) ? S.noticeOk : S.noticeBad) }}>
          <span style={{ flex: 1 }}>{notice}</span>
          <button style={S.noticeClose} onClick={() => setNotice(null)} aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}

      <div style={S.body}>
        {/* Sidebar: the Project › Suite › Test case tree. Collapsible, so a
            wide report can have the window. Hidden rather than unmounted:
            re-opening should put you back where you were in a long tree, and
            an unmounted <aside> loses its scroll position. */}
        {!railOpen && (
          <RailStub
            projects={projects.length}
            tests={recorded.length}
            onExpand={() => applyRailOpen(true)}
          />
        )}
        <aside
          style={{ ...S.sidebar, display: railOpen ? "block" : "none" }}
          // Leaving the rail entirely drops the insertion marker. Rows keep
          // re-asserting it on dragover, so this only fires when there is
          // genuinely nothing under the pointer any more.
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setDropAt(null);
          }}
        >
          <div style={S.sidebarHead}>
            <span>PROJECTS</span>
            {/* The rail scrolls; the counts do not, so the size of the tree
                stays legible from wherever you are inside it. */}
            {recorded.length > 0 && (
              <span style={S.sidebarCount}>
                {projects.length} · {recorded.length}
              </span>
            )}
            <span style={{ flex: 1 }} />
            <button onClick={addProject} style={S.addBtn} title="Create a project to group suites under">
              <PlusIcon size={11} />
              Project
            </button>
            <button
              onClick={() => applyRailOpen(false)}
              style={{ ...S.pagerBtn, cursor: "pointer" }}
              title="Hide the projects rail"
              aria-label="Hide the projects rail"
            >
              <CaretIcon dir="left" />
            </button>
          </div>

          {!projects.length && !unfiled.length && (
            <div style={S.treeHint}>
              Nothing here yet. Start with <b style={{ color: "var(--tr-accent)" }}>+ Project</b>, add a{" "}
              <b style={{ color: "var(--tr-text-2)" }}>suite</b> inside it, then record test cases
              into the suite.
            </div>
          )}

          {projects.map((project) => {
            const projectTests = testsInProject(project);
            const projectFolded = collapsed.has(project.id);
            return (
              <div key={project.id} style={S.treeGroup}>
                <div
                  className="tr-row tr-project"
                  {...rowDnd({ kind: "project", id: project.id })}
                  style={{ ...S.projectRow, ...dragStyle(project.id), ...dropStyle(project.id) }}
                  onClick={() => toggleFold(project.id)}
                  title={
                    drag
                      ? "Drop a suite or a test case here to move it into this project"
                      : `${projectFolded ? "Expand" : "Collapse"} — drag to reorder projects`
                  }
                >
                  <span style={S.caret}>
                    <ChevronIcon open={!projectFolded} />
                  </span>
                  <span style={S.projectIcon}>
                    <FolderIcon size={14} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={S.projectName} title={project.name}>
                      {project.name}
                    </div>
                    <div style={S.suiteDesc}>
                      {project.suites.length} suite{project.suites.length === 1 ? "" : "s"} ·{" "}
                      {projectTests.length} test{projectTests.length === 1 ? "" : "s"}
                    </div>
                  </div>
                  <button
                    style={S.addBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      addSuite(project);
                    }}
                    title={`Add a suite to "${project.name}"`}
                  >
                    <PlusIcon size={11} />
                    Suite
                  </button>
                  <span className="tr-fade">
                    <button
                      style={S.suiteEdit}
                      onClick={(e) => {
                        e.stopPropagation();
                        renameProject(project);
                      }}
                      title="Rename this project"
                      aria-label={`Rename project ${project.name}`}
                    >
                      <PencilIcon />
                    </button>
                    <button
                      style={S.suiteDelete}
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteProject(project);
                      }}
                      title="Delete this project — its test cases are kept and moved to Unfiled"
                      aria-label={`Delete project ${project.name}`}
                    >
                      <TrashIcon />
                    </button>
                  </span>
                  <button
                    style={{ ...S.suiteRun, opacity: projectTests.length ? 1 : 0.35 }}
                    disabled={!projectTests.length || !!recorder || queue.length > 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      runTests(projectTests);
                    }}
                    title={`Run every test case in "${project.name}"`}
                    aria-label={`Run every test case in project ${project.name}`}
                  >
                    Run
                    <PlayIcon size={11} />
                  </button>
                </div>

                {/* One continuous guide line down the children, rather than
                    indentation alone. At three levels in a 340px rail the eye
                    loses which suite a test case hangs off without it. */}
                {!projectFolded && (
                  <div style={S.treeChildren}>
                  {project.suites.length === 0 ? (
                    // An empty container has no rows to aim at, so the placeholder
                    // is the drop target. The outline still appears on the header
                    // above, which is what names the destination.
                    <div
                      style={S.treeEmpty}
                      onDragOver={overRow({ kind: "project", id: project.id })}
                      onDrop={dropOn({ kind: "project", id: project.id })}
                    >
                      No suites yet — add one with <b style={{ color: "var(--tr-text-2)" }}>+ Suite</b>.
                    </div>
                  ) : (
                    project.suites.map((suite) => {
                      const suiteTests = testsInSuite(suite.id);
                      const suiteFolded = collapsed.has(suite.id);
                      return (
                        <div key={suite.id}>
                          <div
                            className="tr-row tr-suite"
                            {...rowDnd({ kind: "suite", id: suite.id, projectId: project.id })}
                            style={{ ...S.suiteHeadRow, ...dragStyle(suite.id), ...dropStyle(suite.id) }}
                            onClick={() => toggleFold(suite.id)}
                            title={
                              drag
                                ? "Drop a test case here to move it into this suite"
                                : `${suiteFolded ? "Expand" : "Collapse"} — drag onto another project to move this suite`
                            }
                          >
                            <span style={S.caret}>
                              <ChevronIcon open={!suiteFolded} />
                            </span>
                            <span style={S.suiteIcon}>
                              <LayersIcon />
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={S.suiteHeadName} title={suite.name}>
                                {suite.name}
                              </div>
                              <div style={S.suiteDesc}>
                                {suiteTests.length} test case{suiteTests.length === 1 ? "" : "s"}
                              </div>
                            </div>
                            {/* "+ New Test", matching "+ Project" and "+ Suite"
                                above it: the three are the same kind of action
                                at three levels of the tree, so they read as a
                                set. It is the only filled one of the three,
                                which is what still distinguishes it — this is
                                the only one that opens a recorder. */}
                            <button
                              style={{ ...S.addBtn, background: "#0ac8f2", color: "#fff", borderColor: "#0ac8f2" }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setNewTest({ suiteId: suite.id });
                              }}
                              title={`Record a new test case into "${suite.name}"`}
                            >
                              <PlusIcon size={11} />
                              NEW TEST
                            </button>
                            <span className="tr-fade">
                              <button
                                style={S.suiteEdit}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  renameSuite(project, suite);
                                }}
                                title="Rename this suite"
                                aria-label={`Rename suite ${suite.name}`}
                              >
                                <PencilIcon />
                              </button>
                              <button
                                style={S.suiteDelete}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteSuite(project, suite);
                                }}
                                title="Delete this suite — its test cases are kept and moved to Unfiled"
                                aria-label={`Delete suite ${suite.name}`}
                              >
                                <TrashIcon />
                              </button>
                            </span>
                            <button
                              style={{ ...S.suiteRun, opacity: suiteTests.length ? 1 : 0.35 }}
                              disabled={!suiteTests.length || !!recorder || queue.length > 0}
                              onClick={(e) => {
                                e.stopPropagation();
                                runTests(suiteTests);
                              }}
                              title={`Run every test case in "${suite.name}"`}
                              aria-label={`Run every test case in suite ${suite.name}`}
                            >
                              Run
                              <PlayIcon size={11} />
                            </button>
                          </div>

                          {!suiteFolded && (
                            <div style={S.treeChildren}>
                              {suiteTests.length === 0 ? (
                                <div
                                  style={S.treeEmpty}
                                  onDragOver={overRow({ kind: "suite", id: suite.id, projectId: project.id })}
                                  onDrop={dropOn({ kind: "suite", id: suite.id, projectId: project.id })}
                                >
                                  No test cases — hit <b style={{ color: "var(--tr-rec)" }}>+ New Test</b> to record one.
                                </div>
                              ) : (
                                renderTestList(suite.id, suiteTests)
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Tests that belong to no suite: everything recorded before there
              were projects, plus anything freed by deleting a container. */}
          {unfiled.length > 0 && (
            <div style={S.treeGroup}>
              <div
                className="tr-row tr-project"
                onDragOver={overRow({ kind: "unfiled", id: UNFILED_ID })}
                onDrop={dropOn({ kind: "unfiled", id: UNFILED_ID })}
                onClick={() => toggleFold(UNFILED_ID)}
                title={drag ? "Drop a test case here to take it out of its suite" : undefined}
                style={{ ...S.projectRow, ...dropStyle(UNFILED_ID) }}
              >
                <span style={S.caret}>
                  <ChevronIcon open={!collapsed.has(UNFILED_ID)} />
                </span>
                <span style={{ ...S.projectIcon, color: "var(--tr-soft)" }}>
                  <InboxIcon size={14} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...S.projectName, color: "var(--tr-soft)" }}>Unfiled</div>
                  <div style={S.suiteDesc}>
                    {unfiled.length} test{unfiled.length === 1 ? "" : "s"} in no suite
                  </div>
                </div>
                <button
                  style={{ ...S.suiteRun, opacity: unfiled.length ? 1 : 0.35 }}
                  disabled={!!recorder || queue.length > 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    runTests(unfiled);
                  }}
                  title="Run every unfiled test case"
                  aria-label="Run every unfiled test case"
                >
                  Run
                  <PlayIcon size={11} />
                </button>
              </div>
              {!collapsed.has(UNFILED_ID) && (
                <div style={S.treeChildren}>{renderTestList(UNFILED_ID, unfiled, true)}</div>
              )}
            </div>
          )}
        </aside>

        {/* Center: the selected test's steps */}
        <main style={S.main}>
          {!recorded.length ? (
            <StorageDiagnostics onRecover={recoverTests} />
          ) : !current ? (
            <div style={S.emptyState}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--tr-text-2)", marginBottom: 6 }}>
                No test selected
              </div>
              <div style={{ fontSize: 13, color: "var(--tr-dim)", maxWidth: 380, lineHeight: 1.6 }}>
                Pick a test on the left, or hit <b style={{ color: "var(--tr-rec)" }}>Record</b> to make a
                new one.
              </div>
            </div>
          ) : (
            <>
              <div style={S.mainHead}>
                <div style={S.mainCrumb}>
                  {suitePathOf(current.suiteId) ? <FolderIcon size={12} /> : <InboxIcon size={12} />}
                  {suitePathOf(current.suiteId) || "Unfiled"}
                  {/* The face again, with the name spelled out beside it —
                      there is room for both here, and the header is the one
                      place that says who somebody is rather than assuming you
                      recognise them. An unowned test says so: silence would
                      read as "nobody has looked at whose this is", which is a
                      different thing. */}
                  <span style={S.crumbSep}>·</span>
                  {ownerOf(current) ? (
                    <span style={S.ownerChip} title={ownerLabel(ownerOf(current))}>
                      <span
                        style={{
                          ...S.ownerDotSm,
                          ...(isMine(ownerOf(current), user) ? S.ownerDotMine : {}),
                        }}
                      >
                        <AvatarFace user={ownerUser(ownerOf(current))} size={S.ownerDotSm.width} />
                      </span>
                      {ownerOf(current).name}
                      {isMine(ownerOf(current), user) && <span style={S.crumbSep}>(you)</span>}
                    </span>
                  ) : (
                    <span
                      style={{ ...S.ownerChip, color: "var(--tr-muted)" }}
                      title="Recorded before test cases carried an owner — whoever next saves it becomes one"
                    >
                      <UserIcon size={11} /> no owner
                    </span>
                  )}
                </div>
                <div style={S.mainTitle}>{current.name}</div>
                <div style={S.mainDesc}>
                  {current.steps.length} step{current.steps.length === 1 ? "" : "s"} · starts at{" "}
                  <span style={{ fontFamily: mono }}>{current.startUrl || START_URL}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <TagEditor
                    tags={tagsOf(current)}
                    onChange={(next) => setTestTags(current.id, next)}
                  />
                  {/* Pinning is for the test that only makes sense against one
                      set — a staging-only login flow. Everything else follows
                      whatever is live, which is why "Live set" is the default and
                      names the set it currently means. */}
                  {testData.sets.length > 0 && (
                    <label style={S.dataSetPill} title="Which test data this test resolves {{names}} against">
                      <DatabaseIcon size={11} />
                      <select
                        value={current.dataSetId || ""}
                        onChange={(e) => pinDataSet(current.id, e.target.value)}
                        style={S.dataSetSelect}
                        aria-label="Test data set for this test case"
                      >
                        <option value="">
                          Live set{setFor(testData, {}) ? ` (${setFor(testData, {}).name})` : ""}
                        </option>
                        {testData.sets.map((s) => (
                          <option key={s.id} value={s.id}>
                            Always {s.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              </div>

              {history.length > 0 && (
                <RunHistoryStrip history={history} shownIdx={shownIdx} onPick={setRunIdx} />
              )}
              <Report test={current} report={report} />
            </>
          )}
        </main>
      </div>

      {newTest && (
        <NewTestDialog
          mobileBlocked={refusal("android")}
          apiBlocked={refusal("apitesting")}
          suitePath={suitePathOf(newTest.suiteId)}
          onCancel={() => setNewTest(null)}
          onStart={({ engine, app, udid, apiOnly }) => {
            setNewTest(null);
            setRecorder({
              mode: "record",
              test: null,
              suiteId: newTest.suiteId,
              engine,
              app,
              udid,
              apiOnly,
            });
          }}
        />
      )}

      {recorder && (
        <Recorder
          mode={recorder.mode}
          initialTest={recorder.test}
          suiteId={recorder.suiteId}
          // Chosen in the dialog above, before there was a recorder to ask.
          initialEngine={recorder.engine}
          initialApp={recorder.app}
          initialUdid={recorder.udid}
          initialApiOnly={recorder.apiOnly}
          suitePath={suitePathOf(recorder.test ? recorder.test.suiteId : recorder.suiteId)}
          onSave={saveRecordedTest}
          onRunComplete={recordRun}
          onHeal={applyHeals}
          refusal={refusal}
          selfHeal={selfHeal && can(user, "heal")}
          autoPlay={recorder.autoPlay}
          headless={headless}
          browser={browser}
          onBrowser={applyBrowser}
          device={device}
          onDevice={applyDevice}
          onAutoDone={() => finishScheduledRun(recorder.test.id, recorder.queued)}
          onClose={closeRecorder}
          dataSet={dataSetFor(recorder.test)}
          onDefineVar={defineVar}
        />
      )}

      {teamOpen && (
        <TeamWorkspace user={user} onImport={importTeamTest} onClose={() => setTeamOpen(false)} />
      )}

      {dataOpen && (
        <TestDataModal
          data={testData}
          onChange={saveTestData}
          tests={recorded}
          onClose={() => setDataOpen(false)}
        />
      )}

      {reportsOpen && (
        <ReportsModal
          runs={runs}
          tests={recorded}
          blocked={refusal("extent")}
          // The tree already knows how to name a suite; the modal borrows it
          // rather than walking projects a second time and disagreeing.
          suiteNameOf={(suiteId) => suitePathOf(suiteId) || "Unfiled"}
          onOpenTest={setSelectedId}
          onClose={() => setReportsOpen(false)}
        />
      )}

      {cicdOpen && (
        <CicdModal
          testData={testData}
          tests={recorded}
          parallel={parallel}
          // One object rather than eight props: the modal depends on "a suite
          // that can be scheduled and run", not on the runner internals that
          // happen to implement it today.
          suite={{
            schedule: schedules[ALL_TESTS_ID],
            onPreset: (presetId) => setSchedule(ALL_TESTS_ID, presetId),
            onTime: (time) => setScheduleTime(ALL_TESTS_ID, time),
            onRunAll: () => setQueue(recorded.map((t) => t.id)),
            onStop: () => setQueue([]),
            total: recorded.length,
            remaining: queue.length,
            running: queue.length > 0 || !!(recorder && recorder.queued),
            // A run already under way, or a recorder open over the top of one.
            busy: !!recorder || queue.length > 0,
          }}
          onClose={() => setCicdOpen(false)}
        />
      )}

      <footer style={S.footer}>
        <span style={S.footerText}>
          © {new Date().getFullYear()} {branding.name}. All rights reserved.
        </span>
        {/* Sample URLs — swap for the real profiles once they exist. */}
        <div style={S.footerSocial}>
          <a
            href="https://twitter.com/testexpress"
            target="_blank"
            rel="noreferrer"
            aria-label="Twitter"
            className="tr-social-link"
            style={S.footerSocialLink}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
          <a
            href="https://linkedin.com/company/testexpress"
            target="_blank"
            rel="noreferrer"
            aria-label="LinkedIn"
            className="tr-social-link"
            style={S.footerSocialLink}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.114 20.452H3.558V9h3.556v11.452z" />
            </svg>
          </a>
          <a
            href="https://github.com/testexpress"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub"
            className="tr-social-link"
            style={S.footerSocialLink}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.09 3.29 9.39 7.86 10.91.57.1.79-.25.79-.55v-2.15c-3.2.7-3.87-1.36-3.87-1.36-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.71.08-.71 1.17.08 1.78 1.2 1.78 1.2 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.56-.29-5.26-1.28-5.26-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.18 1.84 1.18 3.1 0 4.43-2.7 5.4-5.28 5.69.42.36.78 1.07.78 2.15v3.19c0 .31.21.66.8.55A10.51 10.51 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5z" />
            </svg>
          </a>
        </div>
      </footer>
    </div>
  );
}

// ---- new test: what am I testing? ----------------------------------------
// Asked before the recorder opens rather than inside it, because the answer
// decides what the recorder needs to have ready: a web recording starts against
// this origin immediately, while a mobile one cannot start until there is a
// device and an app on it. Choosing after the fact would mean opening a browser
// frame and then throwing it away.
// One of the two answers to "what am I testing?". Declared out here rather than
// inside NewTestDialog: a component defined in a render body is a new type on
// every render, so React unmounts and remounts it each time — which throws away
// keyboard focus the moment the async device probe resolves.
function KindRadio({ value, title, blurb, kind, onPick, blocked }) {
  const on = kind === value;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      // A radiogroup is one tab stop, and the arrow keys move within it — so the
      // unchecked option is reachable by arrow but skipped by Tab.
      tabIndex={on ? 0 : -1}
      disabled={!!blocked}
      title={blocked || undefined}
      onClick={() => onPick(value)}
      style={{
        opacity: blocked ? 0.55 : 1,
        cursor: blocked ? "not-allowed" : "pointer",
        ...REC.paletteBtn,
        // paletteBtn is sized for a one-word palette key: it has no display, so
        // flexDirection/gap would be inert, and its nowrap would push this
        // button's sentence-long blurb out past the card's edge.
        display: "flex",
        flex: "0 0 auto",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 4,
        padding: "12px 14px",
        textAlign: "left",
        whiteSpace: "normal",
        borderColor: on ? "var(--tr-accent-line)" : undefined,
        background: on ? "var(--tr-accent-bg)" : undefined,
      }}
    >
      {/* The accent stays on the dial, not the label: accent-on-accent-wash
          measures 3.1:1 in the light theme, and the border, the wash and the
          filled dial already say which one is chosen. */}
      <span style={{ fontWeight: 800, fontSize: 13 }}>
        <span aria-hidden="true" style={{ color: on ? "var(--tr-accent)" : "var(--tr-dim)" }}>
          {on ? "◉" : "○"}
        </span>{" "}
        {title}
      </span>
      <span style={{ fontSize: 11.5, color: "var(--tr-soft)", lineHeight: 1.5, fontWeight: 500 }}>{blurb}</span>
    </button>
  );
}

// The missing-Appium-server case, with the fix attached to it.
//
// The engine's diagnostic for this ends in "start one with: appium --address …
// and make sure ANDROID_HOME and JAVA_HOME are set in that shell", which is the
// hardest part of the setup handed back as homework — Android Studio sets
// neither variable, so the tester has to go and find two paths the backend can
// locate in milliseconds. It locates them, and this offers the button.
//
// Started automatically after a countdown — see ./useAutoStart for why that
// replaced the deliberate press this used to require, and what the ten seconds
// are protecting.
function AppiumStarter({ caps, onStarted }) {
  const [phase, setPhase] = useState("idle"); // idle | starting | failed
  const [err, setErr] = useState(null);
  const [secs, setSecs] = useState(0);

  // The first start loads every installed driver and can take the better part of
  // a minute. A count that is visibly moving is the difference between "slow"
  // and "hung" for someone watching it.
  useEffect(() => {
    if (phase !== "starting") return undefined;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const go = async () => {
    setErr(null);
    setSecs(0);
    setPhase("starting");
    try {
      await startAppiumServer();
      // The server being up is not the end of the story — there may still be no
      // device — so hand back to the capability probe rather than declaring
      // success here.
      await onStarted();
      setPhase("idle");
    } catch (e) {
      setErr(e.message);
      setPhase("failed");
    }
  };

  // Only when there is something to press. Where the server cannot be started
  // from here at all — no Appium, no JDK — the countdown would be promising
  // something that is never going to happen.
  const { left, cancel } = useAutoStart({ armed: !!caps.canStartServer && phase === "idle", run: go });

  const setup = caps.serverSetup || {};

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* The probe's diagnostic — but only while it is still true.
          `caps` is the answer from the last capability probe, and a probe that
          ran before the button was pressed goes on saying "no Appium server at
          127.0.0.1:4723, start one with: appium --address …" for the whole
          minute the first start takes. Beside a spinner reading "Starting
          Appium… 21s" that is a flat contradiction, and it reads as the start
          having already failed: the instruction tells you to do the thing the
          button is visibly doing. It is replaced below by what is actually
          happening, and comes back by itself if the fresh probe after the start
          still cannot find a server. */}
      {phase === "starting" ? (
        <div style={{ ...S.dataWarn, margin: 0, alignItems: "flex-start", ...S.appiumStarting }}>
          <span
            style={{ ...S.icon, ...S.spin, width: 12, height: 12, borderTopColor: "var(--tr-info)", marginTop: 2 }}
          />
          <span>
            Starting an Appium server on 127.0.0.1:4723 — nothing to do here, this window will move
            on by itself once it answers.
          </span>
        </div>
      ) : left !== null ? (
        /* The pending countdown, in place of the probe's diagnostic and for the
           same reason the branch above replaces it: that text tells you to go
           and start a server by hand, which is precisely what this is about to
           do for you. Showing both at once reads as a contradiction. */
        <div style={{ ...S.dataWarn, margin: 0, alignItems: "flex-start", ...S.appiumStarting }}>
          <span style={{ marginTop: 1 }}>⏳</span>
          <span>
            No Appium server yet — starting one on 127.0.0.1:4723 in {left}s.{" "}
            <button type="button" onClick={cancel} style={AUTO_CANCEL_BTN}>
              Not now
            </button>
          </span>
        </div>
      ) : (
        <div style={{ ...S.dataWarn, margin: 0, whiteSpace: "pre-wrap", alignItems: "flex-start" }}>
          <span>⚠</span>
          <span>{caps.reason}</span>
        </div>
      )}

      {caps.canStartServer ? (
        <>
          <button
            type="button"
            disabled={phase === "starting"}
            onClick={go}
            style={{
              ...S.btn,
              ...S.btnIcon,
              alignSelf: "flex-start",
              background: "var(--tr-accent-bg-2)",
              color: "var(--tr-accent)",
              border: "1px solid var(--tr-accent-line)",
              cursor: phase === "starting" ? "progress" : "pointer",
            }}
            title={`Runs appium --address 127.0.0.1 --port 4723 here, with JAVA_HOME and ANDROID_HOME set for it`}
          >
            {phase === "starting" ? (
              <>
                <span
                  style={{
                    ...S.icon,
                    ...S.spin,
                    width: 13,
                    height: 13,
                    borderTopColor: "var(--tr-accent)",
                  }}
                />{" "}
                Starting Appium… {secs}s
              </>
            ) : (
              <>▶ Start Appium server</>
            )}
          </button>

          {/* Not a black box: these are the two paths the tester was being asked
              to find, so show which ones were found. */}
          <div style={{ fontSize: 10.5, color: "var(--tr-dim)", lineHeight: 1.6, fontFamily: mono }}>
            {phase === "starting" ? "loading drivers — the first start is the slow one" : "will run with"}
            <div>JAVA_HOME={setup.javaHome || "?"}</div>
            <div>ANDROID_HOME={setup.sdkRoot || "?"}</div>
          </div>
        </>
      ) : (
        // Nothing to press: the server cannot be started here, and each missing
        // piece has its own install step.
        setup.missing &&
        setup.missing.length > 0 && (
          <div
            style={{
              fontSize: 11.5,
              color: "var(--tr-soft)",
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {setup.missing.map((m) => (
              <div key={m}>{m}</div>
            ))}
          </div>
        )
      )}

      {err && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 11.5, color: "var(--tr-rec)", fontWeight: 700 }}>
            Appium did not start.
          </div>
          {/* Appium's own log tail, which is the only thing that explains a
              failure like a missing driver or an occupied port. */}
          <pre
            style={{
              margin: 0,
              maxHeight: 160,
              overflow: "auto",
              fontFamily: mono,
              fontSize: 10.5,
              lineHeight: 1.5,
              color: "var(--tr-text-2)",
              background: "var(--tr-sunken)",
              border: "1px solid var(--tr-border)",
              borderRadius: 8,
              padding: 10,
              whiteSpace: "pre-wrap",
            }}
          >
            {err}
          </pre>
          <button
            type="button"
            onClick={go}
            style={{ ...S.btn, ...S.btnGhost, alignSelf: "flex-start" }}
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

// The no-device case, with the fix attached to it — the sibling of
// AppiumStarter above, and there for the same reason.
//
// The diagnostic this replaces ended in "start an emulator (Android Studio >
// Device Manager)", which is wrong in two ways on a machine that is not the
// author's. It names an IDE that need not be installed — adb, the emulator and
// a system image all come from the command-line SDK and work without it — and
// it is a detour even where Studio *is* installed, since an AVD that already
// exists can be booted from here in one press.
//
// So: list the AVDs this machine has, boot one, and fall back to instructions
// that never mention Studio when there is nothing to press.
function DeviceStarter({ caps, onStarted }) {
  const [phase, setPhase] = useState("idle"); // idle | starting | failed
  const [err, setErr] = useState(null);
  const [secs, setSecs] = useState(0);
  // The probe's own answer is the starting point; re-asked after a boot so the
  // list is right if the tester created an AVD while this was open.
  const [setup, setSetup] = useState(caps.deviceSetup || null);
  const [avd, setAvd] = useState((caps.deviceSetup?.avds || [])[0] || "");

  useEffect(() => {
    let alive = true;
    if (!caps.deviceSetup) {
      emulatorOptions().then((next) => {
        if (!alive) return;
        setSetup(next);
        setAvd((cur) => cur || (next.avds || [])[0] || "");
      });
    }
    return () => {
      alive = false;
    };
  }, [caps.deviceSetup]);

  // A cold boot runs into minutes. A number that is visibly moving is the
  // difference between "slow" and "hung" for whoever is watching it.
  useEffect(() => {
    if (phase !== "starting") return undefined;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const go = async () => {
    setErr(null);
    setSecs(0);
    setPhase("starting");
    try {
      await startEmulator(avd);
      // A booted device is not the whole story — Appium still has to see it —
      // so hand back to the capability probe rather than declaring success.
      await onStarted();
      setPhase("idle");
    } catch (e) {
      setErr(e.message);
      setPhase("failed");
    }
  };

  const avds = (setup && setup.avds) || [];
  const canStart = !!(setup && setup.canStart);

  // Waits for `avd` as well as for `canStart`: the AVD list arrives from a
  // second request, and arming before it lands would count down to a boot with
  // no device chosen. Because the hook fires once per mount rather than once
  // per arming, the countdown simply begins when the list does.
  const { left, cancel } = useAutoStart({
    armed: canStart && !!avd && phase === "idle",
    run: go,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {phase === "starting" ? (
        <div style={{ ...S.dataWarn, margin: 0, alignItems: "flex-start", ...S.appiumStarting }}>
          <span
            style={{ ...S.icon, ...S.spin, width: 12, height: 12, borderTopColor: "var(--tr-info)", marginTop: 2 }}
          />
          <span>
            Booting {avd || "the emulator"} — a cold start takes a few minutes. This waits for
            Android to finish starting, not just for the device to appear, so nothing here needs
            watching.
          </span>
        </div>
      ) : left !== null ? (
        <div style={{ ...S.dataWarn, margin: 0, alignItems: "flex-start", ...S.appiumStarting }}>
          <span style={{ marginTop: 1 }}>⏳</span>
          <span>
            No device attached — booting {(avd || "").replace(/_/g, " ") || "the emulator"} in{" "}
            {left}s.{" "}
            <button type="button" onClick={cancel} style={AUTO_CANCEL_BTN}>
              Not now
            </button>
          </span>
        </div>
      ) : (
        <div style={{ ...S.dataWarn, margin: 0, whiteSpace: "pre-wrap", alignItems: "flex-start" }}>
          <span>⚠</span>
          <span>{caps.reason}</span>
        </div>
      )}

      {canStart ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {/* Only worth a picker when there is a choice — one AVD and a
              dropdown holding it is a control that cannot be used. */}
          {avds.length > 1 && (
            <select
              value={avd}
              onChange={(e) => setAvd(e.target.value)}
              disabled={phase === "starting"}
              style={S.dataSetSelect}
              aria-label="Which virtual device to start"
            >
              {avds.map((name) => (
                <option key={name} value={name}>
                  {name.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            disabled={phase === "starting"}
            onClick={go}
            style={{
              ...S.btn,
              ...S.btnIcon,
              background: "var(--tr-accent-bg-2)",
              color: "var(--tr-accent)",
              border: "1px solid var(--tr-accent-line)",
              cursor: phase === "starting" ? "progress" : "pointer",
            }}
            title={`Runs the SDK's own emulator binary here — no Android Studio involved`}
          >
            {phase === "starting" ? (
              <>
                <span
                  style={{ ...S.icon, ...S.spin, width: 13, height: 13, borderTopColor: "var(--tr-accent)" }}
                />{" "}
                Booting… {secs}s
              </>
            ) : (
              <>▶ Start {avds.length > 1 ? "this device" : avds[0]?.replace(/_/g, " ") || "emulator"}</>
            )}
          </button>
        </div>
      ) : (
        // Nothing to press. Each missing piece carries its own sdkmanager line,
        // which is the route that exists on every machine — including the ones
        // that will never have an IDE on them.
        setup &&
        setup.missing &&
        setup.missing.length > 0 && (
          <div
            style={{
              fontSize: 11.5,
              color: "var(--tr-soft)",
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {setup.missing.map((m) => (
              <div key={m}>{m}</div>
            ))}
            <div style={{ color: "var(--tr-dim)" }}>
              A physical phone is the shorter path: enable USB debugging on it, plug it in, and adb
              alone is enough — no emulator and no system image.
            </div>
          </div>
        )
      )}

      {err && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 11.5, color: "var(--tr-rec)", fontWeight: 700 }}>
            The device did not start.
          </div>
          {/* The emulator's own output, which is the only thing that explains a
              refusal like "HAXM is not installed" or a full disk. */}
          <pre
            style={{
              margin: 0,
              maxHeight: 160,
              overflow: "auto",
              fontFamily: mono,
              fontSize: 10.5,
              lineHeight: 1.5,
              color: "var(--tr-text-2)",
              background: "var(--tr-sunken)",
              border: "1px solid var(--tr-border)",
              borderRadius: 8,
              padding: 10,
              whiteSpace: "pre-wrap",
            }}
          >
            {err}
          </pre>
          <button type="button" onClick={go} style={{ ...S.btn, ...S.btnGhost, alignSelf: "flex-start" }}>
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

function NewTestDialog({ suitePath, mobileBlocked, apiBlocked, onCancel, onStart }) {
  const [kind, setKind] = useState("web");
  const [caps, setCaps] = useState(null); // null until the backend answers
  const [udid, setUdid] = useState(null);
  // "upload" installs an APK from this machine; "installed" picks one already on
  // the device. Upload is the default because a test usually targets the build
  // you have just produced, not something already sitting on the emulator.
  const [source, setSource] = useState("upload");
  const [pkg, setPkg] = useState("");
  const [apk, setApk] = useState(null); // { label, package, fileName, versionName }
  const [busy, setBusy] = useState(null); // human-readable stage while working
  const [pct, setPct] = useState(0);
  const [err, setErr] = useState(null);
  const fileRef = useRef(null);

  // Closing the dialog mid-probe must not write to a component that is gone.
  // Re-armed on the way in, not just cleared on the way out: StrictMode mounts,
  // unmounts and remounts, so a flag only ever set to false would stay false for
  // the real mount and silently discard the answer.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Re-runnable rather than a bare on-mount effect: starting an Appium server
  // changes the answer, and so does attaching a device, so the dialog has to be
  // able to ask again without being closed and reopened.
  const probe = useCallback(async () => {
    const c = await mobileCapabilities();
    if (!alive.current) return c;
    setCaps(c);
    setUdid((cur) => cur || (c.devices && c.devices[0] ? c.devices[0].udid : null));
    return c;
  }, []);

  useEffect(() => {
    probe();
  }, [probe]);

  // Escape closes it, as it does every other overlay in here. Not while an APK
  // is uploading, though: the install is already running on the device and
  // closing would only lose the progress report for it.
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !busy && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  const devices = (caps && caps.devices) || [];
  const installedApps = ((caps && caps.apps) || []).filter(
    (a) => a.kind === "app" || /settings|calculator|contacts|clock/i.test(a.name),
  );

  // Upload, install, and read back what was installed. The package name comes
  // from the APK's own manifest — see the /apk route for why it cannot come from
  // the device.
  const chooseApk = async (file) => {
    if (!file) return;
    setErr(null);
    setApk(null);
    setPct(0);
    setBusy(`Uploading ${file.name}…`);
    try {
      const info = await installApk(file, udid, (p) => {
        setPct(p);
        // The install itself happens after the last byte lands, and on a large
        // APK that is the slower half — say so rather than sitting at 100%.
        if (p >= 100) setBusy("Installing on the device…");
      });
      setApk(info);
      setPkg(info.package);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(null);
      setPct(0);
    }
  };

  // Each source owns its own answer to "which app", so switching between them
  // has to drop the other one's. Otherwise picking an installed app and then
  // switching back to upload leaves Start enabled while the visible control
  // shows nothing selected.
  const pickSource = (next) => {
    setSource(next);
    setPkg(next === "upload" && apk ? apk.package : "");
  };

  const mobileReady = kind === "mobile" && caps && caps.available && !!pkg && !busy;
  const canStart = kind === "mobile" ? mobileReady : true;

  // Order the three kinds cycle through and are focused in — matches the
  // radios' visual order below.
  const KIND_ORDER = ["web", "api", "mobile"];
  const kindBlocked = { web: null, api: apiBlocked, mobile: mobileBlocked };

  const start = () => {
    if (kind === "mobile") return onStart({ engine: "mobile", app: pkg, udid });
    // An API-only test still runs through the web (iframe) engine — it wants
    // the same-origin session cookie a prior UI sign-in step left behind, not
    // a browser of its own. `apiOnly` only tells the recorder to open with one
    // API step already in place instead of an empty canvas.
    onStart({ engine: "web", apiOnly: kind === "api" });
  };

  return (
    // Same guard as Escape: an upload in flight is not something a stray click
    // outside the card should throw away.
    <div style={REC.backdrop} onClick={() => !busy && onCancel()}>
      <div
        style={{ ...REC.modal, width: 620, maxWidth: "94vw", height: "auto", maxHeight: "90vh", overflow: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ ...REC.head, flexWrap: "wrap" }}>
          <span style={REC.recDot} />
          <span style={{ fontWeight: 800 }}>New test</span>
          {suitePath && (
            <span style={S.crumbChip} title={`This test case will be filed under ${suitePath}`}>
              <LayersIcon size={11} /> {suitePath}
            </span>
          )}
        </div>

        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 12, color: "var(--tr-muted)", fontWeight: 700, letterSpacing: "0.06em" }}>
            WHAT ARE YOU TESTING?
          </div>
          <div
            role="radiogroup"
            aria-label="What are you testing?"
            // Three options now: skip a blocked one rather than land the
            // arrow key on a radio nobody can pick.
            onKeyDown={(e) => {
              if (!/^Arrow(Up|Down|Left|Right)$/.test(e.key)) return;
              e.preventDefault();
              const dir = e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 1;
              const at = KIND_ORDER.indexOf(kind);
              let next = KIND_ORDER[(at + dir + KIND_ORDER.length) % KIND_ORDER.length];
              if (kindBlocked[next]) {
                next = KIND_ORDER[(KIND_ORDER.indexOf(next) + dir + KIND_ORDER.length) % KIND_ORDER.length];
              }
              setKind(next);
              const radios = e.currentTarget.querySelectorAll('[role="radio"]');
              const target = radios[KIND_ORDER.indexOf(next)];
              if (target) target.focus();
            }}
            style={{ display: "flex", flexDirection: "column", gap: 10 }}
          >
            <KindRadio
              value="web"
              title="🌐 Web app"
              blurb="Record in this browser, or drive a real Chromium, Firefox or WebKit on the backend."
              kind={kind}
              onPick={setKind}
            />
            <KindRadio
              value="api"
              title="🔌 API"
              blurb={
                apiBlocked ||
                "Test REST endpoints directly — method, headers, body, checks and extracted values. No UI steps required."
              }
              blocked={apiBlocked}
              kind={kind}
              onPick={setKind}
            />
            <KindRadio
              value="mobile"
              title="📱 Mobile app"
              blurb={
                mobileBlocked ||
                "Record against a native Android app on a connected device or emulator, through Appium."
              }
              blocked={mobileBlocked}
              kind={kind}
              onPick={setKind}
            />
          </div>

          {kind === "mobile" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Say plainly what is missing rather than showing a dead Start
                  button — each cause has a different fix. */}
              {/* A missing server is the one blocker with a fix this UI can
                  perform, so it gets its own component; the rest can only be
                  explained. */}
              {caps && !caps.available && caps.blocker === "server" && (
                <AppiumStarter caps={caps} onStarted={probe} />
              )}
              {caps && !caps.available && (caps.blocker === "device" || caps.blocker === "adb") && (
                <DeviceStarter caps={caps} onStarted={probe} />
              )}
              {caps && !caps.available && !["server", "device", "adb"].includes(caps.blocker) && (
                // dataWarn carries the side margins of the steps list it was
                // written for; in this padded column they read as a misaligned
                // inset against everything else.
                <div style={{ ...S.dataWarn, margin: 0, whiteSpace: "pre-wrap", alignItems: "flex-start" }}>
                  <span>⚠</span>
                  <span>{caps.reason}</span>
                </div>
              )}
              {caps && !caps.available && caps.blocker === "device" && (
                // The device list is the one thing that changes without any
                // action here — an emulator finishes booting a few seconds after
                // it is launched — so offer a re-check rather than a reopen.
                <button
                  type="button"
                  onClick={probe}
                  style={{ ...S.btn, ...S.btnGhost, ...S.btnIcon, alignSelf: "flex-start" }}
                >
                  ↻ Check again
                </button>
              )}
              {!caps && (
                <div style={{ fontSize: 12, color: "var(--tr-dim)" }}>Checking for a device…</div>
              )}

              {caps && caps.available && (
                <>
                  <div>
                    <div style={REC.tagBarLabel}>DEVICE</div>
                    <div style={{ ...REC.pace, marginTop: 6, flexWrap: "wrap" }}>
                      {devices.map((d) => (
                        <button
                          key={d.udid}
                          type="button"
                          onClick={() => setUdid(d.udid)}
                          title={d.udid}
                          style={{ ...REC.paceBtn, ...(udid === d.udid ? REC.paceBtnActive : {}) }}
                        >
                          📱 {d.model || d.udid}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div style={REC.tagBarLabel}>APP</div>
                    <div style={{ ...REC.pace, marginTop: 6 }}>
                      <button
                        type="button"
                        onClick={() => pickSource("upload")}
                        style={{ ...REC.paceBtn, ...(source === "upload" ? REC.paceBtnActive : {}) }}
                      >
                        From this machine
                      </button>
                      <button
                        type="button"
                        onClick={() => pickSource("installed")}
                        style={{ ...REC.paceBtn, ...(source === "installed" ? REC.paceBtnActive : {}) }}
                      >
                        Already on the device
                      </button>
                    </div>
                  </div>

                  {source === "upload" ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {/* The browser never exposes a picked file's real path, so
                          the APK is uploaded and installed with adb rather than
                          handed to the device as a path. */}
                      {/* The UA styles both halves of a file input for a light
                          page — near-black filename text, a grey button — so on
                          this panel it needs its own colours. The button half
                          can only be reached from a stylesheet. */}
                      <input
                        ref={fileRef}
                        className="tr-file"
                        type="file"
                        accept=".apk,application/vnd.android.package-archive"
                        disabled={!!busy}
                        onChange={(e) => chooseApk(e.target.files && e.target.files[0])}
                        style={{ fontSize: 12.5, color: "var(--tr-text-2)", maxWidth: "100%" }}
                      />
                      {busy && (
                        <div style={{ fontSize: 12, color: "var(--tr-info)", fontWeight: 700 }}>
                          ⏳ {busy}
                          {pct > 0 && pct < 100 ? ` ${pct}%` : ""}
                        </div>
                      )}
                      {apk && (
                        <div style={{ fontSize: 12, color: "var(--tr-accent)", fontWeight: 700, lineHeight: 1.6 }}>
                          ✓ Installed {apk.label || appLabel(apk.package)}
                          {apk.versionName ? ` ${apk.versionName}` : ""}
                          <div style={{ color: "var(--tr-dim)", fontWeight: 600 }}>{apk.package}</div>
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: "var(--tr-dim)", lineHeight: 1.5 }}>
                        An .apk only — an .aab or .apks bundle has to be turned into a universal
                        APK before any device can install it.
                      </div>
                    </div>
                  ) : (
                    <select
                      value={pkg}
                      onChange={(e) => setPkg(e.target.value)}
                      // paceBtn is a transparent segment inside a bordered
                      // group; standing alone this needs its own ground, or the
                      // dropdown list renders as the UA's white-on-nothing.
                      style={{
                        ...REC.paceBtn,
                        width: "100%",
                        background: "var(--tr-sunken)",
                        color: "var(--tr-text)",
                        border: "1px solid var(--tr-border-strong)",
                        padding: "8px 9px",
                      }}
                    >
                      <option value="">choose an app…</option>
                      {installedApps.map((a) => (
                        <option key={a.name} value={a.name}>
                          {appLabel(a.name)} — {a.name}
                        </option>
                      ))}
                    </select>
                  )}
                </>
              )}

              {err && (
                <div style={{ ...S.dataWarn, margin: 0, whiteSpace: "pre-wrap", alignItems: "flex-start" }}>
                  <span>⚠</span>
                  <span>{err}</span>
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
            <button type="button" style={{ ...S.btn, ...S.btnGhost }} onClick={onCancel}>
              Cancel
            </button>
            <button
              type="button"
              style={{
                ...S.btn,
                ...S.btnRec,
                opacity: canStart ? 1 : 0.45,
                cursor: canStart ? "pointer" : "not-allowed",
              }}
              disabled={!canStart}
              onClick={start}
              title={
                canStart
                  ? "Open the recorder"
                  : kind === "mobile"
                    ? "Choose a device and an app first"
                    : ""
              }
            >
              <span style={S.recDotSm} /> Start recording
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// One-line summary of a recorded step, matching the recorder's own step list.
function describeStep(st) {
  if (st.action === "api") return describeApi(st);
  if (st.action === "fill") return `"${st.value}" → ${st.label}`;
  if (st.action === "navigate") return st.url;
  if (st.action === "wait") return `pause ${fmtMs(st.ms)}`;
  if (st.action === "implicitWait") return `auto-wait budget → ${fmtMs(st.ms)}`;
  if (st.action === "scroll") return `${st.direction} ${st.amount}px`;
  if (st.action === "reload") return `reload ${st.url || "the page"}`;
  if (st.action === "hover") return `over ${st.label || st.text || st.selector || "element"}`;
  if (st.action === "upload")
    return `${st.name}${st.truncated ? " (placeholder — too large to store)" : ""}`;
  if (st.action === "assert")
    return st.assertType === "exists" ? `exists: ${st.label}` : `has "${st.expected}"`;
  return st.label;
}

// ---- tag editor ----------------------------------------------------------
// Tags on the selected test case, editable in place. The recorder has its own
// tag row for a test being authored; this is the one for a test that already
// exists, where reopening the recorder to add "@smoke" — and having to press
// Save afterwards, on a recording you did not otherwise touch — is enough
// friction that tests simply stay untagged.
//
// Always rendered, even with no tags: a row that appears only once a test is
// tagged is a control you cannot find until you no longer need it.
//
// The recorder uses this too, for the test case being authored — so a tag is
// added the same way whether the test already exists or is being recorded right
// now. Every change is committed to the caller immediately; the only local
// state is the half-typed tag in the box.
//
// `draftRef` lets a caller with a Save button see that half-typed tag. Blur
// commits it anyway, but a save must not depend on the browser having
// dispatched blur before click — a tag typed and then saved must survive, and
// noticing later that it did not is exactly the kind of loss nobody catches.
function TagEditor({ tags, onChange, draftRef, style }) {
  const [draft, setDraft] = useState("");
  if (draftRef) draftRef.current = draft;

  const add = (text) => {
    const next = [...tags];
    parseTags(text).forEach((tag) => {
      if (!next.includes(tag)) next.push(tag);
    });
    if (next.length !== tags.length) onChange(next);
  };
  const commit = () => {
    if (!draft.trim()) return;
    add(draft);
    setDraft("");
  };
  // A separator ends a tag, so a whole line can be typed or pasted straight
  // through without knowing that Enter is expected between them.
  const onInput = (value) => {
    if (!/[\s,]/.test(value)) return setDraft(value);
    const parts = value.split(/[\s,]+/);
    const tail = parts.pop(); // may still be half-typed — leave it in the box
    add(parts.join(" "));
    setDraft(tail);
  };

  return (
    <div style={{ ...S.tagRow, marginTop: 8, alignItems: "center", gap: 5, ...style }}>
      {tags.map((tag) => (
        <span key={tag} style={{ ...S.tagChipMd, ...S.tagChipEditable }}>
          {tagLabel(tag)}
          <button
            type="button"
            // mousedown, not click: the input's onBlur fires first and can
            // re-flow this row as a chip is committed, which moves the button
            // out from under the pointer before a click would complete.
            onMouseDown={(e) => {
              e.preventDefault();
              onChange(tags.filter((t) => t !== tag));
            }}
            style={S.tagChipX}
            title={`Remove ${tagLabel(tag)}`}
            aria-label={`Remove tag ${tagLabel(tag)}`}
          >
            ✕
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => onInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Backspace" && !draft && tags.length) {
            // Nothing left to delete in the box, so delete the thing before it —
            // what every tag field does.
            onChange(tags.slice(0, -1));
          }
        }}
        onBlur={commit}
        placeholder={tags.length ? "add tag…" : "+ tag  (@smoke @regression)"}
        spellCheck={false}
        style={S.tagAddInput}
        aria-label="Tags for this test case"
      />
    </div>
  );
}

// ---- the test data editor ------------------------------------------------
// Sets on the left, the selected set's values on the right. A modal for the same
// reason User Settings is one: sending someone to another screen would unmount
// an in-progress recording, and naming a value is exactly the sort of thing you
// do in the middle of recording.
//
// Every edit writes straight through to storage, like a schedule and unlike a
// step edit. There is no Save button because there is nothing to cancel back to:
// a data set is a handful of strings, and a half-finished edit is far more likely
// to be lost to a closed tab than regretted.
function TestDataModal({ data, onChange, tests, onClose }) {
  const sets = data.sets;
  const [pickedId, setPickedId] = useState(() => setFor(data, {})?.id || null);
  const picked = sets.find((s) => s.id === pickedId) || sets[0] || null;

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const write = (nextSets, activeId) =>
    onChange({ sets: nextSets, activeId: activeId === undefined ? data.activeId : activeId });

  const patchSet = (id, patch) =>
    write(sets.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const addSet = () => {
    const name = (window.prompt("Name this data set — e.g. Staging patient") || "").trim();
    if (!name) return;
    const set = { id: `ds-${Date.now()}`, name, vars: [] };
    // The first set anyone makes becomes the live one; later ones do not steal
    // the selection from under the tests already using it.
    write([...sets, set], data.activeId || set.id);
    setPickedId(set.id);
  };

  // Copying is how the second environment gets made: the keys are the same and
  // only the values differ, so starting from a blank set means retyping the
  // names of everything.
  const duplicateSet = (set) => {
    const copy = {
      id: `ds-${Date.now()}`,
      name: `${set.name} copy`,
      vars: varsOf(set).map((v) => ({ ...v })),
      // The table comes with it. A copy made to point at another environment
      // wants the same cases run against it — that is the whole reason for
      // copying — and a copy that silently dropped them would look like the
      // rows had been lost rather than never taken.
      rows: rowsOf(set).map((r) => ({ ...r, id: `dr-${Date.now()}-${r.id}`, values: { ...rowValues(r) } })),
    };
    write([...sets, copy]);
    setPickedId(copy.id);
  };

  // How many tests would change behaviour, spelled out before the fact. A set
  // can be referred to by name from any number of recordings, and deleting one
  // does not break them loudly — they quietly start typing "{{email}}" into
  // forms.
  const deleteSet = (set) => {
    const pinned = tests.filter((t) => t.dataSetId === set.id).length;
    const keys = varsOf(set).length;
    const warning = pinned
      ? `\n\n${pinned} test${pinned === 1 ? "" : "s"} pin this set and will fall back to whichever set is live.`
      : "";
    if (!window.confirm(`Delete data set "${set.name}" and its ${keys} value${keys === 1 ? "" : "s"}?${warning}`))
      return;
    const rest = sets.filter((s) => s.id !== set.id);
    write(rest, data.activeId === set.id ? rest[0]?.id || null : data.activeId);
    if (pickedId === set.id) setPickedId(rest[0]?.id || null);
  };

  const setVars = (id, vars) => patchSet(id, { vars });

  const addVar = () => {
    if (!picked) return;
    setVars(picked.id, [...varsOf(picked), { key: "", value: "", secret: false }]);
  };

  // The key is normalised only on blur, not on every keystroke: folding as you
  // type fights the person typing — "first name" becomes "first_name" before the
  // space has finished being a space.
  const editVar = (i, patch) =>
    setVars(
      picked.id,
      varsOf(picked).map((v, k) => (k === i ? { ...v, ...patch } : v)),
    );

  const removeVar = (i) =>
    setVars(
      picked.id,
      varsOf(picked).filter((_, k) => k !== i),
    );

  // ---- rows ---------------------------------------------------------------
  // The columns of the table are the values marked "varies", in the order the
  // set declares them. There is deliberately no separate column list to manage:
  // a name exists once, in the values above, and marking it is what promotes it
  // to a column. Two lists of names would be two places to rename something.
  const cols = useMemo(() => rowKeys(picked), [picked]);
  const rows = rowsOf(picked);

  const setRows = (next) => patchSet(picked.id, { rows: next });

  const addRow = () => setRows([...rows, { id: `dr-${Date.now()}`, label: "", enabled: true, values: {} }]);

  const editRow = (i, patch) => setRows(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  // Cells are stored under the normalised key so a row written here and a row
  // arriving from a hand-edited export index the same way.
  const editCell = (i, key, value) =>
    editRow(i, { values: { ...rowValues(rows[i]), [key]: value } });

  const removeRow = (i) => setRows(rows.filter((_, k) => k !== i));

  // Copying a row is how the next case gets written: a table exists to vary one
  // field at a time, so starting from the row above beats starting from blank.
  const duplicateRow = (i) => {
    const copy = { ...rows[i], id: `dr-${Date.now()}`, values: { ...rowValues(rows[i]) } };
    setRows([...rows.slice(0, i + 1), copy, ...rows.slice(i + 1)]);
  };

  const enabledCount = rows.filter((r) => r.enabled !== false).length;

  // Grid template shared by the header and every row, so the columns line up.
  // `minmax(0, 1fr)` rather than `1fr`: a long value in a text input would
  // otherwise push the grid wider than the modal and take the delete button off
  // the edge of it.
  const rowGrid = { ...S.dataRowGrid, gridTemplateColumns: `22px 26px 130px repeat(${cols.length}, minmax(0, 1fr)) 26px 26px` };

  // Which keys a duplicate name would collide with, so the editor can say so
  // rather than silently letting the first one win at run time (see varMap).
  const dupes = useMemo(() => {
    const seen = new Set();
    const bad = new Set();
    varsOf(picked).forEach((v) => {
      const k = normKey(v.key);
      if (!k) return;
      if (seen.has(k)) bad.add(k);
      seen.add(k);
    });
    return bad;
  }, [picked]);

  return (
    <div style={S.setBackdrop} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={S.setCard} role="dialog" aria-modal="true" aria-label="Test data">
        <div style={S.setHead}>
          <DatabaseIcon size={15} />
          <span style={S.setTitle}>Test Data</span>
          <button onClick={onClose} style={S.setClose} title="Close" aria-label="Close test data" autoFocus>
            <XIcon size={13} />
          </button>
        </div>

        <div style={S.setBody}>
          <section style={S.setSection}>
            <div style={S.setRowHint}>
              A step can refer to a value by name — <code>{"{{email}}"}</code> — instead of the text
              that was typed while recording. Playback substitutes whatever the live set says, so one
              edit here changes every test that uses it, and an exported Playwright spec carries the
              same values.
            </div>
          </section>

          <section style={S.setSection}>
            <div style={S.setSectionLabel}>Data sets</div>
            {!sets.length ? (
              <div style={S.setRow}>
                <div style={S.setRowText}>
                  <div style={S.setRowName}>No data sets yet</div>
                  <div style={S.setRowHint}>
                    One set per environment is the usual shape — a staging login and a local one,
                    holding the same names with different values.
                  </div>
                </div>
                <button style={{ ...S.btn, ...S.btnAccent, ...S.btnIcon }} onClick={addSet}>
                  <PlusIcon size={12} /> New data set
                </button>
              </div>
            ) : (
              <div style={S.dataLayout}>
                <div style={S.dataSetList}>
                  {sets.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setPickedId(s.id)}
                      style={{ ...S.dataSetRow, ...(picked && s.id === picked.id ? S.dataSetRowOn : {}) }}
                      title={
                        s.id === data.activeId
                          ? `"${s.name}" is live — tests use it unless they pin another`
                          : `Show the values in "${s.name}"`
                      }
                    >
                      {/* The live set is marked, because which one is live is the
                          single fact that decides what every unpinned test does. */}
                      <span
                        style={{
                          ...S.ownerDotSm,
                          width: 7,
                          height: 7,
                          padding: 0,
                          background: s.id === data.activeId ? "var(--tr-accent)" : "#334155",
                          border: "none",
                        }}
                      />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.name}
                      </span>
                      {/* Marks the sets that are tables. Which set is live
                          decides how many times every unpinned test runs, so a
                          list that showed only value counts would hide the one
                          difference that changes a run from 1 pass to 12. */}
                      {hasRows(s) && (
                        <span style={{ ...S.iterPill, marginLeft: "auto" }} title={`Runs ${iterationsOf(s).length} times — one per enabled row`}>
                          ×{iterationsOf(s).length}
                        </span>
                      )}
                      <span style={{ ...S.dataSetCount, marginLeft: hasRows(s) ? 6 : "auto" }}>{varsOf(s).length}</span>
                    </button>
                  ))}
                  <button style={{ ...S.dataToolBtn, justifyContent: "center", marginTop: 4 }} onClick={addSet}>
                    <PlusIcon size={10} /> New set
                  </button>
                </div>

                {picked && (
                  <div style={S.dataGrid}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                      <input
                        value={picked.name}
                        onChange={(e) => patchSet(picked.id, { name: e.target.value })}
                        style={{ ...S.dataInput, width: 190, fontFamily: "inherit", fontWeight: 700 }}
                        aria-label="Data set name"
                      />
                      {picked.id === data.activeId ? (
                        <span style={S.roleChip}>live</span>
                      ) : (
                        <button
                          style={S.dataToolBtn}
                          onClick={() => write(sets, picked.id)}
                          title="Make this the set every test uses unless it pins another"
                        >
                          Make live
                        </button>
                      )}
                      <span style={{ flex: 1 }} />
                      <button style={S.dataToolBtn} onClick={() => duplicateSet(picked)} title="Copy this set's names and values into a new set">
                        <CopyIcon size={10} /> Duplicate
                      </button>
                      <button
                        style={{ ...S.dataToolBtn, color: "var(--tr-rec)", borderColor: "rgba(248,113,113,0.4)" }}
                        onClick={() => deleteSet(picked)}
                      >
                        <TrashIcon size={10} /> Delete set
                      </button>
                    </div>

                    {varsOf(picked).length > 0 && (
                      <div style={S.dataHeadRow}>
                        <span>Name</span>
                        <span>Value</span>
                        <span />
                        <span />
                        <span />
                      </div>
                    )}
                    {varsOf(picked).map((v, i) => (
                      <div key={i}>
                        <div style={S.dataVarRow}>
                          <input
                            value={v.key}
                            placeholder="email"
                            spellCheck={false}
                            onChange={(e) => editVar(i, { key: e.target.value })}
                            onBlur={(e) => editVar(i, { key: normKey(e.target.value) })}
                            style={{
                              ...S.dataInput,
                              ...(dupes.has(normKey(v.key)) ? { borderColor: "rgba(248,113,113,0.6)" } : {}),
                            }}
                            aria-label="Value name"
                          />
                          <input
                            value={v.value}
                            placeholder="priya@example.com"
                            spellCheck={false}
                            // A masked value would be unreadable to whoever is
                            // fixing it, so a secret is hidden the way a password
                            // field is — by the browser, and revealable.
                            type={v.secret ? "password" : "text"}
                            onChange={(e) => editVar(i, { value: e.target.value })}
                            style={S.dataInput}
                            aria-label={`Value for ${v.key || "this entry"}`}
                          />
                          {/* Promotes this value to a column of the row table
                              below. The value above stays as the one used when
                              the set has no rows at all, so marking something
                              and then adding no rows changes nothing — which is
                              what makes this safe to press to find out. */}
                          <button
                            onClick={() => editVar(i, { perRow: !v.perRow })}
                            // A secret cannot be a column: a row cell has no
                            // environment variable to hide behind, so it could
                            // only be written into the exported spec in plain
                            // text. rowKeys refuses it anyway; this stops the
                            // press that would look like it had worked.
                            disabled={!!v.secret}
                            style={{
                              ...S.dataSecretBtn,
                              ...(v.perRow && !v.secret ? S.dataVariesOn : {}),
                              ...(v.secret ? { opacity: 0.45, cursor: "not-allowed" } : {}),
                            }}
                            title={
                              v.secret
                                ? "A secret cannot vary by row — a row cell would have to be written into the exported spec in plain text. Unmark secret first."
                                : v.perRow
                                  ? "A column of the row table — each row supplies its own value, and the test runs once per row"
                                  : "Shared by every row. Mark it to give each row its own value for this name."
                            }
                            aria-pressed={!!v.perRow && !v.secret}
                          >
                            {v.perRow && !v.secret ? "varies" : "shared"}
                          </button>
                          <button
                            // Marking something secret drops it out of the row
                            // table in the same press, so the two flags can
                            // never both be set — including on a set that
                            // arrived from a hand-edited import with both.
                            onClick={() => editVar(i, { secret: !v.secret, ...(v.secret ? {} : { perRow: false }) })}
                            style={{ ...S.dataSecretBtn, ...(v.secret ? S.dataSecretOn : {}) }}
                            title={
                              v.secret
                                ? "Hidden in the steps list and reports, and left out of exported specs. Not encrypted — it is in this browser's storage as typed."
                                : "Mark as a secret: hidden on screen and replaced by an environment variable in exported specs"
                            }
                            aria-pressed={!!v.secret}
                          >
                            {v.secret ? "secret" : "plain"}
                          </button>
                          <button
                            onClick={() => removeVar(i)}
                            style={{ ...REC.toolBtn, color: "var(--tr-rec)" }}
                            title="Delete this value"
                            aria-label={`Delete ${v.key || "this entry"}`}
                          >
                            <TrashIcon size={11} />
                          </button>
                        </div>
                        {dupes.has(normKey(v.key)) && (
                          <div style={{ ...S.dataMissing, margin: "-2px 0 6px" }}>
                            two entries are called {`{{${normKey(v.key)}}}`} — only the first will be
                            used
                          </div>
                        )}
                      </div>
                    ))}
                    <button style={{ ...S.dataToolBtn, marginTop: 4 }} onClick={addVar}>
                      <PlusIcon size={10} /> Add value
                    </button>

                    {/* ---- the row table ---------------------------------
                        Only offered once something is marked "varies". A table
                        with no columns is a table with nothing to say, and
                        showing an empty grid to everyone who opens this modal
                        would make the common case — one set of values, one run
                        — look unfinished. */}
                    <div style={{ ...S.setSectionLabel, marginTop: 18 }}>Rows</div>
                    {!cols.length ? (
                      <div style={S.setRowHint}>
                        Mark a value above as <b>varies</b> to turn this set into a table. The test
                        then runs once per row — twelve logins, twelve results — instead of once.
                        Everything left as <b>shared</b> keeps its single value across every row, so
                        a base URL is written once rather than twelve times.
                      </div>
                    ) : (
                      <>
                        <div style={{ ...rowGrid, marginBottom: 4 }}>
                          <span />
                          <span />
                          <span style={S.dataRowHead}>Label</span>
                          {cols.map((key) => (
                            <span key={key} style={{ ...S.dataRowHead, fontFamily: mono, textTransform: "none" }}>
                              {`{{${key}}}`}
                            </span>
                          ))}
                          <span />
                          <span />
                        </div>

                        {rows.map((r, i) => {
                          const values = rowValues(r);
                          const off = r.enabled === false;
                          return (
                            <div key={r.id} style={{ ...rowGrid, opacity: off ? 0.45 : 1 }}>
                              <span style={S.dataRowNum}>{i + 1}</span>
                              {/* Skipping a row without deleting it. The row that
                                  reproduces a bug is worth keeping while the bug
                                  is open, and re-typing it later is how it stops
                                  being kept. */}
                              <input
                                type="checkbox"
                                checked={!off}
                                onChange={(e) => editRow(i, { enabled: e.target.checked })}
                                title={off ? "Skipped — this row will not run" : "Runs"}
                                aria-label={`Run row ${i + 1}`}
                                style={{ accentColor: "var(--tr-accent)", cursor: "pointer" }}
                              />
                              <input
                                value={r.label || ""}
                                placeholder={rowLabel(picked, r, i)}
                                onChange={(e) => editRow(i, { label: e.target.value })}
                                style={S.dataInput}
                                // Optional: the placeholder shows what the row
                                // will be called if nothing is typed, which for
                                // most rows reads better than anything would.
                                title="What this row is called in the report. Left blank, its values name it."
                                aria-label={`Label for row ${i + 1}`}
                              />
                              {cols.map((key) => (
                                <input
                                  key={key}
                                  value={values[key] == null ? "" : values[key]}
                                  onChange={(e) => editCell(i, key, e.target.value)}
                                  spellCheck={false}
                                  style={S.dataInput}
                                  aria-label={`${key} for row ${i + 1}`}
                                />
                              ))}
                              <button
                                onClick={() => duplicateRow(i)}
                                style={{ ...REC.toolBtn }}
                                title="Copy this row"
                                aria-label={`Copy row ${i + 1}`}
                              >
                                <CopyIcon size={11} />
                              </button>
                              <button
                                onClick={() => removeRow(i)}
                                style={{ ...REC.toolBtn, color: "var(--tr-rec)" }}
                                title="Delete this row"
                                aria-label={`Delete row ${i + 1}`}
                              >
                                <TrashIcon size={11} />
                              </button>
                            </div>
                          );
                        })}

                        <button style={{ ...S.dataToolBtn, marginTop: 4 }} onClick={addRow}>
                          <PlusIcon size={10} /> Add row
                        </button>

                        <div style={{ ...S.setRowHint, marginTop: 10 }}>
                          {rows.length === 0 ? (
                            <>
                              No rows yet — the set still runs once, using the values above. Add one
                              per case you want covered.
                            </>
                          ) : (
                            <>
                              A test using this set runs <b>{enabledCount}</b>{" "}
                              time{enabledCount === 1 ? "" : "s"}, once per enabled row, and reports
                              each separately. A blank cell means an empty value, not the shared one
                              — which is how "submit with no email" is written as a row.
                            </>
                          )}
                        </div>
                      </>
                    )}

                    <div style={{ ...S.setRowHint, marginTop: 12 }}>
                      Secrets are hidden on screen and exported as an environment variable rather
                      than written into the spec file. They are <b>not encrypted</b> — like every
                      other thing here they sit in this browser's storage as typed, so treat this as
                      keeping a password off a shared screen, not as protecting it.
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          <section style={S.setSection}>
            <div style={S.setSectionLabel}>Generated values</div>
            <div style={S.setRowHint}>
              These need no entry above — they produce a new value on every run, which is what lets a
              signup test pass twice. One value per run: <code>{"{{$email}}"}</code> in a form and the
              same token in a later assertion resolve to the same address.
            </div>
            <div style={{ marginTop: 8 }}>
              {DYNAMIC_TOKENS.map((t) => (
                <div key={t.token} style={S.dataTokenRow}>
                  <span style={{ fontFamily: mono, color: "var(--tr-accent)", flexShrink: 0 }}>{t.ref}</span>
                  <span style={{ color: "var(--tr-muted)", textAlign: "right" }}>{t.hint}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div style={S.setFoot}>
          <button style={{ ...S.btn, ...S.btnGhost }} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- test data, per field ------------------------------------------------
// The strip under a step's value box. Three jobs, all of them about the gap
// between what a step says and what it will do:
//   * a literal offers to become a named value;
//   * a reference shows what it currently resolves to, since "{{email}}" says
//     nothing about whether the live set still has an email in it;
//   * a reference to a key nothing provides is called out here, where it can be
//     fixed, rather than at run time where it looks like the app's fault.
function DataFieldTools({ text, dataSet, onExtract, onInsert }) {
  const raw = typeof text === "string" ? text : "";
  const refs = useMemo(() => auditSteps([{ value: raw }], dataSet), [raw, dataSet]);
  // Frozen: stored values are substituted, dynamic tokens are left standing.
  // Their value is genuinely unknown until the run, and showing a sample here
  // would be inventing one.
  const preview = useMemo(() => {
    if (!hasRef(raw)) return null;
    return resolveStep({ value: raw }, makeResolver(dataSet, { frozen: true })).value;
  }, [raw, dataSet]);

  return (
    <div style={S.dataTools}>
      {preview == null ? (
        <button
          style={S.dataToolBtn}
          onClick={onExtract}
          disabled={!raw}
          title={
            raw
              ? "Move this value into test data and refer to it by name, so other tests can use it and changing it is one edit"
              : "Nothing to name yet — type a value first"
          }
        >
          <DatabaseIcon size={10} /> Use test data
        </button>
      ) : (
        <span style={S.dataPreview} title="What this step will use when it runs">
          → <span style={{ fontFamily: mono }}>{preview}</span>
        </span>
      )}
      {onInsert && (
        <select
          value=""
          onChange={(e) => e.target.value && onInsert(e.target.value)}
          style={S.dataTokenSelect}
          title="Insert a value generated fresh on every run — what makes a signup test runnable twice"
        >
          <option value="">+ generated…</option>
          {DYNAMIC_TOKENS.map((t) => (
            <option key={t.token} value={t.ref}>
              {t.label}
            </option>
          ))}
        </select>
      )}
      {refs.missing.length > 0 && (
        <span style={S.dataMissing}>
          no value for {refs.missing.map((k) => `{{${k}}}`).join(", ")}
        </span>
      )}
    </div>
  );
}

// ---- empty-list diagnostics ---------------------------------------------
// Shown instead of a bare "nothing here": tests are scoped to one origin, so
// the two questions worth answering are "which origin am I on" and "is the data
// there but unreadable". Both are facts, not guesses.
function StorageDiagnostics({ onRecover }) {
  const info = storageReport();
  const unreadable = info.bytes > 0;

  return (
    <div style={S.emptyState}>
      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--tr-text-2)", marginBottom: 6 }}>
        No recorded tests on this origin
      </div>
      <div style={{ fontSize: 13, color: "var(--tr-dim)", maxWidth: 460, lineHeight: 1.6, marginBottom: 14 }}>
        Tests are stored per origin. If you previously ran the app on a different
        port or host, they are still safe there — open it and use{" "}
        <b style={{ color: "var(--tr-text-2)" }}>Export</b>, then{" "}
        <b style={{ color: "var(--tr-text-2)" }}>Import</b> here.
      </div>

      <div style={S.diagBox}>
        <div>
          <span style={S.diagKey}>origin </span>
          {info.origin || "(unknown)"}
        </div>
        <div>
          <span style={S.diagKey}>key    </span>
          {RECORDED_KEY}
        </div>
        <div>
          <span style={S.diagKey}>value  </span>
          {info.error
            ? `unreadable — ${info.error}`
            : info.raw === null
              ? "not present"
              : `${info.bytes} bytes present but no tests parsed`}
        </div>
      </div>

      {unreadable && (
        <div style={{ fontSize: 12.5, color: "var(--tr-warn)", marginTop: 10, maxWidth: 460 }}>
          There is data under that key that didn't parse into a test list. It has
          not been overwritten — check the browser console for the parse error.
        </div>
      )}

      {info.candidates.length > 0 && (
        <div style={{ marginTop: 16, width: "100%", maxWidth: 460 }}>
          <div style={{ fontSize: 12, color: "var(--tr-soft)", marginBottom: 8 }}>
            Found test-shaped data under other keys:
          </div>
          {info.candidates.map((c) => (
            <div key={c.key} style={S.diagCandidate}>
              <span style={{ fontFamily: mono, fontSize: 11.5, color: "var(--tr-text)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                {c.key}
              </span>
              <span style={{ fontSize: 11.5, color: "var(--tr-dim)" }}>
                {c.tests.length} test{c.tests.length === 1 ? "" : "s"}
              </span>
              <button style={{ ...S.btn, ...S.btnRun, padding: "5px 10px", fontSize: 12 }} onClick={() => onRecover(c.tests)}>
                Recover
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Hand a string to the browser as a file. Module scope rather than inside the
// runner: the CI/CD modal needs it too, and a second copy is the drift that ends
// with one of them writing the wrong mime type.
const download = (text, filename, type) => {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

// ---- test generation -----------------------------------------------------
// Recordings become code in ./testrunner/pom, as a Page Object Model: locators
// on a class per page, specs that name only methods. That module in turn asks
// ./testrunner/spec and ./testrunner/mobileSpec what a single step compiles to,
// so there is exactly one step-to-code mapping per runner. Two would drift the
// first time a new step action was added — silently, as code missing that step.
//
// Three callers share it: "Export spec" here, the recorder's live CODE view,
// and scripts/review-tests.js, which writes the conventional multi-file layout
// from Node.

// ---- paging one container's test cases -----------------------------------
// Deliberately quiet: this is not an action you take, it is a note on where
// you are in a list. So it reads as a caption with two buttons rather than as
// another row of the tree competing with the suites around it.
function TreePager({ page, pages, from, to, total, onPage }) {
  // The rail's ancestors toggle folds on click; a page turn must not also
  // collapse the suite it belongs to.
  const step = (delta) => (e) => {
    e.stopPropagation();
    onPage(Math.min(pages - 1, Math.max(0, page + delta)));
  };
  const atStart = page === 0;
  const atEnd = page >= pages - 1;
  return (
    <div style={S.pager} onClick={(e) => e.stopPropagation()}>
      <span style={S.pagerLabel}>
        {from}–{to} of {total}
      </span>
      <span style={{ flex: 1 }} />
      <button
        style={{ ...S.pagerBtn, opacity: atStart ? 0.3 : 1, cursor: atStart ? "default" : "pointer" }}
        disabled={atStart}
        onClick={step(-1)}
        title="Previous page of test cases"
        aria-label="Previous page of test cases"
      >
        <CaretIcon dir="left" />
      </button>
      <button
        style={{ ...S.pagerBtn, opacity: atEnd ? 0.3 : 1, cursor: atEnd ? "default" : "pointer" }}
        disabled={atEnd}
        onClick={step(1)}
        title="Next page of test cases"
        aria-label="Next page of test cases"
      >
        <CaretIcon dir="right" />
      </button>
    </div>
  );
}

// ---- the report ---------------------------------------------------------
/**
 * The projects rail collapsed: a slim strip carrying the control that
 * restores it, plus the project and test counts.
 *
 * A strip rather than nothing at all. Collapsing to zero width and floating
 * a re-open button over the report was the alternative, but that button's
 * position then depends on what the report happens to be showing, and a
 * control that moves is a control people stop finding. The strip gives it a
 * fixed edge to live on.
 *
 * @param {number} projects how many projects exist
 * @param {number} tests how many test cases exist
 * @param {() => void} onExpand re-opens the rail
 */
function RailStub({ projects, tests, onExpand }) {
  return (
    <div style={S.railStub}>
      <button
        onClick={onExpand}
        style={{ ...S.pagerBtn, cursor: "pointer" }}
        title="Show the projects rail"
        aria-label="Show the projects rail"
      >
        <CaretIcon dir="right" />
      </button>
      <span style={S.railStubLabel}>
        PROJECTS {projects} · {tests}
      </span>
    </div>
  );
}

// A Playwright-HTML-report-style view of the last playback: overall verdict,
// step timings, and the failure that stopped the run. Before a test has ever
// been played this degrades to a plain listing of its steps.

const fmtMs = (ms) =>
  ms == null ? "" : ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(ms < 10000 ? 2 : 1)}s`;

const fmtWhen = (ts) => {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleString();
};

/**
 * A wall-clock run stamp: date on the first line, time on the second.
 *
 * The reports table wants the real date and time, not fmtWhen's relative age —
 * rows there are read against each other, and "19 min ago" next to a dated row
 * cannot be compared without doing the arithmetic yourself. Stacked rather than
 * one line because the WHEN column is under 90px, where a single
 * toLocaleString() truncates exactly at the seconds.
 */
function RunStamp({ ts }) {
  const d = new Date(ts);
  return (
    <>
      <span style={{ display: "block" }}>{d.toLocaleDateString()}</span>
      <span style={{ display: "block", color: "var(--tr-dim)" }}>{d.toLocaleTimeString()}</span>
    </>
  );
}

// ---- run history ---------------------------------------------------------
// The last few runs as bars: height is duration relative to the slowest of
// them, colour is the outcome. Oldest on the left, so the row reads as time
// passing rather than as an unordered set.
function Sparkline({ runs, count = 5, height = 16 }) {
  const recent = runs.slice(0, count).reverse();
  const slowest = Math.max(1, ...recent.map((r) => r.durationMs || 0));
  return (
    <span
      style={{ ...S.spark, height }}
      title={`last ${recent.length} run${recent.length === 1 ? "" : "s"}, oldest first`}
    >
      {recent.map((r, i) => (
        <span
          key={i}
          style={{
            ...S.sparkBar,
            // A floor, not a true zero: a run that took no measurable time
            // still happened, and an invisible bar reads as a gap in history.
            height: `${Math.max(20, ((r.durationMs || 0) / slowest) * 100)}%`,
            background: r.status === "failed" ? "#ef4444" : "#22c55e",
          }}
        />
      ))}
    </span>
  );
}

// The full history for the selected test, and the way you get at an earlier
// report. Every bar is a run you can open — which is the point of keeping
// them: comparing today's failure against the last time it passed is how you
// find what changed.
function RunHistoryStrip({ history, shownIdx, onPick }) {
  const stats = runStats(history);
  const slowest = Math.max(1, ...history.map((r) => r.durationMs || 0));
  // Index is newest-first; render reversed so time runs left to right.
  const ordered = history.map((r, i) => ({ r, i })).reverse();
  return (
    <div style={S.histBar}>
      <span style={S.histLabel}>
        <HistoryIcon size={13} /> History
      </span>
      <div style={S.histTrack}>
        {ordered.map(({ r, i }) => (
          <button
            key={i}
            onClick={() => onPick(i)}
            style={{ ...S.histBtn, ...(i === shownIdx ? S.histBtnActive : {}) }}
            title={`${fmtWhen(r.startedAt)} — ${r.status} in ${fmtMs(r.durationMs)}${
              i === 0 ? " (latest)" : ""
            }`}
            aria-label={`Show the run from ${fmtWhen(r.startedAt)}, ${r.status}`}
            aria-pressed={i === shownIdx}
          >
            <span
              style={{
                ...S.histBarInner,
                height: `${Math.max(22, ((r.durationMs || 0) / slowest) * 100)}%`,
                background: r.status === "failed" ? "#ef4444" : "#22c55e",
              }}
            />
          </button>
        ))}
      </div>
      <span style={{ flex: 1 }} />
      {stats.flaky && (
        <span style={S.flakyChip} title={`${stats.failed} of the last ${stats.total} runs failed`}>
          flaky
        </span>
      )}
      <span style={S.histStat}>
        {stats.passed}/{stats.total} passed
      </span>
      {/* Only offered when you have actually gone back — otherwise it is a
          button that does nothing, sitting next to one that does. */}
      {shownIdx > 0 && (
        <button style={{ ...S.btn, ...S.btnGhost, padding: "4px 10px", fontSize: 11.5 }} onClick={() => onPick(0)}>
          ↩ Latest
        </button>
      )}
    </div>
  );
}

// Where a run happened, spelled out. "" is not a Playwright engine — it
// is this very browser driving an iframe — and conflating the two would make a
// report claim a cross-browser result it never had.
const runBrowserTitle = (id) =>
  id === ""
    ? "Ran in this browser,  (iframe engine)"
    : `Ran in ${browserLabel(id)} on the backend (real browser engine)`;

function Report({ test, report }) {
  // Failure evidence is stored apart from the report (IndexedDB — see
  // trShots.js), so it is fetched when a report is actually looked at. null
  // means "still loading"; an empty bundle means "this run has none", which is
  // what every passing run looks like, along with runs from before this existed
  // and runs whose shot has since been pruned.
  const reportId = report ? report.id : null;

  // A data-driven run holds one set of step results per row rather than one for
  // the run — see the note where the report is built. Everything below renders
  // exactly one of them, which is what let the rest of this panel stay as it
  // was: the strip picks which, and the step list never learns that rows exist.
  const iterations = (report && report.iterations) || null;
  const [iterIdx, setIterIdx] = useState(0);

  // Open on the first row that failed. A twelve-row report is opened to find
  // out which input broke it, and landing on row 1 — green, like most of them —
  // hides that answer behind eleven clicks.
  useEffect(() => {
    if (!iterations) return;
    const firstBad = iterations.findIndex((it) => it.status === "failed");
    setIterIdx(firstBad >= 0 ? firstBad : 0);
    // Keyed on the run, not on `iterations`: a new array identity every render
    // would reset the selection the moment anyone clicked another row.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  // Clamped on read for the same reason the run history is: a report with fewer
  // rows than the one before it must not leave the selection past the end.
  const shownIter = iterations ? iterations[Math.min(iterIdx, iterations.length - 1)] : null;

  // Without a run, show the recorded steps as "not yet run".
  const rows = shownIter
    ? shownIter.steps
    : report
      ? report.steps
      : test.steps.map((st) => ({
          verb: stepVerb[st.action] || st.action,
          label: describeStep(st),
          status: "idle",
          durationMs: null,
          error: null,
        }));

  const [shots, setShots] = useState(null);
  const [zoom, setZoom] = useState(null); // { shot, css, title } shown full size
  useEffect(() => {
    setShots(null);
    if (!reportId) return undefined;
    let live = true;
    loadShots(reportId).then((bundle) => {
      if (live) setShots(bundle || { css: null, steps: {} });
    });
    return () => {
      live = false;
    };
  }, [reportId]);
  // Looking at a different run must not leave the previous run's picture open.
  useEffect(() => setZoom(null), [reportId]);

  const counts = rows.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }), {});
  const slowest = Math.max(1, ...rows.map((r) => r.durationMs || 0));
  const failed = report && report.status === "failed";

  return (
    <>
      <div style={{ ...S.reportBar, borderColor: report ? (failed ? "#7f1d1d" : "#14532d") : "var(--tr-border)" }}>
        {report ? (
          <>
            <span style={{ ...S.verdict, background: failed ? "#ef4444" : "#22c55e", color: failed ? "#fff" : "#052e16" }}>
              {failed ? "✕ Failed" : "✓ Passed"}
            </span>
            <span style={S.reportStat}>
              <b style={{ color: "var(--tr-pass)" }}>{counts.passed || 0}</b> passed
            </span>
            {counts.failed > 0 && (
              <span style={S.reportStat}>
                <b style={{ color: "var(--tr-rec)" }}>{counts.failed}</b> failed
              </span>
            )}
            {counts.skipped > 0 && (
              <span style={S.reportStat}>
                <b style={{ color: "var(--tr-soft)" }}>{counts.skipped}</b> skipped
              </span>
            )}
            {/* Never folded into the pass count. A run that only stayed green
                because two locators rewrote themselves is a different thing
                from one that stayed green on its own, and the difference is
                exactly what a reviewer needs to see from here. */}
            {report.healed > 0 && (
              <span style={S.reportStat}>
                <b style={{ color: "var(--tr-pick)" }}>{report.healed}</b> healed
              </span>
            )}
            {/* How many rows passed, which for a data-driven run is the
                headline — the step counts beside it belong to whichever single
                row is open below. */}
            {iterations && (
              <span style={S.reportStat} title="Rows of the data set that passed">
                <b style={{ color: iterations.every((it) => it.status === "passed") ? "var(--tr-pass)" : "var(--tr-rec)" }}>
                  {iterations.filter((it) => it.status === "passed").length}/{iterations.length}
                </b>{" "}
                rows
              </span>
            )}
            <span style={{ flex: 1 }} />
            {/* Which browser produced this verdict. Absent on runs recorded
                before the report carried it — say nothing rather than guess
                Chromium, which would be a claim about a run nobody watched. */}
            {report.browser && (
              <span style={S.browserChip} title={runBrowserTitle(report.browser)}>
                {(() => {
                  const Glyph = browserIconFor(report.browser);
                  return <Glyph size={11} />;
                })()}
                {report.browser === "" ? "" : browserLabel(report.browser)}
              </span>
            )}
            <span style={S.reportStat}>{fmtMs(report.durationMs)}</span>
            <span style={{ ...S.reportStat, color: "var(--tr-muted)" }}>{fmtWhen(report.startedAt)}</span>
          </>
        ) : (
          <>
            <span style={{ ...S.verdict, background: "var(--tr-border)", color: "var(--tr-soft)" }}>◌ Not run</span>
            <span style={S.reportStat}>Press ▶ Play to run this test and produce a report.</span>
          </>
        )}
      </div>

      {/* One chip per row of the data set this run was driven by. The whole
          point of a table is comparing rows, so they are laid out side by side
          and the verdict travels with the label — which row failed is readable
          without opening any of them. */}
      {iterations && (
        <div style={S.iterStrip}>
          <span style={{ ...S.reportStat, color: "var(--tr-muted)", flexShrink: 0 }}>
            <DatabaseIcon size={11} />{" "}
            {report.dataSet ? report.dataSet : "rows"}
          </span>
          {iterations.map((it, k) => {
            const bad = it.status === "failed";
            return (
              <button
                key={it.index}
                onClick={() => setIterIdx(k)}
                style={{
                  ...S.iterChip,
                  ...(k === Math.min(iterIdx, iterations.length - 1) ? S.iterChipOn : {}),
                  ...(bad ? { borderColor: "rgba(248,113,113,0.5)" } : {}),
                }}
                title={`Row ${it.index + 1}: ${it.label} — ${bad ? "failed" : "passed"} in ${fmtMs(it.durationMs)}`}
              >
                <span style={{ color: bad ? "var(--tr-rec)" : "var(--tr-pass)", fontWeight: 800 }}>
                  {bad ? "✕" : "✓"}
                </span>
                <span
                  style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  {it.label}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div style={S.steps}>
        {rows.map((r, i) => {
          // A literal, not a token: this value gets "55" appended for the
          // border, and "var(--x)55" is not a colour.
          const color = ACTION_COLORS[r.verb] || "#94a3b8";
          return (
            <div key={i} style={S.stepRow}>
              <div style={S.stepGutter}>
                {report ? <StatusIcon status={r.status} /> : <span style={S.stepNum}>{String(i + 1).padStart(2, "0")}</span>}
                {i < rows.length - 1 && <div style={S.stepLine} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={S.stepTop}>
                  <span style={{ ...S.actionTag, color, borderColor: color + "55" }}>{r.verb}</span>
                  <span
                    style={{
                      ...S.stepName,
                      opacity: r.status === "skipped" ? 0.45 : 1,
                      color: r.status === "failed" ? "var(--tr-rec)" : "var(--tr-text)",
                    }}
                  >
                    {r.label}
                  </span>
                  <span style={{ flex: 1 }} />
                  {r.healed && (
                    <span
                      style={S.healChip}
                      title={
                        `Self-healed: ${r.healed.why}` +
                        (r.healed.from ? `

was   ${r.healed.from}` : "") +
                        `
now   ${r.healed.to || r.healed.selector}` +
                        `

The repaired locator has been saved to this test, with the old one kept behind it.`
                      }
                    >
                      ✚ healed
                    </span>
                  )}
                  {r.holdMs > 0 && (
                    <span style={S.holdChip} title="Explicit hold after this step, excluded from the step time">
                      ⏳ +{fmtMs(r.holdMs)} hold
                    </span>
                  )}
                  {r.durationMs != null && (
                    <>
                      <span style={S.durTrack}>
                        <span
                          style={{
                            ...S.durBar,
                            width: `${Math.max(4, (r.durationMs / slowest) * 100)}%`,
                            background: r.status === "failed" ? "#ef4444" : "var(--tr-border-strong)",
                          }}
                        />
                      </span>
                      <span style={S.dur}>{fmtMs(r.durationMs)}</span>
                    </>
                  )}
                </div>
                {r.error && (
                  <div style={S.errBox}>
                    <span style={S.errText}>{r.error}</span>
                    <CopyButton text={r.error} title="Copy this error message" />
                  </div>
                )}
                {/* The page as it stood when this step failed — nothing here on
                    a step that passed. Below the error, not above: the message
                    says what went wrong, the picture says what it looked like. */}
                {/* Only the iteration that actually failed carries a shot —
                    the store holds one per run — and `r.shot` is how this row
                    knows whether it is that one. Reading shots.steps[i] alone
                    would show row 1 the picture row 7 produced. */}
                <StepShot
                  shot={r.shot && shots ? shots.steps[i] : null}
                  css={shots && shots.css}
                  loading={!!r.shot && shots === null}
                  expected={!!r.shot}
                  onOpen={() =>
                    setZoom({
                      shot: shots.steps[i],
                      css: shots.css,
                      title: `${String(i + 1).padStart(2, "0")} · ${r.verb} — ${r.label}`,
                    })
                  }
                />
              </div>
            </div>
          );
        })}
      </div>

      {zoom && (
        <ShotLightbox
          shot={zoom.shot}
          css={zoom.css}
          title={zoom.title}
          onClose={() => setZoom(null)}
        />
      )}
    </>
  );
}

// ---- copying text out ----------------------------------------------------
// Returns whether the text actually landed, because the caller shows a tick and
// a tick that means "probably" is worse than no button at all.
async function writeClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Permission denied, or the document was not focused. Fall through.
  }
  // navigator.clipboard does not exist on an insecure origin, and serving this
  // app to another machine on the LAN — http://192.168.x.x:3000 — is exactly
  // that. execCommand is deprecated and still the only thing that works there.
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    // Off-screen but focusable: display:none or visibility:hidden cannot be
    // selected, so the copy would silently do nothing.
    ta.style.cssText = "position:fixed;top:0;left:-9999px;opacity:0";
    ta.setAttribute("readonly", "");
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

// A failure message is the one string in this UI nobody wants to retype — it
// goes into a ticket, a chat thread or a search box. Selecting it by hand means
// dragging across a pre-wrapped block that can be several lines tall, and
// catching the surrounding chrome along the way.
function CopyButton({ text, label = "Copy", title = "Copy to clipboard" }) {
  // "done" and "failed" are transient confirmations rather than state the rest
  // of the UI cares about, so they live here and clear themselves.
  const [result, setResult] = useState(null); // null | "done" | "failed"
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    const ok = await writeClipboard(text);
    setResult(ok ? "done" : "failed");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setResult(null), ok ? 1400 : 2600);
  };

  const tone =
    result === "done" ? "#4ade80" : result === "failed" ? "var(--tr-soft)" : "inherit";
  return (
    <button
      type="button"
      onClick={copy}
      // The row this sits in is not clickable, but the lightbox and step rows
      // around it are — a copy must never also open something.
      onMouseDown={(e) => e.stopPropagation()}
      style={{ ...S.copyBtn, color: tone, borderColor: result === "done" ? "color-mix(in srgb, var(--tr-pass) 34%, transparent)" : undefined }}
      title={result === "failed" ? "Could not reach the clipboard — select the text and copy it" : title}
      aria-label={title}
    >
      {result === "done" ? <CheckIcon size={11} /> : <CopyIcon size={11} />}
      {result === "done" ? "Copied" : result === "failed" ? "Blocked" : label}
    </button>
  );
}

// ---- failure evidence ----------------------------------------------------
// A thumbnail of the page as it stood when a step failed — the only step a run
// photographs. Two very different things arrive here looking the same: a JPEG
// from the real browser, and a DOM snapshot that has to be *rendered* to be seen
// (see trShots.js).
//
// A snapshot is an iframe carrying the app's entire stylesheet, so it is built
// only once scrolled near. One failure per run makes that cheap either way, but
// a report opened straight from a suite pass should not pay for it before anyone
// has scrolled down to look.
const THUMB_W = 280;

function StepShot({ shot, css, loading, expected, onOpen }) {
  const boxRef = useRef(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const node = boxRef.current;
    if (!node || typeof IntersectionObserver !== "function") {
      setNear(true); // no observer — render everything rather than nothing
      return undefined;
    }
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setNear(true)),
      { rootMargin: "300px" },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  // Nothing was captured (a passing step, a run recorded before shots existed,
  // an unreadable cross-origin frame). Say nothing rather than leave a gap.
  if (!expected && !shot) return null;

  const w = (shot && shot.w) || 1280;
  const h = (shot && shot.h) || 800;
  const scale = THUMB_W / w;
  const frame = { width: THUMB_W, height: Math.round(h * scale) };

  if (loading) return <div ref={boxRef} style={{ ...S.shotBox, ...frame }} />;
  if (!shot)
    return (
      <div ref={boxRef} style={S.shotNote} title="Screenshots are only kept for the newest few runs">
        screenshot no longer stored
      </div>
    );
  if (shot.tooBig)
    return (
      <div ref={boxRef} style={S.shotNote}>
        snapshot too large to store ({Math.round(shot.tooBig / 1024)}KB of markup)
      </div>
    );

  return (
    <button
      ref={boxRef}
      onClick={onOpen}
      style={{ ...S.shotBox, ...frame }}
      title={
        shot.kind === KIND_IMAGE
          ? "Screenshot of the real browser when this step failed — click to enlarge"
          : "DOM snapshot of the page when this step failed — click to enlarge and inspect"
      }
      aria-label="Show what the page looked like when this step failed"
    >
      {near &&
        (shot.kind === KIND_IMAGE ? (
          <img src={shot.dataUrl} alt="" style={S.shotImg} />
        ) : (
          <SnapshotFrame shot={shot} css={css} scale={scale} />
        ))}
      <span style={S.shotKind}>{shot.kind === KIND_IMAGE ? "screenshot" : "snapshot"}</span>
    </button>
  );
}

// A DOM snapshot, rendered at the size it was captured at and scaled down to
// fit. `sandbox="allow-same-origin"` and nothing else: no scripts, no forms, no
// navigation — but readable from here, which is how the scroll position the page
// had at capture time is put back.
function SnapshotFrame({ shot, css, scale, interactive = false }) {
  return (
    <iframe
      title="page snapshot"
      sandbox="allow-same-origin"
      srcDoc={snapshotSrcDoc(shot, css)}
      onLoad={(e) => {
        try {
          e.currentTarget.contentWindow.scrollTo(shot.sx || 0, shot.sy || 0);
        } catch {
          /* the snapshot is still worth showing unscrolled */
        }
      }}
      style={{
        width: shot.w || 1280,
        height: shot.h || 800,
        border: 0,
        background: "#fff",
        transform: `scale(${scale})`,
        transformOrigin: "top left",
        // A thumbnail is a picture; only the enlarged view is for scrolling
        // around in, and even there nothing inside can be clicked.
        pointerEvents: interactive ? "auto" : "none",
      }}
    />
  );
}

// One shot, as large as the window allows. Escape or a click outside closes it —
// the same two ways out as every other overlay in here.
function ShotLightbox({ shot, css, title, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const w = shot.w || 1280;
  // Fit the width, never magnify: a 900px screenshot blown up to 1600 is just
  // blur where detail is the entire point.
  const avail = Math.min(window.innerWidth - 80, w);
  const scale = Math.min(1, avail / w);

  return (
    <div style={S.lightbox} onClick={onClose}>
      <div style={S.lightboxPanel} onClick={(e) => e.stopPropagation()}>
        <div style={S.lightboxHead}>
          <span style={S.lightboxTitle} title={title}>
            {title}
          </span>
          <span style={S.lightboxMeta}>
            {shot.kind === KIND_IMAGE ? "screenshot" : "DOM snapshot"} · {w}×{shot.h || 800}
          </span>
          <button style={S.noticeClose} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div style={S.lightboxBody}>
          {shot.kind === KIND_IMAGE ? (
            <img src={shot.dataUrl} alt={title} style={{ width: Math.round(w * scale), display: "block" }} />
          ) : (
            <div
              style={{
                width: Math.round(w * scale),
                height: Math.round((shot.h || 800) * scale),
                overflow: "hidden",
              }}
            >
              <SnapshotFrame shot={shot} css={css} scale={scale} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- account -------------------------------------------------------------
// The signed-in user, top right. Their picture when the account has one,
// initials when it does not, and a generic figure when nobody is signed in.
// Everything comes from AuthContext, which is also what the rest of the app
// reads, so signing out anywhere updates this too.
const initialsOf = (name) =>
  String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

// The picture chosen at registration, kept as a data URL alongside the rest of
// the account (see NewRegistration). A hosted URL would work here too — this
// only ever becomes an <img src>.
const photoOf = (user) => (user && user.profilePicture) || null;

// The avatar circle, in px. One number rather than two, because the style and
// the face drawn inside it have to agree: the initials are scaled from it.
const AVATAR_PX = 48;

/**
 * What goes inside the avatar circle: the user's picture, their initials, or a
 * generic figure when nobody is signed in.
 *
 * A component rather than a helper because a picture can fail to load — a data
 * URL truncated by a full storage quota, a hosted one that 404s — and falling
 * back to the initials then needs state that the three places drawing an avatar
 * must not each keep for themselves.
 *
 * The circle itself stays with the caller (S.avatar), so this fills whatever
 * button or span it is dropped into.
 *
 * @param {object|null} user the signed-in user, or null.
 * @param {number} size the circle being drawn into, in px. Only the initials
 *   read it, so that they fill the same proportion of it at every size.
 */
function AvatarFace({ user, size = AVATAR_PX }) {
  const src = photoOf(user);
  // Reset when the picture changes: a failure belongs to one image, not to
  // whoever signs in after it.
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);

  if (src && !broken) {
    return (
      <img
        src={src}
        alt=""
        onError={() => setBroken(true)}
        // The photo is stored at whatever resolution it was uploaded at (see
        // NewRegistration: the file goes straight to a data URL), so a full
        // camera picture is being drawn into a circle a few dozen pixels wide.
        // Chrome's default downscaler is a fast one and leaves that visibly
        // soft; "high-quality" asks for the good filter instead, which is the
        // whole of the difference between a mushy thumbnail and a sharp one.
        // decoding="async" only keeps a large source off the paint path.
        decoding="async"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          borderRadius: 999,
          display: "block",
          imageRendering: "high-quality",
        }}
      />
    );
  }
  const initials = initialsOf(displayName(user));
  return initials ? (
    <span style={{ fontSize: size * 0.37 }}>{initials}</span>
  ) : (
    <UserIcon size={Math.round(size * 0.5)} />
  );
}

// How much of this origin's localStorage quota the runner is using. Worth
// showing: a full quota is the one failure that stops a recording being saved
// at all (see persistRecorded), and until now the only way to learn you were
// near it was to lose a test to it. Failure screenshots are not counted —
// those live in IndexedDB (see trShots) and are not billed to this quota.
const runnerBytes = () => {
  try {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith("testrunner.")) continue;
      total += key.length + (localStorage.getItem(key) || "").length;
    }
    return total;
  } catch {
    return null; // storage disabled — say nothing rather than guess
  }
};

/**
 * What the whole origin is using, and what is using most of it.
 *
 * The recorder's own figure above answers "how much are my tests costing me".
 * This answers the question that actually stops people: the quota belongs to
 * the origin, not to this feature, so a recording can fail to save because of
 * something else entirely — and until now nothing on this screen would say so.
 *
 * Observed for real: an account with a large profile photo could not be signed
 * in, because writing the session exceeded the quota. The session no longer
 * carries the photo (see context/AuthContext), but the directory of registered
 * users still does, and it is usually the biggest thing here.
 *
 * @returns {{total: number, biggest: {key: string, bytes: number}|null}|null}
 */
const originStorage = () => {
  try {
    let total = 0;
    let biggest = null;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const bytes = key.length + (localStorage.getItem(key) || "").length;
      total += bytes;
      if (!biggest || bytes > biggest.bytes) biggest = { key, bytes };
    }
    return { total, biggest };
  } catch {
    return null;
  }
};

const fmtBytes = (n) => {
  if (n == null) return "unavailable";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
};

// ---- user settings -------------------------------------------------------
// Opened from the account menu. A modal rather than a route: every preference
// here belongs to the runner page itself, and sending someone to another screen
// to flip the theme would unmount the recorder — losing an in-progress
// recording to change a setting is not a trade anybody would make.
//
// This shows the preferences that already exist and are already persisted
// (theme, headed/headless) in one place, so they can be found by looking for
// "settings" rather than by knowing which top-bar toggle to hunt for. The
// account block above them is read-only: identity comes from AuthContext and is
// changed where you signed in, not here.
/**
 * The team on this account's seats.
 *
 * A seat can be held for an address that has not registered yet, which is the
 * ordinary way a team is filled — somebody is added, and signs up afterwards.
 * The row says which, because "invited" and "using it" are different states and
 * only one of them is a person who can log in.
 *
 * @param {{blocked: string|null}} props the plan's refusal, or null.
 */
function TeamPanel({ blocked }) {
  const [members, setMembers] = useState(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    if (blocked) return;
    getTeam()
      .then(setMembers)
      .catch((err) => {
        setMembers([]);
        setError(err.message);
      });
  }, [blocked]);

  useEffect(load, [load]);

  const add = async () => {
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await addTeamMember(email.trim());
      setEmail("");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const drop = async (member) => {
    if (!window.confirm(`Remove ${member.memberEmail} from the team?`)) return;
    setError(null);
    try {
      await removeTeamMember(member.memberEmail);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  if (blocked) return <div style={S.setRowHint}>{blocked}</div>;

  return (
    <>
      <div style={S.setRowHint}>
        Accounts that belong to this one. A seat can be held for somebody who has not registered
        yet — they join the team when they sign up with that address.
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="colleague@example.com"
          spellCheck={false}
          style={{ ...S.dataInput, flex: 1, fontFamily: "inherit" }}
          aria-label="Email of the member to add"
        />
        <button
          style={{ ...S.btn, ...S.btnAccent, opacity: busy ? 0.5 : 1 }}
          disabled={busy}
          onClick={add}
        >
          {busy ? "Adding…" : "Add"}
        </button>
      </div>

      {members === null ? (
        <div style={S.setRowHint}>Reading…</div>
      ) : !members.length ? (
        <div style={S.setRowHint}>Nobody on the team yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {members.map((m) => (
            <div key={m.memberEmail} style={S.setRow}>
              <div style={S.setRowText}>
                <div style={S.setRowName}>{m.name || m.memberEmail}</div>
                <div style={S.setRowHint}>
                  {m.name ? m.memberEmail + " · " : ""}
                  {!m.registered
                    ? "invited — has not registered yet"
                    : m.canSignIn
                      ? "on " + (m.plan || "no plan")
                      : "registered, but sign-in is switched off"}
                </div>
              </div>
              <button style={{ ...S.btn, ...S.btnGhost }} onClick={() => drop(m)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div style={{ ...S.dataWarn, margin: 0 }}>
          <span>⚠</span>
          <span>{error}</span>
        </div>
      )}
    </>
  );
}

/**
 * API tokens: a credential CI carries instead of a browser session.
 *
 * The token is shown once and never again — the server keeps only a hash of it.
 * That is stated on screen rather than left to be discovered, because the
 * moment it can be copied is the only moment it exists.
 *
 * @param {{blocked: string|null}} props the plan's refusal, or null.
 */
function TokensPanel({ blocked }) {
  const [tokens, setTokens] = useState(null);
  const [name, setName] = useState("");
  const [issued, setIssued] = useState(null); // the plaintext, until dismissed
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    if (blocked) return;
    getTokens()
      .then(setTokens)
      .catch((err) => {
        setTokens([]);
        setError(err.message);
      });
  }, [blocked]);

  useEffect(load, [load]);

  const issue = async () => {
    setError(null);
    try {
      const { secret } = await createToken(name.trim() || "CI");
      setIssued(secret);
      setName("");
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const kill = async (token) => {
    if (!window.confirm(`Revoke "${token.name}"? Anything using it stops working immediately.`))
      return;
    setError(null);
    try {
      await revokeToken(token.id);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  if (blocked) return <div style={S.setRowHint}>{blocked}</div>;

  return (
    <>
      <div style={S.setRowHint}>
        Send one as <code>Authorization: Bearer …</code> and this API answers as your account,
        with no browser session. A token is as powerful as the account that issued it — issue one
        per job, and revoke it rather than sharing it.
      </div>

      {issued && (
        <div style={{ ...S.setRow, flexDirection: "column", alignItems: "stretch", gap: 6 }}>
          <div style={{ ...S.setRowName, color: "var(--tr-warn)" }}>
            Copy this now — it is not shown again
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              readOnly
              value={issued}
              onFocus={(e) => e.target.select()}
              style={{ ...S.dataInput, flex: 1 }}
              aria-label="The new API token"
            />
            <CopyButton text={issued} title="Copy this token" />
            <button style={{ ...S.btn, ...S.btnGhost }} onClick={() => setIssued(null)}>
              Done
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && issue()}
          placeholder="What is it for? e.g. GitHub Actions"
          style={{ ...S.dataInput, flex: 1, fontFamily: "inherit" }}
          aria-label="Name for the new token"
        />
        <button style={{ ...S.btn, ...S.btnAccent }} onClick={issue}>
          Issue token
        </button>
      </div>

      {tokens === null ? (
        <div style={S.setRowHint}>Reading…</div>
      ) : !tokens.length ? (
        <div style={S.setRowHint}>No tokens issued.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {tokens.map((t) => (
            <div key={t.id} style={S.setRow}>
              <div style={S.setRowText}>
                <div style={{ ...S.setRowName, opacity: t.revokedAt ? 0.55 : 1 }}>
                  {t.name} <span style={{ fontFamily: mono, color: "var(--tr-muted)" }}>…{t.tail}</span>
                </div>
                <div style={S.setRowHint}>
                  {t.revokedAt
                    ? "revoked " + new Date(t.revokedAt).toLocaleDateString()
                    : (t.lastUsedAt
                        ? "last used " + fmtWhen(new Date(t.lastUsedAt).getTime())
                        : "never used") +
                      " · issued " + new Date(t.createdAt).toLocaleDateString()}
                </div>
              </div>
              {!t.revokedAt && (
                <button
                  style={{ ...S.btn, ...S.btnGhost, color: "var(--tr-rec)" }}
                  onClick={() => kill(t)}
                >
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {error && (
        <div style={{ ...S.dataWarn, margin: 0 }}>
          <span>⚠</span>
          <span>{error}</span>
        </div>
      )}
    </>
  );
}

/**
 * What this account and its team have been doing.
 *
 * A read of the audit log the app already keeps, scoped server-side to this
 * account and its members. Nothing new is recorded for it — which is the point:
 * a log written specially for a paid feature is a log that only records what
 * somebody thought to bill for.
 *
 * @param {{blocked: string|null}} props the plan's refusal, or null.
 */
function ActivityPanel({ blocked }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (blocked) return;
    getActivity({ limit: 50 })
      .then((d) => setRows(d.activity))
      .catch((err) => {
        setRows([]);
        setError(err.message);
      });
  }, [blocked]);

  if (blocked) return <div style={S.setRowHint}>{blocked}</div>;

  return (
    <>
      <div style={S.setRowHint}>
        What this account and its team have done — registrations, profile changes and the other
        actions the app records. Newest first.
      </div>
      {rows === null ? (
        <div style={S.setRowHint}>Reading…</div>
      ) : !rows.length ? (
        <div style={S.setRowHint}>
          Nothing recorded for this account yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 220, overflowY: "auto" }}>
          {rows.map((r) => (
            <div key={r.id} style={{ display: "flex", gap: 8, fontSize: 11.5, padding: "3px 0" }}>
              <span style={{ fontFamily: mono, color: "var(--tr-muted)", flexShrink: 0 }}>
                {new Date(r.created_at + "Z").toLocaleString()}
              </span>
              <span style={{ color: "var(--tr-text-2)", fontWeight: 600 }}>{r.action}</span>
              <span style={{ color: "var(--tr-dim)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {(r.payload && (r.payload.email || r.payload.patientName)) || ""}
              </span>
            </div>
          ))}
        </div>
      )}
      {error && (
        <div style={{ ...S.dataWarn, margin: 0 }}>
          <span>⚠</span>
          <span>{error}</span>
        </div>
      )}
    </>
  );
}

/**
 * What this account is on, and how to change it.
 *
 * In User Settings rather than in the top bar, because it is the one screen
 * where somebody is already asking "what does this account get" — the theme,
 * the browser and the storage figure are all answers to variations of it. The
 * top bar says which plan; this is where it is bought.
 *
 * A tier below the current one is not offered. Downgrading is not a payment and
 * cannot be done by taking one, and a button that silently removed capabilities
 * somebody is relying on is not something to put behind an "Upgrade" heading.
 * The Super Admin table is where a plan is moved down.
 *
 * @param {{user: object|null}} props the signed-in user.
 */
function PlanSection({ user }) {
  const [busy, setBusy] = useState(null); // which plan is being opened
  const [error, setError] = useState(null);
  const current = planOfUser(user);
  const at = PLANS.findIndex((p) => p.value === current);

  /**
   * Opens a checkout for a plan and goes to the payment page.
   *
   * A full navigation rather than a modal here: the payment page is where the
   * gateway's own window opens, and it is the same page a registration lands
   * on — one payment screen, reached two ways.
   */
  const buy = async (plan) => {
    setBusy(plan.value);
    setError(null);
    try {
      const { checkout } = await openCheckout({ email: user.email, plan: plan.value });
      window.location.assign("/Checkout?token=" + encodeURIComponent(checkout.token));
    } catch (err) {
      setError(err.message);
      setBusy(null);
    }
  };

  if (!user) {
    return (
      <div style={S.setRowHint}>
        Not signed in, so there is no account to put on a plan.
      </div>
    );
  }

  const upgrades = PLANS.slice(at + 1).filter((p) => p.price);

  return (
    <>
      <div style={S.setRow}>
        <div style={S.setRowText}>
          <div style={S.setRowName}>
            You are on {current}
            <span style={{ ...S.avatarPlan, marginLeft: 8 }}>{priceLabel(current)}</span>
          </div>
          <div style={S.setRowHint}>
            The plan decides which capabilities this account may use — a control it does not
            include is disabled rather than hidden, and says which plan carries it. Changing plan
            takes effect as soon as the payment settles; there is nothing to sign out for.
          </div>
        </div>
      </div>

      {upgrades.length === 0 ? (
        <div style={S.setRowHint}>
          {at === PLANS.length - 1
            ? "This is the top tier — everything is included."
            : "No paid tier above this one has a price set yet."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {upgrades.map((plan) => (
            <div key={plan.value} style={S.setRow}>
              <div style={S.setRowText}>
                <div style={S.setRowName}>
                  {plan.label || plan.value} — {priceLabel(plan)}
                </div>
                <div style={S.setRowHint}>{plan.blurb}</div>
              </div>
              <button
                style={{
                  ...S.btn,
                  ...S.btnAccent,
                  opacity: busy ? 0.5 : 1,
                  cursor: busy ? "progress" : "pointer",
                }}
                disabled={!!busy}
                onClick={() => buy(plan)}
                title={`Pay ${priceLabel(plan)} and move this account to ${plan.value}`}
              >
                {busy === plan.value ? "Opening…" : "Upgrade"}
              </button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div style={{ ...S.dataWarn, margin: 0 }}>
          <span>⚠</span>
          <span>{error}</span>
        </div>
      )}
    </>
  );
}

function UserSettingsModal({
  user,
  name,
  refusal,
  themeChoice,
  theme,
  onTheme,
  headless,
  onHeadless,
  selfHeal,
  onSelfHeal,
  parallel,
  onParallel,
  browser,
  onBrowser,
  onClose,
}) {
  // Measured once per open. It only changes when tests are saved or deleted,
  // neither of which can happen while this is the front-most thing on screen.
  const bytes = useMemo(runnerBytes, []);
  const origin = useMemo(originStorage, []);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const segments = (options, active, pick, blocked) => (
    <div style={REC.pace} title={blocked || undefined}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          disabled={!!blocked}
          title={blocked || undefined}
          onClick={() => pick(o.value)}
          style={{
            ...REC.paceBtn,
            ...S.btnIcon,
            gap: 5,
            ...(active === o.value ? REC.paceBtnActive : {}),
            opacity: blocked ? 0.45 : 1,
            cursor: blocked ? "not-allowed" : "pointer",
          }}
          aria-pressed={active === o.value}
        >
          <o.Glyph size={12} /> {o.label}
        </button>
      ))}
    </div>
  );

  return (
    <div
      style={S.setBackdrop}
      // Clicking the sheet itself must not close it, so only a hit on the
      // backdrop counts.
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={S.setCard} role="dialog" aria-modal="true" aria-label="User settings">
        <div style={S.setHead}>
          <GearIcon size={15} />
          <span style={S.setTitle}>User Settings</span>
          <button onClick={onClose} style={S.setClose} title="Close" aria-label="Close settings" autoFocus>
            <XIcon size={13} />
          </button>
        </div>

        <div style={S.setBody}>
          <section style={S.setSection}>
            <div style={S.setSectionLabel}>Account</div>
            <div style={S.setIdentity}>
              <span style={{ ...S.avatar, ...(user ? S.avatarKnown : S.avatarAnon), cursor: "default", width: 60, height: 60 }}>
                <AvatarFace user={user} size={60} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ ...S.menuName, fontSize: 14 }}>{name || "Not signed in"}</div>
                {user?.email && <div style={{ ...S.menuSub, fontSize: 12 }}>{user.email}</div>}
                {(user?.role || user?.practiceName) && (
                  <div style={{ marginTop: 6, display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {user.role && <span style={S.roleChip}>{user.role}</span>}
                    {user.practiceName && <span style={S.roleChip}>{user.practiceName}</span>}
                  </div>
                )}
                <div style={{ ...S.setRowHint, marginTop: 7 }}>
                  Your picture, name and email come from your sign-in; the name and email are
                  stamped on every test you record. Change them where you manage your account.
                </div>
              </div>
            </div>
          </section>

          <section style={S.setSection}>
            <div style={S.setSectionLabel}>Preferences</div>
            <div style={S.setRow}>
              <div style={S.setRowText}>
                <div style={S.setRowName}>Theme</div>
                <div style={S.setRowHint}>
                  Light, dark, or on the clock: Auto is dark from {hourLabel(DARK_FROM_HOUR)} to{" "}
                  {hourLabel(DARK_UNTIL_HOUR)} and switches while the runner is open
                  {themeChoice === "auto" ? " — right now it is " + theme + "." : "."} Remembered on
                  this browser and shared with the rest of the app; the app under test keeps its own
                  styling.
                </div>
              </div>
              {segments(
                [
                  { value: "light", label: "Light", Glyph: SunIcon },
                  { value: "dark", label: "Dark", Glyph: MoonIcon },
                  { value: "auto", label: "Auto", Glyph: ClockIcon },
                ],
                themeChoice,
                onTheme,
              )}
            </div>
            <div style={S.setRow}>
              <div style={S.setRowText}>
                <div style={S.setRowName}>Playback window</div>
                <div style={S.setRowHint}>
                  Headless keeps the app frame offscreen and shows only a small progress panel —
                  useful for scheduled runs. Recording is always headed.
                </div>
              </div>
              {segments(
                [
                  { value: false, label: "Headed", Glyph: MonitorIcon },
                  { value: true, label: "Headless", Glyph: EyeOffIcon },
                ],
                headless,
                onHeadless,
              )}
            </div>
            <div style={S.setRow}>
              <div style={S.setRowText}>
                <div style={S.setRowName}>Self-healing locators</div>
                <div style={S.setRowHint}>
                  When no recorded selector matches, loosen them — drop the tag, drop the
                  path, keep the identifying attribute — and act on the element that answers,
                  provided exactly one does. The repair is saved to the test and shown on the
                  step. Turn it off where a locator changing itself is a change that has to be
                  reviewed.
                </div>
              </div>
              {segments(
                [
                  { value: true, label: "Heal", Glyph: WandIcon },
                  { value: false, label: "Strict", Glyph: LockIcon },
                ],
                selfHeal,
                onSelfHeal,
                refusal("heal"),
              )}
            </div>
            <div style={S.setRow}>
              <div style={S.setRowText}>
                <div style={S.setRowName}>Browser</div>
                <div style={S.setRowHint}>
                  Which rendering engine the real-browser engine records and replays in. The
                   engine is always this browser. A browser that is not installed on the
                  backend can be added with <code>npx playwright install</code>.
                </div>
              </div>
              {segments(
                BROWSER_IDS.map((id) => ({
                  value: id,
                  label: browserLabel(id),
                  Glyph: browserIconFor(id),
                })),
                browser,
                onBrowser,
                refusal("browsers"),
              )}
            </div>
            <div style={S.setRow}>
              <div style={S.setRowText}>
                <div style={S.setRowName}>Suite execution</div>
                <div style={S.setRowHint}>
                  How a generated pipeline runs the exported specs: Parallel gives each job
                  every core the runner has, Sequential one worker at a time. Parallel is
                  several times faster and is the right default; Sequential is what to reach
                  for when a suite passes one test at a time and fails together, which means
                  the recordings are sharing state rather than the app being broken.
                  {/* Said plainly, because the control is in the same list as four
                      preferences that DO change what happens when you press play, and a
                      reasonable person would assume this one does too. It cannot: replay
                      drives the recorder's frame and there is exactly one of those. */}
                  <br />
                  This does not change ▶ Play or Run — the player here is always one test at
                  a time. It is written into the file <b>CI/CD</b> generates, and into{" "}
                  <code>npm run test:e2e</code>.
                </div>
              </div>
              {segments(
                [
                  { value: true, label: "Parallel", Glyph: ParallelIcon },
                  { value: false, label: "Sequential", Glyph: SequentialIcon },
                ],
                parallel,
                onParallel,
                refusal("cicd"),
              )}
            </div>
          </section>

          <section style={S.setSection}>
            <div style={S.setSectionLabel}>Plan</div>
            <PlanSection user={user} />
          </section>

          {/* The Corporate features. Shown to everyone, refused with a reason
              for a plan that does not include them — a section that vanished
              would leave nobody able to find out it exists. */}
          <section style={S.setSection}>
            <div style={S.setSectionLabel}>Team</div>
            <TeamPanel blocked={refusal("team")} />
          </section>

          <section style={S.setSection}>
            <div style={S.setSectionLabel}>API tokens</div>
            <TokensPanel blocked={refusal("apitokens")} />
          </section>

          <section style={S.setSection}>
            <div style={S.setSectionLabel}>Activity</div>
            <ActivityPanel blocked={refusal("audit")} />
          </section>

          <section style={S.setSection}>
            <div style={S.setSectionLabel}>Storage</div>
            <div style={S.setRow}>
              <div style={S.setRowText}>
                <div style={S.setRowName}>Browser storage in use</div>
                <div style={S.setRowHint}>
                  Tests, projects, reports and schedules are kept in this browser, not on a
                  server — export them to move or back them up. Failure screenshots are stored
                  separately and are not counted here.
                  {/* The quota belongs to the whole origin, so what stops a
                      recording saving is often something else entirely. Naming
                      the largest entry is what turns "storage is full" from a
                      dead end into something to act on. */}
                  {origin && (
                    <>
                      <br />
                      This origin is using <b>{fmtBytes(origin.total)}</b> altogether, of roughly
                      5 MB.
                      {origin.biggest && (
                        <>
                          {" "}
                          The largest entry is <code style={{ fontFamily: mono }}>
                            {origin.biggest.key}
                          </code>{" "}
                          at {fmtBytes(origin.biggest.bytes)}.
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
              <span style={S.setValue}>{fmtBytes(bytes)}</span>
            </div>
          </section>
        </div>

        <div style={S.setFoot}>
          <button style={{ ...S.btn, ...S.btnGhost }} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// A DOM snapshot made safe to open anywhere.
//
// A snapshot is a live document, and it keeps every URL the real page used:
// <base href="http://localhost:3000/…"> plus relative src attributes for logos,
// avatars and icons. Inside the app that works, because the app is being served.
// In a report attached to an email it does not — the dev server is not running,
// nothing resolves, and every one of those images renders as a broken-image
// icon over the top of the evidence.
//
// So the references are removed rather than left to fail: the base goes, and
// every remote image becomes a transparent 1x1 that keeps its own width and
// height. The layout is unchanged and nothing is broken; the picture is simply
// missing the decorative parts, which is honest and quiet. Data URIs are kept —
// they are already self-contained.
const BLANK_PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

const portableSnapshot = (doc) =>
  String(doc || "")
    // Nothing left to resolve against, and leaving it makes every relative URL
    // point at a host that is not there.
    .replace(/<base\b[^>]*>/gi, "")
    // Responsive sets would re-introduce the remote URLs the line below strips.
    .replace(/\ssrcset\s*=\s*"[^"]*"/gi, "")
    .replace(/\ssrcset\s*=\s*'[^']*'/gi, "")
    // Any src that is not already self-contained. `data:` survives; so does an
    // inline SVG, which is where most of this app's iconography lives.
    .replace(/(<img\b[^>]*?)\ssrc\s*=\s*"(?!data:)[^"]*"/gi, '$1 src="' + BLANK_PIXEL + '"')
    .replace(/(<img\b[^>]*?)\ssrc\s*=\s*'(?!data:)[^']*'/gi, '$1 src="' + BLANK_PIXEL + '"')
    // A CSS background pointing at the same dead host. Left in place it is only
    // an invisible failed request, but it is a request per element on a document
    // that should make none.
    .replace(/url\((\s*['"]?)(?!data:)[^)'"]*\1\s*\)/gi, "none");

// One recorded step result, reduced to what a report needs to show. Deliberately
// lossy: a run also carries screenshots and healed-locator detail, and neither
// belongs in a document that gets emailed around.
// A REST step's response, reduced to what a shareable document may carry.
//
// Two things are deliberately dropped rather than trimmed. `extracted` goes
// entirely: the values a recording chooses to capture are overwhelmingly
// credentials — that is what extraction is *for* — and a bearer token pasted
// into a report that gets emailed around is a leak nobody notices until it is
// used. And the response body is kept only for a step that failed, where it is
// the diagnosis, and capped shorter than the runner holds it: a passing call's
// body is never read and may be a page of somebody's personal data.
const plainApi = (api) => {
  if (!api) return null;
  return {
    method: api.method || null,
    url: api.url || null,
    status: api.status == null ? null : api.status,
    statusText: api.statusText || null,
    ms: api.ms == null ? null : api.ms,
    ok: !!api.ok,
    checks: (api.results || []).map((r) => ({ ok: !!r.ok, text: r.ok ? r.text : r.detail })),
    body: api.ok ? null : String(api.bodyPreview || '').slice(0, 600) || null,
  };
};

const plainStep = (st) => ({
  verb: st.verb || null,
  label: st.label || null,
  status: st.status || null,
  durationMs: st.durationMs == null ? null : st.durationMs,
  error: st.error || null,
  api: plainApi(st.api),
});

// ---- reports -------------------------------------------------------------
// The whole workspace's run history in one place.
//
// Every report already exists — the runner writes one per run and the panel on
// the right shows whichever test is selected. What was missing is the view
// across all of them, and that is the one you want before a release: "is
// anything red, and has anything been quietly flaky for a week" cannot be
// answered by clicking twenty tests one at a time.
//
// A modal rather than a screen, for the same reason the others are: it is
// reached mid-flow and must not unmount a recording in progress.
//
// Deliberately derived, never stored. Everything here is computed from `runs`
// on open, so there is no second copy of the history to drift from the first —
// the numbers are the reports, counted.
function ReportsModal({ runs, tests, suiteNameOf, blocked, onOpenTest, onClose }) {
  const [filter, setFilter] = useState("all"); // all | failing | flaky | never
  const [query, setQuery] = useState("");
  // Sorted by "what needs attention" until you ask for something else. A table
  // that opens alphabetically makes you find the failures yourself.
  const [sort, setSort] = useState({ key: "attention", dir: 1 });

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // One row per test, newest run first — the shape the table renders and the
  // summary counts, so the two can never disagree about what is failing.
  const rows = useMemo(
    () =>
      (tests || []).map((t) => {
        const history = (runs && runs[t.id]) || [];
        const latest = lastRun(history);
        const stats = runStats(history);
        return {
          test: t,
          history,
          latest,
          stats,
          suite: suiteNameOf(t.suiteId),
          // Failing first, then flaky, then never-run, then passing. A release
          // checklist reads top-down.
          rank: latest && latest.status === "failed" ? 0 : stats.flaky ? 1 : !latest ? 2 : 3,
        };
      }),
    [runs, tests, suiteNameOf],
  );

  const shown = useMemo(() => {
    const keep =
      filter === "failing"
        ? (r) => r.latest && r.latest.status === "failed"
        : filter === "flaky"
          ? (r) => r.stats.flaky
          : filter === "never"
            ? (r) => !r.latest
            : () => true;
    // Name, suite and tags all match, because all three are things you would
    // half-remember about a test you are looking for.
    const q = query.trim().toLowerCase();
    const matches = (r) =>
      !q ||
      r.test.name.toLowerCase().includes(q) ||
      String(r.suite).toLowerCase().includes(q) ||
      tagsOf(r.test).some((tag) => tag.includes(q));

    const by = {
      attention: (a, b) => a.rank - b.rank || (b.latest?.startedAt || 0) - (a.latest?.startedAt || 0),
      name: (a, b) => a.test.name.localeCompare(b.test.name),
      // Never-run tests sort last whichever way the arrow points: they have no
      // rate to compare, and floating them to the top of "worst first" would
      // bury the tests that actually failed.
      rate: (a, b) => {
        const v = (r) => (r.stats.total ? r.stats.passed / r.stats.total : Infinity);
        return v(a) - v(b);
      },
      duration: (a, b) => (b.latest?.durationMs || 0) - (a.latest?.durationMs || 0),
      when: (a, b) => (b.latest?.startedAt || 0) - (a.latest?.startedAt || 0),
    };
    return rows.filter(keep).filter(matches).slice().sort((a, b) => (by[sort.key] || by.attention)(a, b) * sort.dir);
  }, [rows, filter, query, sort]);

  const totals = useMemo(() => {
    const runsAll = rows.reduce((n, r) => n + r.stats.total, 0);
    const passed = rows.reduce((n, r) => n + r.stats.passed, 0);
    return {
      tests: rows.length,
      runs: runsAll,
      // Of runs, not of tests: "84% of runs passed" is the number that moves
      // when something starts failing intermittently.
      rate: runsAll ? Math.round((passed / runsAll) * 100) : null,
      failing: rows.filter((r) => r.latest && r.latest.status === "failed").length,
      flaky: rows.filter((r) => r.stats.flaky).length,
      never: rows.filter((r) => !r.latest).length,
      healed: rows.reduce((n, r) => n + r.history.reduce((m, h) => m + (h.healed || 0), 0), 0),
    };
  }, [rows]);

  // Which step is failing, across every test's latest run.
  //
  // The most useful thing a suite-wide view can say and the one thing no single
  // report can: three tests failing on the same step is one broken locator, not
  // three broken tests, and it is a five-minute fix rather than an afternoon.
  // Grouped on the step's own description because that is what identifies it to
  // a person — the index would group "step 4" across unrelated recordings.
  const failures = useMemo(() => {
    const by = new Map();
    rows.forEach((r) => {
      if (!r.latest || r.latest.status !== "failed") return;
      // A data-driven run holds one result list per row; the failing step can
      // be in any of them, and the same step failing on nine rows is still one
      // problem, so each step is counted at most once per test.
      const lists = r.latest.iterations ? r.latest.iterations.map((it) => it.steps) : [r.latest.steps];
      const seen = new Set();
      (lists || []).forEach((steps) =>
        (steps || []).forEach((st) => {
          if (!st || st.status !== "failed") return;
          const key = `${st.verb || ""} ${st.label || ""}`.trim() || "(unnamed step)";
          if (seen.has(key)) return;
          seen.add(key);
          const hit = by.get(key) || { key, verb: st.verb, label: st.label, error: st.error, tests: [] };
          hit.tests.push(r);
          by.set(key, hit);
        }),
      );
    });
    return [...by.values()].sort((a, b) => b.tests.length - a.tests.length).slice(0, 6);
  }, [rows]);

  // The report as a document, for someone who will never open TestExpress.
  //
  // Built from the same rows the screen is rendering, flattened to plain data,
  // so the file cannot disagree with the view by being derived a second time.
  // The generator itself is in ./testrunner/reportDoc, free of any DOM, so a
  // Node script can produce the identical document from an exported workspace.
  // The evidence for one failed run, ready to embed.
  //
  // Failures only, and only the step that failed. A shot bundle holds a whole
  // serialized page, so putting one against every step of every test would turn
  // a report somebody emails into tens of megabytes — and nobody looks at the
  // picture of a step that passed.
  //
  // The two kinds are genuinely different things and both have to survive the
  // trip: the remote engine stores a JPEG, the in-page engine stores the DOM,
  // which is rebuilt into a standalone document here rather than in the report
  // so the file needs no knowledge of how a snapshot is put back together.
  const shotFor = async (latest, steps) => {
    if (!latest || latest.status !== "failed" || !latest.id) return null;
    const bundle = await loadShots(latest.id);
    if (!bundle || !bundle.steps) return null;
    // The failing step's own shot, falling back to whatever the bundle has —
    // older runs stored the shot under a different index than the one the step
    // list now reports, and a picture of the wrong step still beats none.
    const failedAt = (steps || []).findIndex((s) => s && s.status === "failed");
    const keys = Object.keys(bundle.steps);
    const pick = bundle.steps[failedAt] ? String(failedAt) : keys[0];
    const shot = pick == null ? null : bundle.steps[pick];
    if (!shot) return null;
    // A capture can be present but empty — a canvas the encoder could not read
    // gives back a bare "data:," and a snapshot taken mid-navigation serialises
    // to a shell with nothing in the body. Dropped here rather than embedded and
    // then hidden by the report, because a megabyte of unusable snapshot in a
    // file somebody emails is worse than no screenshot.
    const usableImage =
      shot.kind === KIND_IMAGE && String(shot.dataUrl || "").startsWith("data:image/") && shot.dataUrl.length > 64;
    const usableDom = shot.kind !== KIND_IMAGE && !!(shot.html || "").replace(/<[^>]*>/g, "").trim();
    if (!usableImage && !usableDom) return null;
    return {
      stepIndex: Number(pick),
      kind: shot.kind,
      w: shot.w || null,
      h: shot.h || null,
      // One or the other, never both.
      dataUrl: shot.kind === KIND_IMAGE ? shot.dataUrl || null : null,
      srcdoc: shot.kind === KIND_IMAGE ? null : portableSnapshot(snapshotSrcDoc(shot, bundle.css)),
    };
  };

  // Async because the evidence lives in IndexedDB, not in `runs`. Gathered only
  // when a report is actually asked for, so opening the modal stays instant.
  const reportData = async () => ({
    generatedAt: Date.now(),
    totals,
    failures: failures.map((f) => ({
      verb: f.verb,
      label: f.label,
      tests: f.tests.map((r) => r.test.name),
    })),
    // Every test, not only the ones passing the current filter: a document that
    // silently omitted the passing tests would misrepresent the suite to the
    // person least able to notice.
    rows: await Promise.all(
      rows.map(async (r) => {
        const latest = r.latest;
        // A data-driven run shot belongs to one row; the report shows it against
        // that row rather than whichever the reader happens to be looking at.
        const shotSteps =
          latest && latest.iterations
            ? (latest.iterations[latest.shotIteration || 0] || {}).steps
            : latest && latest.steps;
        return {
          name: r.test.name,
          suite: r.suite,
          tags: tagsOf(r.test),
          latest: latest
            ? { status: latest.status, durationMs: latest.durationMs, startedAt: latest.startedAt }
            : null,
          browser: latest && latest.browser ? (latest.browser === "in-page" ? "In-page" : browserLabel(latest.browser)) : "",
          passed: r.stats.passed,
          total: r.stats.total,
          flaky: r.stats.flaky,
          // The steps are what make this a report rather than a summary — without
          // them the reader can see that something failed but not what.
          steps: latest && latest.steps ? latest.steps.map(plainStep) : null,
          // A data-driven run stores one list per row instead; both shapes travel
          // so the document can offer the row picker.
          iterations:
            latest && latest.iterations
              ? latest.iterations.map((it) => ({
                  label: it.label || null,
                  status: it.status,
                  steps: (it.steps || []).map(plainStep),
                }))
              : null,
          shotIteration: latest && latest.iterations ? latest.shotIteration ?? 0 : null,
          shot: await shotFor(latest, shotSteps),
          history: r.history.map((h) => ({ status: h.status, startedAt: h.startedAt, durationMs: h.durationMs })),
        };
      }),
    ),
  });

  const stamp = () => new Date().toISOString().slice(0, 10);

  // Async now that the evidence has to be fetched. `busy` is not decoration:
  // reading and inlining several page snapshots takes long enough that a button
  // which did nothing visible would be pressed again.
  const [busy, setBusy] = useState(false);
  const downloadHtml = async () => {
    setBusy(true);
    try {
      const data = await reportData();
      download(toReportHtml(data), `testexpress-report-${stamp()}.html`, "text/html;charset=utf-8");
    } catch (err) {
      // Never leave the button spinning on a failure nobody can see.
      console.warn("[TestRunner] report could not be built:", err);
      window.alert(`The report could not be built: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const tile = (label, value, color) => (
    <div style={S.reportTile}>
      <div style={{ ...S.reportTileValue, ...(color ? { color } : {}) }}>{value}</div>
      <div style={S.reportTileLabel}>{label}</div>
    </div>
  );

  // The last few runs as bars, oldest left. Pass/fail is a colour and nothing
  // else is encoded: at this size a height would be unreadable, and the only
  // question being asked of it is "has this been steady".
  const spark = (history) => {
    const recent = history.slice(0, 8).reverse();
    if (!recent.length) return <span style={{ color: "var(--tr-border-strong)", fontSize: 10 }}>—</span>;
    return (
      <span style={S.reportSparkRow} title={`${recent.length} most recent runs, oldest first`}>
        {recent.map((h, i) => (
          <span
            key={i}
            style={{
              ...S.reportSparkBar,
              background: h.status === "failed" ? "var(--tr-rec)" : "var(--tr-pass)",
              opacity: i === recent.length - 1 ? 1 : 0.55,
            }}
          />
        ))}
      </span>
    );
  };

  const sortBtn = (key, label, align) => (
    <button
      style={{ ...S.reportSortBtn, justifyContent: align === "right" ? "flex-end" : "flex-start" }}
      onClick={() => setSort((s) => ({ key, dir: s.key === key ? -s.dir : 1 }))}
      title={`Sort by ${label.toLowerCase()}`}
    >
      {label}
      {sort.key === key && <span style={{ color: "var(--tr-accent)" }}>{sort.dir === 1 ? "▾" : "▴"}</span>}
    </button>
  );

  const FILTERS = [
    { id: "all", label: `All ${rows.length}` },
    { id: "failing", label: `Failing ${totals.failing}` },
    { id: "flaky", label: `Flaky ${totals.flaky}` },
    { id: "never", label: `Not run ${totals.never}` },
  ];

  return (
    <div style={S.setBackdrop} onClick={(e) => e.target === e.currentTarget && onClose()}>
      {/* Wider than the shared 540px sheet: every other modal is a form, this
          one is a seven-column table, and at 540 the fixed columns left the
          test-case name about 60px — enough to render "T…" and nothing more. */}
      <div style={{ ...S.setCard, width: 880 }} role="dialog" aria-modal="true" aria-label="Reports">
        <div style={S.setHead}>
          <ChartIcon size={15} />
          <span style={S.setTitle}>Reports</span>
          <button onClick={onClose} style={S.setClose} title="Close" aria-label="Close reports" autoFocus>
            <XIcon size={13} />
          </button>
        </div>

        <div style={S.setBody}>
          {!rows.length ? (
            <div style={S.setRowHint}>
              No tests recorded yet. Once something has run, its history collects here.
            </div>
          ) : (
            <>
              <section style={S.setSection}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {tile("test cases", totals.tests)}
                  {tile("runs", totals.runs)}
                  {tile(
                    "of runs passed",
                    totals.rate == null ? "—" : `${totals.rate}%`,
                    totals.rate == null
                      ? null
                      : totals.rate === 100
                        ? "var(--tr-pass)"
                        : totals.rate < 80
                          ? "var(--tr-rec)"
                          : "var(--tr-warn)",
                  )}
                  {tile("failing now", totals.failing, totals.failing ? "var(--tr-rec)" : null)}
                  {tile("flaky", totals.flaky, totals.flaky ? "var(--tr-warn)" : null)}
                  {/* Repairs are worth a tile of their own: a suite that is
                      green only because the healer keeps rewriting its
                      locators is a suite about to go red all at once. */}
                  {tile("locators healed", totals.healed, totals.healed ? "var(--tr-info)" : null)}
                </div>
              </section>

              {failures.length > 0 && (
                <section style={S.setSection}>
                  <div style={S.setSectionLabel}>What is failing</div>
                  <div style={S.setRowHint}>
                    The step each red test stopped on. Two tests on one line is one broken thing,
                    not two.
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {failures.map((f) => (
                      <div key={f.key} style={S.failRow}>
                        <span style={S.failCount} title={`${f.tests.length} test case(s) stop here`}>
                          ×{f.tests.length}
                        </span>
                        <span style={{ minWidth: 0 }}>
                          <span style={S.failStep}>
                            {f.verb && <span style={S.failVerb}>{f.verb}</span>}
                            {f.label}
                          </span>
                          <span style={S.failTests}>{f.tests.map((r) => r.test.name).join(" · ")}</span>
                        </span>
                        <button
                          style={S.dataToolBtn}
                          onClick={() => {
                            onOpenTest(f.tests[0].test.id);
                            onClose();
                          }}
                          title={`Open "${f.tests[0].test.name}"`}
                        >
                          Open
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section style={S.setSection}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div style={REC.pace}>
                    {FILTERS.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setFilter(f.id)}
                        style={{ ...REC.paceBtn, ...(filter === f.id ? REC.paceBtnActive : {}) }}
                        aria-pressed={filter === f.id}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Filter by name, suite or tag…"
                    spellCheck={false}
                    style={{ ...S.dataInput, flex: "1 1 170px", minWidth: 130 }}
                    aria-label="Filter the report"
                  />
                  {/* One download, not three. CSV and JSON were formats looking
                      for a reader — the thing anyone actually wants to be handed
                      is the report itself. */}
                  <button
                    style={{
                      ...S.dataToolBtn,
                      color: "var(--tr-accent)",
                      borderColor: "var(--tr-accent-line)",
                      cursor: busy ? "progress" : "pointer",
                      opacity: blocked ? 0.45 : 1,
                    }}
                    disabled={busy || !!blocked}
                    onClick={downloadHtml}
                    title={
                      blocked ||
                      "A self-contained Extent-style HTML report — dashboard, categories, every test's steps, and the failure screenshots. Opens in any browser, prints, and needs nothing else."
                    }
                  >
                    {busy ? (
                      <>
                        <span
                          style={{ ...S.icon, ...S.spin, width: 10, height: 10, borderTopColor: "var(--tr-accent)" }}
                        />{" "}
                        Collecting screenshots…
                      </>
                    ) : (
                      <>
                        <DownloadIcon size={10} /> Extent Report
                      </>
                    )}
                  </button>
                </div>
              </section>

              <section style={S.setSection}>
                {!shown.length ? (
                  <div style={S.setRowHint}>
                    {query.trim()
                      ? `Nothing matches "${query.trim()}".`
                      : "Nothing matches that filter — which is the good answer."}
                  </div>
                ) : (
                  <div style={S.reportTable}>
                    <div style={S.reportHeadRow}>
                      {sortBtn("name", "Test case")}
                      <span>Recent</span>
                      {sortBtn("attention", "Last run")}
                      {sortBtn("rate", "Passed", "right")}
                      {sortBtn("duration", "Duration", "right")}
                      <span>Where</span>
                      {sortBtn("when", "When")}
                    </div>
                    {shown.map((r) => {
                      const Glyph = r.latest && r.latest.browser ? browserIconFor(r.latest.browser) : null;
                      return (
                        <button
                          key={r.test.id}
                          style={S.reportRow}
                          // Opening the test is the point of the row: a failure
                          // here is only ever the start of the question.
                          onClick={() => {
                            onOpenTest(r.test.id);
                            onClose();
                          }}
                          title={`Open "${r.test.name}"`}
                        >
                          <span style={{ minWidth: 0 }}>
                            <span style={S.reportName}>{r.test.name}</span>
                            <span style={S.reportSuite}>{r.suite}</span>
                          </span>
                          <span>{spark(r.history)}</span>
                          <span style={{ color: verdictColor(r.latest), fontWeight: 800, fontSize: 11 }}>
                            {r.latest ? (r.latest.status === "failed" ? "✕ failed" : "✓ passed") : "not run"}
                            {r.stats.flaky && <span style={S.flakyChip}>flaky</span>}
                          </span>
                          <span style={{ textAlign: "right", fontFamily: mono, fontSize: 11 }}>
                            {r.stats.total ? `${r.stats.passed}/${r.stats.total}` : "—"}
                          </span>
                          <span
                            style={{ textAlign: "right", fontFamily: mono, fontSize: 11, color: "var(--tr-muted)" }}
                          >
                            {r.latest ? fmtMs(r.latest.durationMs) : "—"}
                          </span>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              fontSize: 10.5,
                              color: "var(--tr-muted)",
                            }}
                          >
                            {Glyph && <Glyph size={10} />}
                            {r.latest && r.latest.browser
                              ? r.latest.browser === "in-page"
                                ? "In-page"
                                : browserLabel(r.latest.browser)
                              : ""}
                          </span>
                          <span
                            style={{
                              fontSize: 10.5,
                              color: "var(--tr-muted)",
                              lineHeight: 1.3,
                              fontVariantNumeric: "tabular-nums",
                            }}
                            title={r.latest ? `Last run ${fmtWhen(r.latest.startedAt)}` : undefined}
                          >
                            {r.latest ? <RunStamp ts={r.latest.startedAt} /> : "—"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </div>

        <div style={S.setFoot}>
          <span style={{ ...S.setRowHint, flex: 1, marginTop: 0 }}>
            History is kept per test in this browser — the last {RUN_HISTORY} runs of each.
          </span>
          <button style={{ ...S.btn, ...S.btnGhost }} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- CI/CD ---------------------------------------------------------------
// The pipeline that runs the recorded suite without anybody remembering to.
//
// A modal for the same reason the others are: this is reached mid-flow, and
// sending someone to another screen would unmount a recording in progress.
//
// It generates a file rather than pressing a button on anything. TestExpress has
// no credentials for your CI provider and should not ask for any — what it can
// do is write the correct pipeline for the tests it just generated, including
// the exact secret names those tests read, which is the part that is fiddly to
// get right by hand.
function CicdModal({ testData, tests, suite, parallel, onClose }) {
  const [provider, setProvider] = useState("github");
  const [browsers, setBrowsers] = useState(["chromium"]);
  const [trigger, setTrigger] = useState("push");
  const [tag, setTag] = useState("");
  const [branch, setBranch] = useState("main");

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Which set the suite runs against — read only for which of its values are
  // secret, so the pipeline declares exactly the secrets these tests need.
  const liveSet = setFor(testData, {});

  // Offered rather than typed: a tag misspelt here produces a pipeline that
  // matches no test and passes, which is the worst possible failure mode for a
  // regression suite.
  const knownTags = useMemo(() => {
    const out = [];
    (tests || []).forEach((t) => tagsOf(t).forEach((x) => out.includes(x) || out.push(x)));
    return out.sort();
  }, [tests]);

  const generated = useMemo(
    () => toPipeline(provider, { browsers, trigger, tag, branch, set: liveSet, parallel }),
    [provider, browsers, trigger, tag, branch, liveSet, parallel],
  );

  const secrets = useMemo(() => secretEnv(liveSet), [liveSet]);

  // Never empties the list: a pipeline with no engine is a green tick over
  // nothing run, which is worse than having no pipeline at all.
  const toggleBrowser = (id) =>
    setBrowsers((prev) => {
      if (!prev.includes(id)) return [...prev, id];
      return prev.length === 1 ? prev : prev.filter((b) => b !== id);
    });

  const seg = (options, active, pick) => (
    <div style={REC.pace}>
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => pick(o.id)}
          style={{ ...REC.paceBtn, ...(active === o.id ? REC.paceBtnActive : {}) }}
          aria-pressed={active === o.id}
          title={o.hint || o.label}
        >
          {o.label}
        </button>
      ))}
    </div>
  );

  return (
    <div style={S.setBackdrop} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={S.setCard} role="dialog" aria-modal="true" aria-label="CI/CD">
        <div style={S.setHead}>
          <PipelineIcon size={15} />
          <span style={S.setTitle}>CI/CD</span>
          <button onClick={onClose} style={S.setClose} title="Close" aria-label="Close CI/CD" autoFocus>
            <XIcon size={13} />
          </button>
        </div>

        <div style={S.setBody}>
          <section style={S.setSection}>
            <div style={S.setRowHint}>
              Two ways to run the suite without being asked: a timer in this browser, and a
              pipeline on your CI. The pipeline file below is for the specs <b>Download Spec</b>{" "}
              and{" "}
              <code>npm run tests:review</code> generate. Commit it and the suite runs on its own —
              a recording made this afternoon guards the branch tomorrow morning. Nothing here talks
              to your CI provider; it writes the file and you commit it.
            </div>
          </section>

          {/* The in-browser schedule, moved here from the top bar. It belongs
              beside the pipeline rather than above the project tree: both
              answer "when does this suite run without me", and it is a decision
              taken once per suite, not something you reach for while working on
              a test. The two are deliberately adjacent because they are
              alternatives — see the hint below. */}
          <section style={S.setSection}>
            <div style={S.setSectionLabel}>Run on a schedule</div>
            <div style={S.setRowHint}>
              Runs every recorded test in this browser, on a timer. It only fires while TestExpress
              is open in a tab — close it and nothing runs. For a suite that has to run whether or
              not anyone is at a desk, use the pipeline below instead.
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={S.suiteScheduleLabel}>
                <ClockIcon size={14} /> Run all tests
              </span>
              <div style={{ ...REC.pace, ...S.paceAccent }}>
                {SCHEDULE_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => suite.onPreset(p.id)}
                    disabled={!suite.total}
                    style={{
                      ...REC.paceBtn,
                      ...(scheduleId(suite.schedule) === p.id ? S.paceBtnAccent : {}),
                      opacity: suite.total ? 1 : 0.4,
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {scheduleId(suite.schedule) === "daily" && (
                <input
                  type="time"
                  value={suite.schedule?.time || "09:00"}
                  onChange={(e) => suite.onTime(e.target.value)}
                  style={{ ...S.timeInput, borderColor: "var(--tr-accent-line)" }}
                  aria-label="Time of day the suite runs"
                />
              )}

            </div>
            {/* The countdown refreshes because the runner re-renders on a timer
                and this modal is its child — no second ticker here. */}
            {suite.running ? (
              <div style={{ fontSize: 12, color: "var(--tr-warn)", fontWeight: 700 }}>
                running suite — {suite.total - suite.remaining} of {suite.total}
                <button
                  style={{ ...S.btn, ...S.btnGhost, ...S.btnIcon, padding: "3px 9px", fontSize: 11, marginLeft: 8 }}
                  onClick={suite.onStop}
                >
                  <StopIcon size={10} /> Stop
                </button>
              </div>
            ) : (
              <div
                style={{
                  fontSize: 12,
                  fontWeight: suite.schedule?.nextRunAt ? 700 : 400,
                  color: suite.schedule?.nextRunAt ? "var(--tr-accent)" : "var(--tr-muted)",
                }}
              >
                {!suite.total
                  ? "No tests recorded yet — nothing to schedule."
                  : suite.schedule?.nextRunAt
                    ? `next suite run ${fmtCountdown(suite.schedule.nextRunAt - Date.now())}`
                    : "suite not scheduled"}
              </div>
            )}
          </section>

          <section style={S.setSection}>
            <div style={S.setSectionLabel}>Provider</div>
            {seg(PROVIDERS, provider, setProvider)}
          </section>

          <section style={S.setSection}>
            <div style={S.setSectionLabel}>Engines</div>
            <div style={S.setRowHint}>
              One job per engine, run in parallel and never fail-fast — “passes in Chromium, fails in
              WebKit” is the finding, and a pipeline that stops at the first red hides it.
              {/* Where the --workers flag below comes from. Said here rather than left to
                  be inferred from the YAML: this is the screen the flag is read on, and
                  the control that sets it is two clicks away in another modal. */}
              <br />
              Within a job, each engine runs{" "}
              <b>{parallel ? "on every core the runner has" : "one worker at a time"}</b> —
              that is <b>{parallel ? "Parallel" : "Sequential"}</b>, from User Settings ›
              Preferences › Suite execution.
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {BROWSERS.map((b) => (
                <button
                  key={b.id}
                  onClick={() => toggleBrowser(b.id)}
                  style={{ ...S.dataToolBtn, ...(browsers.includes(b.id) ? S.cicdChipOn : {}) }}
                  aria-pressed={browsers.includes(b.id)}
                  title={
                    browsers.includes(b.id) && browsers.length === 1
                      ? "The last engine cannot be removed — a pipeline that runs none is a green tick over nothing"
                      : b.label
                  }
                >
                  {b.label}
                </button>
              ))}
            </div>
          </section>

          <section style={S.setSection}>
            <div style={S.setSectionLabel}>When it runs</div>
            {seg(TRIGGERS, trigger, setTrigger)}
            <div style={S.setRowHint}>
              {(TRIGGERS.find((t) => t.id === trigger) || {}).hint}
            </div>
          </section>

          <section style={S.setSection}>
            <div style={S.setSectionLabel}>Scope</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}>
                <span style={{ color: "var(--tr-muted)" }}>Branch</span>
                <input
                  value={branch}
                  onChange={(e) => setBranch(e.target.value.trim())}
                  style={{ ...S.dataInput, width: 130 }}
                  spellCheck={false}
                  aria-label="Branch the pipeline watches"
                />
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}>
                <span style={{ color: "var(--tr-muted)" }}>Only tests tagged</span>
                <select
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  style={S.dataSetSelect}
                  aria-label="Restrict the pipeline to one tag"
                >
                  <option value="">every test</option>
                  {knownTags.map((x) => (
                    <option key={x} value={x}>
                      @{x}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {!knownTags.length && (
              <div style={S.setRowHint}>
                No tags on any test yet. Tagging a handful <code>@smoke</code> is what lets a
                pull-request pipeline stay under a couple of minutes.
              </div>
            )}
          </section>

          {secrets.length > 0 && (
            <section style={S.setSection}>
              <div style={S.setSectionLabel}>Secrets it expects</div>
              <div style={S.setRowHint}>
                Values marked secret are never written into a spec file, so CI has to supply them.
                Add {secrets.length === 1 ? "this" : "these"} to your provider's secret store under
                exactly {secrets.length === 1 ? "this name" : "these names"}:
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {secrets.map((name) => (
                  <span key={name} style={{ ...S.iterPill, fontFamily: mono, color: "var(--tr-warn)" }}>
                    {name}
                  </span>
                ))}
              </div>
            </section>
          )}

          <section style={S.setSection}>
            <div style={S.setSectionLabel}>{generated.file}</div>
            <div style={S.cicdCodeWrap}>
              <div style={REC.codeBar}>
                <span style={{ fontFamily: mono }}>{generated.file}</span>
                <span style={{ flex: 1 }} />
                <CopyButton text={generated.source} title="Copy this pipeline" />
              </div>
              <pre style={{ ...REC.codeBody, maxHeight: 320 }}>{generated.source}</pre>
            </div>
          </section>
        </div>

        <div style={S.setFoot}>
          <span style={{ ...S.setRowHint, flex: 1, marginTop: 0 }}>
            Save it at <code>{generated.file}</code> in the repo root.
          </span>
          <button
            style={{ ...S.btn, ...S.btnAccent, ...S.btnIcon }}
            onClick={() =>
              // Downloaded under the file's basename: a browser cannot write
              // into .github/workflows, so the path is told to the user above
              // rather than pretended at here.
              download(generated.source, generated.file.split("/").pop(), "text/plain;charset=utf-8")
            }
          >
            <DownloadIcon size={13} /> Download
          </button>
          <button style={{ ...S.btn, ...S.btnGhost }} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function UserMenu({ themeChoice, theme, onTheme, headless, onHeadless, selfHeal, onSelfHeal, parallel, onParallel, browser, onBrowser, onCicd, refusal }) {
  const navigate = useNavigate();
  // Tolerate being rendered outside the provider rather than crashing the whole
  // runner over a decoration.
  const auth = useAuth() || {};
  const user = auth.user || null;
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Same derivation the owner stamp uses, so the rail cannot call someone one
  // thing while the menu they signed in through calls them another.
  const name = displayName(user);

  return (
    <div ref={boxRef} style={{ position: "relative", marginLeft: 4 }}>
      {/* A bare circle reads as a picture of someone, not as something to
          press. The caret is the convention that says otherwise — it is what
          every account menu uses — and the button now carries a hover and an
          open state of its own, so the affordance survives on a device with
          no pointer to hover with. */}
      <button
        className="tr-avatarbtn"
        onClick={() => setOpen((o) => !o)}
        style={S.avatarBtn}
        title={
          user
            ? `${name}${user.email ? ` — ${user.email}` : ""} — account menu`
            : "Not signed in — account menu"
        }
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={user ? `Account: ${name}` : "Account"}
      >
        <span style={{ ...S.avatar, ...(user ? S.avatarKnown : S.avatarAnon) }}>
          <AvatarFace user={user} />
        </span>
        {/* Who is signed in, spelled out rather than left to the tooltip. A
            picture only identifies you to somebody who already knows your face,
            and this bar is where a shared machine gets used by two people in a
            row — the name and address are what catch that before a test is
            recorded under the wrong owner. Both truncate rather than wrap, so a
            long address cannot reflow the bar. */}
        <span style={S.avatarWho}>
          <span style={S.avatarName}>{name || "Not signed in"}</span>
          {user?.email && <span style={S.avatarEmail}>{user.email}</span>}
          {/* Under the address, because they qualify it: two accounts on one
              machine can differ only by what each is allowed to do. The role
              says which pages, the plan says which capabilities — and it is the
              plan that explains a greyed-out engine, so it belongs where the
              engine is greyed out rather than only in Super Admin. */}
          {(user?.role || user) && (
            <span style={S.avatarTags}>
              {user?.role && <span style={S.avatarRole}>{user.role}</span>}
              {user && (
                <span
                  style={S.avatarPlan}
                  title={`${planOfUser(user)} plan — what this account may use`}
                >
                  {planOfUser(user)}
                </span>
              )}
            </span>
          )}
        </span>
        <CaretIcon dir={open ? "up" : "down"} size={13} />
      </button>

      {open && (
        <div style={S.menu} role="menu">
          {/* No name or email here: the button that opens this menu now carries
              both, an inch above, and repeating them was the same fact twice.
              What is left is what the bar has no room for — the role and the
              practice — so the head is drawn only when there is one, rather than
              leaving a picture of somebody sitting above the items on its own. */}
          {user?.practiceName && (
            <div style={S.menuHead}>
              <span style={S.roleChip}>{user.practiceName}</span>
            </div>
          )}

          {user ? (
            <>
              <button
                role="menuitem"
                style={S.menuItem}
                onClick={() => {
                  setOpen(false);
                  navigate("/NewRegistration");
                }}
              >
                <UserIcon size={13} /> Profile
              </button>
              <button
                role="menuitem"
                style={S.menuItem}
                onClick={() => {
                  setOpen(false);
                  setSettingsOpen(true);
                }}
              >
                <GearIcon size={13} /> User Settings
              </button>
              {/* Beside User Settings rather than in the top bar: generating a
                  pipeline is something you do once per repo, not once per test,
                  and the bar is for the things you do to a test. */}
              {/* Both halves of that panel — the pipeline file and the suite
                  schedule — are the same capability, so it is the entry that is
                  refused rather than the two controls inside it. */}
              <button
                role="menuitem"
                disabled={!!refusal("cicd")}
                title={refusal("cicd") || "Generate a pipeline, or run the suite on a timer"}
                style={{ ...S.menuItem, opacity: refusal("cicd") ? 0.45 : 1 }}
                onClick={() => {
                  setOpen(false);
                  if (onCicd) onCicd();
                }}
              >
                <PipelineIcon size={13} /> CI/CD
              </button>
              {/* The only way into account administration.
                  /SuperAdmin was reachable solely by typing the URL: the menu
                  that lists the pages a signed-in user has did not mention it,
                  and the one navigation table that did -- practiceServices in
                  constants.js -- is imported by nothing and renders nowhere.
                  Shown only to a role RoleRoute will admit, so the entry never
                  offers a door that closes in your face. */}
              {canVisit("/SuperAdmin", user.role) && (
                <button
                  role="menuitem"
                  style={S.menuItem}
                  onClick={() => {
                    setOpen(false);
                    navigate("/SuperAdmin");
                  }}
                >
                  <LockIcon size={13} /> Super Admin
                </button>
              )}
              {/* Signs out in place: the dedicated /Logout page no longer exists,
                  so the session is cleared through the same context and the user
                  is dropped back on the login screen. */}
              <button
                role="menuitem"
                style={{ ...S.menuItem, color: "var(--tr-rec)" }}
                onClick={() => {
                  setOpen(false);
                  if (typeof auth.logout === "function") {
                    auth.logout();
                  } else {
                    localStorage.removeItem("isLoggedIn");
                    localStorage.removeItem("user");
                    localStorage.removeItem("loggedInUser");
                  }
                  navigate("/my-app");
                }}
              >
                <LogOutIcon size={13} /> Sign out
              </button>
            </>
          ) : (
            <button
              role="menuitem"
              style={S.menuItem}
              onClick={() => {
                setOpen(false);
                navigate("/my-app");
              }}
            >
              <LogOutIcon size={13} /> Sign in
            </button>
          )}
        </div>
      )}

      {settingsOpen && (
        <UserSettingsModal
          user={user}
          name={name}
          refusal={refusal}
          themeChoice={themeChoice}
          theme={theme}
          onTheme={onTheme}
          headless={headless}
          onHeadless={onHeadless}
          selfHeal={selfHeal}
          onSelfHeal={onSelfHeal}
          parallel={parallel}
          onParallel={onParallel}
          browser={browser}
          onBrowser={onBrowser}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}

// ---- brand ---------------------------------------------------------------
// The mark lives in ./TestExpressMark, so the public landing page can wear the
// same logo without importing this module to get it.

// ---- icons ---------------------------------------------------------------
// Inline SVG rather than emoji. The 🗑 that used to be here had no glyph in the
// default Windows UI font stack and rendered as an empty tofu box, and the rest
// of the emoji this UI wants are a lottery across platforms. A path is not:
// it inherits currentColor, stays sharp at any size, adds no request and cannot
// 404. Every icon is drawn on the same 24×24 grid with the same stroke weight,
// so they stay optically matched wherever they sit next to each other.
const Icon = ({ size = 13, children, ...rest }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    style={{ flexShrink: 0, display: "block" }}
    {...rest}
  >
    {children}
  </svg>
);

function TrashIcon(props) {
  return (
    <Icon {...props}>
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </Icon>
  );
}

// A project: the container everything else lives in.
function FolderIcon(props) {
  return (
    <Icon {...props}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </Icon>
  );
}

// A suite: stacked sheets, because a suite is many test cases seen as one.
function LayersIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 2 2 7l10 5 10-5z" />
      <path d="M2 12l10 5 10-5" />
      <path d="M2 17l10 5 10-5" />
    </Icon>
  );
}

// A test case.
function BeakerIcon(props) {
  return (
    <Icon {...props}>
      <path d="M8 3h8" />
      <path d="M9 3v6l-5 9a2 2 0 0 0 1.8 3h12.4a2 2 0 0 0 1.8-3l-5-9V3" />
      <path d="M6.6 15h10.8" />
    </Icon>
  );
}

// Tests belonging to no suite.
function InboxIcon(props) {
  return (
    <Icon {...props}>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </Icon>
  );
}

function PencilIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
    </Icon>
  );
}

// Named test data — the values steps refer to instead of literals.
function DatabaseIcon(props) {
  return (
    <Icon {...props}>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
      <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
    </Icon>
  );
}

function PlusIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

// Solid, not outlined: play reads as a button, and a hollow triangle at 10px
// reads as noise.
function PlayIcon(props) {
  return (
    <Icon fill="currentColor" stroke="none" {...props}>
      <path d="M8 5.5v13l11-6.5z" />
    </Icon>
  );
}

function StopIcon(props) {
  return (
    <Icon fill="currentColor" stroke="none" {...props}>
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
    </Icon>
  );
}

function ClockIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </Icon>
  );
}

// Past runs: the clock, wound back.
// Three bars of differing height: the mark every product uses for a report.
// Drawn on the same 24-grid as the rest so it can sit in a row of them without
// the line reflowing.
function ChartIcon(props) {
  return (
    <Icon {...props}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </Icon>
  );
}

function HistoryIcon(props) {
  return (
    <Icon {...props}>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7.5V12l3 1.8" />
    </Icon>
  );
}

// Export / import. The ⭳ and ⭱ these replace are outside the basic glyph
// coverage of several shipped fonts.
function DownloadIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 3v12" />
      <path d="M7 11l5 5 5-5" />
      <path d="M4 20h16" />
    </Icon>
  );
}

function UploadIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 16V4" />
      <path d="M7 9l5-5 5 5" />
      <path d="M4 20h16" />
    </Icon>
  );
}

// The Playwright spec download: a file that is code.
function FileCodeIcon(props) {
  return (
    <Icon {...props}>
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
      <path d="M14 2v5h5" />
      <path d="M10 13l-2 2 2 2M14 13l2 2-2 2" />
    </Icon>
  );
}

// Two nodes feeding a third: the shape every CI product uses for a pipeline.
function PipelineIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="5" cy="6" r="2" />
      <circle cx="5" cy="18" r="2" />
      <circle cx="19" cy="12" r="2" />
      <path d="M7 6h4a2 2 0 0 1 2 2v2M7 18h4a2 2 0 0 0 2-2v-2M13 12h4" />
    </Icon>
  );
}

// Two sheets, offset. The universal copy mark.
function CopyIcon(props) {
  return (
    <Icon {...props}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
    </Icon>
  );
}

// Confirmation that something landed. Drawn on the same grid as the rest so it
// can swap in for another icon without the row reflowing by a pixel.
function CheckIcon(props) {
  return (
    <Icon {...props}>
      <path d="M20 6L9 17l-5-5" />
    </Icon>
  );
}

// Headed vs headless. Deliberately not a moon — that now means dark theme two
// buttons away, and "headless" is about whether you can watch the run.
function MonitorIcon(props) {
  return (
    <Icon {...props}>
      <rect x="2.5" y="4" width="19" height="12" rx="2" />
      <path d="M9 20h6M12 16v4" />
    </Icon>
  );
}

// The drag handle on the insert-step palette's header. Six dots is the
// convention for "this can be moved", and drawn rather than typed for the
// reason at the top of this section — the braille glyph usually used for it has
// no coverage in the default Windows UI font stack and lands as a tofu box.
function GripIcon(props) {
  return (
    <Icon fill="currentColor" stroke="none" {...props}>
      <circle cx="9" cy="6" r="1.6" />
      <circle cx="15" cy="6" r="1.6" />
      <circle cx="9" cy="12" r="1.6" />
      <circle cx="15" cy="12" r="1.6" />
      <circle cx="9" cy="18" r="1.6" />
      <circle cx="15" cy="18" r="1.6" />
    </Icon>
  );
}

// A native recording, against the MonitorIcon above: the two sit side by side
// in the rail's type chip, so a phone drawn on the same grid at the same stroke
// weight is what makes them read as one pair rather than two decorations.
function MobileIcon(props) {
  return (
    <Icon {...props}>
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <path d="M10.5 18.5h3" />
    </Icon>
  );
}

function EyeOffIcon(props) {
  return (
    <Icon {...props}>
      <path d="M10.6 5.2A9.9 9.9 0 0 1 12 5c5.5 0 9 6 9 6a15.6 15.6 0 0 1-3 3.6" />
      <path d="M6.3 6.7A15.6 15.6 0 0 0 3 11s3.5 6 9 6a9.6 9.6 0 0 0 4.4-1.1" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="M3 3l18 18" />
    </Icon>
  );
}

// Self-healing on: a locator that repairs itself.
function WandIcon(props) {
  return (
    <Icon {...props}>
      <path d="M4 20L16.5 7.5" />
      <path d="M18 3.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" />
      <path d="M6.5 4.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4L4.5 6.5l1.4-.6z" />
    </Icon>
  );
}

// Two lanes moving at once: a pipeline given every core.
//
// Lanes with arrowheads rather than the usual three stacked bars, which at 12px
// is indistinguishable from a list icon — the heads are what say these are
// running rather than merely stacked, and two of them is what says "more than
// one", against the single lane below.
function ParallelIcon(props) {
  return (
    <Icon {...props}>
      <path d="M3 8h13M3 16h13" />
      <path d="M17 5l4 3-4 3M17 13l4 3-4 3" />
    </Icon>
  );
}

// One lane: a pipeline walked a test at a time.
function SequentialIcon(props) {
  return (
    <Icon {...props}>
      <path d="M3 12h13" />
      <path d="M17 9l4 3-4 3" />
    </Icon>
  );
}

// Self-healing off: what was recorded is what runs.
function LockIcon(props) {
  return (
    <Icon {...props}>
      <rect x="4" y="10.5" width="16" height="10" rx="2" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
    </Icon>
  );
}

/** Several people: a team, as opposed to the single figure for an account. */
function UsersIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="8" r="3.4" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 5.2a3.4 3.4 0 0 1 0 5.6M17.5 14.4A6.5 6.5 0 0 1 21.5 20" />
    </Icon>
  );
}

function UserIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </Icon>
  );
}

function GearIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 3 15H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 10 4.6V4a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0 1.2 2.9H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5.9z" />
    </Icon>
  );
}

function LogOutIcon(props) {
  return (
    <Icon {...props}>
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <path d="M10 17l-5-5 5-5" />
      <path d="M5 12h12" />
    </Icon>
  );
}

function SunIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Icon>
  );
}

// ---- browser engines -----------------------------------------------------
// Drawn in the same line-art style as every other icon here — one stroke
// weight, currentColor — rather than pasted brand logos. That is deliberate:
// these sit inside segmented controls that recolour on selection, and a
// full-colour logo would be the only thing in the UI ignoring the theme. Each
// is the *silhouette* the mark is known by, which is what has to survive at
// 12px; the label beside it carries the name.

// Chrome/Chromium: a ring, a hub, and the three seams between its sectors —
// down, upper-left, upper-right, as on the real mark.
function ChromiumIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3.2" />
      {/* Seams inset at both ends rather than run wall to wall: at 12px a spoke
          that touches both the hub and the ring closes the gap and the whole
          mark fills in as a disc. */}
      <path d="M12 17.1v3.2" />
      <path d="M16.4 9.4 19.1 7.8" />
      <path d="M7.6 9.4 4.9 7.8" />
    </Icon>
  );
}

// Firefox: the flame. The fox curled round a globe is unreadable at this size,
// where the flame outline still is.
function FirefoxIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 2.8c.9 2.3 2.3 3.6 3.6 4.9 1.5 1.6 2.6 3.3 2.6 5.5A6.2 6.2 0 0 1 12 19.4a6.2 6.2 0 0 1-6.2-6.2c0-1.9.8-3.2 1.9-4.5.5.9 1.2 1.4 2.1 1.7-.4-2.6.8-5.4 2.2-7.6z" />
      <path d="M12 19.4a3 3 0 0 0 1.6-5.6c-.5 1-1.3 1.5-2.3 1.8-.9.3-1.6.9-1.6 1.9A2 2 0 0 0 12 19.4z" />
    </Icon>
  );
}

// WebKit: Safari's compass, which is how the engine is recognised — the needle
// in a ring, with the cardinal ticks left off as noise at this size.
function WebKitIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.8 8.2 10.9 10.9 8.2 15.8 13.1 13.1z" />
    </Icon>
  );
}

// A browser this build has no mark for — an id from a stored preference or an
// old report, so it still gets an icon rather than a gap.
function GlobeIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18z" />
    </Icon>
  );
}

// The  engine is not a Playwright browser — it is the one you are in,
// driving an iframe — so it takes the screen glyph, not an engine mark.
const browserIconFor = (id) =>
  ({
    chromium: ChromiumIcon,
    firefox: FirefoxIcon,
    webkit: WebKitIcon,
    "": MonitorIcon,
  })[id] || GlobeIcon;

// Dismiss.
function XIcon(props) {
  return (
    <Icon {...props}>
      <path d="M18 6L6 18M6 6l12 12" />
    </Icon>
  );
}

function MoonIcon(props) {
  return (
    <Icon {...props}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </Icon>
  );
}

// Folded/unfolded is the same glyph rotated, so the two states cannot drift
// apart — and the rotation animates, which the two separate ▸/▾ glyphs could
// never do.
function ChevronIcon({ open, size = 11 }) {
  return (
    <Icon
      size={size}
      style={{
        flexShrink: 0,
        display: "block",
        transform: open ? "rotate(90deg)" : "none",
        transition: "transform 0.15s ease",
      }}
    >
      <path d="M9 18l6-6-6-6" />
    </Icon>
  );
}

// The same chevron again, pointing along a list rather than into a fold —
// previous/next on the tree's pagers, and up/down on the account menu. One
// glyph turned four ways rather than four glyphs, so they cannot drift apart.
const CARET_TURN = { right: 0, down: 90, left: 180, up: 270 };

function CaretIcon({ dir = "right", size = 11 }) {
  return (
    <Icon
      size={size}
      style={{
        flexShrink: 0,
        display: "block",
        transform: `rotate(${CARET_TURN[dir] || 0}deg)`,
        transition: "transform 0.15s ease",
      }}
    >
      <path d="M9 18l6-6-6-6" />
    </Icon>
  );
}

function StatusIcon({ status }) {
  if (status === "running")
    return <span style={{ ...S.icon, ...S.spin, borderTopColor: "#38bdf8" }} />;
  if (status === "passed")
    return <span style={{ ...S.iconSolid, background: "#22c55e" }}>✓</span>;
  if (status === "failed")
    return <span style={{ ...S.iconSolid, background: "#ef4444" }}>✕</span>;
  if (status === "skipped")
    return <span style={{ ...S.iconSolid, background: "var(--tr-border-strong)", color: "var(--tr-soft)" }}>–</span>;
  return <span style={{ ...S.iconSolid, background: "var(--tr-border)", color: "var(--tr-muted)", border: "1px solid #334155" }} />;
}

// ---- styles -------------------------------------------------------------
const S = {
  page: {
    minHeight: "100vh",
    background: "var(--tr-bg)",
    color: "var(--tr-text)",
    fontFamily: "'Outfit', system-ui, sans-serif",
    display: "flex",
    flexDirection: "column",
  },
  topbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 20px",
    borderBottom: "1px solid #1e293b",
    background: "var(--tr-panel)",
    flexWrap: "wrap",
    gap: 12,
  },
  // Italic, heavy, letter-spaced, in the brand colour — matching the mark
  // beside it. Its own token rather than the pass green it used to borrow: the
  // product's name is not a status, and sharing a variable with one meant the
  // wordmark could only ever be whatever colour "passed" was.
  wordmark: {
    fontSize: 17,
    fontWeight: 900,
    fontStyle: "italic",
    letterSpacing: "0.06em",
    color: "var(--tr-brand)",
    lineHeight: 1.1,
  },
  playwrightDot: {
    width: 34,
    height: 34,
    borderRadius: 9,
    background: "radial-gradient(circle at 35% 30%, #4ade80, #16a34a 70%)",
    boxShadow: "0 0 0 3px rgba(34,197,94,0.15)",
    display: "inline-block",
    flexShrink: 0,
  },
  title: { fontSize: 16, fontWeight: 800, letterSpacing: "-0.01em" },
  subtitle: { fontSize: 12, color: "var(--tr-dim)" },
  // ---- footer ---------------------------------------------------------------
  footer: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
    padding: "16px 24px",
    borderTop: "1px solid #1e293b",
    background: "var(--tr-panel)",
  },
  footerText: { fontSize: 12, color: "var(--tr-dim)" },
  footerSocial: { display: "flex", alignItems: "center", gap: 10 },
  footerSocialLink: { lineHeight: 0 },
  // ---- account ------------------------------------------------------------
  topbarDivider: {
    width: 1,
    alignSelf: "stretch",
    minHeight: 24,
    background: "var(--tr-border)",
    margin: "0 2px",
    flexShrink: 0,
  },
  // The pressable wrapper: avatar, then who is signed in, then the caret.
  // Padded tighter on the left so the circle sits where it did before and the
  // text and caret are what the row grew by.
  avatarBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "3px 9px 3px 3px",
    background: "transparent",
    border: "1px solid transparent",
    borderRadius: 999,
    color: "var(--tr-soft)",
    cursor: "pointer",
    fontFamily: "inherit",
    flexShrink: 0,
  },
  // Name over email, beside the picture. Capped rather than free-flowing: the
  // top bar is a single row of controls, and an address like
  // "firstname.lastname@some-practice.example.com" would otherwise push Export
  // and Import off the end of it on a narrow window.
  avatarWho: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    maxWidth: 190,
    textAlign: "left",
    lineHeight: 1.25,
  },
  avatarName: {
    fontSize: 12.5,
    fontWeight: 700,
    color: "var(--tr-text)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  avatarEmail: {
    fontSize: 10.5,
    fontWeight: 500,
    color: "var(--tr-dim)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  // The two chips share a line and wrap, because "Receptionist" and
  // "Enterprise" together are wider than the 190px column.
  avatarTags: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
    maxWidth: "100%",
  },
  // The plan. Neutral rather than accent-coloured, so it does not read as a
  // second role — the accent chip beside it is the role, and two identical
  // chips would invite comparing the wrong pair of words.
  avatarPlan: {
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--tr-soft)",
    background: "var(--tr-track)",
    border: "1px solid var(--tr-border-strong)",
    borderRadius: 999,
    padding: "0 6px",
    lineHeight: "14px",
    whiteSpace: "nowrap",
    cursor: "help",
  },
  // The role, as its own chip under the email. alignSelf rather than a block:
  // a chip stretched to the 190px column would read as a bar, and it has to be
  // as wide as the word it holds.
  avatarRole: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--tr-accent)",
    background: "var(--tr-accent-bg-2)",
    border: "1px solid var(--tr-accent-line)",
    borderRadius: 999,
    padding: "0 6px",
    lineHeight: "14px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  avatar: {
    width: AVATAR_PX,
    height: AVATAR_PX,
    borderRadius: 999,
    // Clips the photo to the circle here rather than leaving it to the image's
    // own radius: a rounded image anti-aliased over the gradient behind it
    // leaves a soft halo at its edge, which reads as a blurred picture.
    overflow: "hidden",
    padding: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "inherit",
    fontSize: 12.5,
    fontWeight: 900,
    letterSpacing: "0.02em",
    cursor: "pointer",
    flexShrink: 0,
  },
  // Signed in: the brand gradient, same two stops as the TestExpress mark.
  avatarKnown: {
    background: "linear-gradient(160deg, #5ff0c4, #21b58d)",
    color: "#04231a",
    border: "1px solid rgba(95,240,196,0.55)",
  },
  avatarAnon: {
    background: "var(--tr-border)",
    color: "var(--tr-soft)",
    border: "1px solid #334155",
  },
  menu: {
    position: "absolute",
    top: "calc(100% + 8px)",
    right: 0,
    zIndex: 90, // under the recorder modal (100), over the page
    width: 244,
    background: "var(--tr-bg)",
    border: "1px solid #334155",
    borderRadius: 12,
    boxShadow: "0 18px 44px rgba(0,0,0,0.5)",
    padding: 6,
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  // All that is left here: the practice. The picture, the name, the email and
  // the role have all moved to the button above, so this is a single chip
  // rather than an identity block, and it wraps because a practice name can be
  // longer than the menu is wide.
  menuHead: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 5,
    padding: "6px 8px 9px",
    borderBottom: "1px solid #1e293b",
    marginBottom: 4,
  },
  menuName: {
    fontSize: 13,
    fontWeight: 700,
    color: "var(--tr-text)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  menuSub: {
    fontSize: 11,
    color: "var(--tr-dim)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  roleChip: {
    fontSize: 9.5,
    fontWeight: 800,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--tr-accent)",
    background: "rgba(95,240,196,0.1)",
    border: "1px solid rgba(95,240,196,0.3)",
    borderRadius: 999,
    padding: "1px 7px",
    display: "inline-block",
  },
  menuItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    background: "transparent",
    border: "none",
    borderRadius: 8,
    padding: "8px 9px",
    fontFamily: "inherit",
    fontSize: 12.5,
    fontWeight: 600,
    color: "var(--tr-text-2)",
    cursor: "pointer",
    textAlign: "left",
  },
  // ---- user settings modal ------------------------------------------------
  setBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(2,6,23,0.72)",
    backdropFilter: "blur(3px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    // Above the recorder modal (100) and its floating palette (120): settings
    // is opened on top of whatever is already on screen and must not land under
    // it.
    zIndex: 130,
  },
  setCard: {
    width: 540,
    maxWidth: "96vw",
    maxHeight: "88vh",
    background: "var(--tr-bg)",
    border: "1px solid #334155",
    borderRadius: 16,
    boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    // The menu this opens from is right-aligned; the sheet is not.
    textAlign: "left",
    cursor: "default",
  },
  setHead: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "13px 16px",
    borderBottom: "1px solid #1e293b",
    background: "var(--tr-panel)",
    color: "var(--tr-text)",
  },
  setTitle: { flex: 1, fontSize: 14.5, fontWeight: 800, letterSpacing: "-0.01em" },
  setClose: {
    background: "transparent",
    border: "1px solid var(--tr-border-strong)",
    color: "var(--tr-soft)",
    borderRadius: 8,
    width: 26,
    height: 26,
    padding: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
  },
  setBody: {
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 20,
    overflowY: "auto",
    minHeight: 0,
  },
  setSection: { display: "flex", flexDirection: "column", gap: 11 },
  setSectionLabel: {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "var(--tr-muted)",
  },
  setIdentity: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    padding: 12,
    background: "var(--tr-panel)",
    border: "1px solid #1e293b",
    borderRadius: 12,
  },
  setRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
  },
  setRowText: { flex: "1 1 260px", minWidth: 0 },
  setRowName: { fontSize: 12.5, fontWeight: 700, color: "var(--tr-text-2)" },
  setRowHint: { fontSize: 11, lineHeight: 1.45, color: "var(--tr-dim)", marginTop: 3 },
  setValue: { fontFamily: mono, fontSize: 12, fontWeight: 700, color: "var(--tr-soft)", flexShrink: 0 },

  // ---- test data -------------------------------------------------------
  // The strip under a step's value box.
  dataTools: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 5,
  },
  dataToolBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    background: "transparent",
    border: "1px dashed var(--tr-border-strong)",
    borderRadius: 999,
    padding: "2px 9px",
    color: "var(--tr-muted)",
    fontFamily: "inherit",
    fontSize: 10,
    fontWeight: 700,
    cursor: "pointer",
  },
  dataPreview: {
    fontSize: 10.5,
    color: "var(--tr-accent)",
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  dataTokenSelect: {
    background: "var(--tr-bg)",
    border: "1px solid #334155",
    borderRadius: 999,
    padding: "2px 6px",
    color: "var(--tr-muted)",
    fontFamily: "inherit",
    fontSize: 10,
    fontWeight: 700,
    outline: "none",
    cursor: "pointer",
  },
  // A reference nothing provides. Deliberately loud: the step will type the
  // braces into the field and fail on whatever the app makes of them.
  dataMissing: {
    fontSize: 10.5,
    fontWeight: 700,
    color: "var(--tr-rec)",
  },
  // The banner above the steps list when a run would hit a missing reference.
  // Work in progress, not a fault: the same box as dataWarn in the neutral
  // info colour. Red here would say the start had already gone wrong, which is
  // the exact misreading this state exists to prevent.
  // Tinted from --tr-info's own value rather than a token pair, matching how
  // dataWarn tints itself from the failure red. Both themes carry a legible
  // --tr-info on this wash.
  appiumStarting: {
    background: "rgba(56,189,248,0.1)",
    border: "1px solid rgba(56,189,248,0.35)",
    color: "var(--tr-info)",
    whiteSpace: "normal",
  },
  dataWarn: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    margin: "0 10px 8px",
    padding: "7px 10px",
    borderRadius: 8,
    background: "rgba(248,113,113,0.1)",
    border: "1px solid rgba(248,113,113,0.35)",
    color: "var(--tr-rec)",
    fontSize: 11,
    fontWeight: 600,
    lineHeight: 1.5,
  },
  // Which data set a test runs against, in its details panel.
  dataSetPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "var(--tr-bg)",
    border: "1px solid var(--tr-border-strong)",
    borderRadius: 999,
    padding: "2px 4px 2px 10px",
    fontSize: 11,
    color: "var(--tr-muted)",
    fontWeight: 700,
  },
  dataSetSelect: {
    background: "transparent",
    border: "none",
    color: "var(--tr-soft)",
    fontFamily: "inherit",
    fontSize: 11,
    fontWeight: 700,
    outline: "none",
    cursor: "pointer",
    maxWidth: 160,
  },
  // ---- the test data editor -------------------------------------------
  dataLayout: { display: "flex", gap: 14, alignItems: "flex-start" },
  dataSetList: {
    width: 190,
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  dataSetRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    width: "100%",
    padding: "7px 9px",
    borderRadius: 8,
    border: "1px solid transparent",
    background: "transparent",
    color: "var(--tr-text-2)",
    fontFamily: "inherit",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    textAlign: "left",
  },
  dataSetRowOn: {
    background: "var(--tr-panel-2)",
    border: "1px solid var(--tr-accent-line)",
    color: "var(--tr-text)",
  },
  dataSetCount: { marginLeft: "auto", fontSize: 10, color: "var(--tr-muted)", fontWeight: 700 },
  // The ×N / "row 2/5" markers. Deliberately the same shape wherever an
  // iteration count is shown — the recorder header, the report bar and the set
  // list — so the number reads as one fact appearing in three places.
  iterPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "1px 6px",
    borderRadius: 6,
    border: "1px solid var(--tr-border-strong)",
    fontSize: 10,
    fontWeight: 700,
    color: "var(--tr-soft)",
    whiteSpace: "nowrap",
  },
  // One row of the report's iteration strip. A button rather than a tab strip:
  // twelve rows do not fit as tabs, and the label is the useful part.
  // ---- reports ------------------------------------------------------------
  // A headline number and its caption. Wide enough for "100%" without the row
  // reflowing as the figures change.
  reportTile: {
    flex: "1 1 96px",
    minWidth: 96,
    padding: "9px 11px",
    borderRadius: 9,
    background: "var(--tr-sunken)",
    border: "1px solid var(--tr-border)",
  },
  reportTileValue: { fontSize: 19, fontWeight: 800, lineHeight: 1.1, fontVariantNumeric: "tabular-nums" },
  reportTileLabel: { fontSize: 9.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--tr-muted)", marginTop: 3 },
  reportTable: { display: "flex", flexDirection: "column", gap: 2, minWidth: 0 },
  reportHeadRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0,2fr) 44px 92px 52px 62px 78px 88px",
    gap: 8,
    padding: "0 8px 4px",
    fontSize: 9.5,
    fontWeight: 800,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--tr-muted)",
  },
  reportRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0,2fr) 44px 92px 52px 62px 78px 88px",
    gap: 8,
    alignItems: "center",
    width: "100%",
    textAlign: "left",
    padding: "7px 8px",
    borderRadius: 8,
    border: "1px solid transparent",
    background: "var(--tr-sunken)",
    color: "var(--tr-text)",
    font: "inherit",
    cursor: "pointer",
  },
  // A column heading that sorts. Styled as text, not a button: it has to read
  // as a heading first, or the row stops looking like a table header.
  reportSortBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 3,
    background: "transparent",
    border: "none",
    padding: 0,
    font: "inherit",
    fontSize: 9.5,
    fontWeight: 800,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--tr-muted)",
    cursor: "pointer",
    textAlign: "left",
  },
  // Pass/fail per run, oldest left. Colour is the only channel — at 3px a bar
  // height would encode nothing anyone could read.
  reportSparkRow: { display: "inline-flex", alignItems: "flex-end", gap: 2, height: 12 },
  reportSparkBar: { width: 3, height: 11, borderRadius: 1, display: "inline-block" },
  // ---- the failure roll-up ------------------------------------------------
  failRow: {
    display: "grid",
    gridTemplateColumns: "34px minmax(0,1fr) auto",
    gap: 9,
    alignItems: "center",
    padding: "7px 9px",
    borderRadius: 8,
    background: "var(--tr-sunken)",
    border: "1px solid rgba(248,113,113,0.25)",
  },
  failCount: {
    fontFamily: mono,
    fontSize: 12,
    fontWeight: 800,
    color: "var(--tr-rec)",
    textAlign: "center",
  },
  failStep: { display: "block", fontSize: 11.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  failVerb: { fontFamily: mono, fontSize: 10, color: "var(--tr-rec)", marginRight: 6, fontWeight: 700 },
  failTests: { display: "block", fontSize: 10, color: "var(--tr-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  reportName: { display: "block", fontWeight: 700, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  reportSuite: { display: "block", fontSize: 10, color: "var(--tr-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  // A selected engine in the CI/CD modal. Same accent the live data set wears,
  // so "this one is on" reads the same wherever it appears.
  cicdChipOn: {
    color: "var(--tr-accent)",
    borderColor: "rgba(10,200,242,0.45)",
    background: "rgba(10,200,242,0.1)",
  },
  cicdCodeWrap: {
    border: "1px solid var(--tr-border)",
    borderRadius: 9,
    overflow: "hidden",
    background: "var(--tr-bg)",
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
  },
  iterChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    maxWidth: 220,
    padding: "3px 8px",
    borderRadius: 7,
    border: "1px solid var(--tr-border)",
    background: "transparent",
    color: "var(--tr-soft)",
    fontSize: 11,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: "pointer",
    flexShrink: 0,
  },
  iterChipOn: {
    borderColor: "var(--tr-accent)",
    color: "var(--tr-text)",
    background: "rgba(10,200,242,0.10)",
  },
  iterStrip: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "7px 12px",
    borderBottom: "1px solid var(--tr-border)",
    overflowX: "auto",
  },
  // The rows table in the Test Data editor.
  dataRowGrid: {
    display: "grid",
    gap: 6,
    alignItems: "center",
    marginBottom: 6,
  },
  dataRowHead: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: "var(--tr-muted)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  dataRowNum: {
    fontSize: 10.5,
    fontWeight: 700,
    color: "var(--tr-muted)",
    fontVariantNumeric: "tabular-nums",
    textAlign: "right",
  },
  dataGrid: { flex: 1, minWidth: 0 },
  dataVarRow: {
    display: "grid",
    // key · value · varies · secret · delete — the value gets the room because
    // it is the part that is read and edited most.
    gridTemplateColumns: "minmax(96px, 1fr) minmax(0, 2fr) auto auto auto",
    gap: 6,
    alignItems: "center",
    marginBottom: 5,
  },
  dataInput: {
    width: "100%",
    minWidth: 0,
    background: "var(--tr-bg)",
    border: "1px solid #334155",
    borderRadius: 7,
    padding: "5px 8px",
    color: "var(--tr-text)",
    fontFamily: mono,
    fontSize: 11.5,
    outline: "none",
  },
  dataHeadRow: {
    display: "grid",
    gridTemplateColumns: "minmax(96px, 1fr) minmax(0, 2fr) auto auto auto",
    gap: 6,
    fontSize: 9.5,
    fontWeight: 800,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "var(--tr-muted)",
    marginBottom: 5,
  },
  dataSecretBtn: {
    background: "transparent",
    border: "1px solid #334155",
    borderRadius: 7,
    padding: "4px 7px",
    color: "var(--tr-muted)",
    fontFamily: "inherit",
    fontSize: 10,
    fontWeight: 700,
    cursor: "pointer",
  },
  dataVariesOn: {
    color: "var(--tr-accent)",
    borderColor: "rgba(10,200,242,0.45)",
    background: "rgba(10,200,242,0.1)",
  },
  dataSecretOn: {
    color: "var(--tr-warn)",
    borderColor: "rgba(251,191,36,0.45)",
    background: "rgba(251,191,36,0.1)",
  },
  dataTokenRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    padding: "5px 0",
    fontSize: 11,
    borderTop: "1px solid #1e293b",
  },
  setFoot: {
    display: "flex",
    justifyContent: "flex-end",
    padding: "12px 16px",
    borderTop: "1px solid #1e293b",
    background: "var(--tr-panel)",
  },
  btn: {
    border: "none",
    borderRadius: 9,
    padding: "9px 14px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  // Any button whose label is an icon followed by a word.
  btnIcon: { display: "inline-flex", alignItems: "center", gap: 7, lineHeight: 1 },
  btnRun: { background: "#22c55e", color: "#052e16" },
  // The corporate indigo, the same hue the plan badges use in Super Admin and
  // on the landing page — so "this is the organisation's" reads as one colour
  // across the app rather than three unrelated accents.
  btnCorporate: {
    color: "#a5b4fc",
    borderColor: "rgba(129,140,248,0.45)",
    background: "rgba(129,140,248,0.12)",
  },
  btnStop: { background: "#ef4444", color: "#fff" },
  btnRec: {
    background: "var(--tr-rec-bg)",
    color: "var(--tr-rec)",
    border: "1px solid var(--tr-rec-line)",
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
  },
  recDotSm: {
    width: 9,
    height: 9,
    borderRadius: 999,
    background: "#ef4444",
    display: "inline-block",
    animation: "recpulse 1.4s ease-in-out infinite",
  },
  suiteEdit: {
    background: "transparent",
    border: "1px solid var(--tr-border-strong)",
    color: "var(--tr-soft)",
    borderRadius: 7,
    width: 24,
    height: 24,
    padding: 0,
    cursor: "pointer",
    fontSize: 12,
    flexShrink: 0,
    marginRight: 4,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
  },
  suiteDelete: {
    background: "transparent",
    border: "1px solid #7f1d1d",
    color: "var(--tr-rec)",
    borderRadius: 7,
    width: 24,
    height: 24,
    padding: 0,
    cursor: "pointer",
    flexShrink: 0,
    marginRight: 4,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
  },
  btnGhost: {
    background: "var(--tr-border)",
    color: "var(--tr-text-2)",
    border: "1px solid #334155",
  },
  body: { display: "flex", flex: 1, minHeight: 0, alignItems: "stretch" },
  sidebar: {
    // Three levels of tree plus a row of actions does not fit in 300.
    width: 340,
    flexShrink: 0,
    borderRight: "1px solid var(--tr-border)",
    background: "var(--tr-panel)",
    padding: "0 8px 20px",
    overflowY: "auto",
  },
  // Same border and background as the open rail, so collapsing reads as that
  // edge narrowing rather than as a different panel taking its place.
  railStub: {
    width: 34,
    flexShrink: 0,
    borderRight: "1px solid var(--tr-border)",
    background: "var(--tr-panel)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
    padding: "12px 0",
  },
  railStubLabel: {
    writingMode: "vertical-rl",
    fontFamily: mono,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.14em",
    color: "var(--tr-dim)",
    userSelect: "none",
    whiteSpace: "nowrap",
  },
  // Sticky so the tree scrolls under its own heading and "+ Project" stays
  // reachable from the bottom of a long list.
  sidebarHead: {
    position: "sticky",
    top: 0,
    zIndex: 2,
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.12em",
    color: "var(--tr-muted)",
    padding: "12px 4px 10px",
    marginBottom: 4,
    background: "var(--tr-panel)",
    borderBottom: "1px solid var(--tr-border)",
  },
  sidebarCount: {
    fontFamily: mono,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 0,
    color: "var(--tr-dim)",
    background: "var(--tr-panel-2)",
    border: "1px solid var(--tr-border)",
    borderRadius: 999,
    padding: "1px 7px",
  },
  suiteRow: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    padding: "8px 8px",
    borderRadius: 9,
    cursor: "pointer",
    marginBottom: 2,
  },
  // ---- Project › Suite › Test case tree ----------------------------------
  // Depth is carried by indentation, weight and one guide line rather than by
  // boxes: three nested cards in a 340px rail leaves no room for the names.
  treeGroup: { marginBottom: 12 },
  // Everything nested under a project or a suite. The border is the guide
  // line; because consecutive rows inside share it, it reads as one unbroken
  // stroke from the parent down past its last child.
  treeChildren: {
    marginLeft: 15,
    paddingLeft: 8,
    borderLeft: "1px solid var(--tr-border)",
  },
  projectRow: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    padding: "9px 8px",
    borderRadius: 10,
    cursor: "pointer",
    border: "1px solid var(--tr-border)",
  },
  projectName: {
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: "0.02em",
    color: "var(--tr-accent)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  suiteHeadRow: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    padding: "7px 8px 7px 6px",
    marginTop: 4,
    borderRadius: 8,
    cursor: "pointer",
  },
  suiteHeadName: {
    fontSize: 12.5,
    fontWeight: 700,
    color: "var(--tr-text-2)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  testRow: { padding: "7px 8px 7px 6px", marginBottom: 0 },
  // The case number. Right-aligned in a fixed box so the numbers form a column
  // and every name below starts at the same x — the same treatment the step
  // numbers get in the recorder's list (REC.recNum).
  testNum: {
    fontFamily: mono,
    fontVariantNumeric: "tabular-nums",
    fontSize: 10.5,
    fontWeight: 700,
    color: "var(--tr-muted)",
    width: 18,
    flexShrink: 0,
    textAlign: "right",
    userSelect: "none",
  },
  // ---- ownership ---------------------------------------------------------
  // Two letters, and the colour carries the rest: your own tests are teal — the
  // same teal as your avatar in the top bar — and everyone else's are grey. That
  // is what makes a rail of thirty recordings answer "which of these are mine"
  // without being read.
  ownerDot: {
    width: 19,
    height: 19,
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 8.5,
    fontWeight: 900,
    letterSpacing: "0.02em",
    flexShrink: 0,
    background: "var(--tr-panel-2)",
    color: "var(--tr-soft)",
    border: "1px solid var(--tr-border-strong)",
    cursor: "default",
    // Clips the owner photograph to the circle.
    overflow: "hidden",
  },
  ownerDotMine: {
    background: "rgba(95,240,196,0.16)",
    color: "var(--tr-accent)",
    borderColor: "rgba(95,240,196,0.45)",
  },
  ownerChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    fontWeight: 700,
    color: "var(--tr-soft)",
    letterSpacing: 0,
  },
  ownerDotSm: {
    width: 16,
    height: 16,
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 7.5,
    fontWeight: 900,
    flexShrink: 0,
    background: "var(--tr-panel-2)",
    color: "var(--tr-soft)",
    border: "1px solid var(--tr-border-strong)",
    overflow: "hidden",
  },
  crumbSep: { color: "var(--tr-border-strong)" },
  // The row left behind while its copy is under the pointer.
  dragging: { opacity: 0.35 },
  caret: {
    color: "var(--tr-muted)",
    width: 11,
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
  },
  // The three tier icons. Shape carries the depth — folder, layers, beaker — so
  // a glance down the rail reads as a hierarchy even where the indentation is
  // clipped by a long name.
  //
  // The project and suite colours are fixed. A test case's is not: the row
  // overrides it with its last run's verdict (see verdictColor), so the colour
  // at the leaf level answers "did this pass?" rather than repeating "this is a
  // test", which its shape and its position already say. The value here is only
  // the fallback for a test that has never run.
  projectIcon: { color: "var(--tr-accent)", display: "inline-flex", alignItems: "center", flexShrink: 0 },
  suiteIcon: { color: "var(--tr-dim)", display: "inline-flex", alignItems: "center", flexShrink: 0 },
  testIcon: { color: "var(--tr-muted)", display: "inline-flex", alignItems: "center", flexShrink: 0 },
  addBtn: {
    background: "transparent",
    border: "1px solid var(--tr-border-strong)",
    color: "var(--tr-soft)",
    borderRadius: 7,
    padding: "3px 7px",
    fontSize: 10.5,
    fontWeight: 700,
    letterSpacing: 0,
    cursor: "pointer",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
    flexShrink: 0,
    marginRight: 4,
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    lineHeight: 1,
  },
  pager: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    padding: "5px 4px 2px 6px",
  },
  pagerLabel: {
    fontFamily: mono,
    fontSize: 10,
    color: "var(--tr-muted)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  pagerBtn: {
    background: "transparent",
    border: "1px solid var(--tr-border)",
    color: "var(--tr-soft)",
    borderRadius: 6,
    width: 21,
    height: 21,
    padding: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "inherit",
    flexShrink: 0,
  },
  treeHint: { padding: "8px 6px 10px", fontSize: 12, color: "var(--tr-muted)", lineHeight: 1.6 },
  treeEmpty: {
    padding: "6px 8px",
    fontSize: 11.5,
    fontStyle: "italic",
    color: "var(--tr-muted)",
  },
  assignSelect: {
    marginTop: 5,
    maxWidth: "100%",
    background: "var(--tr-bg)",
    border: "1px solid var(--tr-border-strong)",
    borderRadius: 6,
    color: "var(--tr-soft)",
    fontFamily: "inherit",
    fontSize: 11,
    padding: "2px 4px",
    cursor: "pointer",
  },
  crumbChip: {
    fontSize: 11,
    fontWeight: 700,
    color: "var(--tr-accent)",
    background: "rgba(95,240,196,0.1)",
    border: "1px solid rgba(95,240,196,0.3)",
    borderRadius: 999,
    padding: "3px 9px",
    whiteSpace: "nowrap",
    maxWidth: 240,
    overflow: "hidden",
    textOverflow: "ellipsis",
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
  },
  mainCrumb: {
    fontSize: 11.5,
    fontWeight: 700,
    letterSpacing: "0.04em",
    color: "var(--tr-dim)",
    marginBottom: 3,
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  suiteName: { fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  // Without nowrap this wrapped to three lines the moment the row got tight,
  // which is what made a squeezed row look broken rather than merely narrow.
  suiteDesc: {
    fontSize: 11,
    color: "var(--tr-dim)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  suiteRun: {
    background: "transparent",
    // --tr-info rather than --tr-accent: accent is mint in the dark theme,
    // and this needs to read blue under both. PlayIcon fills with
    // currentColor, so this one colour covers the label and the glyph.
    border: "1px solid color-mix(in srgb, var(--tr-info) 38%, transparent)",
    color: "var(--tr-info)",
    borderRadius: 7,
    height: 24,
    // Was a 24px square holding only the glyph. The "Run" label now sets the
    // width, so the box grows with the text instead of clipping it.
    padding: "0 7px",
    gap: 4,
    cursor: "pointer",
    fontSize: 10,
    fontWeight: 600,
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
    whiteSpace: "nowrap",
  },
  main: {
    flex: 1,
    minWidth: 0,
    padding: "18px 24px",
    overflowY: "auto",
  },
  emptyState: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: 24,
  },
  mainHead: { marginBottom: 18 },
  mainTitle: { fontSize: 18, fontWeight: 800 },
  mainDesc: { fontSize: 13, color: "var(--tr-dim)", marginTop: 3 },
  steps: { display: "flex", flexDirection: "column" },
  stepRow: { display: "flex", gap: 14 },
  stepGutter: { display: "flex", flexDirection: "column", alignItems: "center", width: 22 },
  stepNum: { fontFamily: mono, fontSize: 11, color: "var(--tr-border-strong)", lineHeight: "18px" },
  stepLine: { width: 2, flex: 1, background: "var(--tr-border)", minHeight: 14, marginTop: 2 },
  stepTop: { display: "flex", alignItems: "center", gap: 10, padding: "1px 0 4px" },
  actionTag: {
    fontFamily: mono,
    fontSize: 11,
    fontWeight: 700,
    border: "1px solid",
    borderRadius: 6,
    padding: "1px 7px",
    textTransform: "lowercase",
    flexShrink: 0,
  },
  stepName: { fontSize: 13.5, fontFamily: mono },
  reportBar: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 14px",
    marginBottom: 18,
    background: "var(--tr-panel)",
    border: "1px solid #1e293b",
    borderRadius: 10,
    flexWrap: "wrap",
  },
  verdict: {
    fontSize: 12,
    fontWeight: 800,
    borderRadius: 7,
    padding: "4px 10px",
    letterSpacing: "0.02em",
    flexShrink: 0,
  },
  reportStat: { fontSize: 12.5, color: "var(--tr-soft)" },
  // The suite-wide runner's label, in the brand green. It names the one control
  // that acts on *everything*, so it is the one worth colouring — the per-test
  // schedule bar stays neutral, and the difference is then visible rather than
  // something you read the label to find out.
  //
  // The strip this used to sit in is gone: the scheduler moved into the CI/CD
  // modal, beside the pipeline that answers the same question for CI.
  suiteScheduleLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12.5,
    fontWeight: 800,
    letterSpacing: "0.01em",
    color: "var(--tr-accent)",
    flexShrink: 0,
  },
  // Green-trimmed variants of the shared toggle group and button, applied only
  // inside this bar so the same components stay neutral everywhere else.
  paceAccent: { borderColor: "var(--tr-accent-line)" },
  paceBtnAccent: { background: "var(--tr-accent-bg-2)", color: "var(--tr-accent)" },
  btnAccent: {
    background: "var(--tr-accent-solid)",
    color: "var(--tr-accent-ink)",
    border: "1px solid var(--tr-accent-solid)",
  },
  // ---- tags ---------------------------------------------------------------
  // Wraps rather than scrolls: a test with six tags should show six tags, and
  // the rail has vertical room where it has none horizontally.
  tagRow: { display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 },
  // Web or Mobile, beside the tags but deliberately not one of them: the same
  // neutral treatment browserChip gets in the report bar, because both answer
  // "what was this run against" rather than "what did somebody call it".
  typeChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 3,
    fontSize: 9.5,
    fontWeight: 800,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    color: "var(--tr-soft)",
    background: "var(--tr-track)",
    border: "1px solid var(--tr-border-strong)",
    borderRadius: 999,
    padding: "0 6px",
    lineHeight: "15px",
    whiteSpace: "nowrap",
    cursor: "help",
  },
  tagChipSm: {
    fontFamily: mono,
    fontSize: 9.5,
    fontWeight: 700,
    color: "var(--tr-accent)",
    background: "var(--tr-accent-bg-2)",
    border: "1px solid var(--tr-accent-line)",
    borderRadius: 999,
    padding: "0 6px",
    lineHeight: "15px",
    whiteSpace: "nowrap",
  },
  tagChipMd: {
    fontFamily: mono,
    fontSize: 11,
    fontWeight: 700,
    color: "var(--tr-accent)",
    background: "var(--tr-accent-bg-2)",
    border: "1px solid var(--tr-accent-line)",
    borderRadius: 999,
    padding: "2px 10px",
    whiteSpace: "nowrap",
  },
  // The same chip with room for its remove button.
  tagChipEditable: {
    display: "inline-flex",
    alignItems: "center",
    gap: 3,
    padding: "2px 4px 2px 10px",
  },
  tagChipX: {
    background: "transparent",
    border: "none",
    color: "inherit",
    opacity: 0.65,
    cursor: "pointer",
    fontSize: 9,
    lineHeight: 1,
    padding: "3px 5px",
    borderRadius: 999,
    fontFamily: "inherit",
  },
  tagAddInput: {
    // Wide enough for "@regression" plus a little, and it does not grow: this
    // sits under the test's title, where a full-width input would read as the
    // page's main field rather than a small label control.
    width: 168,
    background: "var(--tr-bg)",
    border: "1px dashed var(--tr-border-strong)",
    borderRadius: 999,
    padding: "3px 11px",
    color: "var(--tr-text)",
    fontFamily: mono,
    fontSize: 11,
    outline: "none",
  },
  // Which browser a run used, in its report bar.
  browserChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: "var(--tr-soft)",
    background: "var(--tr-track)",
    border: "1px solid var(--tr-border-strong)",
    borderRadius: 999,
    padding: "2px 9px",
    whiteSpace: "nowrap",
  },
  // ---- run history --------------------------------------------------------
  flakyChip: {
    marginLeft: 5,
    fontSize: 9.5,
    fontWeight: 800,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    color: "var(--tr-warn)",
    background: "rgba(251,191,36,0.12)",
    border: "1px solid rgba(251,191,36,0.35)",
    borderRadius: 999,
    padding: "0 6px",
    flexShrink: 0,
  },
  spark: {
    display: "inline-flex",
    alignItems: "flex-end",
    gap: 2,
    flexShrink: 0,
    marginRight: 6,
  },
  sparkBar: { width: 3, borderRadius: 1, display: "block", opacity: 0.75 },
  histBar: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 12px",
    marginBottom: 12,
    background: "var(--tr-panel)",
    border: "1px solid var(--tr-border)",
    borderRadius: 10,
    flexWrap: "wrap",
  },
  histLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12.5,
    color: "var(--tr-soft)",
    flexShrink: 0,
  },
  histTrack: { display: "flex", alignItems: "flex-end", gap: 3, height: 30 },
  histBtn: {
    width: 14,
    height: "100%",
    padding: 0,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    background: "var(--tr-track)",
    border: "1px solid transparent",
    borderRadius: 4,
    cursor: "pointer",
    overflow: "hidden",
  },
  // The run on show. An outline rather than a fill — the fill is the bar, and
  // it already means something.
  histBtnActive: { borderColor: "var(--tr-accent)", background: "var(--tr-accent-bg-2)" },
  histBarInner: { width: 6, borderRadius: 2, display: "block" },
  histStat: { fontSize: 12, color: "var(--tr-soft)", fontFamily: mono, flexShrink: 0 },
  timeInput: {
    background: "var(--tr-bg)",
    border: "1px solid #334155",
    borderRadius: 7,
    padding: "4px 8px",
    color: "var(--tr-text)",
    fontFamily: mono,
    fontSize: 12,
    outline: "none",
  },
  diagBox: {
    fontFamily: mono,
    fontSize: 11.5,
    color: "var(--tr-text-2)",
    background: "var(--tr-panel)",
    border: "1px solid #1e293b",
    borderRadius: 8,
    padding: "10px 12px",
    lineHeight: 1.9,
    textAlign: "left",
    maxWidth: 460,
    width: "100%",
    overflowWrap: "anywhere",
  },
  diagKey: { color: "var(--tr-muted)", whiteSpace: "pre" },
  diagCandidate: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "7px 10px",
    background: "var(--tr-panel)",
    border: "1px solid #1e293b",
    borderRadius: 8,
    marginBottom: 6,
  },
  notice: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "9px 20px",
    fontSize: 13,
    borderBottom: "1px solid #1e293b",
  },
  noticeOk: { background: "rgba(34,197,94,0.1)", color: "var(--tr-pass)" },
  noticeBad: { background: "rgba(239,68,68,0.12)", color: "var(--tr-rec)" },
  noticeClose: {
    background: "transparent",
    border: "none",
    color: "inherit",
    cursor: "pointer",
    fontSize: 13,
    fontFamily: "inherit",
    flexShrink: 0,
  },
  // A repaired locator. Its own colour rather than the pass green: the step
  // did run, but it ran on a locator nobody recorded, and that is worth a
  // second look even when the run is green.
  healChip: {
    fontSize: 10.5,
    fontFamily: mono,
    color: "var(--tr-pick)",
    background: "color-mix(in srgb, var(--tr-pick) 12%, transparent)",
    border: "1px solid color-mix(in srgb, var(--tr-pick) 34%, transparent)",
    borderRadius: 6,
    padding: "1px 6px",
    flexShrink: 0,
    cursor: "help",
  },
  holdChip: {
    fontSize: 10.5,
    fontFamily: mono,
    color: "var(--tr-warn)",
    background: "rgba(251,191,36,0.1)",
    border: "1px solid rgba(251,191,36,0.3)",
    borderRadius: 6,
    padding: "1px 6px",
    flexShrink: 0,
  },
  durTrack: {
    width: 70,
    height: 4,
    borderRadius: 999,
    background: "var(--tr-track)",
    overflow: "hidden",
    flexShrink: 0,
  },
  durBar: { display: "block", height: "100%", borderRadius: 999 },
  dur: { fontSize: 11, color: "var(--tr-muted)", fontFamily: mono, width: 54, textAlign: "right", flexShrink: 0 },
  errBox: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    fontFamily: mono,
    fontSize: 12,
    color: "var(--tr-rec)",
    background: "rgba(239,68,68,0.08)",
    border: "1px solid rgba(239,68,68,0.25)",
    borderRadius: 8,
    padding: "8px 10px",
    margin: "2px 0 12px",
  },
  // A selector or a stack frame has no spaces to break at, so it has to be
  // allowed to break mid-token or it pushes the copy button off the row.
  errText: { flex: 1, minWidth: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" },
  // Sits inside the error box, so it borrows its red rather than introducing a
  // second colour to a block that is already saying one thing.
  copyBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    flexShrink: 0,
    padding: "3px 7px",
    fontSize: 11,
    fontFamily: "inherit",
    lineHeight: 1.4,
    color: "inherit",
    background: "transparent",
    border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: 6,
    cursor: "pointer",
    // The message can wrap to many lines; the button stays level with the first.
    alignSelf: "flex-start",
  },
  // ---- per-step evidence -------------------------------------------------
  // Clipped, non-interactive and the same width for every step, so a column of
  // them reads as a filmstrip of the run rather than as decoration.
  shotBox: {
    position: "relative",
    display: "block",
    overflow: "hidden",
    padding: 0,
    margin: "2px 0 12px",
    borderRadius: 8,
    border: "1px solid var(--tr-border)",
    background: "#fff",
    cursor: "zoom-in",
    flexShrink: 0,
  },
  shotImg: { display: "block", width: "100%" },
  // Which kind of evidence this is. It matters: a JPEG is what the page looked
  // like, a DOM snapshot is what the page *was* — and only one of them can be
  // trusted to show a canvas or a video frame.
  shotKind: {
    position: "absolute",
    bottom: 0,
    right: 0,
    fontFamily: mono,
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: "0.04em",
    color: "var(--tr-text)",
    background: "rgba(2,6,23,0.72)",
    borderTopLeftRadius: 6,
    padding: "1px 5px",
    pointerEvents: "none",
  },
  shotNote: {
    fontSize: 11,
    fontStyle: "italic",
    color: "var(--tr-muted)",
    margin: "2px 0 12px",
  },
  lightbox: {
    position: "fixed",
    inset: 0,
    zIndex: 130, // above the recorder modal (100) and its palette (120)
    background: "rgba(2,6,23,0.82)",
    backdropFilter: "blur(3px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  lightboxPanel: {
    maxWidth: "100%",
    maxHeight: "100%",
    display: "flex",
    flexDirection: "column",
    background: "var(--tr-bg)",
    border: "1px solid var(--tr-border-strong)",
    borderRadius: 12,
    boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
    overflow: "hidden",
  },
  lightboxHead: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "9px 10px 9px 13px",
    borderBottom: "1px solid var(--tr-border)",
    background: "var(--tr-panel)",
  },
  lightboxTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 12.5,
    fontWeight: 700,
    color: "var(--tr-text)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  lightboxMeta: { fontFamily: mono, fontSize: 11, color: "var(--tr-muted)", flexShrink: 0 },
  lightboxBody: { overflow: "auto", background: "#fff", minHeight: 0 },
  icon: {
    width: 16,
    height: 16,
    borderRadius: 999,
    border: "2px solid var(--tr-border)",
    display: "inline-block",
    boxSizing: "border-box",
    flexShrink: 0,
  },
  spin: { animation: "trspin 0.7s linear infinite" },
  iconSolid: {
    width: 16,
    height: 16,
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 10,
    fontWeight: 900,
    color: "#052e16",
    flexShrink: 0,
    boxSizing: "border-box",
  },
};

// keyframes for the running spinner and the record pulse
if (typeof document !== "undefined" && !document.getElementById("trspin-kf")) {
  const style = document.createElement("style");
  style.id = "trspin-kf";
  style.textContent =
    "@keyframes trspin{to{transform:rotate(360deg)}}" +
    "@keyframes recpulse{0%,100%{opacity:1}50%{opacity:0.35}}" +
    // Rename and delete are rare and destructive; they collapse to nothing
    // until the row is hovered, which is the width the name needs. Collapsed
    // with max-width rather than display:none on purpose — the buttons stay in
    // the accessibility tree and stay focusable, and focusing one trips
    // :focus-within, so a keyboard can still reach them. A device with no
    // hover never collapses them at all.
    ".tr-fade{display:inline-flex;align-items:center;max-width:0;opacity:0;overflow:hidden;" +
    "transition:max-width .16s ease,opacity .16s ease}" +
    ".tr-row:hover .tr-fade,.tr-row:focus-within .tr-fade{max-width:70px;opacity:1}" +
    "@media (hover:none){.tr-fade{max-width:70px;opacity:1}}" +
    // The "Choose file" half of the APK picker. A UA renders it as a light
    // grey chip with dark text, which is the one control in the recorder that
    // ignores the theme; it is only reachable from a stylesheet.
    ".tr-file::file-selector-button{font:inherit;font-size:12px;font-weight:700;" +
    "color:var(--tr-text);background:var(--tr-panel);border:1px solid var(--tr-border-strong);" +
    "border-radius:7px;padding:6px 10px;margin-right:10px;cursor:pointer}" +
    ".tr-file::file-selector-button:hover{background:var(--tr-hover-2)}" +
    ".tr-file:disabled{opacity:0.5}" +
    ".tr-file:disabled::file-selector-button{cursor:not-allowed}" +
    // The account button. Transparent until pointed at, then plainly a
    // control; and held in the pressed state for as long as its menu is open.
    ".tr-avatarbtn{transition:background .14s ease,border-color .14s ease}" +
    ".tr-avatarbtn:hover{background:var(--tr-hover);border-color:var(--tr-border-strong)}" +
    '.tr-avatarbtn[aria-expanded="true"]{background:var(--tr-hover-2);' +
    "border-color:var(--tr-border-strong)}" +
    // Row backgrounds live here rather than in the inline style objects: a
    // hover state cannot be expressed inline, and an inline background would
    // out-specify any rule written for one.
    ".tr-row{transition:background .14s ease,box-shadow .14s ease}" +
    ".tr-project{background:var(--tr-panel-2)}" +
    ".tr-project:hover{background:var(--tr-hover-2)}" +
    ".tr-suite:hover,.tr-test:hover{background:var(--tr-hover)}" +
    // The selected test case. A left bar as well as a fill, so it stays
    // identifiable while the pointer sits on some other row.
    ".tr-test.is-selected{background:var(--tr-hover-2);" +
    "box-shadow:inset 2px 0 0 0 #5ff0c4}" +
    // Footer social links: transparent until pointed at, same as the account
    // button — a plain, muted control rather than brand-coloured icons.
    ".tr-social-link{display:inline-flex;padding:6px;border-radius:8px;" +
    "color:var(--tr-dim);transition:background .14s ease,color .14s ease}" +
    ".tr-social-link:hover,.tr-social-link:focus-visible{" +
    "background:var(--tr-hover);color:var(--tr-text)}" +
    // Theme tokens. Every neutral in the UI resolves through these, so both
    // themes come from one place — and the recorder modal, being a descendant
    // of the themed root, inherits them without any extra wiring.
    '[data-tr-theme="dark"]{' +
    "--tr-bg:#0b1120;--tr-panel:#0f172a;--tr-panel-2:#0d1424;--tr-sunken:#0a0f1c;" +
    "--tr-track:#111c31;--tr-border:#1e293b;--tr-border-strong:#334155;" +
    "--tr-muted:#475569;--tr-dim:#64748b;--tr-soft:#94a3b8;" +
    "--tr-text-2:#cbd5e1;--tr-text:#e2e8f0;" +
    "--tr-hover:rgba(148,163,184,0.08);--tr-hover-2:rgba(148,163,184,0.15);" +
    // The brand green, as a set: text, hairline, wash, and a solid fill with
    // an ink that stays legible on it. The two themes need different greens —
    // #5ff0c4 is a mint that only reads on a dark ground — so anything green
    // resolves through these rather than naming a hex.
    "--tr-accent:#5ff0c4;--tr-accent-line:rgba(95,240,196,0.32);" +
    "--tr-accent-bg:rgba(95,240,196,0.07);--tr-accent-bg-2:rgba(95,240,196,0.14);" +
    "--tr-accent-solid:#5ff0c4;--tr-accent-ink:#04231a;" +
    // The record red, as the same kind of set, and for the same reason: #fca5a5
    // is a tint that only reads on a dark ground, and it was being used for the
    // Start-recording button and every warning banner in both themes.
    "--tr-rec:#fca5a5;--tr-rec-bg:#1e293b;--tr-rec-line:#7f1d1d;" +
    // The rest of the palette, by the role it marks rather than by its hue: what
    // is in flight, what is waiting, what passed, navigation, gestures, picking.
    // Every one of these was a hardcoded tint chosen against the dark ground and
    // reused verbatim in the light theme, where none of them reach 3:1.
    "--tr-info:#38bdf8;--tr-warn:#fbbf24;--tr-pass:#22c55e;" +
    // The wordmark. Unchanged on dark — the green it has always been.
    "--tr-brand:#22c55e;" +
    "--tr-nav:#a78bfa;--tr-move:#22d3ee;--tr-pick:#f9a8d4;" +
    "}" +
    '[data-tr-theme="light"]{' +
    "--tr-bg:#f1f5f9;--tr-panel:#ffffff;--tr-panel-2:#f8fafc;--tr-sunken:#f8fafc;" +
    "--tr-track:#e2e8f0;--tr-border:#e2e8f0;--tr-border-strong:#cbd5e1;" +
    "--tr-muted:#94a3b8;--tr-dim:#64748b;--tr-soft:#475569;" +
    "--tr-text-2:#334155;--tr-text:#0f172a;" +
    "--tr-hover:rgba(15,23,42,0.05);--tr-hover-2:rgba(15,23,42,0.09);" +
    // Blue on light, mint on dark. The two themes have never shared an accent
    // hex — the mint only reads on a dark ground — so this is the one line to
    // change, and everything accent-coloured follows it: labels, the project
    // names, the tag chips, the suite-wide run bar and its solid button.
    //
    // blue-700, not blue-600: 600 measures 4.06:1 on this theme's panel, which
    // leaves every accent label and the white-on-accent buttons under the 4.5:1
    // line. 700 reads as the same blue and clears it at 6.66:1.
    "--tr-accent:#1d4ed8;--tr-accent-line:rgba(29,78,216,0.34);" +
    "--tr-accent-bg:rgba(29,78,216,0.08);--tr-accent-bg-2:rgba(29,78,216,0.16);" +
    "--tr-accent-solid:#1d4ed8;--tr-accent-ink:#ffffff;" +
    "--tr-rec:#b91c1c;--tr-rec-bg:#fef2f2;--tr-rec-line:#fecaca;" +
    // The same six roles, darkened until each clears 4.5:1 on this theme's panel.
    "--tr-info:#0369a1;--tr-warn:#b45309;--tr-pass:#15803d;" +
    // Blue on light, with the accent. Note --tr-pass stays green here: it is
    // what "✓ passed" is written in, and a blue pass beside a red fail would
    // say nothing at a glance.
    "--tr-brand:#1d4ed8;" +
    "--tr-nav:#6d28d9;--tr-move:#0e7490;--tr-pick:#be185d;" +
    "}";
  document.head.appendChild(style);
}
