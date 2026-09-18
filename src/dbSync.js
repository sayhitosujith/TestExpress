// Keeps the localStorage collections and the online (Postgres) database in step.
//
// Why a diff-and-push loop rather than a save call in each screen: these keys are
// written from many places across the app, every one of them would need the same
// call, and the next screen added would forget it. One loop watching the keys is
// the same behaviour in one place -- the same reasoning, and the same shape, as
// sheetsSync.js.
//
// Additions and edits are upserts. Deletions are the delicate case, because two
// situations look identical from here -- the user deleted a record, or this browser
// never had it -- and acting on the second would let a fresh browser empty the
// database. They are told apart by a *baseline*: the record keys this browser last
// confirmed the database had stored. A key that was in the baseline and is now gone
// from localStorage was really deleted, and only those keys are ever removed.
//
// Deleting by key rather than by reconciling the whole collection is deliberate. An
// earlier version sent the full local list and had the server drop everything not
// in it, which quietly destroyed ten appointments that had been imported straight
// into the database and so had never been in any browser. Naming the keys means a
// record this browser has not seen cannot be collateral damage.
//
// The baseline is persisted (see BASELINE_KEY) rather than kept in memory, because
// clearing a collection and then reloading is the normal way people do it -- an
// in-memory baseline died with the reload and the deletion could never propagate.
// Clearing all site data removes the baseline too, which is the safe direction: an
// unknown browser cannot delete anything.
//
// Boot reads are deliberately narrow. sheetsSync claims that job whenever a sheet
// is configured, and two engines writing the same keys would fight, so this module
// only fills the gap: hydrateMissing() populates collections this browser has
// nothing for, which cannot collide with anything. pullCollections() overwrites
// wholesale and stays an explicit, opt-in restore.
import {
  getRegistrationsStatus,
  saveRegistrations,
  getRegistrations,
} from "./api/registrations";
import { bulkDelete } from "./api/onlineCollections";
import {
  testRunnerTests,
  testRunnerProjects,
  testRunnerSchedules,
  testRunnerDataSets,
} from "./api/testRunnerOnline";
import {
  RECORDED_KEY,
  PROJECTS_KEY,
  SCHEDULES_KEY,
  TESTDATA_KEY,
} from "./testrunner/store";

// localStorage key -> the API that persists it. Mirrors TAB_KEYS in sheetsSync.js
// so the two engines describe the same collections the same way.
// ---- ordered collections -------------------------------------------------
// Order is meaningful in the recorder. Nothing there sorts anything — the tree,
// the test list and the data-set editor all render the stored array as it is —
// so what comes back from the database IS what the user sees. A pulled
// collection arrives newest-first, and a bulk push stamps every row with the
// same created_at, so without help the first open on a new machine would show
// someone's tests silently shuffled.
//
// Each record therefore carries its index while it is in the database, and
// hydration sorts by it and strips it again. Reordering locally changes the
// rows, so it also changes the hash and pushes like any other edit.
const withPosition = (rows) =>
  rows.map((row, position) => Object.assign({}, row, { position }));

const inPositionOrder = (rows) =>
  rows
    .slice()
    .sort((a, b) => (a && a.position) - (b && b.position))
    .map(({ position, ...record }) => record);

export const COLLECTIONS = [
  {
    // Pulled, never pushed.
    //
    // This key is whatever the browser happens to hold, and pushing it meant the
    // contents of localStorage became rows in the registrations table. Observed
    // directly while testing sign-in: a record typed straight into localStorage
    // arrived in the database as an account. It could not be logged in to — it
    // carries no hash and the server verifies against one — but it should never
    // have been able to write a row at all.
    //
    // Registrations are now created by POST /api/auth/register, which hashes the
    // password server-side, so this loop has nothing left to contribute in that
    // direction. Hydration stays: a fresh browser still needs the user list for
    // the NewRegistration screen, and pulling cannot forge anything.
    readOnly: true,
    name: "registrations",
    key: "registeredUsers",
    slug: "registrations",
    status: getRegistrationsStatus,
    push: saveRegistrations,
    pull: getRegistrations,
  },
  // doctors, appointments and patients used to be mirrored here too. They were
  // retired deliberately: those tables are not wanted offsite, and dropping them
  // by hand did not stick — createCollectionStore runs CREATE TABLE IF NOT
  // EXISTS once per process, so the next backend restart simply recreated them.
  // Taking them out of this list is what actually stops that, because nothing
  // else in the app calls those endpoints and a route that is never requested
  // creates no table.
  //
  // What was deliberately NOT removed, and why:
  //   * src/api/{doctors,appointmentsOnline,patientsOnline}.js and the routes and
  //     stores behind them. scripts/db-migrate.js still requires those stores, so
  //     deleting them would break the migration tool for the sake of tidiness.
  //   * registrations, below. Sign-in reads `registeredUsers` straight out of
  //     localStorage, so a browser that cannot hydrate it cannot log in.
  //   * sheetsSync.js, which mirrors the same four localStorage keys to Google
  //     Sheets. It is a separate engine with its own configuration and is
  //     untouched by this — if those collections should stop leaving the browser
  //     entirely, that is the other half of the job.
  // ---- the test runner ---------------------------------------------------
  // Recordings, the tree they hang in, their schedules and the data sets they
  // resolve against. Until now these were localStorage-only, which is why the
  // recorder shows "tests are stored per origin" — the tests were genuinely
  // stranded in whichever browser and port recorded them.
  //
  // The runner's other five keys (theme, browser, device, selfHeal, headless)
  // are deliberately absent. They are per-browser preferences, and syncing them
  // would let one person's choice of device decide what everyone else's next
  // run executes against.
  {
    name: "testrunner tests",
    key: RECORDED_KEY,
    slug: "testrunner/tests",
    status: testRunnerTests.status,
    push: testRunnerTests.push,
    pull: testRunnerTests.pull,
    toRows: (stored) => (Array.isArray(stored) ? withPosition(stored) : []),
    toStored: inPositionOrder,
  },
  {
    name: "testrunner projects",
    key: PROJECTS_KEY,
    slug: "testrunner/projects",
    status: testRunnerProjects.status,
    push: testRunnerProjects.push,
    pull: testRunnerProjects.pull,
    toRows: (stored) => (Array.isArray(stored) ? withPosition(stored) : []),
    toStored: inPositionOrder,
  },
  {
    // Stored as a map of testId -> schedule, so it is flattened into rows that
    // carry their own testId and rebuilt into the map on the way back. Both
    // directions are total: every row round-trips to the same entry it came
    // from, and a row whose testId is missing is dropped rather than written
    // back under "undefined".
    name: "testrunner schedules",
    key: SCHEDULES_KEY,
    slug: "testrunner/schedules",
    status: testRunnerSchedules.status,
    push: testRunnerSchedules.push,
    pull: testRunnerSchedules.pull,
    toRows: (stored) =>
      stored && typeof stored === "object" && !Array.isArray(stored)
        ? Object.entries(stored)
            .filter(([testId, schedule]) => testId && schedule)
            .map(([testId, schedule]) => Object.assign({ testId }, schedule))
        : [],
    toStored: (rows) => {
      const map = {};
      rows.forEach((row) => {
        if (!row || !row.testId) return;
        const { testId, ...schedule } = row;
        map[testId] = schedule;
      });
      return map;
    },
  },
  {
    // Stored as one document, `{ sets, activeId }`. The sets are the records —
    // each already has an id — and activeId rides along as an `active` flag on
    // the set it names. Keeping it as a flag rather than a separate row means
    // there is no second collection holding a single scalar, and no way for the
    // pointer to survive the set it points at: rebuilding picks activeId back
    // out of whichever row carries the flag, and lands on null if none does.
    name: "testrunner data sets",
    key: TESTDATA_KEY,
    slug: "testrunner/data-sets",
    status: testRunnerDataSets.status,
    push: testRunnerDataSets.push,
    pull: testRunnerDataSets.pull,
    toRows: (stored) =>
      stored && Array.isArray(stored.sets)
        ? withPosition(
            stored.sets
              .filter((set) => set && set.id)
              .map((set) => Object.assign({}, set, { active: set.id === stored.activeId })),
          )
        : [],
    toStored: (rows) => {
      const ordered = inPositionOrder(rows.filter((row) => row && row.id));
      const activeRow = ordered.find((row) => row.active);
      const sets = ordered.map(({ active, ...set }) => set);
      return {
        sets,
        // Falls back to the first set rather than null when nothing is flagged,
        // matching loadTestData in TestRunner.jsx — a data set that exists but
        // is not selected leaves every {{token}} resolving against nothing.
        activeId: activeRow ? activeRow.id : sets.length ? sets[0].id : null,
      };
    },
  },
];

const PUSH_INTERVAL_MS = 10000;
const STORAGE_DEBOUNCE_MS = 1000;

// Where the baseline lives. Its own key, so clearing a data collection leaves it
// intact and the deletion can still be recognised after a reload.
const BASELINE_KEY = "dbSync.baseline";

// What this browser last confirmed the database holds, per collection:
// { hash, keys }. The hash short-circuits an unchanged collection; a hash rather
// than the JSON itself because these records embed base64 images and keeping copies
// would double an already large localStorage for no benefit. "keys" is the list of
// record identities the server reported storing, and it is the only thing this
// module will ever ask to have deleted.
let baseline = new Map();

// djb2. Not cryptographic and does not need to be: a collision would only cause a
// skipped upsert of identical-length data, and the interval would catch the next
// real change.
const hashOf = (text) => {
  let h = 5381;
  for (let i = 0; i < text.length; i += 1) {
    h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  }
  return String(h);
};

function loadBaseline() {
  try {
    const raw = localStorage.getItem(BASELINE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw);
    return new Map(
      Object.entries(parsed).filter(
        ([, v]) => v && typeof v.hash === "string" && Array.isArray(v.keys),
      ),
    );
  } catch {
    return new Map();
  }
}

function saveBaseline() {
  try {
    localStorage.setItem(
      BASELINE_KEY,
      JSON.stringify(Object.fromEntries(baseline)),
    );
  } catch (err) {
    // A full quota is not a reason to stop syncing; it only means the next reload
    // starts without a baseline, which errs towards not deleting.
    console.warn("[dbSync] could not persist baseline:", err.message);
  }
}

/**
 * The stored value as sync rows.
 *
 * Most collections keep a plain array under their key and need nothing here.
 * Two of the test runner's do not — schedules are a `{ [testId]: … }` map and
 * test data is a `{ sets, activeId }` document — and those declare `toRows` to
 * present themselves as records, with `toStored` to put the shape back.
 *
 * The alternative was to store those two keys as a single blob row each, which
 * would have been less code here and much worse behaviour: every save becomes a
 * wholesale overwrite, and the per-record upsert-and-baseline machinery this
 * whole module is built on stops applying to them.
 */
const readLocal = (collection) => {
  try {
    const raw = localStorage.getItem(collection.key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const rows = collection.toRows ? collection.toRows(parsed) : parsed;
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
};

// What goes back into localStorage for a collection: the rows as they came, or
// the shape the collection says it actually stores.
const storedShape = (collection, rows) =>
  collection.toStored ? collection.toStored(rows) : rows;

/**
 * Syncs any collection whose local contents differ from its baseline: upserts what
 * is here, then deletes exactly the keys that have gone missing since the baseline.
 *
 * A collection that errors is skipped, not fatal: one failing collection must not
 * stop the others from saving.
 */
export async function pushChanged() {
  const results = [];
  let baselineChanged = false;

  for (const collection of COLLECTIONS) {
    // A read-only collection is owned by the server: it is hydrated from the
    // database but never written back from here, so whatever this browser holds
    // under its key cannot become a row. See the note on registrations.
    if (collection.readOnly) continue;
    const rows = readLocal(collection);
    const json = JSON.stringify(rows);
    const hash = hashOf(json);
    const previous = baseline.get(collection.key);
    if (previous?.hash === hash) continue;

    try {
      // The server reports the key it stored each record under, which is also how
      // this side learns record identities without reimplementing the key rules --
      // those differ per collection (id, licence, patientId, phone fallbacks) and
      // duplicating them here is exactly how the two would drift apart.
      const result = rows.length ? await collection.push(rows) : { keys: [] };
      const currentKeys = result?.keys ?? [];

      // Keys this browser had confirmed stored and no longer holds: real deletions.
      // Nothing else is ever deleted -- in particular a record that only exists in
      // the database, never having passed through this browser, is not in `known`
      // and so cannot be touched.
      const known = previous?.keys ?? [];
      let deleted = 0;
      if (known.length) {
        const present = new Set(currentKeys);
        const gone = known.filter((key) => !present.has(key));
        if (gone.length) {
          const removal = await bulkDelete(collection.slug, gone);
          deleted = removal?.deleted ?? 0;
        }
      }

      baseline.set(collection.key, { hash, keys: currentKeys });
      baselineChanged = true;
      if (rows.length || deleted) {
        results.push({
          collection: collection.name,
          saved: result?.saved ?? 0,
          deleted,
        });
      }
    } catch (err) {
      console.warn(`[dbSync] ${collection.name} failed:`, err.message);
    }
  }

  if (baselineChanged) saveBaseline();
  return results;
}

/**
 * Reads every collection out of the database into localStorage. Not called on
 * startup by design -- see the note at the top of this file. Use it to restore a
 * wiped browser, when you know the database is the copy you want to keep.
 */
export async function pullCollections() {
  const loaded = [];
  for (const collection of COLLECTIONS) {
    try {
      const rows = await collection.pull();
      // An empty table must not wipe good local data.
      if (!rows.length) continue;
      const json = JSON.stringify(rows);
      localStorage.setItem(collection.key, JSON.stringify(storedShape(collection, rows)));
      // No server-reported keys from a pull, and inventing them from the records
      // would mean guessing the key rules. An empty list simply means the next sync
      // has nothing it is allowed to delete, which is the safe direction.
      baseline.set(collection.key, { hash: hashOf(json), keys: [] });
      loaded.push({ collection: collection.name, count: rows.length });
    } catch (err) {
      console.warn(`[dbSync] pull ${collection.name} failed:`, err.message);
    }
  }
  saveBaseline();
  return loaded;
}

/**
 * Fills in, from the database, only the collections this browser holds nothing
 * for. Returns what it loaded.
 *
 * Boot hydration is normally sheetsSync's job (see the note at the top of this
 * file), but that engine does nothing at all when no spreadsheet is configured —
 * and then a browser with empty localStorage shows no data even though the
 * database is full. Worse, sign-in reads `registeredUsers` straight out of
 * localStorage, so an unhydrated browser cannot log in against registrations
 * that plainly exist.
 *
 * Restricted to keys that are empty locally, which is what makes it safe to run
 * whether or not a sheet is configured: a collection this browser already has is
 * never overwritten, so a local edit that has not been pushed yet cannot be lost.
 * Unlike pullCollections(), this can never clobber.
 */
export async function hydrateMissing() {
  baseline = loadBaseline();
  const loaded = [];
  for (const collection of COLLECTIONS) {
    if (readLocal(collection).length) continue;
    try {
      const rows = await collection.pull();
      if (!rows.length) continue;
      const json = JSON.stringify(rows);
      localStorage.setItem(collection.key, JSON.stringify(storedShape(collection, rows)));
      // Recorded so the first push does not re-upload what was just pulled. The
      // key list stays empty because a pull reports no server-side keys, and an
      // empty list is the safe direction: it authorises no deletions.
      baseline.set(collection.key, { hash: hashOf(json), keys: [] });
      loaded.push({ collection: collection.name, count: rows.length });
    } catch (err) {
      console.warn(`[dbSync] hydrate ${collection.name} failed:`, err.message);
    }
  }
  if (loaded.length) saveBaseline();
  return loaded;
}

let timer = null;
let storageListener = null;
let storageDebounce = null;

// Coalesces the interval and the storage-event trigger so a burst of writes in one
// handler results in a single sync rather than one per key touched.
let running = false;
async function runSync() {
  if (running) return [];
  running = true;
  try {
    const changed = await pushChanged();
    if (changed.length) console.info("[dbSync] synced:", changed);
    return changed;
  } finally {
    running = false;
  }
}

/**
 * Loads the persisted baseline, syncs once -- which backfills anything already in
 * localStorage and propagates a deletion made before the last reload -- then
 * repeats on an interval and on every localStorage write.
 *
 * Safe to call when the backend is down or has no DATABASE_URL: it reports why and
 * leaves the app on localStorage, exactly how it behaved before.
 */
export async function startDbSync() {
  let configured = false;
  try {
    const statuses = await Promise.all(COLLECTIONS.map((c) => c.status()));
    configured = statuses.every((s) => s?.configured);
  } catch (err) {
    console.warn("[dbSync] backend unreachable, staying local:", err.message);
    return { active: false, reason: "backend-unreachable" };
  }
  if (!configured) {
    console.warn("[dbSync] no online database configured, staying local.");
    return { active: false, reason: "not-configured" };
  }

  baseline = loadBaseline();
  const first = await pushChanged();
  if (first.length) console.info("[dbSync] synced on boot:", first);

  if (timer) clearInterval(timer);
  // Runs regardless of tab visibility. It used to skip a hidden tab as a small
  // optimisation, but that broke the obvious workflow: delete a record, switch to
  // the database console to check, and the pass that would have sent the deletion
  // never ran. An unchanged collection costs a hash compare and no request, so
  // there was little to save.
  timer = setInterval(runSync, PUSH_INTERVAL_MS);

  // The screens dispatch a "storage" event after writing localStorage, and the
  // browser fires one natively for other tabs. Listening means a deletion reaches
  // the database in about a second instead of waiting out the interval.
  if (!storageListener) {
    storageListener = () => {
      clearTimeout(storageDebounce);
      storageDebounce = setTimeout(runSync, STORAGE_DEBOUNCE_MS);
    };
    window.addEventListener("storage", storageListener);
  }

  return { active: true, synced: first };
}

export function stopDbSync() {
  if (timer) clearInterval(timer);
  timer = null;
  clearTimeout(storageDebounce);
  if (storageListener) {
    window.removeEventListener("storage", storageListener);
    storageListener = null;
  }
}
