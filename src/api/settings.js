import axios from "axios";
import { apiMessage } from "./apiError";

const API_BASE = process.env.REACT_APP_API_URL || "";
const BRANDING = `${API_BASE}/api/settings/branding`;

// The installation's branding, held in the `settings` table rather than in one
// person's browser. See src/appBranding.js for how the two fit together:
// localStorage stays the copy the first paint reads, this is the one everybody
// shares.

/**
 * The branding the server holds, or null when it has none to give.
 *
 * Null rather than an error for the two ordinary "no shared branding" cases — a
 * backend with no DATABASE_URL answers 501, and a backend that is not running
 * answers nothing at all. Both mean the same thing to the caller: carry on with
 * this browser's copy. A real fault still throws, because a database that is
 * configured and failing is worth knowing about.
 *
 * @returns {Promise<{logo: string|null, name: string|null, tagline: string|null}|null>}
 */
export async function getBranding() {
  try {
    const { data } = await axios.get(BRANDING);
    return data;
  } catch (err) {
    if (!err.response || err.response.status === 501) return null;
    throw new Error(apiMessage(err, "Could not load the app branding"));
  }
}

/**
 * Stores a change for everyone. Needs a Super Admin session.
 *
 * A patch: send only the fields that changed, so saving a name cannot clear a
 * logo it never mentioned. An empty string or null clears a field back to the
 * app's built-in value.
 *
 * @param {{logo?: string|null, name?: string, tagline?: string}} patch
 * @returns {Promise<{logo: string|null, name: string|null, tagline: string|null}>}
 *   the stored branding, trimmed and capped as the server accepted it.
 */
export async function putBranding(patch) {
  try {
    const { data } = await axios.put(BRANDING, patch);
    return data;
  } catch (err) {
    throw new Error(apiMessage(err, "Could not save the app branding"));
  }
}
