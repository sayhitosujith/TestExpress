// Shared Postgres pool for the online datastores. Nothing here connects until a
// query runs, so requiring this module with no DATABASE_URL set is harmless.
//
// Connection rules (TLS, idle-error handling) live in pgPool.js, which the
// migration script reuses for the source database.
require('dotenv').config();
const { createPool } = require('./pgPool');

module.exports = createPool(process.env.DATABASE_URL || '', 'db');
