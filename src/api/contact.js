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

/**
 * Sends an admin's reply to one Contact Us submission and emails it to the
 * person who wrote in. Super Admin only.
 *
 * @param {string} id the submission's id.
 * @param {string} message the reply text.
 * @returns {Promise<object>} the submission, with the new reply appended to
 *   its `replies` history.
 * @throws {Error} with the backend's own message — a 501 when no mail
 *   provider is configured, a 502 when sending failed, or the field-level 400.
 */
export async function replyToContactMessage(id, message) {
  try {
    const { data } = await axios.post(`${API_BASE}/api/contact/${id}/reply`, { message });
    return data.message;
  } catch (err) {
    throw new Error(apiMessage(err, "Could not send the reply"));
  }
}

/**
 * Sends the same admin reply to several Contact Us submissions at once.
 * Super Admin only. A partial failure is not an exception — every id is
 * attempted, and each result says for itself whether that recipient's email
 * actually went out.
 *
 * @param {string[]} ids submission ids to reply to.
 * @param {string} message the reply text, sent unchanged to each recipient.
 * @returns {Promise<{id: string, sent: boolean, message?: object, error?: string}[]>}
 * @throws {Error} with the backend's own message when the request itself
 *   fails (e.g. no mail provider configured, or a 400 on `ids`/`message`).
 */
export async function bulkReplyToContactMessages(ids, message) {
  try {
    const { data } = await axios.post(`${API_BASE}/api/contact/bulk-reply`, { ids, message });
    return data.results;
  } catch (err) {
    throw new Error(apiMessage(err, "Could not send the bulk reply"));
  }
}

/**
 * Permanently deletes several Contact Us submissions. Super Admin only, and
 * there is no undo — the caller is expected to have confirmed with the admin
 * before this is called.
 *
 * @param {string[]} ids
 * @returns {Promise<number>} how many were actually deleted.
 */
export async function bulkDeleteContactMessages(ids) {
  try {
    const { data } = await axios.post(`${API_BASE}/api/contact/bulk-delete`, { ids });
    return data.deleted;
  } catch (err) {
    throw new Error(apiMessage(err, "Could not delete the selected messages"));
  }
}
