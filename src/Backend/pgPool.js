// Builds a Postgres pool for a given connection string.
//
// Extracted from db.js because the migration script needs a second pool -- for the
// source database -- with exactly the same TLS and error handling. A second copy of
// those rules is how the two would drift apart, and the one that drifted would be
// the one handling someone else's credential.
const { Pool } = require('pg');

/**
 * @param {string} url    Postgres connection string. An empty string yields a pool
 *   that never connects, which is what lets a no-database install boot.
 * @param {string} label  Prefix for the idle-client warning, so a failure names
 *   which database it came from.
 */
function createPool(url, label = 'db') {
  // Hosted providers (Neon, Supabase, Render, Railway) require TLS; a local or
  // containerised server generally does not offer it, and forcing it there fails
  // the handshake. Certificate verification stays ON -- those providers all present
  // publicly trusted certs, and these pools carry registration PII, so silently
  // accepting any certificate would defeat the point of using TLS at all.
  // DATABASE_SSL_NO_VERIFY exists only for a self-hosted server with a self-signed
  // cert, where the alternative is no encryption.
  const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);
  const sslDisabled = /[?&]sslmode=disable\b/.test(url);

  const sslOption =
    !url || isLocal || sslDisabled
      ? false
      : { rejectUnauthorized: process.env.DATABASE_SSL_NO_VERIFY !== 'true' };

  // TEMPORARY: the deployed Render container keeps reporting a self-signed
  // certificate for a host that verifies fine under strict TLS from outside
  // it, through three different attempted fixes. This says what the process
  // actually has, rather than what the dashboard or the Dockerfile claim it
  // should have -- remove once that mismatch is found.
  console.log(
    `[${label}] ssl option:`, sslOption,
    '| DATABASE_SSL_NO_VERIFY=', JSON.stringify(process.env.DATABASE_SSL_NO_VERIFY),
    '| NODE_EXTRA_CA_CERTS=', JSON.stringify(process.env.NODE_EXTRA_CA_CERTS),
    '| node=', process.version,
  );

  const pool = new Pool({
    connectionString: url,
    ssl: sslOption,
  });

  // Without a listener, a dropped backend connection raises an unhandled 'error'
  // on the pool and takes the whole server down -- the pool replaces the socket on
  // its own, so logging is the right response.
  pool.on('error', (err) => {
    console.warn(`[${label}] idle client error:`, err.message);
  });

  return pool;
}

module.exports = { createPool };
