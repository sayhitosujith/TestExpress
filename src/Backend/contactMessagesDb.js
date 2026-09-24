// Submissions from the public Contact Us page.
//
// Append-only, same shape as plan_changes: nobody edits a message once it
// arrives, so there is nothing to key on but a freshly generated id. Built on
// createCollectionStore for the same reason every other online store is —
// one schema round-trip and one upsert query, not a copy of both per table.
const crypto = require('crypto');
const pool = require('./db');
const { createCollectionStore } = require('./collectionStore');

const store = createCollectionStore({
  table: 'contact_messages',
  keyColumn: 'message_key',
  keyOf: (m) => String(m?.id ?? '').trim(),
  keyHint: 'must have an id',
  indexes: ['email'],
  columns: [
    { name: 'name', from: (m) => m.name },
    { name: 'email', from: (m) => m.email },
    { name: 'subject', from: (m) => m.subject },
  ],
});

/**
 * Records one contact-form submission.
 *
 * @param {{name: string, email: string, subject?: string, message: string}} fields
 * @returns {Promise<string>} the id it was stored under.
 * @throws {Error} `notConfigured: true` when there is no online database;
 *   otherwise when a required field is missing.
 */
async function submit({ name, email, subject, message }) {
  if (!store.isConfigured()) {
    const err = new Error(
      'No online database configured. Set DATABASE_URL in src/Backend/.env.',
    );
    err.notConfigured = true;
    throw err;
  }
  if (!String(name || '').trim() || !String(email || '').trim() || !String(message || '').trim()) {
    throw new Error('name, email and message are required');
  }

  const record = {
    id: crypto.randomUUID(),
    name: String(name).trim(),
    email: String(email).trim(),
    subject: String(subject || '').trim(),
    message: String(message).trim(),
    submittedAt: new Date().toISOString(),
  };
  await store.upsert(record);
  return record.id;
}

/**
 * The messages, newest first.
 *
 * Sorted here rather than trusted from the store, same reasoning as
 * planChangesDb.history: `list` orders by updated_at (the write time), which
 * for an append-only table only coincides with submission order when nothing
 * is ever backfilled.
 *
 * @param {{limit?: number}} [opts]
 * @returns {Promise<object[]>}
 */
async function list({ limit = 500 } = {}) {
  if (!store.isConfigured()) return [];
  const rows = await store.list({ limit: Math.min(Number(limit) || 500, 2000) });
  return rows.sort((a, b) => String(b.submittedAt || '').localeCompare(String(a.submittedAt || '')));
}

/**
 * One submission by id, or null when there is no database or no match.
 *
 * A raw query rather than filtering `list()`: the reply route needs exactly
 * one row out of a table that only grows, and reading all of them to find it
 * is the query this bypasses.
 *
 * @param {string} id
 * @returns {Promise<object|null>}
 */
async function get(id) {
  const key = String(id || '').trim();
  if (!key || !store.isConfigured()) return null;
  await store.init();
  const { rows } = await pool.query(
    'SELECT data FROM contact_messages WHERE message_key = $1',
    [key],
  );
  return rows[0] ? rows[0].data : null;
}

/**
 * Appends an admin's reply to a submission's history and stores it.
 *
 * A list rather than a single "replied" field: a submitter can be answered
 * more than once, and each reply is worth keeping rather than overwriting the
 * one before it. The record itself is otherwise untouched -- the reply is
 * appended to the same JSONB `list()` already reads, so the panel shows it
 * without a schema change.
 *
 * @param {string} id
 * @param {{message: string, repliedBy?: string}} fields
 * @returns {Promise<object>} the updated record.
 * @throws {Error} `notFound: true` when `id` matches no submission.
 */
async function addReply(id, { message, repliedBy }) {
  const record = await get(id);
  if (!record) {
    const err = new Error('Message not found');
    err.notFound = true;
    throw err;
  }
  const updated = {
    ...record,
    replies: [
      ...(record.replies || []),
      {
        message: String(message).trim(),
        sentAt: new Date().toISOString(),
        sentBy: repliedBy || null,
      },
    ],
  };
  await store.upsert(updated);
  return updated;
}

/**
 * Permanently deletes the given submissions. The one place this table is
 * ever pruned -- everything else about it is append-only, so this is a
 * deliberate admin action rather than something a route reaches for lightly.
 *
 * @param {string[]} ids
 * @returns {Promise<{deleted: number}>}
 */
async function removeMany(ids) {
  const keys = (Array.isArray(ids) ? ids : [])
    .map((id) => String(id || '').trim())
    .filter(Boolean);
  if (!keys.length || !store.isConfigured()) return { deleted: 0 };
  return store.removeMany(keys);
}

module.exports = {
  submit,
  list,
  get,
  addReply,
  removeMany,
  isConfigured: store.isConfigured,
};
