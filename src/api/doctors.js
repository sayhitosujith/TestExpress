import axios from "axios";

const API_BASE = process.env.REACT_APP_API_URL || "";

/** Whether the backend has an online database to write to. */
export async function getDoctorsStatus() {
  const { data } = await axios.get(`${API_BASE}/api/online/doctors/status`);
  return data;
}

/**
 * Persists one dentist to the online database, keyed on licence (falling back to
 * phone), so re-saving the same dentist updates in place. Callers treat this as
 * fire-and-forget, the same way logAction is used: the screen already has the
 * record in localStorage, so a database outage must never block the UI.
 */
export async function saveDoctor(doctor) {
  const { data } = await axios.post(`${API_BASE}/api/online/doctors`, doctor);
  return data;
}

/** Pushes a whole list — used to backfill dentists added before this existed. */
export async function saveDoctors(doctors) {
  const { data } = await axios.post(`${API_BASE}/api/online/doctors`, doctors);
  return data;
}

export async function getDoctors(params = {}) {
  const { data } = await axios.get(`${API_BASE}/api/online/doctors`, { params });
  return Array.isArray(data) ? data : [];
}

export async function deleteDoctor(key) {
  const { data } = await axios.delete(`${API_BASE}/api/online/doctors/${key}`);
  return data;
}

/**
 * Makes the online doctors match `records` exactly, deleting rows it does not
 * contain. Only for the UI's own delete and clear actions -- the background push
 * loop must never call this, or one browser missing a record would delete it for
 * everyone. Emptying the collection requires the explicit allowEmpty flag.
 */
export async function replaceDoctors(records) {
  const allowEmpty = Array.isArray(records) && records.length === 0;
  const { data } = await axios.put(
    `${API_BASE}/api/online/doctors${allowEmpty ? "?allowEmpty=true" : ""}`,
    records,
  );
  return data;
}
