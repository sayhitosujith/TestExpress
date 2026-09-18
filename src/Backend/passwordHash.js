// One-way password hashing for the online registrations store.
//
// scrypt rather than bcrypt: it is built into Node, so there is no native module to
// compile on Windows and nothing new in package.json, and it is a memory-hard KDF in
// the same class. Swapping to bcryptjs later would only mean changing these two
// functions -- the stored string carries its own scheme tag so old values stay
// readable.
const { scrypt, randomBytes, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');

const scryptAsync = promisify(scrypt);

// Node's defaults (N=16384, r=8, p=1) at a 64-byte output. Recorded in the stored
// string so raising the cost later does not invalidate existing hashes.
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;
const SALT_BYTES = 16;

/**
 * Hashes a plaintext password.
 *
 * @returns {Promise<string>} "scrypt$N$r$p$saltHex$keyHex", or null for an
 *   empty/absent password so callers can store nothing rather than a hash of "".
 */
async function hashPassword(plain) {
  const text = String(plain ?? '');
  if (!text) return null;
  const salt = randomBytes(SALT_BYTES);
  const key = await scryptAsync(text, salt, KEYLEN, { N, r: R, p: P });
  return [
    'scrypt',
    N,
    R,
    P,
    salt.toString('hex'),
    Buffer.from(key).toString('hex'),
  ].join('$');
}

/**
 * Checks a plaintext password against a stored hash.
 *
 * Nothing calls this yet -- sign-in is OTP by phone -- but it belongs next to the
 * hasher: storing a hash with no supported way to check it invites a hand-rolled
 * comparison, which is how timing-unsafe equality checks get written. Returns false
 * rather than throwing on a malformed or unknown-scheme value.
 */
async function verifyPassword(plain, stored) {
  const text = String(plain ?? '');
  const parts = String(stored ?? '').split('$');
  if (!text || parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const [, n, r, p, saltHex, keyHex] = parts;
  try {
    const expected = Buffer.from(keyHex, 'hex');
    const actual = await scryptAsync(text, Buffer.from(saltHex, 'hex'), expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
    return timingSafeEqual(expected, Buffer.from(actual));
  } catch {
    return false;
  }
}

module.exports = { hashPassword, verifyPassword };
