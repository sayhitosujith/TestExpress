import axios from "axios";
import { apiMessage } from "./apiError";

const API_BASE = process.env.REACT_APP_API_URL || "";
const SUMMARY = `${API_BASE}/api/homepage-analytics`;

// Reading the landing page's traffic back, aggregated.
//
// Separate from api/actions.js, which writes single rows and lists them: this
// endpoint answers a different question, from a different table shape, behind a
// different guard. The counting happens in SQL on the server -- see
// homePageSummary in src/Backend/actionsDb.js -- so what crosses the wire is a
// few dozen numbers rather than every row the landing page has ever written.

/**
 * Visits, calls to action and section reach over a recent window.
 *
 * @param {{days?: number}} [options] the window; the server clamps it to 1–365
 *   and falls back to 30.
 * @returns {Promise<{days: number, visits: number, ctaClicks: number,
 *   visitsWithCta: number, daily: object[], ctas: object[],
 *   sections: object[]}>} the summary.
 */
export async function getHomePageAnalytics({ days } = {}) {
  try {
    const { data } = await axios.get(SUMMARY, { params: { days } });
    return data;
  } catch (err) {
    throw new Error(apiMessage(err, "Could not load HomePage analytics"));
  }
}

/**
 * Whether the landing-page events are mirrored to the online database, and how
 * many are over there.
 *
 * Answers rather than refuses when no database is configured — "not set up" is
 * the useful reply to that question, not an error.
 *
 * @returns {Promise<{configured: boolean, events: number, error?: string}>}
 */
export async function getAnalyticsMirror() {
  try {
    const { data } = await axios.get(`${SUMMARY}/online`);
    return data;
  } catch (err) {
    throw new Error(apiMessage(err, "Could not read the analytics mirror"));
  }
}

/**
 * Copies the local log's landing-page events into the online database.
 *
 * Idempotent — the rows are keyed on the local row id, so running it twice
 * copies nothing twice. That is what makes it safe as a button.
 *
 * @returns {Promise<{mirrored: number, skipped: number}>}
 */
export async function syncAnalyticsMirror() {
  try {
    const { data } = await axios.post(`${SUMMARY}/online`);
    return data;
  } catch (err) {
    throw new Error(apiMessage(err, "Could not copy the events across"));
  }
}
