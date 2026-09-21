// Verifies DATABASE_URL actually reaches the online Postgres (Neon) and reports
// what is there. Run after changing the connection string -- a wrong or expired
// string otherwise only shows up as a 501/500 from the /api/registrations routes.
//   node scripts/db-check.js
const pool = require('../db');

/** Host of the configured URL, without leaking the password into the log. */
function safeHost(url) {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`;
  } catch {
    return '(unparseable)';
  }
}

(async () => {
  const url = process.env.DATABASE_URL || '';
  if (!url) {
    console.error('DATABASE_URL is not set in src/Backend/.env -- nothing to check.');
    process.exit(1);
  }
  console.log('target:', safeHost(url));

  try {
    const { rows } = await pool.query(
      'select current_database() as db, current_user as usr, now() as ts'
    );
    console.log('connected:', rows[0].db, 'as', rows[0].usr, 'at', rows[0].ts.toISOString());

    const tables = await pool.query(
      `select table_name,
              (select count(*) from information_schema.columns c
                where c.table_schema = 'public' and c.table_name = t.table_name) as cols
         from information_schema.tables t
        where table_schema = 'public'
        order by table_name`
    );
    if (!tables.rowCount) {
      console.log('tables: none yet -- they are created on first use of the API');
    } else {
      for (const r of tables.rows) console.log(`  ${r.table_name} (${r.cols} cols)`);
    }
  } catch (err) {
    console.error('connection FAILED:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
