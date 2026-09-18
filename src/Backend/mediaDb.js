// Binary payloads for recorded tests, kept out of Google Sheets.
//
// A recorded step can carry an uploaded file or a screenshot inlined as a
// base64 data URL (TestRunner.jsx). Those routinely exceed Sheets' 50,000
// characters per cell, and even when they fit they would bloat the sheet past
// the point a human can read it. So the payload goes here, in the same SQLite
// file the audit log and appointments already use, and the sheet keeps a short
// reference in its place.
//
// Extraction and re-inlining are exact inverses: what the app stores is what
// the app gets back.
const { db } = require('./actionsDb');

db.exec(`
  CREATE TABLE IF NOT EXISTS test_media (
    id         TEXT PRIMARY KEY,   -- "<testId>:<stepIndex>"
    test_id    TEXT NOT NULL,
    data_url   TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

const insert = db.prepare(
  'INSERT INTO test_media (id, test_id, data_url) VALUES (?, ?, ?) ' +
    'ON CONFLICT(id) DO UPDATE SET data_url = excluded.data_url',
);
const selectOne = db.prepare('SELECT data_url FROM test_media WHERE id = ?');
const deleteForTest = db.prepare('DELETE FROM test_media WHERE test_id = ?');

/** Marks a step whose payload lives in SQLite rather than in the sheet. */
const MEDIA_REF = 'mediaRef';

/**
 * Moves every step's data URL out of `test` and into SQLite, returning a copy
 * safe to write to a sheet. The original object is not modified.
 */
function extractMedia(test) {
  if (!test || !Array.isArray(test.steps)) return test;
  const testId = String(test.id ?? '');
  if (!testId) return test;

  // Rewritten wholesale, so stale rows from deleted steps don't accumulate.
  deleteForTest.run(testId);

  const steps = test.steps.map((step, i) => {
    if (!step || !step.dataUrl) return step;
    const id = `${testId}:${i}`;
    insert.run(id, testId, step.dataUrl);
    const { dataUrl, ...rest } = step;
    return { ...rest, [MEDIA_REF]: id };
  });
  return { ...test, steps };
}

/** Puts the data URLs back, undoing extractMedia. */
function inlineMedia(test) {
  if (!test || !Array.isArray(test.steps)) return test;
  const steps = test.steps.map((step) => {
    if (!step || !step[MEDIA_REF]) return step;
    const row = selectOne.get(step[MEDIA_REF]);
    if (!row) return step; // payload gone: keep the ref rather than invent one
    const { [MEDIA_REF]: _ref, ...rest } = step;
    return { ...rest, dataUrl: row.data_url };
  });
  return { ...test, steps };
}

module.exports = { extractMedia, inlineMedia, MEDIA_REF };
