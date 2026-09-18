// Persistent appointment records (survive a browser/localStorage wipe).
// Reuses the same SQLite connection as the action log.
const { db } = require('./actionsDb');

db.exec(`
  CREATE TABLE IF NOT EXISTS appointments (
    id                TEXT PRIMARY KEY,
    patient_name      TEXT,
    phone             TEXT,
    email             TEXT,
    date              TEXT,
    time              TEXT,
    dentist           TEXT,
    consultation_type TEXT,
    meeting_url       TEXT,
    notes             TEXT,
    type              TEXT,           -- JSON array of treatments
    amount            INTEGER,
    status            TEXT,           -- Pending | Cancelled | Paid | Completed
    paid              INTEGER DEFAULT 0,
    payment_method    TEXT,
    discharged        INTEGER DEFAULT 0,
    created_at        TEXT DEFAULT (datetime('now')),
    updated_at        TEXT DEFAULT (datetime('now'))
  );
`);

const COLS = [
  'id',
  'patient_name',
  'phone',
  'email',
  'date',
  'time',
  'dentist',
  'consultation_type',
  'meeting_url',
  'notes',
  'type',
  'amount',
  'status',
  'paid',
  'payment_method',
  'discharged',
];

function upsertAppointment(a) {
  if (!a || !a.id) throw new Error('appointment id is required');
  const row = {
    id: String(a.id),
    patient_name: a.patientName ?? a.name ?? a.customerName ?? null,
    phone: a.phone ?? null,
    email: a.email ?? null,
    date: a.date ?? null,
    time: a.time ?? null,
    dentist: a.dentist ?? null,
    consultation_type: a.consultationType ?? null,
    meeting_url: a.meetingUrl ?? null,
    notes: a.notes ?? null,
    type: a.type != null ? JSON.stringify(a.type) : null,
    amount: a.amount != null ? Number(a.amount) : null,
    status: a.status ?? 'Pending',
    paid: a.paid ? 1 : 0,
    payment_method: a.paymentMethod ?? null,
    discharged: a.discharged ? 1 : 0,
  };

  const placeholders = COLS.map(() => '?').join(', ');
  const updates = COLS.filter((c) => c !== 'id')
    .map((c) => `${c}=excluded.${c}`)
    .join(', ');

  db.prepare(
    `INSERT INTO appointments (${COLS.join(', ')})
     VALUES (${placeholders})
     ON CONFLICT(id) DO UPDATE SET ${updates}, updated_at=datetime('now')`,
  ).run(...COLS.map((c) => row[c]));

  return row.id;
}

function listAppointments({ limit = 500 } = {}) {
  const rows = db
    .prepare(`SELECT * FROM appointments ORDER BY updated_at DESC LIMIT ?`)
    .all(limit);
  return rows.map((r) => ({
    ...r,
    type: r.type ? JSON.parse(r.type) : [],
    paid: !!r.paid,
    discharged: !!r.discharged,
  }));
}

module.exports = { upsertAppointment, listAppointments };
