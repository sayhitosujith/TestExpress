// Online (Postgres) store for the appointment history shown in MyCart.
//
// A separate collection from `appointments` because the app keeps it as a separate
// localStorage key with its own record shape, and clearing history is expected to
// leave the live appointments alone.
const { createCollectionStore } = require('./collectionStore');

/**
 * Stable key for a history entry: `id`, falling back to `appointmentID`.
 *
 * `id` is what sheetsDb already declares as this collection's idField, and what
 * MyCart matches on when it marks an entry completed. The fallback covers an entry
 * derived from a BookAppointment record, which carries only appointmentID.
 */
function historyKey(entry) {
  const id = String(entry?.id ?? '').trim();
  if (id) return id;
  return String(entry?.appointmentID ?? '').trim();
}

// The patient name arrives under three spellings depending on which screen wrote
// the entry (`name` and `customerName` from MyCart's mapping, `patientName`
// elsewhere), so all three are tried for the mirrored column.
const store = createCollectionStore({
  table: 'appointment_history',
  keyColumn: 'history_key',
  keyOf: historyKey,
  keyHint: 'must have an id or appointmentID',
  indexes: ['phone', 'appt_date'],
  columns: [
    { name: 'record_id', from: (h) => h.id ?? h.appointmentID },
    { name: 'patient_name', from: (h) => h.name ?? h.customerName ?? h.patientName },
    { name: 'phone', from: (h) => h.phone },
    { name: 'email', from: (h) => h.email },
    { name: 'appt_date', from: (h) => h.date },
    { name: 'appt_time', from: (h) => h.time },
    { name: 'dentist', from: (h) => h.dentist },
    { name: 'status', from: (h) => h.status },
    { name: 'completed_at', from: (h) => h.completedAt },
  ],
});

module.exports = {
  store,
  isConfigured: store.isConfigured,
  init: store.init,
  historyKey,
  upsertHistoryEntry: store.upsert,
  upsertHistoryEntries: store.upsertMany,
  listHistoryEntries: store.list,
  deleteHistoryEntry: store.remove,
};
