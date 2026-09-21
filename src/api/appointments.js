import axios from "axios";

const API_BASE = process.env.REACT_APP_API_URL || "";

// Upsert the full appointment record into the DB (survives localStorage wipes).
export async function saveAppointment(appointment) {
  const { data } = await axios.post(
    `${API_BASE}/api/appointments`,
    appointment,
  );
  return data;
}

export async function getAppointments(params = {}) {
  const { data } = await axios.get(`${API_BASE}/api/appointments`, { params });
  return data;
}
