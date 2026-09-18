import React, { createContext, useContext, useState, useEffect } from 'react';
// The session token lives beside the session, and dies with it. Kept in its own
// module because the axios interceptors that send it need it too, and they run
// before any component mounts.
import { clearToken, setToken } from '../api/authToken';

const AuthContext = createContext();

/**
 * Attach the account's profile picture to a session that has none.
 *
 * The picture is chosen at registration and lives with the registration
 * record, which is the one place it is edited. Copying it into the session
 * would spend the origin's storage quota twice over on the same data URL, and
 * would leave anyone already signed in with a stale copy — or none at all —
 * until they signed out and back in.
 *
 * Decoration only: a session that cannot be matched is returned untouched.
 */
const withPhoto = (u) => {
  if (!u || u.profilePicture || !u.email) return u;
  try {
    const registered = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
    const match = registered.find(
      (r) => r && r.email && r.email.toLowerCase() === u.email.toLowerCase(),
    );
    return match && match.profilePicture ? { ...u, profilePicture: match.profilePicture } : u;
  } catch (e) {
    return u;
  }
};

/**
 * The session as it is written to storage: everything except the picture.
 *
 * The picture is a base64 data URL and can be megabytes. localStorage is a few
 * megabytes for the whole origin, shared with the recorded tests, the project
 * tree and the data sets — so storing it here does not merely waste room, it
 * throws. Observed exactly that way: an account with a large photo paid for a
 * plan and then could not be signed in, because setItem('user') exceeded the
 * quota and took the sign-in down with it.
 *
 * withPhoto above already puts the picture back on read, from the one place it
 * belongs. This is the write half of the same decision, which was missing.
 *
 * @param {object} user the session as the server sent it.
 * @returns {object} the same, minus the picture.
 */
const persistable = (user) => {
  if (!user || !user.profilePicture) return user;
  const { profilePicture, ...rest } = user;
  return rest;
};

/**
 * Writes the session, and never fails the sign-in for it.
 *
 * A session that could not be written still works for this tab — the user is in
 * memory — and losing it costs a reload, not access. Throwing here cost access:
 * every caller of login() treats a throw as "signing in failed".
 *
 * @param {object} user the session to keep.
 * @returns {boolean} whether it was written.
 */
const persistSession = (user) => {
  try {
    localStorage.setItem('user', JSON.stringify(persistable(user)));
    localStorage.setItem('isLoggedIn', 'true');
    return true;
  } catch (e) {
    console.warn('[auth] the session was not written to storage:', e.message);
    return false;
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('user');
      return raw ? withPhoto(JSON.parse(raw)) : null;
    } catch (e) {
      return null;
    }
  });

  /**
   * Opens a session.
   *
   * @param {object} userObj the signed-in user.
   * @param {string} [token] the session token from /api/auth/login. Optional
   *   only so a caller that has no token to give does not silently wipe one it
   *   never had; a sign-in without a token cannot use any protected endpoint.
   */
  const login = (userObj, token) => {
    if (token) setToken(token);
    setUser(withPhoto(userObj));
    persistSession(userObj);
  };

  const logout = () => {
    // The token first. Whatever else fails, the credential must not outlive the
    // sign-out -- it is the part that can still do things.
    clearToken();
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('loggedInUser');
    localStorage.removeItem('isLoggedIn');
  };

  /**
   * Updates the signed-in user in place, without a new sign-in.
   *
   * For facts about the account that change while the session is open — the
   * plan, after an upgrade is paid for. The alternative is telling somebody who
   * has just paid to sign out and back in before they can use what they bought,
   * which is not an acceptable end to a payment.
   *
   * Deliberately narrow: it merges fields onto the session and leaves the token
   * alone. It is not a way to become somebody else — nothing here re-decides
   * who is signed in, and the server is still the only thing that grants
   * anything. A client that lied to itself about its plan would be caught by
   * the next request it made.
   *
   * @param {object} fields what changed, e.g. { payment: "Pro" }.
   */
  const updateUser = (fields) => {
    setUser((current) => {
      if (!current) return current;
      const next = { ...current, ...fields };
      persistSession(next);
      return withPhoto(next);
    });
  };

  useEffect(() => {
    const handleStorage = () => {
      const raw = localStorage.getItem('user');
      setUser(raw ? withPhoto(JSON.parse(raw)) : null);
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

export default AuthContext;
