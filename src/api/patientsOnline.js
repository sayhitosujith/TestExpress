import axios from "axios";

const API_BASE = process.env.REACT_APP_API_URL || "";

// Mirrors patient profiles to the online database. Separate from api/patients.js,
// which talks to the local SQLite store at /api/patients.

/** Whether the backend has an online database to write to. */
export async function getPatientsOnlineStatus() {
  const { data } = await axios.get(`${API_BASE}/api/online/patients/status`);
  return data;
}

/**
 * Persists one profile offsite, keyed on patientId (falling back to phone), so
 * re-saving the same patient updates in place. Fire-and-forget at the call site:
 * the profile is already in localStorage, so an outage must not block the screen.
 */
export async function savePatientOnline(profile) {
  const { data } = await axios.post(`${API_BASE}/api/online/patients`, profile);
  return data;
}

/** Pushes the whole list — used by dbSync to backfill and to sync changes. */
export async function savePatientsOnline(profiles) {
  const { data } = await axios.post(`${API_BASE}/api/online/patients`, profiles);
  return data;
}

export async function getPatientsOnline(params = {}) {
  const { data } = await axios.get(`${API_BASE}/api/online/patients`, { params });
  return Array.isArray(data) ? data : [];
}

/**
 * Makes the online patients match `profiles` exactly, deleting rows it does not
 * contain. Only for the UI's own delete and clear actions — the background push
 * loop must never call this, or one browser missing a profile would delete it for
 * everyone. Emptying the collection requires the explicit allowEmpty flag.
 */
export async function replacePatientsOnline(profiles) {
  const allowEmpty = Array.isArray(profiles) && profiles.length === 0;
  const { data } = await axios.put(
    `${API_BASE}/api/online/patients${allowEmpty ? "?allowEmpty=true" : ""}`,
    profiles,
  );
  return data;
}

export async function deletePatientOnline(key) {
  const { data } = await axios.delete(
    `${API_BASE}/api/online/patients/${encodeURIComponent(key)}`,
  );
  return data;
}
