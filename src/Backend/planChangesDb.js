// Every move of an account from one plan to another.
//
// The account record carries the plan it is on now and nothing about how it got
// there, which is the one question a subscription list is always asked next:
// when did this change, and who changed it. A column cannot answer that, so the
// changes are their own rows.
//
// Append-only by construction. The key is the account plus the instant, so two
// changes to one account are two rows and re-sending the same change is
// idempotent rather than duplicated. Nothing here ever updates a row: a
// correction is another change, which is what actually happened.
const { createCollectionStore } = require('./collectionStore');

const store = createCollectionStore({
  table: 'plan_changes',
  keyColumn: 'change_key',
  keyOf: (c) => {
    const account = String(c?.accountKey ?? '').trim();
    const at = String(c?.at ?? '').trim();
    return account && at ? `${account}@${at}` : '';
  },
  keyHint: 'must have an accountKey and an at',
  indexes: ['account_key', 'to_plan'],
  columns: [
    { name: 'account_key', from: (c) => c.accountKey },
    { name: 'account_email', from: (c) => c.accountEmail },
    { name: 'from_plan', from: (c) => c.fromPlan },
    { name: 'to_plan', from: (c) => c.toPlan },
    { name: 'changed_by', from: (c) => c.changedBy },
  ],
});

/**
 * Records one plan change.
 *
 * Fire-and-forget on purpose: the change itself is already saved by the time
 * this is called, and losing the history entry — because the online database is
 * unreachable, or was never configured — must not turn a successful save into a
 * failed request. The warning is the record of the loss.
 *
 * @param {object} change
 * @param {string} change.accountKey the registration key that moved.
 * @param {string} [change.accountEmail] who the account belongs to, for reading.
 * @param {string} [change.fromPlan] the plan before, '' when it had none.
 * @param {string} change.toPlan the plan after.
 * @param {string} [change.changedBy] the administrator's email.
 * @returns {Promise<void>} resolves either way; never rejects.
 */
async function record(change) {
  if (!store.isConfigured()) return;
  try {
    await store.upsert({ at: new Date().toISOString(), ...change });
  } catch (err) {
    console.warn('[plan_changes] not recorded:', err.message);
  }
}

/**
 * The history, newest first.
 *
 * Sorted here rather than trusted from the store: `list` orders by updated_at,
 * which for an append-only table is the write time and not necessarily the
 * order the changes happened in — a backfilled row would sort as if it were the
 * most recent event.
 *
 * `limit` bounds the RESULT, applied after the accountKey filter rather than
 * before it. Capping the raw fetch first -- `store.list({ limit })` -- would
 * silently return nothing for `history({ limit: 1, accountKey })` on any
 * table where that account's newest row is not among the table's newest row
 * overall, which is true for every account except whichever one happens to
 * hold the single most-recently-changed row in the entire table.
 *
 * @param {{limit?: number, accountKey?: string}} [opts]
 * @returns {Promise<object[]>}
 */
async function history({ limit = 500, accountKey } = {}) {
  if (!store.isConfigured()) return [];
  // The fetch itself is always capped at 2000 rather than at the caller's
  // (possibly much smaller) `limit` -- see above.
  const rows = await store.list({ limit: 2000 });
  const filtered = rows
    .filter((r) => !accountKey || r.accountKey === accountKey)
    .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  return filtered.slice(0, Math.min(Number(limit) || 500, 2000));
}

module.exports = { record, history, store };
