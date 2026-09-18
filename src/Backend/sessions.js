// Signed session tokens.
//
// This is the piece the rest of the auth story was missing. /login proved a
// password and then answered with a user object and nothing else, so every
// request after it was anonymous: the browser said who it was and the server
// believed it. That is why routes/admin.js carried a note admitting it trusted
// its caller, and why the role gate on /SuperAdmin hid a screen rather than
// protecting anything. A token the server signed and can check is what turns
// "the client claims to be a Super Admin" into "the server established it".
//
// Deliberately not the jsonwebtoken package. What is needed here is one HMAC
// over one JSON object, and node's crypto does that in twenty lines -- adding a
// dependency to an offline-installable backend for that is a worse trade than
// writing the twenty lines and saying what they do.
//
// What is NOT in the token, on purpose: the role. It is looked up from the
// database on every request instead (see requireRole.js). A role baked into a
// token stays true until the token expires, so demoting someone would leave
// them a working Super Admin for the rest of the day -- which is precisely the
// operation the Super Admin page exists to perform.
const crypto = require('crypto');

/**
 * How long a token is good for.
 *
 * A working day, so signing in once in the morning is enough, and a token
 * lifted from a browser is not good forever. There is no refresh flow: when it
 * expires the API answers 401 and the app returns to the login screen.
 */
const TTL_SECONDS = 12 * 60 * 60;

const CONFIGURED_SECRET = String(process.env.AUTH_SECRET || '').trim();

/**
 * Whether the signing key was invented at boot rather than configured.
 *
 * A missing AUTH_SECRET does not disable sign-in -- refusing to authenticate
 * anyone because an environment variable is absent turns a deployment slip into
 * a total outage. It falls back to a random key instead, which is secure but
 * per-process: tokens do not survive a restart, and two instances behind a load
 * balancer will each reject the other's. index.js says so at startup.
 */
const ephemeralSecret = !CONFIGURED_SECRET;

const SECRET = CONFIGURED_SECRET || crypto.randomBytes(32).toString('hex');

const b64 = (buf) => Buffer.from(buf).toString('base64url');

/** The signature over an encoded payload. */
const signaturePart = (encodedPayload) =>
  crypto.createHmac('sha256', SECRET).update(encodedPayload).digest('base64url');

/**
 * A token identifying one account.
 *
 * @param {{key: string, email: string}} account which account the token speaks
 *   for. `key` is the registration key, which is the identity the database
 *   indexes on; the email rides along only so a log line can name someone.
 * @returns {{token: string, expiresAt: string}} the token and when it dies, the
 *   latter so the browser can stop using it without having to decode anything.
 */
function issue(account) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = {
    k: account.key,
    e: account.email,
    iat: issuedAt,
    exp: issuedAt + TTL_SECONDS,
  };
  const encoded = b64(JSON.stringify(payload));
  return {
    token: `${encoded}.${signaturePart(encoded)}`,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
  };
}

/**
 * The payload of a token this server signed and that has not expired.
 *
 * @param {string} token
 * @returns {{k: string, e: string, iat: number, exp: number}|null} null for
 *   anything at all wrong with it -- malformed, re-signed, edited, or stale.
 *   One answer for every failure because the caller's response is the same 401
 *   either way, and distinguishing them tells whoever is probing which part of
 *   their forgery to fix.
 */
function verify(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  if (!encoded || !signature) return null;

  const expected = Buffer.from(signaturePart(encoded));
  const given = Buffer.from(signature);
  // Length-checked first: timingSafeEqual throws on a mismatch rather than
  // returning false, and a thrown error here would be a 500 instead of a 401.
  if (given.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(given, expected)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch (err) {
    return null;
  }
  if (!payload || typeof payload !== 'object') return null;
  if (typeof payload.k !== 'string' || !payload.k) return null;
  if (typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) return null;
  return payload;
}

/**
 * The bearer token on a request, if there is one.
 *
 * Header only. A token in the query string ends up in access logs and browser
 * history, and a cookie would need CORS credentials and a same-site story that
 * this app -- a dev server on one port talking to an API on another -- does not
 * currently have.
 */
function tokenFrom(req) {
  const header = String((req.headers && req.headers.authorization) || '');
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

module.exports = { issue, verify, tokenFrom, TTL_SECONDS, ephemeralSecret };
