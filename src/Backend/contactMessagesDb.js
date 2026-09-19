// Submissions from the public Contact Us page.
//
// Append-only, same shape as plan_changes: nobody edits a message once it
// arrives, so there is nothing to key on but a freshly generated id. Built on
// createCollectionStore for the same reason every other online store is —
// one schema round-trip and one upsert query, not a copy of both per table.
const crypto = require('crypto');
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

module.exports = { submit, list, isConfigured: store.isConfigured };
