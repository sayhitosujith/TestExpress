// Online (Postgres) store for appointments.
//
// Distinct from appointmentsDb.js, which is the local SQLite copy behind
// /api/appointments and stays exactly as it was. This is the offsite mirror, fed
// by dbSync from the same `appointments` localStorage key the fourteen writing
// screens already use.
const { createCollectionStore } = require('./collectionStore');

/**
 * Stable key for an appointment: `id` first, then `appointmentID`.
 *
 * The one localStorage collection holds two record shapes -- BookAppointment
 * stamps `appointmentID` ("APT-<millis>") while MyCart, SuperAdmin and
 * AppointmentHistory use `id` -- so both have to be accepted or half the
 * bookings would be unkeyable. `id` is first because it is what the existing
 * SQLite table keys on, keeping the two stores in agreement.
 */
function appointmentKey(appointment) {
  const id = String(appointment?.id ?? '').trim();
  if (id) return id;
  return String(appointment?.appointmentID ?? '').trim();
}

// Both shapes are read with a fallback so the mirrored columns are populated
// whichever screen wrote the record. The full record is in `data` regardless.
const store = createCollectionStore({
  table: 'appointments',
  keyColumn: 'appointment_key',
  keyOf: appointmentKey,
  keyHint: 'must have an id or appointmentID',
  indexes: ['phone', 'appt_date'],
  columns: [
    { name: 'record_id', from: (a) => a.id ?? a.appointmentID },
    { name: 'patient_name', from: (a) => a.patientName ?? a.patient_name },
    { name: 'phone', from: (a) => a.phone },
    { name: 'email', from: (a) => a.email },
    { name: 'appt_date', from: (a) => a.date },
    { name: 'appt_time', from: (a) => a.time },
    { name: 'dentist', from: (a) => a.dentist ?? a.doctor },
    { name: 'status', from: (a) => a.status },
    { name: 'amount', from: (a) => a.amount ?? a.consultationCharges },
  ],
});

module.exports = {
  store,
  isConfigured: store.isConfigured,
  init: store.init,
  appointmentKey,
  upsertAppointment: store.upsert,
  upsertAppointments: store.upsertMany,
  listAppointments: store.list,
  deleteAppointment: store.remove,
};
