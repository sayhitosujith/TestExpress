// Online (Postgres) store for patient profiles.
//
// Distinct from patientsDb.js, which is the local SQLite copy behind /api/patients
// and stays exactly as it was. This is the offsite mirror, fed by dbSync from the
// same `allProfiles` localStorage key Addprofile, Profile and PatientPortal write.
const { createCollectionStore } = require('./collectionStore');

/**
 * Stable key for a profile: patientId ("P-123456"), falling back to phone.
 *
 * Identical to profileKey in patientsDb.js so a profile is the same record in both
 * stores, and consistent with the `patients` idField sheetsDb declares.
 */
function patientKey(profile) {
  const id = String(profile?.patientId ?? '').trim();
  if (id) return id;
  return String(profile?.phone ?? '').trim();
}

// Only small, queryable fields get their own column. The profile photo and the
// x-ray reports are base64 and can run to megabytes each -- they live in the `data`
// JSONB and are deliberately not mirrored, since duplicating them would double the
// row for something nothing filters on.
const store = createCollectionStore({
  table: 'patients',
  keyColumn: 'patient_key',
  keyOf: patientKey,
  keyHint: 'must have a patientId or phone',
  indexes: ['phone'],
  columns: [
    { name: 'patient_id', from: (p) => p.patientId },
    { name: 'phone', from: (p) => p.phone },
    { name: 'first_name', from: (p) => p.firstName },
    { name: 'last_name', from: (p) => p.lastName },
    { name: 'email', from: (p) => p.email },
    { name: 'sex', from: (p) => p.sex },
    { name: 'zip', from: (p) => p.zip },
    { name: 'occupation', from: (p) => p.occupation },
    { name: 'referred_by', from: (p) => p.referredBy },
    { name: 'contact_preference', from: (p) => p.contactPreference },
  ],
});

module.exports = {
  store,
  isConfigured: store.isConfigured,
  init: store.init,
  patientKey,
  upsertPatient: store.upsert,
  upsertPatients: store.upsertMany,
  listPatients: store.list,
  deletePatient: store.remove,
};
