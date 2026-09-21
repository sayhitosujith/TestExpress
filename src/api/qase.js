import axios from "axios";

const API_BASE = process.env.REACT_APP_API_URL || "";

/**
 * Which half of the pipeline the backend can run: generation needs an Anthropic
 * key, pushing needs a Qase token, and they are independent.
 */
export async function getQaseStatus() {
  const { data } = await axios.get(`${API_BASE}/api/qase`);
  return data;
}

/**
 * Generates reviewable test cases from a user story. Writes nothing anywhere —
 * the result lives in the page until it is pushed or exported.
 */
export async function generateCases(payload) {
  const { data } = await axios.post(`${API_BASE}/api/qase/generate`, payload);
  return data;
}

export async function getQaseProjects() {
  const { data } = await axios.get(`${API_BASE}/api/qase/projects`);
  return Array.isArray(data) ? data : [];
}

export async function getQaseSuites(code) {
  const { data } = await axios.get(`${API_BASE}/api/qase/suites/${encodeURIComponent(code)}`);
  return Array.isArray(data) ? data : [];
}

/**
 * Creates the reviewed cases in Qase. Pass newSuiteTitle to have the suite
 * created first, or suiteId to file them into an existing one.
 */
export async function pushCases(payload) {
  const { data } = await axios.post(`${API_BASE}/api/qase/push`, payload);
  return data;
}

/** The message worth showing a user, from whichever layer failed. */
export function qaseError(err) {
  const body = err?.response?.data;
  if (body?.setup) return `${body.error}. ${body.setup.join(" ")}`;
  return body?.error || err?.message || "Request failed. Is the backend running?";
}
