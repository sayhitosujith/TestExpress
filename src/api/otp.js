import axios from "axios";

// Empty base => relative URLs (e.g. "/api/otp/send"), served by the current
// origin and forwarded to the backend via the CRA dev-server "proxy" in
// package.json. Works on localhost, LAN IP, and an HTTPS tunnel alike.
const API_BASE = process.env.REACT_APP_API_URL || "";

export async function sendOtp(mobile) {
  const { data } = await axios.post(`${API_BASE}/api/otp/send`, { mobile });
  return data;
}

export async function verifyOtp(mobile, code) {
  const { data } = await axios.post(`${API_BASE}/api/otp/verify`, {
    mobile,
    code,
  });
  return data;
}

// Sends an appointment SMS. event: "scheduled" | "rescheduled" | "cancelled".
export async function sendAppointmentSms({ mobile, date, time, name, event }) {
  const { data } = await axios.post(`${API_BASE}/api/notify/appointment`, {
    mobile,
    date,
    time,
    name,
    event: event || "scheduled",
  });
  return data;
}
