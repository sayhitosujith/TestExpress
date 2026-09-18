/**
 * Turns an axios failure into something worth showing a person.
 *
 * Every branch here exists because the failure it describes was, at some point,
 * reported to the user as a bare "Registration failed" — a message that names
 * no cause and suggests no fix. Two very different faults produced it: an old
 * backend process with no /api/auth mounted (404) and a body over the JSON
 * limit (413). Both answer with Express's HTML error page, which has no `error`
 * field, so both fell through to the fallback and looked identical.
 *
 * The rule: never return a message that does not say what happened. The status
 * code is included whenever nothing better is known, because "Registration
 * failed (500)" at least tells you which half of the system to look at.
 *
 * Shared by every client in src/api rather than living inside one of them: an
 * unreachable backend and a stale backend look the same from any endpoint, and
 * a second copy of this reasoning would be a second copy to keep current.
 *
 * @param {Error} err an axios error.
 * @param {string} fallback what failed, in the caller's own words.
 * @returns {string} a message naming the cause.
 */
export function apiMessage(err, fallback) {
  const res = err.response;
  const data = res?.data;

  // The backend's own message, which is always the best one available.
  if (data?.error) {
    return data.setup?.length ? `${data.error}. ${data.setup.join(" ")}` : data.error;
  }

  // Nothing answered at all.
  if (!res) {
    return "Cannot reach the server — accounts live there, so the backend has to be running.";
  }

  // Answered, but not by a route that knows about this endpoint. Almost always
  // a backend started before the route existed: the code is on disk, the
  // process is not running it.
  if (res.status === 404) {
    return (
      "The server does not have that route — it is running an older build. " +
      "Restart the backend (npm run server) and try again."
    );
  }

  // The profile picture is a base64 data URL and rides along with the record,
  // so this is reachable with a large photo rather than being theoretical.
  if (res.status === 413) {
    return "That record is too large for the server to accept — a smaller profile picture will fix it.";
  }

  return `${fallback} (HTTP ${res.status})`;
}
