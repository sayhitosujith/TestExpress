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
