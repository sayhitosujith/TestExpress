import axios from "axios";

const API_BASE = process.env.REACT_APP_API_URL || "";

/** Whether the backend has an online database to write to. */
export async function getRegistrationsStatus() {
  const { data } = await axios.get(`${API_BASE}/api/online/registrations/status`);
  return data;
}

/**
 * Persists one registration to the online database, keyed on phone number so a
 * re-save updates in place. Callers treat this as fire-and-forget, the same way
 * logAction is used: the screen already has the record in localStorage, so a
 * database outage must never block the UI.
 */
export async function saveRegistration(user) {
  const { data } = await axios.post(`${API_BASE}/api/online/registrations`, user);
  return data;
}

/** Pushes a whole list — used to backfill users registered before this existed. */
export async function saveRegistrations(users) {
  const { data } = await axios.post(`${API_BASE}/api/online/registrations`, users);
  return data;
}

export async function getRegistrations(params = {}) {
  const { data } = await axios.get(`${API_BASE}/api/online/registrations`, { params });
  return Array.isArray(data) ? data : [];
}

export async function deleteRegistration(phoneNumber) {
  const { data } = await axios.delete(
    `${API_BASE}/api/online/registrations/${phoneNumber}`,
  );
  return data;
}

/**
 * Makes the online registrations match `records` exactly, deleting rows it does not
 * contain. Only for the UI's own delete and clear actions -- the background push
 * loop must never call this, or one browser missing a record would delete it for
 * everyone. Emptying the collection requires the explicit allowEmpty flag.
 */
export async function replaceRegistrations(records) {
  const allowEmpty = Array.isArray(records) && records.length === 0;
  const { data } = await axios.put(
    `${API_BASE}/api/online/registrations${allowEmpty ? "?allowEmpty=true" : ""}`,
    records,
  );
  return data;
}
