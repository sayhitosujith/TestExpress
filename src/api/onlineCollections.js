import axios from "axios";

const API_BASE = process.env.REACT_APP_API_URL || "";

/**
 * Deletes exactly the named keys from one online collection.
 *
 * One shared function rather than a copy in each api/<collection>.js: the path is
 * the only thing that differs, and five identical bodies would be five places to
 * fix. `slug` is the collection's URL segment, e.g. "patients".
 *
 * Safe by construction — the server removes only the keys listed, so a record this
 * browser never knew about (one imported straight into the database) cannot be
 * caught up in a deletion.
 */
export async function bulkDelete(slug, keys) {
  if (!Array.isArray(keys) || !keys.length) return { deleted: 0 };
  const { data } = await axios.post(`${API_BASE}/api/online/${slug}/delete`, {
    keys,
  });
  return data;
}

/**
 * The status/push/pull trio dbSync needs for one online collection.
 *
 * The four older collections each hand-wrote these because each also exposes
 * extra operations its screens call directly (savePatientOnline for a single
 * profile, replacePatientsOnline for the UI's own clear). A collection that
 * needs nothing beyond the sync contract gets it from here instead — the test
 * runner adds four at once, and four more copies of the same three one-line
 * bodies is exactly the drift this module already exists to prevent.
 *
 * @param {string} slug the collection's URL segment under /api/online,
 *   e.g. "testrunner/tests". Nested segments are fine; it is a path, not a name.
 * @returns {{status: Function, push: Function, pull: Function}}
 */
export function createCollectionApi(slug) {
  const url = `${API_BASE}/api/online/${slug}`;
  return {
    /** Whether the backend has an online database to write to. */
    async status() {
      const { data } = await axios.get(`${url}/status`);
      return data;
    },
    /**
     * Upserts the whole list. Returns the server's own report, including the
     * key it stored each record under — dbSync reads those back rather than
     * reimplementing the key rules, so the two sides cannot disagree about
     * what a record is called.
     */
    async push(rows) {
      const { data } = await axios.post(url, rows);
      return data;
    },
    async pull(params = {}) {
      const { data } = await axios.get(url, { params });
      return Array.isArray(data) ? data : [];
    },
  };
}
