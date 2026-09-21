import axios from "axios";

const API_BASE = process.env.REACT_APP_API_URL || "";

// Mirrors appointments to the online database. Separate from api/appointments.js,
// which talks to the local SQLite store at /api/appointments — this one is the
// offsite copy and leaves that endpoint untouched.

/** Whether the backend has an online database to write to. */
export async function getAppointmentsOnlineStatus() {
  const { data } = await axios.get(`${API_BASE}/api/online/appointments/status`);
  return data;
}

/**
 * Persists one appointment offsite, keyed on id (falling back to appointmentID),
 * so re-saving the same booking updates in place. Fire-and-forget at the call
 * site: the record is already in localStorage, so an outage must not block the UI.
 */
export async function saveAppointmentOnline(appointment) {
  const { data } = await axios.post(
    `${API_BASE}/api/online/appointments`,
    appointment,
  );
  return data;
}

/** Pushes a whole list — used by dbSync to backfill and to sync changes. */
export async function saveAppointmentsOnline(appointments) {
  const { data } = await axios.post(
    `${API_BASE}/api/online/appointments`,
    appointments,
  );
  return data;
}

export async function getAppointmentsOnline(params = {}) {
  const { data } = await axios.get(`${API_BASE}/api/online/appointments`, {
    params,
  });
  return Array.isArray(data) ? data : [];
}

export async function deleteAppointmentOnline(key) {
  const { data } = await axios.delete(
    `${API_BASE}/api/online/appointments/${key}`,
  );
  return data;
}

/**
 * Makes the online appointments match `records` exactly, deleting rows it does not
 * contain. Only for the UI's own delete and clear actions -- the background push
 * loop must never call this, or one browser missing a record would delete it for
 * everyone. Emptying the collection requires the explicit allowEmpty flag.
 */
export async function replaceAppointmentsOnline(records) {
  const allowEmpty = Array.isArray(records) && records.length === 0;
  const { data } = await axios.put(
    `${API_BASE}/api/online/appointments${allowEmpty ? "?allowEmpty=true" : ""}`,
    records,
  );
  return data;
}
