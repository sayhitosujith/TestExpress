import axios from "axios";
import { apiMessage } from "./apiError";

const API_BASE = process.env.REACT_APP_API_URL || "";
const ACCOUNTS = `${API_BASE}/api/admin/accounts`;

// Account administration, performed by the backend against the stored records.
//
// Deliberately not localStorage. NewRegistration edits the local copy and lets
// dbSync mirror it, which is right for the account you are signed in as and
// useless for anyone else's -- another person's record is only in this browser
// if it happened to be hydrated, and a change made to it here would race their
// own tab. An administrator has to act on the database.
//
// Nothing in this module ever receives a password or a hash: the server answers
// with an allow-listed view plus a `canSignIn` boolean.

/**
 * Every account in the database.
 *
 * @returns {Promise<object[]>} accounts, each with `key`, `role` and `canSignIn`.
 */
export async function listAccounts() {
  try {
    const { data } = await axios.get(ACCOUNTS);
    return data.accounts;
  } catch (err) {
    throw new Error(apiMessage(err, "Could not load accounts"));
  }
}

/**
 * Changes any subset of an account's editable fields.
 *
 * Send only what changed. The server merges onto the stored record, so a field
 * left out keeps its value rather than being blanked — which is what makes it
 * safe for a screen to send a partial edit.
 *
 * @param {string} key the account's registration key.
 * @param {object} changes any of firstName, lastName, email, phoneNumber,
 *   zipCode, payment, role, profilePicture.
 * @returns {Promise<object>} the saved account.
 */
export async function updateAccount(key, changes) {
  try {
    const { data } = await axios.patch(`${ACCOUNTS}/${encodeURIComponent(key)}`, changes);
    return data.account;
  } catch (err) {
    throw new Error(apiMessage(err, "Could not save this account"));
  }
}

/**
 * Changes one account's role.
 *
 * A named wrapper rather than a second endpoint: the role select in the table
 * reads better calling this than passing an object literal, and there is still
 * one write path on the server.
 *
 * @param {string} key the account's registration key.
 * @param {string} role one of the roles the registration screen offers.
 * @returns {Promise<object>} the saved account.
 */
export const setRole = (key, role) => updateAccount(key, { role });

/**
 * Moves an account onto a different plan.
 *
 * A named wrapper for the same reason setRole is one: the Subscriptions panel
 * reads better calling this than passing an object literal, and the write still
 * goes through the one endpoint that validates the value against
 * paymentOptions.json.
 *
 * @param {string} key the account's registration key.
 * @param {string} payment one of the plans in paymentOptions.json.
 * @returns {Promise<object>} the saved account.
 */
export const setPayment = (key, payment) => updateAccount(key, { payment });

/**
 * Switches an account's ability to sign in on or off.
 *
 * The password is untouched either way, so switching back on restores the
 * credential the account already had rather than needing a new one.
 *
 * @param {string} key the account's registration key.
 * @param {boolean} enabled whether sign-in should be allowed.
 * @returns {Promise<object>} the saved account.
 */
export const setSignIn = (key, enabled) => updateAccount(key, { signInDisabled: !enabled });

/**
 * Sets a new password on an account, hashed server-side.
 *
 * @param {string} key the account's registration key.
 * @param {string} password as typed; never stored by the browser.
 * @returns {Promise<object>} the saved account.
 */
export async function resetPassword(key, password) {
  try {
    const { data } = await axios.post(`${ACCOUNTS}/${encodeURIComponent(key)}/password`, { password });
    return data.account;
  } catch (err) {
    throw new Error(apiMessage(err, "Could not set the password"));
  }
}

/**
 * Deletes an account from the database, recoverably for a few minutes.
 *
 * The server keeps the whole record — the password hash with it — in a holding
 * area and reports when that copy expires. Restoring from the table's own row
 * would not work: it carries no hash, so the account would come back unable to
 * sign in.
 *
 * @param {string} key the account's registration key.
 * @returns {Promise<{deleted: string, restorableUntil: string}>} the deadline as
 *   an ISO timestamp. Taken from the server rather than computed here, so the
 *   countdown on the screen cannot disagree with the window being enforced.
 */
export async function deleteAccount(key) {
  try {
    const { data } = await axios.delete(`${ACCOUNTS}/${encodeURIComponent(key)}`);
    return data;
  } catch (err) {
    throw new Error(apiMessage(err, "Could not delete the account"));
  }
}

/**
 * Puts a just-deleted account back, exactly as it was.
 *
 * Fails rather than overwrites if something has taken the key in the meantime,
 * and fails once the window has closed — both of which the caller should show,
 * because "Undo" reporting success while doing nothing is worse than the
 * deletion it was meant to reverse.
 *
 * @param {string} key the account's registration key.
 * @returns {Promise<object>} the restored account, as the table renders it.
 */
export async function restoreAccount(key) {
  try {
    const { data } = await axios.post(`${ACCOUNTS}/${encodeURIComponent(key)}/restore`);
    return data.account;
  } catch (err) {
    throw new Error(apiMessage(err, "Could not restore the account"));
  }
}
