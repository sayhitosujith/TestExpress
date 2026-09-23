import axios from "axios";
import { apiMessage } from "./apiError";

const API_BASE = process.env.REACT_APP_API_URL || "";
const BASE = `${API_BASE}/api/jmeter`;

// The load-testing engine's client. Requires sign-in on the server (see
// Backend/routes/jmeter.js) — every call here can 401 for a signed-out
// caller, and that is the server's rule to enforce, not this module's to
// duplicate.

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
 * Every target in `targets` runs as its own thread group, all concurrently —
 * ten targets means ten independent endpoints under load at the same time,
 * not ten requests in one flow.
 *
 * `username`/`password`, if given, are sent as HTTP Basic/Digest auth to
 * every target's origin — not a form login or a session cookie.
 *
 * `dataSetId`, if given (from `uploadJmeterDataSet`), is what makes
 * `{{colName}}` in a target URL, header, username, password or body mean
 * anything — each iteration pulls the next row's value for it.
 *
 * @param {{name?: string, targets: {targetUrl: string, method?: string}[],
 *   threads: number, rampUpSeconds: number, loops: number, headers?: object,
 *   body?: string, username?: string, password?: string, dataSetId?: string}} plan
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

/**
 * Uploads a CSV to back `{{colName}}` placeholders — one row per iteration,
 * the header row naming the columns. Validated and parsed on the server
 * before this resolves, so a malformed file is reported here rather than as
 * an opaque failure minutes into a run.
 *
 * @param {File} file
 * @returns {Promise<{id: string, columns: string[], rowCount: number}>}
 */
export async function uploadJmeterDataSet(file) {
  try {
    const form = new FormData();
    form.append("file", file);
    const { data } = await axios.post(`${BASE}/data-sets`, form);
    return data;
  } catch (err) {
    throw new Error(apiMessage(err, "Could not read that CSV"));
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

// CRA's dev-server proxy (package.json's "proxy" field) only forwards
// XHR/fetch requests to the backend, not full-page navigations — that
// exclusion is deliberate, so React Router can handle page loads instead of
// every unmatched path being proxied. A relative URL opened as a real
// navigation (this function feeds an <a href target="_blank">, not axios)
// therefore never reaches the backend in dev: it hits the CRA dev server,
// which serves the SPA shell for the unrecognised path, and the router's
// catch-all then lands on /my-app. REACT_APP_API_URL already sidesteps this
// in production, where it is set to the real backend origin; this fills the
// same gap for a dev server started without it, matching the port CRA's own
// proxy config already names.
const REPORT_ORIGIN =
  process.env.REACT_APP_API_URL ||
  (process.env.NODE_ENV === "development" ? "http://localhost:5000" : "");

/**
 * The full JMeter HTML dashboard for a finished run, to open in a new tab.
 *
 * The trailing slash matters: the dashboard's own CSS/JS/image references are
 * relative, and the browser resolves them against this exact URL. Without it
 * they resolve one level too high and 404 — the backend redirects to add it
 * if this is ever hit without one, but this saves that extra round trip.
 */
export function jmeterReportUrl(id) {
  return `${REPORT_ORIGIN}/api/jmeter/runs/${encodeURIComponent(id)}/report/`;
}
