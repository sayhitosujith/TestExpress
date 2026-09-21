// Verifying a Google sign-in.
//
// The browser is handed a signed ID token by Google and passes it here. That
// token is the whole of the evidence, so this file is the whole of the trust:
// its signature is checked against Google's own public keys, and its claims are
// checked against this app's client id and against the clock. A token that is
// merely *decoded* proves nothing at all — anyone can write a JWT saying they
// are anybody, and base64 is not a signature.
//
// Written against the JWKS endpoint with fetch and node:crypto rather than
// pulling in google-auth-library. Node can build a public key straight from a
// JWK, so the whole verification is one createPublicKey and one verify — and
// this is the file where "what exactly is checked" should be readable rather
// than delegated.
const crypto = require('crypto');

const CERTS = 'https://www.googleapis.com/oauth2/v3/certs';
// The two issuers Google signs ID tokens with. Both are legitimate and which
// one appears depends on the flow, so accepting only one rejects real tokens.
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

const clientId = () => process.env.GOOGLE_CLIENT_ID || '';
const isConfigured = () => Boolean(clientId());

// The keys, cached. Google rotates them, so this is a short cache rather than a
// permanent one — and a token signed with a key we have not seen forces a
// re-fetch below, which is what makes rotation invisible rather than an outage.
let keys = { at: 0, byKid: new Map() };
const CACHE_MS = 60 * 60 * 1000;

async function fetchKeys() {
  const res = await fetch(CERTS);
  if (!res.ok) throw new Error(`Could not read Google's signing keys (${res.status})`);
  const body = await res.json();
  const byKid = new Map();
  (body.keys || []).forEach((jwk) => {
    try {
      byKid.set(jwk.kid, crypto.createPublicKey({ key: jwk, format: 'jwk' }));
    } catch {
      // A key we cannot build is a key we cannot verify with. Skipped rather
      // than fatal: the others are still usable.
    }
  });
  keys = { at: Date.now(), byKid };
  return byKid;
}

async function keyFor(kid) {
  if (Date.now() - keys.at > CACHE_MS || !keys.byKid.size) await fetchKeys();
  if (keys.byKid.has(kid)) return keys.byKid.get(kid);
  // Not in the cache: either a rotation, or a token signed by something that is
  // not Google. One re-fetch tells the two apart.
  const fresh = await fetchKeys();
  return fresh.get(kid) || null;
}

const b64url = (part) => Buffer.from(String(part).replace(/-/g, '+').replace(/_/g, '/'), 'base64');

/**
 * Verifies a Google ID token and returns the profile it asserts.
 *
 * Everything here is a refusal waiting to happen, and each check earns its
 * place:
 *
 *   * the **signature**, or the token is just text somebody typed;
 *   * `aud`, or a token issued for a different application would be accepted
 *     here — the classic confused-deputy in OAuth, and the reason a client id
 *     is not merely configuration;
 *   * `iss`, so only Google's own issuers count;
 *   * `exp`, or a token stays valid for ever once leaked;
 *   * `email_verified`, because Google will assert an address the account has
 *     not proved it owns, and this app matches accounts by address.
 *
 * @param {string} credential the ID token from Google Identity Services.
 * @returns {Promise<{email: string, name: string, givenName: string,
 *   familyName: string, picture: string, sub: string}>}
 */
async function verifyIdToken(credential) {
  if (!isConfigured()) throw Object.assign(new Error('Google sign-in is not configured'), { status: 501 });

  const parts = String(credential || '').split('.');
  if (parts.length !== 3) throw Object.assign(new Error('That is not a Google token'), { status: 400 });

  let header;
  let claims;
  try {
    header = JSON.parse(b64url(parts[0]).toString('utf8'));
    claims = JSON.parse(b64url(parts[1]).toString('utf8'));
  } catch {
    throw Object.assign(new Error('That token could not be read'), { status: 400 });
  }

  if (header.alg !== 'RS256') {
    // Refusing anything else is not pedantry: "alg": "none" and the HMAC
    // confusion attack are both defeated here and nowhere else.
    throw Object.assign(new Error('Unexpected token algorithm'), { status: 400 });
  }

  const key = await keyFor(header.kid);
  if (!key) throw Object.assign(new Error('That token was not signed by Google'), { status: 401 });

  const signed = Buffer.from(`${parts[0]}.${parts[1]}`, 'utf8');
  if (!crypto.verify('RSA-SHA256', signed, key, b64url(parts[2]))) {
    throw Object.assign(new Error('That token was not signed by Google'), { status: 401 });
  }

  if (claims.aud !== clientId()) {
    throw Object.assign(new Error('That token was issued for a different application'), {
      status: 401,
    });
  }
  if (!ISSUERS.includes(claims.iss)) {
    throw Object.assign(new Error('That token was not issued by Google'), { status: 401 });
  }
  // A minute of leeway, which is a clock difference rather than a policy.
  if (!claims.exp || Number(claims.exp) * 1000 < Date.now() - 60_000) {
    throw Object.assign(new Error('That sign-in has expired — try again'), { status: 401 });
  }
  if (!claims.email) {
    throw Object.assign(new Error('That Google account has no email address'), { status: 400 });
  }
  if (claims.email_verified === false) {
    throw Object.assign(new Error('That Google account has not verified its email address'), {
      status: 401,
    });
  }

  return {
    email: String(claims.email).trim().toLowerCase(),
    name: claims.name || '',
    givenName: claims.given_name || '',
    familyName: claims.family_name || '',
    picture: claims.picture || '',
    sub: claims.sub,
  };
}

module.exports = { isConfigured, clientId, verifyIdToken };
