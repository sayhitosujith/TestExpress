// API tokens: a credential a CI job can carry instead of a browser session.
//
// **Only a hash is stored.** The token is shown once, at creation, and cannot be
// recovered afterwards — the same rule the account passwords follow, and for the
// same reason: a credential a server can read back is a credential a breach
// hands over. "Lost it" is answered by revoking and issuing another, which is a
// worse experience than showing it again and a far better one than the
// alternative.
//
// SHA-256 rather than bcrypt, deliberately, and the difference from a password
// is what justifies it: this is 32 bytes of machine-generated randomness, not a
// human's guessable phrase, so there is nothing for a slow hash to defend
// against. A fast hash also matters here — it is checked on every API call.
const crypto = require('crypto');
const { createCollectionStore } = require('./collectionStore');

const PREFIX = 'tx_';

const store = createCollectionStore({
  table: 'api_tokens',
  keyColumn: 'token_id',
  keyOf: (t) => String(t && t.id ? t.id : '').trim(),
  keyHint: 'must have an id',
  indexes: ['owner_email', 'token_hash'],
  columns: [
    { name: 'owner_email', from: (t) => t.ownerEmail },
    { name: 'token_hash', from: (t) => t.hash },
    { name: 'name', from: (t) => t.name },
  ],
});

const hashOf = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

/**
 * Issues a token.
 *
 * The plaintext is in the return value and nowhere else — it is never written,
 * so this is the only moment it exists outside the caller's hands.
 *
 * @param {{ownerEmail: string, name: string}} spec
 * @returns {Promise<{record: object, token: string}>}
 */
async function issue({ ownerEmail, name }) {
  const token = PREFIX + crypto.randomBytes(32).toString('hex');
  const record = {
    id: crypto.randomUUID(),
    ownerEmail: String(ownerEmail || '').trim().toLowerCase(),
    name: String(name || '').trim().slice(0, 60) || 'Untitled token',
    hash: hashOf(token),
    // The last few characters, so a list can say which token a row is without
    // holding anything that could be used as one.
    tail: token.slice(-4),
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
    revokedAt: null,
  };
  if (!record.ownerEmail) throw new Error('an owner is required');
  await store.upsert(record);
  return { record: publicToken(record), token };
}

/** A token as it may be shown: everything except the hash. */
const publicToken = (t) => ({
  id: t.id,
  name: t.name,
  tail: t.tail,
  createdAt: t.createdAt,
  lastUsedAt: t.lastUsedAt,
  revokedAt: t.revokedAt,
});

/** This owner's tokens, newest first. Revoked ones stay, as a record. */
async function list(ownerEmail) {
  if (!store.isConfigured()) return [];
  const owner = String(ownerEmail || '').trim().toLowerCase();
  const rows = await store.list({ limit: 2000 });
  return rows
    .filter((t) => t.ownerEmail === owner)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    .map(publicToken);
}

/**
 * Revokes a token.
 *
 * Marked rather than deleted: "this token was revoked on the 3rd" is the useful
 * answer when somebody is working out how a job stopped working, and a deleted
 * row answers nothing at all.
 */
async function revoke({ ownerEmail, id }) {
  const rows = await store.list({ limit: 2000 });
  const found = rows.find(
    (t) => t.id === id && t.ownerEmail === String(ownerEmail || '').trim().toLowerCase(),
  );
  if (!found) throw Object.assign(new Error('No such token'), { status: 404 });
  const revoked = { ...found, revokedAt: new Date().toISOString() };
  await store.upsert(revoked);
  return publicToken(revoked);
}

/**
 * The account a token belongs to, or null.
 *
 * A revoked token resolves to nothing — that is what revoking is — and a used
 * one has its lastUsedAt stamped, which is how a token nobody can account for is
 * spotted.
 *
 * @param {string} token the plaintext from the Authorization header.
 * @returns {Promise<{ownerEmail: string, id: string}|null>}
 */
async function resolve(token) {
  if (!store.isConfigured() || !String(token || '').startsWith(PREFIX)) return null;
  const hash = hashOf(token);
  const rows = await store.list({ limit: 2000 });
  const found = rows.find((t) => t.hash === hash && !t.revokedAt);
  if (!found) return null;
  // Fire and forget: a stamp that failed to write must not fail the request it
  // was recording.
  store.upsert({ ...found, lastUsedAt: new Date().toISOString() }).catch(() => {});
  return { ownerEmail: found.ownerEmail, id: found.id };
}

module.exports = { issue, list, revoke, resolve, PREFIX, store };
