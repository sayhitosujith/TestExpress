// Re-runnable: make sure every registration has a bcrypt hash, deriving it from
// the plaintext where one is present.
//
//   node src/Backend/scripts/hash-passwords.js          # report only
//   node src/Backend/scripts/hash-passwords.js --apply  # make the change
//
// It does NOT remove the plaintext. It used to, back when the readable password
// was being eliminated; storing it alongside the hash is now a deliberate
// choice (see the note at the top of registrationsDb.js), so deleting it here
// would quietly undo that on the next run. Hashing and clearing were one
// transaction; only the hashing half remains.
//
// This is still a script rather than boot DDL because bcrypt cannot run in SQL,
// so the plaintext is the only possible input to the hash.
//
// Dry by default. This rewrites credentials for real people; making the caller
// ask for it twice is cheap next to getting it wrong once.
// Loaded by absolute path, not from the working directory. The sibling scripts
// call plain config() and so only work when run from src/Backend; a migration
// that rewrites credentials must not quietly do nothing because it was started
// from the repo root, which is where its own usage line says to start it.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const pool = require('../db');
const { hashPassword, isHashed } = require('../passwords');

const APPLY = process.argv.includes('--apply');

/**
 * Whether this database still has the legacy plaintext `password` column.
 *
 * It is dropped once a database has finished migrating, so every statement
 * below has to work with and without it. Detected rather than assumed: naming a
 * column that is not there is a hard error, and this script has to stay
 * runnable as a check long after it has nothing left to do.
 *
 * @returns {Promise<boolean>}
 */
async function hasLegacyColumn() {
  const { rowCount } = await pool.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_name = 'registrations' AND column_name = 'password'`,
  );
  return rowCount > 0;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set — nothing to migrate.');
    process.exitCode = 1;
    return;
  }

  // password_hash is created by the store's own schema pass; if this script runs
  // before the backend has ever started, add it here rather than failing.
  await pool.query('ALTER TABLE registrations ADD COLUMN IF NOT EXISTS password_hash TEXT');

  const legacy = await hasLegacyColumn();
  if (!legacy) {
    console.log("(the legacy plaintext column is gone — checking the JSONB only)\n");
  }

  const { rows } = await pool.query(`
    SELECT registration_key,
           email,
           ${legacy ? "password" : "NULL::text AS password"},
           password_hash,
           data->>'password' AS json_password
      FROM registrations
     ORDER BY registration_key`);

  console.log(`${rows.length} registration(s) in the table\n`);

  let hashed = 0;
  let already = 0;
  let noPassword = 0;

  for (const row of rows) {
    const label = `${row.registration_key} (${row.email || 'no email'})`;

    if (isHashed(row.password_hash)) {
      // Nothing to do. The plaintext beside it is kept on purpose now, so it is
      // reported as present rather than as residue to be cleaned up.
      const readable = row.password || row.json_password;
      console.log(`  already hashed  ${label}${readable ? '  (readable copy present)' : ''}`);
      already += 1;
      continue;
    }

    const plain = row.password || row.json_password;
    if (!plain) {
      console.log(`  no password     ${label}  — cannot log in until one is set`);
      noPassword += 1;
      continue;
    }

    if (!APPLY) {
      console.log(`  would hash      ${label}  (${String(plain).length} chars)`);
      hashed += 1;
      continue;
    }

    const hash = await hashPassword(plain);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE registrations
            SET password_hash = $2,
                data          = data || jsonb_build_object('passwordHash', $2::text)
          WHERE registration_key = $1`,
        [row.registration_key, hash],
      );
      await client.query('COMMIT');
      console.log(`  hashed          ${label}`);
      hashed += 1;
    } catch (err) {
      await client.query('ROLLBACK');
      console.log(`  FAILED          ${label}: ${err.message}`);
    } finally {
      client.release();
    }
  }

  console.log(
    `\n${APPLY ? 'applied' : 'dry run'}: ${hashed} to hash, ${already} already hashed, ${noPassword} without a password`,
  );
  if (!APPLY && hashed) console.log('re-run with --apply to make the change.');

  if (APPLY) {
    const readable = await pool.query(
      `SELECT count(*) AS n FROM registrations
        WHERE ${legacy ? "password IS NOT NULL OR " : ""}data ? 'password'`);
    // Reported, not warned about: the readable copy is stored deliberately.
    console.log(`rows with a readable password: ${readable.rows[0].n} of ${rows.length}`);
  }
}

main()
  .catch((err) => {
    console.error('migration failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end().catch(() => {}));
