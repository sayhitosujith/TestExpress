// Copies every online collection from one Postgres database to another -- the
// operation needed after DATABASE_URL is repointed at a fresh Neon project, since
// changing the string moves the app but not the rows.
//
//   OLD_DATABASE_URL=postgresql://...  (source, in src/Backend/.env)
//   DATABASE_URL=postgresql://...      (target, already configured)
//   node scripts/db-migrate.js [--dry-run]
//
// Records are read as the `data` JSONB payload and replayed through the target's
// own store, so the per-collection key rules and mirrored columns are applied by
// the same code the API uses rather than a second copy here that could drift.
//
// The operation is an upsert per record and never deletes: re-running it is safe,
// and a row that exists only in the target is left alone. That makes the failure
// mode a partial copy to be re-run, not lost data.
require('dotenv').config();
const { createPool } = require('../pgPool');

// Ordered so the collections people check first are reported first.
const COLLECTIONS = [
  { name: 'registrations', store: require('../registrationsDb').store },
  { name: 'doctors', store: require('../doctorsDb').store },
  { name: 'patients', store: require('../patientsOnlineDb').store },
  { name: 'appointments', store: require('../appointmentsOnlineDb').store },
  { name: 'appointment_history', store: require('../appointmentHistoryDb').store },
];

/** Host and database of a URL, with the password removed, for logging. */
function safeHost(url) {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`;
  } catch {
    return '(unparseable)';
  }
}

/**
 * Reads one table's record payloads from the source database.
 *
 * A missing table is not an error: the source may predate a collection, and that
 * should report as zero rows rather than abort the other four.
 */
async function readSource(sourcePool, table) {
  const exists = await sourcePool.query('SELECT to_regclass($1) AS reg', [table]);
  if (!exists.rows[0].reg) return null;
  const { rows } = await sourcePool.query(`SELECT data FROM ${table}`);
  return rows.map((r) => r.data);
}

(async () => {
  const sourceUrl = process.env.OLD_DATABASE_URL || '';
  const targetUrl = process.env.DATABASE_URL || '';
  const dryRun = process.argv.includes('--dry-run');

  if (!sourceUrl) {
    console.error('OLD_DATABASE_URL is not set in src/Backend/.env -- nothing to copy from.');
    console.error('Add the OLD project\'s connection string as OLD_DATABASE_URL, then re-run.');
    process.exit(1);
  }
  if (!targetUrl) {
    console.error('DATABASE_URL is not set -- no target to copy into.');
    process.exit(1);
  }
  if (sourceUrl === targetUrl) {
    console.error('OLD_DATABASE_URL and DATABASE_URL are the same database -- refusing to run.');
    process.exit(1);
  }

  console.log('from:', safeHost(sourceUrl));
  console.log('  to:', safeHost(targetUrl));
  if (dryRun) console.log('(dry run -- reading only, nothing is written)');
  console.log('');

  const sourcePool = createPool(sourceUrl, 'db:source');
  let failed = false;

  try {
    for (const { name, store } of COLLECTIONS) {
      try {
        const records = await readSource(sourcePool, name);
        if (records === null) {
          console.log(`${name}: no such table in source -- skipped`);
          continue;
        }
        if (dryRun) {
          console.log(`${name}: ${records.length} in source (would upsert)`);
          continue;
        }

        const saved = await store.upsertMany(records);
        const after = await store.list({ limit: 5000 });
        const flag = saved.length === records.length ? '' : '  <-- SHORTFALL';
        console.log(
          `${name}: ${records.length} read, ${saved.length} upserted, ` +
            `${after.length} now in target${flag}`,
        );
        // upsertMany logs and skips records the key rules reject, so a shortfall is
        // real data left behind and must not be reported as a clean run.
        if (saved.length !== records.length) failed = true;
      } catch (err) {
        console.error(`${name}: FAILED -- ${err.message}`);
        failed = true;
      }
    }
  } finally {
    await sourcePool.end();
    await require('../db').end();
  }

  if (failed) {
    console.error('\nMigration incomplete -- see the lines above. Re-running is safe.');
    process.exitCode = 1;
  } else if (!dryRun) {
    console.log('\nMigration complete. Remove OLD_DATABASE_URL from .env now.');
  }
})();
