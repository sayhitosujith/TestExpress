// Password hashing, in one place.
//
// Every path that stores or checks a password goes through here — the auth
// routes, the registrations store's sanitizer, and the one-off migration — so
// the cost factor and the "what does a hash look like" rule are decided once
// rather than in three places that could disagree.
//
// bcryptjs rather than bcrypt: the native module needs a toolchain to build and
// this project is developed on Windows, where that is the difference between
// `npm install` working and not. The pure-JS implementation is slower, which at
// one login per person per session is not a cost worth caring about.
const bcrypt = require('bcryptjs');

// Cost 12. Roughly a quarter-second per hash on ordinary hardware — slow enough
// that an offline attack on a leaked table is expensive, fast enough that a
// login does not feel stalled. Raise it, never lower it: existing hashes carry
// their own cost and keep verifying regardless.
const COST = 12;

// What bcrypt output looks like, so a plaintext value can never be mistaken for
// an already-hashed one. Checked rather than assumed because the migration and
// the sanitizer both have to answer "has this been done already?" and getting it
// wrong means either double-hashing (locking the account out) or storing
// plaintext believing it was hashed.
const BCRYPT_RE = /^\$2[aby]?\$\d{2}\$[./A-Za-z0-9]{53}$/;

/** Whether `value` is already a bcrypt hash rather than a plaintext password. */
function isHashed(value) {
  return typeof value === 'string' && BCRYPT_RE.test(value);
}

/**
 * Hashes a plaintext password.
 *
 * Passing an already-hashed value back in returns it unchanged, which is what
 * makes the sanitizer and the migration safe to run repeatedly — re-hashing a
 * hash would lock the account out with no way to tell what went wrong.
 *
 * @param {string} plain
 * @returns {Promise<string>} a bcrypt hash.
 */
async function hashPassword(plain) {
  if (isHashed(plain)) return plain;
  const value = String(plain ?? '');
  if (!value) throw new Error('a password is required');
  return bcrypt.hash(value, COST);
}

/**
 * Checks a plaintext password against a stored hash.
 *
 * Returns false rather than throwing on a missing or malformed hash: a record
 * that predates hashing must fail to log in, not crash the login route.
 *
 * @param {string} plain the password as typed.
 * @param {string} hash the stored bcrypt hash.
 * @returns {Promise<boolean>}
 */
async function verifyPassword(plain, hash) {
  if (!plain || !isHashed(hash)) return false;
  return bcrypt.compare(String(plain), hash);
}

module.exports = { hashPassword, verifyPassword, isHashed, COST };
