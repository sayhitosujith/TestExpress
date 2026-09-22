import axios from "axios";
import { apiMessage } from "./apiError";

const API_BASE = process.env.REACT_APP_API_URL || "";
const BASE = `${API_BASE}/api/jmeter`;

// The load-testing engine's client. Super Admin only on the server (see
// Backend/routes/jmeter.js) — every call here can 403 for anyone else, and
// that is the server's rule to enforce, not this module's to duplicate.

/**
 * Whether this backend can run a load test at all, and the limits a plan
 * must stay inside. The UI asks before offering the engine, the same way it
 * already does for the real-browser and Android engines.
 */
export async function jmeterCapabilities() {
  try {
    const { data } = await axios.get(`${BASE}/capabilities`);
    return data;
  } catch (err) {
    return { available: false, reason: apiMessage(err, "Could not reach the load-testing engine") };
  }
}

/**
 * Starts a load test and returns its initial state immediately — the run
 * itself continues on the server. Poll `getJmeterRun` for progress.
 *
 * @param {{name?: string, targetUrl: string, method?: string, threads: number,
 *   rampUpSeconds: number, loops: number, headers?: object, body?: string}} plan
 */
export async function startJmeterRun(plan) {
  try {
    const { data } = await axios.post(`${BASE}/runs`, plan);
    return data;
  } catch (err) {
    throw new Error(apiMessage(err, "Could not start the load test"));
  }
}

/** The current state of one run: status, log tail, and the summary once done. */
export async function getJmeterRun(id) {
  try {
    const { data } = await axios.get(`${BASE}/runs/${encodeURIComponent(id)}`);
    return data;
  } catch (err) {
    throw new Error(apiMessage(err, "Could not read the run's status"));
  }
}

/** Recent runs, most recent first — for a "past results" list. */
export async function listJmeterRuns() {
  try {
    const { data } = await axios.get(`${BASE}/runs`);
    return data.runs;
  } catch (err) {
    throw new Error(apiMessage(err, "Could not load past runs"));
  }
}

/** Stops a run in progress. Safe to call on one that has already finished. */
export async function cancelJmeterRun(id) {
  try {
    const { data } = await axios.delete(`${BASE}/runs/${encodeURIComponent(id)}`);
    return data;
  } catch (err) {
    throw new Error(apiMessage(err, "Could not stop the run"));
  }
}

/** The full JMeter HTML dashboard for a finished run, to open in a new tab. */
export function jmeterReportUrl(id) {
  return `${BASE}/runs/${encodeURIComponent(id)}/report`;
}
