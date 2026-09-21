// Online (Postgres) store for the dentists created by the AddDoctor screen.
// Same contract as registrationsDb: localStorage stays the working copy, this is
// the durable one.
const { createCollectionStore } = require('./collectionStore');

// Phone numbers are compared on digits only, because older entries were saved
// with spaces or dashes -- the same normalisation AddDoctor's digitsOnly does, so
// "9876543210" and "98765 43210" resolve to one dentist rather than two.
const digitsOnly = (value) => String(value ?? '').replace(/\D/g, '');

/**
 * Stable key for a dentist: licence number, falling back to the phone digits.
 *
 * Licence is first because sheetsDb already declares `license` as the idField for
 * this collection, so both datastores identify a dentist the same way. Phone is
 * the fallback since AddDoctor is what enforces uniqueness app-wide on it, and
 * records written by the older screens may lack a licence.
 */
function doctorKey(doctor) {
  const license = String(doctor?.license ?? '').trim();
  if (license) return license;
  return digitsOnly(doctor?.phone);
}

const store = createCollectionStore({
  table: 'doctors',
  keyColumn: 'doctor_key',
  keyOf: doctorKey,
  keyHint: 'must have a license or phone',
  indexes: ['phone_number', 'license'],
  columns: [
    { name: 'license', from: (d) => d.license },
    { name: 'phone_number', from: (d) => digitsOnly(d.phone) },
    { name: 'first_name', from: (d) => d.firstName },
    { name: 'last_name', from: (d) => d.lastName },
    { name: 'email', from: (d) => d.email },
    { name: 'specialization', from: (d) => d.specialization },
    { name: 'clinic', from: (d) => d.clinic },
    { name: 'experience', from: (d) => d.experience },
    { name: 'consultation_fee', from: (d) => d.consultationFee },
    { name: 'address', from: (d) => d.address },
    // The dentist photo is a base64 data URL, kept in its own column for the same
    // reason as the patient x-rays: it is large and nothing queries it.
    { name: 'image', from: (d) => d.image },
  ],
});

module.exports = {
  store,
  isConfigured: store.isConfigured,
  init: store.init,
  doctorKey,
  upsertDoctor: store.upsert,
  upsertDoctors: store.upsertMany,
  listDoctors: store.list,
  deleteDoctor: store.remove,
};
