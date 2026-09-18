// Online (Postgres) store for the users created by the NewRegistration screen.
// The frontend keeps writing localStorage as it always has; this is the durable
// copy that survives a browser wipe.
const { createCollectionStore } = require('./collectionStore');

/**
 * Stable key for a registration: the record's own id, falling back to phone.
 *
 * Keyed on id rather than phone because the screen's clone button deliberately
 * produces users that share a phone and differ only by id and email -- keying on
 * phone made a clone overwrite the row it was cloned from instead of adding one.
 * Phone is the fallback because users created from SuperAdmin are pushed into the
 * same collection without an id. Mirrors profileKey in patientsDb.js.
 */
function registrationKey(user) {
  const id = String(user?.id ?? '').trim();
  if (id) return id;
  return String(user?.phoneNumber ?? '').trim();
}

// Passwords are stored twice: as a bcrypt hash, and as readable plaintext.
//
// The plaintext copy is a deliberate, requested choice, and it is worth being
// blunt about what it costs so nobody has to rediscover it:
//
//   * anyone who can read this table can read every account's real password,
//     and these are addresses people reuse on other services, so a leak here is
//     not limited to this application;
//   * a database backup, a log of a query, or a screenshot of the table browser
//     carries them too.
//
// What it buys is that the password can be read back from the database, which
// is what was asked for.
//
// Sign-in does NOT use this column. routes/auth.js compares against
// `password_hash` only, so deleting every plaintext value would cost nothing
// but the readability -- which is the escape hatch if this is ever reconsidered.
const { hashPassword, isHashed, verifyPassword } = require('./passwords');

/**
 * Hashes an incoming password, and keeps the plaintext alongside it.
 *
 * The rule that matters: a plaintext `password` on the record means somebody
 * just typed one, so it is hashed and it replaces whatever hash was stored. An
 * earlier version treated any existing hash as final and returned early, which
 * made a password change a silent no-op -- the edit screen reported "User
 * Updated Successfully", the row kept the old hash, and the new password simply
 * did not work while the old one still did.
 *
 * Still idempotent where idempotence is actually needed: a record arriving with
 * only a hash and no plaintext -- a re-push from the sync loop, or a cloned
 * user -- keeps that hash untouched rather than being re-hashed into something
 * nobody's password matches. Carrying the *plaintext* through that case is the
 * route's job, not this function's: only the route can read what is already
 * stored, and blanking it on every unrelated edit would leave the column
 * populated or empty depending on which field somebody last touched.
 */
async function hashRegistrationPassword(user) {
  const record = Object.assign({}, user);
  const existing = record.passwordHash;
  const plain = record.password;

  // A plaintext password: it wins over anything already stored, and the
  // readable copy is kept beside the hash.
  if (plain && !isHashed(plain)) {
    // Unless it is the password already stored. Keeping the readable copy means
    // every save now arrives carrying it, so without this check an edit to a
    // phone number would regenerate the hash — bcrypt salts randomly, so it
    // would be a different string every time. That churn is wasted work, and it
    // makes the sanitizer non-idempotent, which is the property the sync loop
    // and the clone button both rely on.
    if (isHashed(existing) && (await verifyPassword(plain, existing))) {
      record.password = plain;
      return record;
    }
    record.passwordHash = await hashPassword(plain);
    record.password = plain;
    return record;
  }
  // Already-hashed values pass through, whichever field they arrived in --
  // `passwordHash` from this app, or `password` from an older client that had
  // already been migrated. A hash is not plaintext, so it must not be left
  // sitting in the readable column pretending to be one.
  if (isHashed(existing)) {
    if (isHashed(record.password)) delete record.password;
    return record;
  }
  if (isHashed(plain)) {
    record.passwordHash = plain;
    delete record.password;
    return record;
  }
  // No password at all. Left as-is rather than rejected: the SuperAdmin screen
  // pushes records this way and they simply cannot be signed in to until one is
  // set, whereas rejecting would drop the record from the sync entirely.
  delete record.passwordHash;
  return record;
}

// Moves a table created before the key changed from phone_number to
// registration_key onto the new key, preserving every existing row. Safe to run
// on every boot: on a table that is already correct each statement is a no-op.
const MIGRATE = `
  ALTER TABLE registrations ADD COLUMN IF NOT EXISTS registration_key TEXT;
  ALTER TABLE registrations ADD COLUMN IF NOT EXISTS record_id TEXT;
  UPDATE registrations
     SET registration_key = COALESCE(NULLIF(data->>'id', ''), phone_number)
   WHERE registration_key IS NULL;
  UPDATE registrations
     SET record_id = NULLIF(data->>'id', '')
   WHERE record_id IS NULL;
  -- A backfill of the plaintext password column from the JSONB used to live
  -- here. It is gone: it would refill, on every boot, the exact column the move
  -- to hashing exists to empty.
  --
  -- The column itself is deliberately NOT dropped and NOT cleared here. Hashing
  -- needs the plaintext as its input and bcrypt cannot run in SQL, so clearing
  -- it from boot DDL would destroy the only source the migration has and leave
  -- every existing account permanently unable to log in. The script at
  -- scripts/hash-passwords.js hashes first and clears second, which is the only
  -- safe order; this file must not race it.

  -- "practice" became "payment". Deliberately a copy-then-drop rather than
  -- ALTER ... RENAME: the store adds every declared column before running this
  -- file, so by the time it executes an empty "payment" already exists and a
  -- rename would fail -- or, guarded on the column not existing, would skip and
  -- leave every account's value stranded in a column nothing reads.
  --
  -- "payment IS NULL" rather than an unconditional copy so that re-running
  -- this on a half-migrated table cannot overwrite a value somebody has since
  -- chosen. Once "practice" is dropped the whole block is a no-op.
  DO LANGUAGE plpgsql $pay$
  BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_name = 'registrations' AND column_name = 'practice'
    ) THEN
      UPDATE registrations SET payment = practice WHERE payment IS NULL;
      ALTER TABLE registrations DROP COLUMN practice;
    END IF;
  END
  $pay$;
  -- The same move inside the JSONB record, which is what the app actually
  -- reads back: the mirrored columns exist for querying, "data" is the record.
  -- Without this every existing account would show no payment at all the
  -- moment the form stopped writing "practice".
  UPDATE registrations
     SET data = (data - 'practice') ||
                CASE WHEN data->>'practice' IS NULL THEN '{}'::jsonb
                     ELSE jsonb_build_object('payment', data->>'practice') END
   WHERE data ? 'practice';

  -- Both sign-in columns, for rows written before they existed. Only NULLs
  -- are filled, so a value already written is never overwritten here.
  UPDATE registrations
     SET sign_in_disabled = CASE WHEN data->>'signInDisabled' = 'true'
                                 THEN 'true' ELSE 'false' END
   WHERE sign_in_disabled IS NULL;
  UPDATE registrations
     SET can_sign_in = CASE
           WHEN password_hash IS NULL THEN 'false'
           WHEN sign_in_disabled = 'true' THEN 'false'
           ELSE 'true'
         END
   WHERE can_sign_in IS NULL;

  DO LANGUAGE plpgsql $mig$
  BEGIN
    -- Drop the old primary key only when it is the single phone_number column.
    IF EXISTS (
      SELECT 1
        FROM pg_constraint c
       WHERE c.conrelid = 'registrations'::regclass
         AND c.contype = 'p'
         AND (SELECT array_agg(a.attname::text)
                FROM pg_attribute a
               WHERE a.attrelid = c.conrelid
                 AND a.attnum = ANY (c.conkey)) = ARRAY['phone_number']
    ) THEN
      EXECUTE 'ALTER TABLE registrations DROP CONSTRAINT ' ||
              (SELECT conname
                 FROM pg_constraint
                WHERE conrelid = 'registrations'::regclass AND contype = 'p');
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
       WHERE conrelid = 'registrations'::regclass AND contype = 'p'
    ) THEN
      ALTER TABLE registrations ALTER COLUMN registration_key SET NOT NULL;
      ALTER TABLE registrations ADD PRIMARY KEY (registration_key);
    END IF;
  END
  $mig$;
`;

const store = createCollectionStore({
  table: 'registrations',
  keyColumn: 'registration_key',
  keyOf: registrationKey,
  keyHint: 'must have an id or phoneNumber',
  indexes: ['phone_number'],
  migrate: MIGRATE,
  sanitize: hashRegistrationPassword,
  columns: [
    { name: 'record_id', from: (u) => u.id },
    { name: 'phone_number', from: (u) => u.phoneNumber },
    { name: 'first_name', from: (u) => u.firstName },
    { name: 'last_name', from: (u) => u.lastName },
    { name: 'email', from: (u) => u.email },
    { name: 'zip_code', from: (u) => u.zipCode },
    { name: 'payment', from: (u) => u.payment },
    // Whether an administrator has switched this account off. Written as an
    // explicit "false" rather than left NULL: a blank cell in a table browser
    // reads as "nobody has decided", and the decision is exactly what somebody
    // opening the table wants to know.
    { name: 'sign_in_disabled', from: (u) => (u.signInDisabled ? 'true' : 'false') },
    // The answer the Super Admin screen shows in its "Can sign in" column,
    // stored rather than left to be recomputed.
    //
    // Derived from two other fields, which is a duplication worth being
    // deliberate about: it exists so the question can be ASKED of the database.
    // "Which accounts cannot log in" is one WHERE clause with this column, and
    // a JSONB lookup plus a bcrypt-shape test without it. It is written on
    // every upsert from the same record it describes, so it cannot drift from
    // the values behind it.
    //
    // Authoritative it is NOT: sign-in reads password_hash and signInDisabled,
    // never this column. Editing it by hand changes what the table says and
    // nothing about who can actually log in.
    {
      name: 'can_sign_in',
      from: (u) => (isHashed(u.passwordHash) && !u.signInDisabled ? 'true' : 'false'),
    },
    { name: 'role', from: (u) => u.role },
    { name: 'profile_picture', from: (u) => u.profilePicture },
    // The hash gets its own column so auth can look a user up without pulling
    // the whole JSONB.
    { name: 'password_hash', from: (u) => u.passwordHash },
    // The readable password, by request -- see the note at the top of this file
    // for what that costs. This is the column a table browser shows; sign-in
    // never reads it.
    { name: 'password', from: (u) => u.password },
  ],
});

module.exports = {
  store,
  // Exported for scripts/auth.test.js. The replace-an-existing-hash rule is
  // subtle enough, and failed silently enough, to be worth testing directly
  // rather than only through the route that happens to call it.
  hashRegistrationPassword,
  isConfigured: store.isConfigured,
  init: store.init,
  registrationKey,
  upsertRegistration: store.upsert,
  upsertRegistrations: store.upsertMany,
  listRegistrations: store.list,
  deleteRegistration: store.remove,
};
