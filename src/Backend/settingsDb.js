// App-wide settings, one key/value row each, in the same Postgres the accounts
// live in.
//
// Branding -- the logo, the app name and the line under it -- used to live only
// in localStorage. That made it one browser's opinion of what the app is
// called: everyone else still saw the built-in name, and clearing site data
// undid the change. It is configuration for the installation rather than a
// per-person preference, so it belongs next to the records it describes.
//
// Key/value rather than a column per setting, because every setting here is a
// short string an administrator picks once and nothing ever joins or filters
// on. A fourth setting is then a row, not a migration.
//
// This module knows nothing about branding: it stores strings under keys. What
// the keys mean, and what a valid value for one is, lives in routes/settings.js.
const pool = require('./db');

// `value` is NOT NULL on purpose. "Not set" is expressed by the row's absence,
// so there is exactly one representation of it -- clearing a setting deletes
// the row, and a caller that finds no row knows to use its default. A nullable
// column would add a second, indistinguishable way to say the same thing.
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

const UPSERT_SQL = `
  INSERT INTO settings (key, value)
       VALUES ($1, $2)
  ON CONFLICT (key) DO UPDATE
          SET value = EXCLUDED.value,
              updated_at = now()
`;

/**
 * True when a connection string is present. Routes check this and answer 501
 * with setup steps rather than 500, so an install without a database reports
 * "not set up" instead of looking broken -- same contract as the collection
 * stores.
 */
function isConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

// Cached so concurrent callers share one schema round-trip instead of racing
// each other on the first request after boot.
let ready = null;

/** Creates the table on first use. Idempotent, and safe to call per request. */
function init() {
  if (!isConfigured()) {
    throw new Error(
      'No online database configured. Set DATABASE_URL in src/Backend/.env ' +
        'to a Postgres connection string.',
    );
  }
  if (!ready) {
    ready = pool.query(SCHEMA).catch((err) => {
      // Clear the cache so a transient outage during boot does not poison every
      // later request with the same rejected promise.
      ready = null;
      throw err;
    });
  }
  return ready;
}

/**
 * The stored values for `keys`.
 *
 * A key with no row is absent from the result rather than present and null, so
 * a caller can spread it over its defaults and get the right answer without
 * testing each field.
 *
 * @param {string[]} keys
 * @returns {Promise<Record<string, string>>}
 */
async function getSettings(keys) {
  if (!Array.isArray(keys) || !keys.length) return {};
  await init();
  const { rows } = await pool.query(
    'SELECT key, value FROM settings WHERE key = ANY($1::text[])',
    [keys.map(String)],
  );
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

/**
 * Writes every entry of `patch`, as one transaction.
 *
 * A null or empty value deletes the row rather than storing a blank string:
 * emptying a setting is a request for the built-in default, and storing "" for
 * it would render an empty header instead.
 *
 * Atomic because the callers change several related keys at once -- resetting
 * the branding clears three of them -- and a connection dropped halfway would
 * otherwise leave a new name beside an old tagline, which is a state nobody
 * asked for and nothing would correct.
 *
 * @param {Record<string, string|null>} patch
 * @returns {Promise<{saved: string[], cleared: string[]}>}
 */
async function putSettings(patch) {
  const entries = Object.entries(patch || {});
  if (!entries.length) return { saved: [], cleared: [] };
  await init();

  const client = await pool.connect();
  const saved = [];
  const cleared = [];
  try {
    await client.query('BEGIN');
    for (const [key, value] of entries) {
      const text = value == null ? '' : String(value);
      if (text) {
        await client.query(UPSERT_SQL, [String(key), text]);
        saved.push(key);
      } else {
        await client.query('DELETE FROM settings WHERE key = $1', [String(key)]);
        cleared.push(key);
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  return { saved, cleared };
}

module.exports = { isConfigured, init, getSettings, putSettings };
