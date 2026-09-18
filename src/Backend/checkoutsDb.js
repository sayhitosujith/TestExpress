// A checkout: one account, one plan, one amount, and what became of it.
//
// It exists so the payment step can be resumed and audited rather than being a
// state the browser holds. A refresh on the payment page must not lose which
// plan was being paid for, and "did this account ever pay" has to be answerable
// afterwards from something other than the account's own plan field — which
// says what they are on, not what they were charged.
//
// The token is the whole security model of the public endpoints, so it is long
// and random: possessing it is what proves this browser is the one that just
// registered. It is never derived from the email, because an email is guessable
// and a token derived from one would be too.
const crypto = require('crypto');
const { createCollectionStore } = require('./collectionStore');

const store = createCollectionStore({
  table: 'checkouts',
  keyColumn: 'token',
  keyOf: (c) => String(c?.token ?? '').trim(),
  keyHint: 'must have a token',
  indexes: ['email', 'status'],
  columns: [
    { name: 'email', from: (c) => c.email },
    // Razorpay's order id, when there is one. Mirrored into a column because
    // "which checkout was this payment for" is the question asked when a
    // customer disputes one, and it should not need a JSON operator.
    { name: 'order_id', from: (c) => c.orderId },
    { name: 'payment_id', from: (c) => c.paymentId },
    { name: 'plan', from: (c) => c.plan },
    { name: 'amount', from: (c) => c.amount },
    { name: 'currency', from: (c) => c.currency },
    { name: 'status', from: (c) => c.status },
  ],
});

/** 32 bytes of randomness, hex. Guessing one is not a practical attack. */
const newToken = () => crypto.randomBytes(32).toString('hex');

/**
 * Opens a checkout for an account and a plan.
 *
 * The amount is passed in by the route from the plan catalogue, never taken
 * from the browser: a price the client can name is a price the client can set
 * to zero.
 *
 * @param {{email: string, plan: object}} spec the account, and the plan record
 *   as the catalogue has it.
 * @returns {Promise<object>} the checkout, including its token.
 */
async function open({ email, plan }) {
  const checkout = {
    token: newToken(),
    email: String(email || '').trim().toLowerCase(),
    plan: plan.value,
    amount: plan.price,
    currency: plan.currency || 'INR',
    interval: plan.interval || null,
    status: 'pending',
    // Filled in by attachOrder once the gateway has an order for it. Null on a
    // simulated install, which is how the two are told apart afterwards.
    orderId: null,
    paymentId: null,
    gateway: null,
    createdAt: new Date().toISOString(),
    paidAt: null,
  };
  await store.upsert(checkout);
  return checkout;
}

/**
 * A checkout already open for this account and plan, if there is one.
 *
 * Reusing it is what stops a new gateway order being minted every time
 * somebody lands on the payment step — from a re-registration, a second tab,
 * or a retry. Orders are cheap but not free: the gateway rate-limits the key
 * that creates them, and a throttled key fails the payment of whoever is
 * unlucky enough to be next.
 *
 * Only a checkout for the *current* price is reused. A gateway order's amount
 * is fixed when it is created, so one opened before a price change would go on
 * charging the old figure — quietly, and to whoever happened to leave a payment
 * page open across it. Those are skipped, which mints a fresh order at the
 * price the catalogue now says.
 *
 * @param {{email: string, plan: string, amount: number}} spec
 * @returns {Promise<object|null>} the pending checkout, newest first.
 */
async function findPending({ email, plan, amount }) {
  if (!store.isConfigured()) return null;
  const wanted = String(email || '').trim().toLowerCase();
  const rows = await store.list({ limit: 2000 });
  return (
    rows
      .filter(
        (r) =>
          r.status === 'pending' &&
          r.email === wanted &&
          r.plan === plan &&
          r.orderId &&
          Number(r.amount) === Number(amount),
      )
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0] || null
  );
}

/** The checkout for a token, or null. */
async function find(token) {
  if (!token) return null;
  const rows = await store.list({ limit: 2000 });
  return rows.find((r) => r.token === token) || null;
}

/**
 * Records the gateway order this checkout is to be paid through.
 *
 * Separate from open() because the order is created after the row exists — the
 * receipt sent to Razorpay is the checkout's own token, so the checkout has to
 * come first.
 *
 * @param {string} token the checkout's token.
 * @param {string} orderId the gateway's order id.
 * @returns {Promise<void>}
 */
async function attachOrder(token, orderId) {
  const checkout = await find(token);
  if (!checkout) return;
  await store.upsert({ ...checkout, orderId, gateway: 'razorpay' });
}

/**
 * Settles a checkout, once.
 *
 * Refuses a second settlement rather than overwriting: a checkout that has
 * already been paid must not be payable again by re-posting, and one that was
 * cancelled must not quietly become paid. That is the difference between a
 * record of what happened and a field somebody can set.
 *
 * @param {string} token the checkout's token.
 * @param {'paid'|'cancelled'} status what it became.
 * @returns {Promise<object>} the settled checkout.
 */
async function settle(token, status, payment) {
  const checkout = await find(token);
  if (!checkout) throw Object.assign(new Error('No such checkout'), { status: 404 });
  if (checkout.status !== 'pending') {
    throw Object.assign(new Error(`This checkout is already ${checkout.status}`), {
      status: 409,
    });
  }
  const settled = {
    ...checkout,
    status,
    // What actually paid it, when something did. Kept because "paid" alone
    // cannot tell a real Razorpay settlement from a simulated one, and six
    // months later that is exactly the distinction somebody needs.
    ...(payment
      ? { paymentId: payment.paymentId || null, orderId: payment.orderId || checkout.orderId, gateway: payment.gateway || 'razorpay' }
      : { gateway: checkout.gateway || 'simulated' }),
    paidAt: status === 'paid' ? new Date().toISOString() : null,
    settledAt: new Date().toISOString(),
  };
  await store.upsert(settled);
  return settled;
}

/** Every checkout, newest first — for an administrator asking who paid what. */
async function list({ limit = 500 } = {}) {
  if (!store.isConfigured()) return [];
  const rows = await store.list({ limit });
  return rows.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

module.exports = { open, find, findPending, attachOrder, settle, list, store };
