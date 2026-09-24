// The temporary password an admin-created account is emailed instead of the
// admin having to invent one and relay it out of band.
//
// It IS the account's real password -- hashed and stored through the same
// path as any other, so sign-in needs no separate mechanism -- with one added
// rule: it stops working after its window closes, until an admin sets it (or
// a new one) again. See routes/auth.js (issued at registration, checked at
// login) and routes/admin.js (cleared when an admin sets a password by hand).
const crypto = require('crypto');

const ACCESS_KEY_TTL_MS = 72 * 60 * 60 * 1000; // 72 hours

/** A random, URL-safe, human-typeable temporary password. */
function generateAccessKey() {
  return crypto.randomBytes(9).toString('base64url');
}

/** An ISO timestamp `ACCESS_KEY_TTL_MS` from now. */
function accessKeyExpiry() {
  return new Date(Date.now() + ACCESS_KEY_TTL_MS).toISOString();
}

/** Whether an `accessKeyExpiresAt` value is in the past. Absent is not expired -- it means no key was ever issued. */
function isAccessKeyExpired(expiresAt) {
  return Boolean(expiresAt) && new Date(expiresAt).getTime() < Date.now();
}

module.exports = {
  ACCESS_KEY_TTL_MS,
  generateAccessKey,
  accessKeyExpiry,
  isAccessKeyExpired,
};
