// Online (Postgres) stores for the test runner's own data.
//
// Everything the recorder produces has until now lived only in localStorage,
// which makes it per-browser and per-origin: a test recorded on one machine is
// invisible on another, and the in-app warning "tests are stored per origin"
// is the whole story. These four stores are the offsite copy, fed by dbSync
// from the same keys TestRunner.jsx reads and writes.
//
// Four collections rather than one blob per key, because dbSync's contract is
// record-level: it upserts what changed and deletes only the keys this browser
// had previously confirmed stored. A whole-key blob would make every save a
// wholesale overwrite, and two people with the recorder open would take turns
// destroying each other's tests — the exact failure the notes in dbSync.js
// were written after.
//
// They live in one module because they are one feature. The stores below are
// pure declarations on top of createCollectionStore, so there is no shared code
// here to hide — only the four key rules, which are worth reading together.
//
// Deliberately excluded: theme, browser, device, selfHeal and headless. Those
// are per-browser preferences, and syncing them would mean one person's choice
// of device silently changing what everyone else's next run executes against.
const { createCollectionStore } = require('./collectionStore');

// Every record here is identified by an id the recorder generated, so one key
// rule serves three of the four stores. Written once and named, rather than
// three copies that could drift into disagreeing about whitespace or nulls.
const byId = (record) => String(record?.id ?? '').trim();

// Recorded tests. `steps` can be long and occasionally carries inlined upload
// content, so only the fields worth querying get their own column; the step
// list itself stays in the JSONB where nothing indexes it.
const tests = createCollectionStore({
  table: 'testrunner_tests',
  keyColumn: 'test_key',
  keyOf: byId,
  keyHint: 'must have an id',
  indexes: ['suite_id'],
  columns: [
    { name: 'name', from: (t) => t.name },
    { name: 'suite_id', from: (t) => t.suiteId },
    // Which engine recorded it — a native recording cannot be replayed in an
    // iframe, so this is the one field a reader needs before opening the row.
    { name: 'engine', from: (t) => t.engine },
    { name: 'owner_email', from: (t) => t.owner && t.owner.email },
  ],
});

// The Project › Suite tree. Suites are nested inside their project rather than
// being a fifth collection: they have no identity apart from the project that
// contains them, and a test points at a suite by id from its own row.
const projects = createCollectionStore({
  table: 'testrunner_projects',
  keyColumn: 'project_key',
  keyOf: byId,
  keyHint: 'must have an id',
  columns: [{ name: 'name', from: (p) => p.name }],
});

// Per-test run schedules. Stored one row per test, keyed by the test it belongs
// to — see toRows in dbSync.js, which flattens the local `{ [testId]: … }` map
// into these rows so this collection has the record identity the sync engine
// needs.
const schedules = createCollectionStore({
  table: 'testrunner_schedules',
  keyColumn: 'test_key',
  keyOf: (s) => String(s?.testId ?? '').trim(),
  keyHint: 'must have a testId',
  columns: [
    { name: 'mode', from: (s) => s.mode },
    // Text rather than boolean: createCollectionStore mirrors into TEXT columns,
    // and a disabled schedule is worth seeing without opening the JSONB.
    { name: 'enabled', from: (s) => (s.enabled ? 'true' : 'false') },
  ],
});

// Named data sets — the values tests fill in instead of the literal that was
// typed while recording.
//
// Values marked `secret` are stored as they are, at the same trust level as
// everything else in this database. That is a deliberate choice: the point of a
// data set is that a test runs unattended on another machine, and a secret held
// back would leave that test failing until someone re-entered it by hand.
// Anyone who can read this table can read the test credentials in it.
const dataSets = createCollectionStore({
  table: 'testrunner_data_sets',
  keyColumn: 'set_key',
  keyOf: byId,
  keyHint: 'must have an id',
  columns: [{ name: 'name', from: (s) => s.name }],
});

module.exports = { tests, projects, schedules, dataSets };
