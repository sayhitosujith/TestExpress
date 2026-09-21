import axios from "axios";
import { apiMessage } from "./apiError";

const API_BASE = process.env.REACT_APP_API_URL || "";
const CORPORATE = `${API_BASE}/api/corporate`;

// What the Corporate plan buys: a team, an activity log, and API tokens.
//
// Every one of these is scoped server-side to the calling account — nothing
// here sends an owner, so there is no version of these calls that reads
// somebody else's team. The plan is checked there too: the browser disabling a
// button is a courtesy, and src/Backend/requirePlan.js is the control.
//
// A 402 from any of them means the plan does not include it. That is a
// different remedy from a 401, and apiMessage passes the server's wording
// through, which already names the plan that carries it.

/** Everyone on this account's team, with whether each has registered. */
export async function getTeam() {
  try {
    const { data } = await axios.get(`${CORPORATE}/team`);
    return data.members;
  } catch (err) {
    throw new Error(apiMessage(err, "Could not load the team"));
  }
}

/**
 * Adds an account to the team, or moves it from another.
 *
 * The address need not have registered yet — a seat can be held for somebody
 * who signs up later, which is the ordinary way a team is filled.
 *
 * @param {string} email
 */
export async function addTeamMember(email) {
  try {
    const { data } = await axios.post(`${CORPORATE}/team`, { email });
    return data.member;
  } catch (err) {
    throw new Error(apiMessage(err, "Could not add that member"));
  }
}

export async function removeTeamMember(email) {
  try {
    const { data } = await axios.delete(`${CORPORATE}/team/${encodeURIComponent(email)}`);
    return data.removed;
  } catch (err) {
    throw new Error(apiMessage(err, "Could not remove that member"));
  }
}

/** What this account and its team have been doing, newest first. */
export async function getActivity({ limit } = {}) {
  try {
    const { data } = await axios.get(`${CORPORATE}/activity`, { params: { limit } });
    return data;
  } catch (err) {
    throw new Error(apiMessage(err, "Could not load the activity log"));
  }
}

/** The tokens issued by this account. Never the tokens themselves. */
export async function getTokens() {
  try {
    const { data } = await axios.get(`${CORPORATE}/tokens`);
    return data.tokens;
  } catch (err) {
    throw new Error(apiMessage(err, "Could not load API tokens"));
  }
}

/**
 * Issues a token.
 *
 * The `secret` in the reply is the only time the token exists outside the
 * server's hash of it. A caller that does not show it to the user has lost it,
 * and revoking and re-issuing is the only way back.
 *
 * @param {string} name what the token is for, for the list afterwards.
 * @returns {Promise<{token: object, secret: string}>}
 */
export async function createToken(name) {
  try {
    const { data } = await axios.post(`${CORPORATE}/tokens`, { name });
    return data;
  } catch (err) {
    throw new Error(apiMessage(err, "Could not issue a token"));
  }
}

export async function revokeToken(id) {
  try {
    const { data } = await axios.delete(`${CORPORATE}/tokens/${encodeURIComponent(id)}`);
    return data.token;
  } catch (err) {
    throw new Error(apiMessage(err, "Could not revoke that token"));
  }
}

/**
 * Every recording made by this account or its members.
 *
 * From the online copy dbSync keeps, not from this browser — which is the whole
 * point: a colleague's test has never been in your localStorage.
 *
 * `configured: false` means the install has no online database, so there is no
 * shared copy to read. That is a setup answer, not an empty team.
 *
 * @returns {Promise<{tests: object[], configured: boolean}>}
 */
export async function getLibrary() {
  try {
    const { data } = await axios.get(`${CORPORATE}/library`);
    return data;
  } catch (err) {
    throw new Error(apiMessage(err, "Could not load the team's tests"));
  }
}

/**
 * One of them in full, steps and all, to copy into your own workspace.
 *
 * @param {string} id the recording's id.
 * @returns {Promise<object>} the test.
 */
export async function getLibraryTest(id) {
  try {
    const { data } = await axios.get(`${CORPORATE}/library/${encodeURIComponent(id)}`);
    return data.test;
  } catch (err) {
    throw new Error(apiMessage(err, "Could not read that test"));
  }
}
