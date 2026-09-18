// The session token, and the two axios interceptors that use it.
//
// One place rather than a change to each client in src/api. Every module in
// here shares a single axios instance -- the default one -- so attaching the
// token in an interceptor means an endpoint added later is authenticated
// without anyone remembering to do it, and there is one definition of what
// happens when the server says the session is over.
//
// Kept in localStorage, which is the honest trade rather than the ideal one: an
// httpOnly cookie would be out of reach of injected script, but this is a
// create-react-app dev server on one port talking to an API on another, so a
// cookie needs CORS credentials and a same-site story the app does not have. A
// token in localStorage is readable by any script that gets into the page --
// which is the same exposure the session object already had, so this adds no
// new class of problem while closing the one where there was no session at all.

/** Where the token lives. Cleared by logout, and by a 401 from the server. */
export const TOKEN_KEY = "authToken";

/**
 * localStorage, or nothing at all.
 *
 * Private-mode Safari throws on access rather than returning null, and a thrown
 * error while reading a token would take down the request that needed it.
 */
const store = () => {
  try {
    return window.localStorage;
  } catch (e) {
    return null;
  }
};

/** The stored token, or null. */
export function getToken() {
  const s = store();
  if (!s) return null;
  try {
    return s.getItem(TOKEN_KEY) || null;
  } catch (e) {
    return null;
  }
}

/** Stores a token, or clears it when given nothing. */
export function setToken(token) {
  const s = store();
  if (!s) return;
  try {
    if (token) s.setItem(TOKEN_KEY, token);
    else s.removeItem(TOKEN_KEY);
  } catch (e) {
    // A full or blocked store is not worth failing a sign-in over; the session
    // simply will not survive a reload.
  }
}

/** Forgets the token. */
export const clearToken = () => setToken(null);

/**
 * Teaches an axios instance to send the token and to notice when it is refused.
 *
 * @param {import("axios").AxiosInstance} axios the instance to install on.
 * @param {() => void} onUnauthorized called when the server answers 401 —
 *   the session is over, so whatever is holding it should let go. Not called
 *   for 403: that means signed in as the wrong person, and throwing the session
 *   away would turn "you may not do this" into a confusing sign-out.
 * @returns {() => void} removes both interceptors, for tests.
 */
export function installAuthInterceptors(axios, onUnauthorized) {
  const request = axios.interceptors.request.use((config) => {
    const token = getToken();
    if (token) {
      config.headers = { ...config.headers, Authorization: `Bearer ${token}` };
    }
    return config;
  });

  const response = axios.interceptors.response.use(
    (res) => res,
    (err) => {
      if (err.response && err.response.status === 401) {
        clearToken();
        if (typeof onUnauthorized === "function") onUnauthorized();
      }
      // Rethrown either way: the calling screen still has an error to report,
      // and swallowing it here would leave a spinner running forever.
      return Promise.reject(err);
    },
  );

  return () => {
    axios.interceptors.request.eject(request);
    axios.interceptors.response.eject(response);
  };
}
