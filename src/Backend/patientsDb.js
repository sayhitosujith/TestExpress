// Persistent patient profiles (survive a browser/localStorage wipe or restart).
// Reuses the same SQLite connection as the action log.
const { db } = require('./actionsDb');

db.exec(`
  CREATE TABLE IF NOT EXISTS patients (
    id          TEXT PRIMARY KEY,   -- patientId (fallback: phone)
    patient_id  TEXT,
    first_name  TEXT,
    last_name   TEXT,
    email       TEXT,
    phone       TEXT,
    data        TEXT,               -- full profile JSON
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
  );
`);

// Stable key for a profile: prefer patientId, fall back to phone.
function profileKey(p) {
  return String(p?.patientId ?? p?.phone ?? '').trim();
}

function upsertPatient(p) {
  if (!p || typeof p !== 'object') throw new Error('patient object is required');
  const id = profileKey(p);
  if (!id) throw new Error('patient must have a patientId or phone');

  db.prepare(
    `INSERT INTO patients (id, patient_id, first_name, last_name, email, phone, data)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       patient_id = excluded.patient_id,
       first_name = excluded.first_name,
       last_name  = excluded.last_name,
       email      = excluded.email,
       phone      = excluded.phone,
       data       = excluded.data,
       updated_at = datetime('now')`,
  ).run(
    id,
    p.patientId != null ? String(p.patientId) : null,
    p.firstName ?? null,
    p.lastName ?? null,
    p.email ?? null,
    p.phone ?? null,
    JSON.stringify(p),
  );

  return id;
}

// Upsert a whole list; invalid entries are skipped rather than failing the batch.
function upsertPatients(list) {
  if (!Array.isArray(list)) throw new Error('an array of patients is required');
  const ids = [];
  for (const p of list) {
    try {
      ids.push(upsertPatient(p));
    } catch (e) {
      console.warn('skipping invalid patient:', e.message);
    }
  }
  return ids;
}

function listPatients({ limit = 1000 } = {}) {
  const rows = db
    .prepare(`SELECT data FROM patients ORDER BY updated_at DESC LIMIT ?`)
    .all(limit);
  return rows.map((r) => JSON.parse(r.data));
}

function deletePatient(id) {
  db.prepare(`DELETE FROM patients WHERE id = ? OR patient_id = ?`).run(
    String(id),
    String(id),
  );
  return true;
}

module.exports = { upsertPatient, upsertPatients, listPatients, deletePatient };
