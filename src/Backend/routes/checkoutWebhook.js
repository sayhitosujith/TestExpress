// Razorpay's server-to-server notification that a payment captured.
//
// The other half of the trust model, and on a live account the more important
// half. The browser's success callback is the happy path; it does not fire if
// the payer closes the tab, loses signal, or their bank's page takes them
// somewhere else after the money has moved. Without this route that payment is
// taken and the account stays locked out — the worst failure this flow has,
// because the customer has paid and cannot use what they paid for.
//
// Mounted in index.js ahead of express.json with a raw body parser: the
// signature is over the exact bytes Razorpay sent, and re-serialising a parsed
// object reorders keys and breaks it.
//
// Public, necessarily — Razorpay is not going to sign in. The signature is what
// authenticates it, and an unsigned or wrongly signed call is refused.
const express = require('express');
const checkouts = require('../checkoutsDb');
const planChanges = require('../planChangesDb');
const razorpay = require('../razorpay');
const { findByEmail } = require('../accounts');
const { store } = require('../registrationsDb');

const router = express.Router();

/**
 * Settles a checkout and lets its account sign in.
 *
 * The same consequences as the browser-verified path in routes/checkout.js,
 * reached from the other direction. Deliberately tolerant of arriving second:
 * settle() refuses a checkout that is already paid, and that refusal is the
 * normal case here rather than an error — it means the browser got there first.
 */
async function settle(checkout, payment) {
  const settled = await checkouts.settle(checkout.token, 'paid', payment);
  const account = await findByEmail(settled.email);
  if (account) {
    await store.upsert({ ...account, payment: settled.plan, signInDisabled: false });
    await planChanges.record({
      accountKey: account.id || settled.email,
      accountEmail: settled.email,
      fromPlan: account.payment || '',
      toPlan: settled.plan,
      changedBy: 'razorpay-webhook',
    });
  }
  return settled;
}

// POST /api/checkout/webhook
router.post('/', async (req, res) => {
  // Answered before any work: Razorpay retries anything that is not a 2xx, and
  // a slow handler turns one payment into a queue of duplicate deliveries.
  const signature = req.get('X-Razorpay-Signature');
  if (!razorpay.verifyWebhook(req.body, signature)) {
    // 400, not 401: there is nothing to authenticate with, and Razorpay reads
    // any non-2xx as "retry" anyway. Logged because a run of these means either
    // the webhook secret here does not match the dashboard, or somebody is
    // posting to this endpoint hopefully.
    console.warn('[checkout] webhook rejected: signature did not verify');
    res.status(400).json({ error: 'signature did not verify' });
    return;
  }

  let event;
  try {
    event = JSON.parse(req.body.toString('utf8'));
  } catch {
    res.status(400).json({ error: 'body was not JSON' });
    return;
  }

  // Acknowledged immediately. Everything below is a consequence of a payment
  // that has already happened; failing to record it must not make Razorpay
  // redeliver, because the redelivery would hit the same failure.
  res.json({ ok: true });

  try {
    const payment = event?.payload?.payment?.entity;
    if (!payment || !['payment.captured', 'order.paid'].includes(event.event)) return;

    const checkout = (await checkouts.list({ limit: 2000 })).find(
      (c) => c.orderId && c.orderId === payment.order_id,
    );
    if (!checkout) {
      console.warn('[checkout] webhook for an order we have no checkout for:', payment.order_id);
      return;
    }
    if (checkout.status !== 'pending') return; // the browser got there first

    await settle(checkout, {
      orderId: payment.order_id,
      paymentId: payment.id,
      gateway: 'razorpay',
    });
    console.info(
      `[checkout] webhook settled ${checkout.plan} for ${checkout.email} (${payment.id})`,
    );
  } catch (err) {
    // Nothing to tell Razorpay — it has its 200 already. This line is how a
    // payment that could not be applied is found afterwards.
    console.error('[checkout] webhook could not be applied:', err.message);
  }
});

module.exports = router;
