// Removes plaintext passwords left in this browser by earlier builds.
//
// Sign-in used to compare `registeredUsers[].password` as a plain string, so
// every browser that ever registered or synced a user still has those passwords
// sitting in localStorage where devtools can read them. Hashing the database
// does nothing about that copy — it has to be deleted from the browsers too, and
// a user is not going to do it by hand.
//
// Safe to run on every boot: it only ever deletes a field nothing reads any
// more. Verification is server-side now (src/api/auth.js), and the record keeps
// its `passwordHash`, which is what dbSync pushes.
//
// This is a migration with a natural end. Once every browser in use has booted
// once on a build containing it, it is dead code and can go.

const KEY = "registeredUsers";

/**
 * Strips `password` from every stored user, leaving everything else untouched.
 *
 * @returns {number} how many records were cleaned — 0 on every boot after the
 *   first, which is what tells you it is finished.
 */
export function scrubStoredPasswords() {
  let raw;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    // Storage can be unavailable outright (private mode, blocked site data).
    // Nothing to scrub and nothing to report.
    return 0;
  }
  if (!raw) return 0;

  try {
    const users = JSON.parse(raw);
    if (!Array.isArray(users)) return 0;

    let cleaned = 0;
    const scrubbed = users.map((user) => {
      if (!user || typeof user !== "object" || user.password === undefined) return user;
      cleaned += 1;
      const { password, ...rest } = user;
      return rest;
    });

    if (!cleaned) return 0;
    localStorage.setItem(KEY, JSON.stringify(scrubbed));
    return cleaned;
  } catch {
    // A corrupt value is left exactly as it is. Rewriting something that could
    // not be parsed risks destroying a record someone could still recover by
    // hand, and a value this code cannot read is not one it should replace.
    return 0;
  }
}
