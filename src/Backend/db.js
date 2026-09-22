// Shared Postgres pool for the online datastores. Nothing here connects until a
// query runs, so requiring this module with no DATABASE_URL set is harmless.
//
// Connection rules (TLS, idle-error handling) live in pgPool.js, which the
// migration script reuses for the source database.
require('dotenv').config();
const { createPool } = require('./pgPool');

const pool = createPool(process.env.DATABASE_URL || '', 'db');

// TEMPORARY: two databases in the same Neon project (neondb, Testexpress
// _Prod) have each looked, from the outside, like they might be the one this
// process actually writes to. Asking the connection itself settles it in one
// line instead of guessing from another angle -- remove once confirmed.
if (process.env.DATABASE_URL) {
  pool.query('select current_database()')
    .then((r) => console.log('[db] connected to database:', r.rows[0].current_database))
    .catch((err) => console.warn('[db] could not read current_database():', err.message));
}

module.exports = pool;
