import axios from "axios";
import { apiMessage } from "./apiError";

const API_BASE = process.env.REACT_APP_API_URL || "";

/**
 * Submits the Contact Us form.
 *
 * @param {{name: string, email: string, subject?: string, message: string}} fields
 * @returns {Promise<void>}
 * @throws {Error} with the backend's own message — a 501 setup guide when no
 *   database is configured, or the field-level 400 from the route.
 */
export async function sendContactMessage({ name, email, subject, message }) {
  try {
    await axios.post(`${API_BASE}/api/contact`, { name, email, subject, message });
  } catch (err) {
    throw new Error(apiMessage(err, "Could not send your message"));
  }
}

/**
 * Every Contact Us submission, newest first. Super Admin only — the session
 * token interceptor installed in index.js sends the bearer token this needs.
 *
 * @param {{limit?: number}} [opts]
 * @returns {Promise<object[]>}
 */
export async function getContactMessages({ limit } = {}) {
  try {
    const { data } = await axios.get(`${API_BASE}/api/contact`, { params: { limit } });
    return data.messages;
  } catch (err) {
    throw new Error(apiMessage(err, "Could not load contact messages"));
  }
}
