// A short-lived holding area for accounts an administrator has just deleted.
//
// Deleting an account was irreversible, and the first thing it cost was a Super
// Admin: the record is the only place the bcrypt hash exists, so once the row
// is gone the credential cannot be reconstructed from anything the screen has.
// Re-creating the person from the table's own copy of them is not an undo --
// that copy is the admin view, which deliberately carries no hash, so the
// "restored" account would exist, be editable and be unable to sign in.
//
// So the whole record is copied here first, hash included, and put back
// verbatim if anyone asks within the retention window.
//
// A separate table rather than a `deleted` flag on `registrations`, which is
// what routes/admin.js used to argue against and was right to: every other
// reader -- sign-in most of all -- would have to learn about the flag, and the
// one that forgot would let a deleted account log in. Moving the row out keeps
// "in registrations" meaning exactly what it means today, so nothing else in
// the app has to change or even know this exists.
const pool = require('./db');

/**
 * How long a deleted account can be brought back.
 *
 * Long enough to notice the mistake and act on it, short enough that this is a
 * recycle bin rather than a second copy of the accounts table quietly holding
 * password hashes for everyone ever removed. The server owns this number and
 * reports the resulting deadline to the client, so there is nothing for the two
 * to disagree about.
 */
const RETENTION_MS = 5 * 60 * 1000;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS deleted_accounts (
    registration_key TEXT PRIMARY KEY,
    data             JSONB NOT NULL,
    deleted_at       TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

function isConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

// Cached so concurrent callers share one schema round-trip, as the other stores do.
let ready = null;

function init() {
  if (!isConfigured()) {
    throw new Error(
      'No online database configured. Set DATABASE_URL in src/Backend/.env ' +
        'to a Postgres connection string.',
    );
  }
  if (!ready) {
    ready = pool.query(SCHEMA).catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}

/**
 * Drops everything past its window.
 *
 * Called from the operations rather than run on a timer: an expired row is only
 * ever wrong when somebody looks, and a setInterval in a web process is a thing
 * that has to be reasoned about at every restart and in every test. The cost is
 * that a database nobody touches keeps its expired rows -- which is untidy and
 * not a leak, because nothing will ever restore from them.
 *
 * @returns {Promise<number>} how many were dropped.
 */
async function purgeExpired() {
  await init();
  const { rowCount } = await pool.query(
    'DELETE FROM deleted_accounts WHERE deleted_at < now() - make_interval(secs => $1)',
    [RETENTION_MS / 1000],
  );
  return rowCount;
}

/**
 * Keeps a copy of one account, replacing any older copy under the same key.
 *
 * Replacing rather than refusing: the key identifies the person, so a second
 * deletion of the same key is the same person being removed again, and the
 * copy worth keeping is the newer one.
 *
 * @param {string} key the registration key.
 * @param {object} record the whole stored record, hash and all.
 * @returns {Promise<string>} when the window closes, as an ISO timestamp.
 */
async function archive(key, record) {
  await init();
  const { rows } = await pool.query(
    `INSERT INTO deleted_accounts (registration_key, data, deleted_at)
          VALUES ($1, $2, now())
     ON CONFLICT (registration_key) DO UPDATE
             SET data = EXCLUDED.data,
                 deleted_at = now()
       RETURNING deleted_at`,
    [String(key), JSON.stringify(record)],
  );
  return new Date(rows[0].deleted_at.getTime() + RETENTION_MS).toISOString();
}

/**
 * Removes the copy and hands it back, or answers null when there is none left.
 *
 * One statement, so two administrators pressing Undo on the same account cannot
 * both be told they succeeded -- the second finds nothing to take. Expired rows
 * are cleared first so a late press is refused rather than honoured.
 *
 * @param {string} key
 * @returns {Promise<object|null>} the record as it was deleted.
 */
async function take(key) {
  await purgeExpired();
  const { rows } = await pool.query(
    'DELETE FROM deleted_accounts WHERE registration_key = $1 RETURNING data',
    [String(key)],
  );
  return rows.length ? rows[0].data : null;
}

module.exports = { RETENTION_MS, isConfigured, init, archive, take, purgeExpired };
