// The landing page's own events, mirrored into the online database.
//
// They are already written to the local SQLite audit log (actionsDb), and that
// stays the one the panel reads: the summary is a piece of SQL there that
// nobody should have to write twice, and two aggregations of the same rows
// would eventually disagree. What SQLite cannot do is survive the machine — the
// file sits beside the backend, so a redeploy, a new laptop or a second
// instance each start from zero.
//
// So this is a mirror, not a second source of truth: every event that lands is
// copied across, and `backfill` carries over whatever the local log already
// holds. The copy is what you would restore from, and what a second instance
// can be pointed at.
const { createCollectionStore } = require('./collectionStore');

const store = createCollectionStore({
  table: 'homepage_events',
  keyColumn: 'event_key',
  // The local row id, prefixed. Not the bare id: this table is a mirror of one
  // particular log, and a bare integer key would silently merge two instances'
  // logs into one on the first collision.
  keyOf: (e) => (e && e.id != null ? `local-${e.id}` : ''),
  keyHint: 'must have an id',
  indexes: ['action', 'visit_id'],
  columns: [
    { name: 'action', from: (e) => e.action },
    // What ties a click to the visit it came from, and the only column the
    // summary's funnel actually groups on.
    { name: 'visit_id', from: (e) => e.appointmentId },
    { name: 'logged_at', from: (e) => e.created_at },
  ],
});

/** The landing page writes exactly these three action names. */
const HOMEPAGE_ACTIONS = ['homepage_view', 'homepage_section', 'homepage_cta'];

const isHomepage = (row) => row && HOMEPAGE_ACTIONS.includes(row.action);

/**
 * Mirrors one freshly logged event.
 *
 * Fire-and-forget, and deliberately not awaited by the route that logs it: an
 * anonymous visitor opening the landing page must not wait on a round trip to
 * Postgres, and must not see an error if it is down. Nothing is lost when it
 * fails — the row is in the local log, and `backfill` will carry it over.
 *
 * @param {object} row an action_logs row.
 * @returns {Promise<void>} resolves either way; never rejects.
 */
async function mirror(row) {
  if (!store.isConfigured() || !isHomepage(row)) return;
  try {
    await store.upsert(row);
  } catch (err) {
    console.warn('[homepage_events] not mirrored:', err.message);
  }
}

/**
 * Copies the local log's landing-page events across.
 *
 * Upserts keyed on the local row id, so running it twice copies nothing twice —
 * which is what makes it safe to offer as a button rather than as a one-off
 * migration somebody has to be told about.
 *
 * @param {object[]} rows action_logs rows, from actionsDb.listActions.
 * @returns {Promise<{mirrored: number, skipped: number}>}
 */
async function backfill(rows) {
  if (!store.isConfigured()) {
    throw new Error(
      'No online database configured. Set DATABASE_URL in src/Backend/.env to a Postgres connection string.',
    );
  }
  const events = (rows || []).filter(isHomepage);
  const saved = await store.upsertMany(events);
  return { mirrored: saved.length, skipped: events.length - saved.length };
}

/** How much is over there, so the panel can say whether the mirror is current. */
async function status() {
  if (!store.isConfigured()) return { configured: false, events: 0 };
  try {
    const rows = await store.list({ limit: 5000 });
    return { configured: true, events: rows.length };
  } catch (err) {
    return { configured: true, events: 0, error: err.message };
  }
}

module.exports = { mirror, backfill, status, HOMEPAGE_ACTIONS, store };
