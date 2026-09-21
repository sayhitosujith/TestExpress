// Factory for the online (Postgres) collection stores.
//
// registrations and doctors need the same six things -- create the table, cache
// the schema round-trip, upsert one, upsert a batch skipping bad entries, list
// newest-first, delete by key -- and differ only in table name, key column and
// which fields get their own queryable column. Writing that twice meant two
// copies of the same SQL drifting apart, so it lives here once and each store
// is a small declaration on top of it.
//
// Every collection keeps the whole sanitised record in a `data` JSONB column and
// mirrors a few fields into TEXT columns. The JSONB is what callers read back;
// the columns exist for indexing and for looking at the table by hand.
const pool = require('./db');

// Table and column names are interpolated into DDL, so they are checked against
// a strict identifier pattern rather than trusted. They are developer-supplied
// constants today, but a generated identifier reaching this unchecked would be
// straightforward SQL injection.
const IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

function assertIdentifier(name, what) {
  if (!IDENTIFIER.test(String(name || ''))) {
    throw new Error(`invalid ${what}: ${name}`);
  }
  return name;
}

/**
 * Builds a store for one collection.
 *
 * @param {object}   spec
 * @param {string}   spec.table      Table name.
 * @param {string}   spec.keyColumn  Primary-key column, holding the value keyOf returns.
 * @param {Array}    spec.columns    [{ name, from(record) }] mirrored into TEXT columns.
 * @param {Function} spec.keyOf      record -> stable string key ('' when unidentifiable).
 * @param {string}   spec.keyHint    Wording for the error when keyOf returns nothing.
 * @param {Function} [spec.sanitize] record -> record (may be async), applied before
 *   anything is stored.
 * @param {string[]} [spec.indexes]  Columns to index.
 * @param {string}   [spec.migrate]  Extra idempotent SQL run after the schema.
 */
function createCollectionStore(spec) {
  const table = assertIdentifier(spec.table, 'table name');
  const keyColumn = assertIdentifier(spec.keyColumn, 'key column');
  const columns = (spec.columns || []).map((c) => ({
    name: assertIdentifier(c.name, 'column name'),
    from: c.from,
  }));
  const sanitize = spec.sanitize || ((record) => record);
  const indexes = (spec.indexes || []).map((c) => assertIdentifier(c, 'index column'));

  const columnDdl = columns.map((c) => `    ${c.name} TEXT,`).join('\n');
  const schema =
    `CREATE TABLE IF NOT EXISTS ${table} (\n` +
    `    ${keyColumn} TEXT PRIMARY KEY,\n` +
    `${columnDdl}\n` +
    `    data JSONB NOT NULL,\n` +
    `    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),\n` +
    `    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()\n` +
    `  );\n` +
    indexes
      .map(
        (c) =>
          `  CREATE INDEX IF NOT EXISTS ${table}_${c}_idx ON ${table} (${c});`,
      )
      .join('\n');

  // CREATE TABLE IF NOT EXISTS does nothing to a table that already exists, so a
  // column added to a store's declaration later would never appear and every write
  // to it would fail. Adding each declared column explicitly keeps an existing table
  // in step with the declaration; both statements are no-ops once it is.
  const addColumns = columns
    .map(
      (c) => `  ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${c.name} TEXT;`,
    )
    .join('\n');

  // $1 is the key, $2..$n the mirrored columns, $last the JSONB payload.
  const insertColumns = [keyColumn, ...columns.map((c) => c.name), 'data'];
  const placeholders = insertColumns.map((_, i) => `$${i + 1}`);
  const updates = [...columns.map((c) => c.name), 'data']
    .map((name) => `      ${name} = EXCLUDED.${name}`)
    .join(',\n');
  const upsertSql =
    `INSERT INTO ${table} (${insertColumns.join(', ')})\n` +
    `   VALUES (${placeholders.join(', ')})\n` +
    `   ON CONFLICT (${keyColumn}) DO UPDATE SET\n` +
    `${updates},\n` +
    `      updated_at = now()`;

  /**
   * True when a connection string is present. Routes check this and answer 501
   * with setup steps rather than 500, so an install without a database reports
   * "not set up" instead of looking broken -- same contract as sheetsDb.
   */
  function isConfigured() {
    return Boolean(process.env.DATABASE_URL);
  }

  // Cached so concurrent callers share one schema round-trip instead of racing
  // each other on the first request after boot.
  let ready = null;
  function init() {
    if (!isConfigured()) {
      throw new Error(
        'No online database configured. Set DATABASE_URL in src/Backend/.env ' +
          'to a Postgres connection string.',
      );
    }
    if (!ready) {
      ready = pool
        .query(schema)
        .then(() => (addColumns ? pool.query(addColumns) : null))
        .then(() => (spec.migrate ? pool.query(spec.migrate) : null))
        .catch((err) => {
          // Clear the cache so a transient outage during boot does not poison
          // every later request with the same rejected promise.
          ready = null;
          throw err;
        });
    }
    return ready;
  }

  /** Inserts or updates one record. Returns the key it was stored under. */
  async function upsert(record) {
    if (!record || typeof record !== 'object') {
      throw new Error(`${table} record is required`);
    }
    const key = spec.keyOf(record);
    if (!key) throw new Error(`${table} record ${spec.keyHint}`);

    await init();
    // Awaited so a store can sanitise asynchronously -- registrations hashes the
    // password here, which is a KDF and therefore async.
    const safe = await sanitize(record);
    await pool.query(upsertSql, [
      key,
      ...columns.map((c) => {
        const value = c.from(safe);
        return value == null || value === '' ? null : String(value);
      }),
      JSON.stringify(safe),
    ]);
    return key;
  }

  /** Upserts a batch; an invalid entry is skipped rather than failing the rest. */
  async function upsertMany(list) {
    if (!Array.isArray(list)) throw new Error(`an array of ${table} records is required`);
    const saved = [];
    for (const record of list) {
      try {
        saved.push(await upsert(record));
      } catch (e) {
        console.warn(`skipping invalid ${table} record:`, e.message);
      }
    }
    return saved;
  }

  /**
   * Makes the table match `list` exactly: upserts everything given, then deletes
   * the rows whose key is not in it.
   *
   * This is the only operation that removes data the caller did not name, so it
   * is never wired into the background push loop -- absence of a record there
   * means "this browser has not got it", not "delete it". The keys are computed
   * here rather than by the caller so the key rules live in one place.
   *
   * @returns {{saved: number, deleted: number}}
   */
  async function replaceAll(list) {
    if (!Array.isArray(list)) throw new Error(`an array of ${table} records is required`);
    await init();

    const saved = await upsertMany(list);
    // An empty list is a full wipe, expressed as "delete every key" -- the route
    // guards that case separately so it cannot happen by accident.
    const result = saved.length
      ? await pool.query(
          `DELETE FROM ${table} WHERE NOT (${keyColumn} = ANY($1::text[]))`,
          [saved],
        )
      : await pool.query(`DELETE FROM ${table}`);

    return { saved: saved.length, deleted: result.rowCount };
  }

  /**
   * Deletes exactly the keys given, and nothing else.
   *
   * This is what the sync uses to propagate a deletion. Unlike replaceAll it can
   * only ever remove records the caller names, so a row the caller has never seen
   * -- one imported straight into the database, say -- is not at risk.
   *
   * @returns {{deleted: number}}
   */
  async function removeMany(keys) {
    if (!Array.isArray(keys)) throw new Error('an array of keys is required');
    if (!keys.length) return { deleted: 0 };
    await init();
    const { rowCount } = await pool.query(
      `DELETE FROM ${table} WHERE ${keyColumn} = ANY($1::text[])`,
      [keys.map(String)],
    );
    return { deleted: rowCount };
  }

  /** Most-recently-updated first, so a grid can render straight from this. */
  async function list({ limit = 1000 } = {}) {
    await init();
    const { rows } = await pool.query(
      `SELECT data FROM ${table} ORDER BY updated_at DESC LIMIT $1`,
      [limit],
    );
    return rows.map((r) => r.data);
  }

  /**
   * Deletes by exact key only. Matching a secondary field as well would remove
   * every record sharing it in one unasked-for sweep, which is not what deleting
   * a single record should do.
   */
  async function remove(key) {
    await init();
    const { rowCount } = await pool.query(
      `DELETE FROM ${table} WHERE ${keyColumn} = $1`,
      [String(key)],
    );
    return rowCount > 0;
  }

  return {
    isConfigured,
    init,
    upsert,
    upsertMany,
    replaceAll,
    removeMany,
    list,
    remove,
    keyOf: spec.keyOf,
  };
}

module.exports = { createCollectionStore };
