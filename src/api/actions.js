import axios from "axios";

const API_BASE = process.env.REACT_APP_API_URL || "";

// Records an action in the backend DB. Fire-and-forget friendly — callers
// typically .catch() so a logging failure never blocks the UI.
export async function logAction(action, meta = {}) {
  const { appointmentId, patientName, phone } = meta;
  const { data } = await axios.post(`${API_BASE}/api/actions`, {
    action,
    appointmentId,
    patientName,
    phone,
    // Everything (including the explicit fields) is kept in the payload too.
    payload: meta,
  });
  return data;
}

export async function getActions(params = {}) {
  const { data } = await axios.get(`${API_BASE}/api/actions`, { params });
  return data;
}
