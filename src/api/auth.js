import axios from "axios";
// Failure messages are shared with the other src/api clients — an unreachable
// or stale backend looks the same from every endpoint.
import { apiMessage } from "./apiError";

const API_BASE = process.env.REACT_APP_API_URL || "";

// Sign-in and registration, verified by the backend.
//
// The browser never holds a password beyond the moment it is typed, and never
// holds a hash it could replay: /login takes plaintext and compares it against a
// bcrypt hash only the server can read. This replaces the comparison App.js used
// to do against localStorage, which put every password in devtools and could be
// sidestepped by editing the same key it read from.

/**
 * Signs a user in.
 *
 * @param {string} email
 * @param {string} password as typed.
 * @returns {Promise<{user: object, token: string, expiresAt: string}>} the
 *   user, with no password or hash on it, and the session token every protected
 *   endpoint requires. The token is what makes the role trustworthy: before it,
 *   a signed-in browser simply asserted who it was and /api/admin believed it.
 * @throws {Error} with the server's own message — "Invalid credentials" for a
 *   bad password or an unknown account (deliberately the same for both), or the
 *   setup text when no database is configured. The error carries
 *   `credentials: true` only for a rejected password, so the caller can decide
 *   where the message belongs: against the password field, or in the banner it
 *   keeps for faults that are not about what was typed. Without that
 *   distinction a login screen shows "cannot reach the server" underneath the
 *   password box, which reads as the password being wrong.
 */
export async function login(email, password) {
  try {
    const { data } = await axios.post(`${API_BASE}/api/auth/login`, { email, password });
    return { user: data.user, token: data.token, expiresAt: data.expiresAt };
  } catch (err) {
    const failure = new Error(apiMessage(err, "Sign-in failed"));
    // 401 is the only status /login answers for a credential it rejected; 403
    // is a disabled account, and everything else is the server or the network.
    failure.credentials = err.response?.status === 401;
    throw failure;
  }
}

/**
 * Registers or updates a user, hashing the password server-side.
 *
 * Returns the record to keep locally: the safe user fields plus the bcrypt hash,
 * and no plaintext. Storing the hash is what lets dbSync keep mirroring
 * registrations without the password travelling with them.
 */
export async function register(user) {
  try {
    const { data } = await axios.post(`${API_BASE}/api/auth/register`, user);
    return { ...data.user, passwordHash: data.passwordHash };
  } catch (err) {
    throw new Error(apiMessage(err, "Registration failed"));
  }
}

/**
 * Whether this install offers Google sign-in, and under which client id.
 *
 * Asked of the backend rather than read from the bundle: the client id belongs
 * with the secret it is paired with, and baking it in at build time would mean
 * rebuilding the app to turn SSO on or off.
 *
 * @returns {Promise<{configured: boolean, clientId: string}>}
 */
export async function googleConfig() {
  try {
    const { data } = await axios.get(`${API_BASE}/api/auth/google`);
    return data;
  } catch (err) {
    // Not knowing is the same as not having it, for a button that would
    // otherwise be drawn and then fail.
    return { configured: false, clientId: "" };
  }
}

/**
 * Exchanges Google's ID token for a session of ours.
 *
 * The token is not inspected here and must not be: it is signed, and the
 * signature can only be checked against Google's public keys, which is done on
 * the server. Anything this browser concluded from reading it would be a
 * conclusion an attacker could arrange.
 *
 * @param {string} credential the ID token from Google Identity Services.
 * @returns {Promise<{user: object, token: string, created: boolean}>} the
 *   session, and whether the account was created by this sign-in.
 */
export async function googleSignIn(credential) {
  try {
    const { data } = await axios.post(`${API_BASE}/api/auth/google`, { credential });
    return data;
  } catch (err) {
    throw new Error(apiMessage(err, "Google sign-in failed"));
  }
}
