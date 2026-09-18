import axios from "axios";

const API_BASE = process.env.REACT_APP_API_URL || "";

// Fetch all persisted patient profiles (durable, survives localStorage wipes/restarts).
export async function getPatients(params = {}) {
  const { data } = await axios.get(`${API_BASE}/api/patients`, { params });
  return data;
}

// Upsert a single profile.
export async function savePatient(profile) {
  const { data } = await axios.post(`${API_BASE}/api/patients`, profile);
  return data;
}

// Upsert the whole list at once (keeps the server in sync with the local cache).
export async function savePatients(profiles) {
  const { data } = await axios.post(`${API_BASE}/api/patients`, { profiles });
  return data;
}

// Delete a profile by patientId (or phone).
export async function deletePatient(id) {
  const { data } = await axios.delete(
    `${API_BASE}/api/patients/${encodeURIComponent(id)}`,
  );
  return data;
}
