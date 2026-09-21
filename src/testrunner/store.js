// The localStorage home of recorded tests and the Project › Suite hierarchy.
//
// This lives outside TestRunner.jsx for the same reason ./spec.js does: two
// callers need it. TestRunner.jsx owns the tests interactively, and QaseImport
// files freshly generated cases into the same store. Two copies of these keys
// would mean a generated case could be written under a key the recorder does
// not read, and the bug would look like "the case vanished".

// ============= recorded tests: real DOM record & playback ==============
// A recorded test is a serializable list of DOM interactions captured from the
// live app running in a same-origin iframe. Playback replays them into that
// iframe (record → save → play back), so it drives the real pages.
export const RECORDED_KEY = "testrunner.recordedTests";

export const loadRecorded = () => {
  try {
    const raw = localStorage.getItem(RECORDED_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (err) {
    // Don't overwrite what we couldn't read — a corrupt entry is recoverable by
    // hand, a silently clobbered one is not.
    console.warn("[TestRunner] stored tests could not be parsed:", err);
    return [];
  }
};

// Returns null on success or a human-readable reason on failure. localStorage
// throws when the origin's quota is exhausted, and inlined upload content makes
// that reachable — swallowing it is how a test appears saved but is gone after
// a restart.
export const persistRecorded = (list) => {
  try {
    localStorage.setItem(RECORDED_KEY, JSON.stringify(list));
    return null;
  } catch (err) {
    return /quota|exceeded/i.test(`${err.name} ${err.message}`)
      ? "Browser storage is full — this test was NOT saved. Export your tests, then delete ones you no longer need."
      : `Could not write to browser storage — this test was NOT saved (${err.message}).`;
  }
};

// ---- projects & suites ---------------------------------------------------
// Recorded tests are organised Project › Suite › Test case. The hierarchy is
// stored on its own and a test points at its suite by id, so there is exactly
// one place a name lives — renaming or deleting a suite can never leave a test
// claiming a project that no longer exists.
//
// The link is deliberately weak in one direction: a test whose suiteId is
// absent, or names a suite that has since been deleted, is *unfiled* rather
// than lost. It still shows, still runs, and can be filed later. That is what
// keeps every test recorded before this hierarchy existed working untouched.
export const PROJECTS_KEY = "testrunner.projects";
// [{ id, name, suites: [{ id, name }] }]

export const loadProjects = () => {
  try {
    const list = JSON.parse(localStorage.getItem(PROJECTS_KEY));
    if (!Array.isArray(list)) return [];
    // Normalise on the way in: a project written by an older build (or a
    // hand-edited export) may have no suites array, and the tree renderer
    // would throw on it.
    return list
      .filter((p) => p && p.id)
      .map((p) => ({ ...p, suites: Array.isArray(p.suites) ? p.suites.filter((s) => s && s.id) : [] }));
  } catch (err) {
    console.warn("[TestRunner] projects could not be parsed:", err);
    return [];
  }
};

// ---- the remaining storage keys -----------------------------------------
// Schedules and test data are read and written entirely inside TestRunner.jsx,
// so their load/persist helpers stay there. Only the key names live here, and
// only because a second reader now needs them: dbSync mirrors all four
// collections to the online database. A key string spelled out in two files is
// the drift that ends with data written under a name nothing reads back — the
// same reasoning that put RECORDED_KEY here rather than in the recorder.
//
// { [testId]: { mode, minutes, time, enabled, nextRunAt } }
export const SCHEDULES_KEY = "testrunner.schedules";
// { sets: [{ id, name, vars: [{ key, value, secret }] }], activeId }
export const TESTDATA_KEY = "testrunner.testData";

// Same contract as persistRecorded: null on success, a reason on failure.
export const persistProjects = (list) => {
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(list));
    return null;
  } catch (err) {
    return `Could not write to browser storage — the project list was NOT saved (${err.message}).`;
  }
};
