// The payment step between registering and signing in.
//
// Two ways it settles, decided by whether Razorpay keys are present:
//
//   * **Razorpay** (RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET set) — a real
//     order, paid in Razorpay's own hosted modal, which is where UPI, the QR
//     code and cards live. The card details never reach this app. `/verify`
//     is what settles it, and only a signature made with the key secret can.
//
//   * **Simulated** (no keys) — `/pay` settles it with no money involved and
//     no card details asked for. Kept so the flow works on an install with no
//     Razorpay account rather than becoming unreachable, and the page says
//     plainly which one the visitor is looking at.
//
// Everything around both — the amount, the plan, whether the account may sign
// in — is the same either way.
//
// Public on purpose, and guarded by the token rather than by a session: the
// account it belongs to cannot sign in yet, which is the whole reason the step
// exists. The token is 32 random bytes handed only to the browser that
// registered, and the two things it can do are settle its own checkout and read
// its own status.
const express = require('express');
const checkouts = require('../checkoutsDb');
const planChanges = require('../planChangesDb');
const { catalogue } = require('../plansDb');
const { findByEmail } = require('../accounts');
// The registrations store itself: accounts.js exports the reads, and this is
// the one write here — switching sign-in on for the account that just paid.
const { store } = require('../registrationsDb');
const razorpay = require('../razorpay');

const router = express.Router();

/** What the browser may see about a checkout. Never the account's own record. */
const publicCheckout = (c) => ({
  token: c.token,
  email: c.email,
  plan: c.plan,
  amount: c.amount,
  currency: c.currency,
  interval: c.interval,
  status: c.status,
  createdAt: c.createdAt,
  paidAt: c.paidAt,
});

/**
 * Settles a checkout and lets the account it belongs to sign in.
 *
 * Shared by the verified-Razorpay path and the simulated one so that "what
 * being paid means" is written once: whichever way the money did or did not
 * move, the consequences for the account are identical.
 *
 * @param {string} token the checkout's token.
 * @param {object} [payment] what Razorpay said, when it was Razorpay.
 * @returns {Promise<{checkout: object, signInEnabled: boolean}>}
 */
async function settlePaid(token, payment) {
  const settled = await checkouts.settle(token, 'paid', payment);

  // Sign-in was switched off when the account was created, so nobody can use
  // an unpaid account. This is the only thing that switches it back on, and it
  // can only ever act on the account named in the checkout.
  const account = await findByEmail(settled.email);
  if (account) {
    await store.upsert({ ...account, payment: settled.plan, signInDisabled: false });
    await planChanges.record({
      accountKey: account.id || settled.email,
      accountEmail: settled.email,
      fromPlan: account.payment || '',
      toPlan: settled.plan,
      changedBy: payment ? 'razorpay' : 'checkout',
    });
  }
  return { checkout: publicCheckout(settled), signInEnabled: Boolean(account) };
}

// POST /api/checkout  { email, plan }
//
// The amount comes from the catalogue here rather than from the request. A
// browser that could name its own price could name zero, and the record of what
// was charged would be whatever the payer felt like.
router.post('/', async (req, res) => {
  try {
    const { email, plan: planValue } = req.body || {};
    if (!email) {
      res.status(400).json({ error: 'an email is required' });
      return;
    }
    const { plans } = await catalogue();
    const plan = plans.find((p) => p.value === planValue);
    if (!plan) {
      res.status(400).json({ error: 'no such plan' });
      return;
    }
    // A free plan has nothing to settle. Refused rather than quietly opened, so
    // a caller that sends one gets told, instead of the browser sitting on a
    // payment page for ₹0.
    if (!plan.price) {
      res.status(400).json({ error: `${plan.value} is free — there is nothing to pay` });
      return;
    }
    // An order already open for this account and plan is reused rather than
    // replaced. Landing on the payment step twice — a retry, a second tab, a
    // re-registration — used to mint a fresh gateway order each time, and the
    // key that mints them is rate-limited: enough of them and the next genuine
    // payment is refused with "Too many requests", which reads to the payer as
    // their card being declined.
    const existing = razorpay.isConfigured()
      ? await checkouts.findPending({ email, plan: plan.value, amount: plan.price })
      : null;
    if (existing) {
      res.json({
        checkout: publicCheckout(existing),
        gateway: { ...razorpay.publicConfig(), orderId: existing.orderId, reused: true },
      });
      return;
    }

    const checkout = await checkouts.open({ email, plan });

    // The order is created here, server-side, so the amount the gateway
    // charges is the amount the catalogue says — a browser that could name it
    // could name one rupee.
    let gateway = razorpay.publicConfig();
    if (razorpay.isConfigured()) {
      try {
        const order = await razorpay.createOrder({
          amount: plan.price,
          currency: checkout.currency,
          receipt: checkout.token.slice(0, 40),
          notes: { plan: plan.value, email: checkout.email },
        });
        await checkouts.attachOrder(checkout.token, order.id);
        gateway = { ...gateway, orderId: order.id, amount: order.amount, currency: order.currency };
      } catch (err) {
        // A gateway that will not open an order must not lose the checkout:
        // the row exists, the page falls back to saying so, and nobody is left
        // with an account they cannot use and no explanation.
        console.warn('[checkout] Razorpay order not created:', err.message);
        gateway = {
          ...gateway,
          configured: false,
          error: err.message,
          // Told apart from a refusal so the page can say "wait and try again"
          // rather than "something is wrong with this payment".
          rateLimited: Boolean(err.rateLimited),
        };
      }
    }

    res.json({ checkout: publicCheckout(checkout), gateway });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/checkout/:token — so a refresh on the payment page still knows what
// is being paid for, and so a settled one cannot be re-presented as pending.
router.get('/:token', async (req, res) => {
  try {
    const checkout = await checkouts.find(req.params.token);
    if (!checkout) {
      res.status(404).json({ error: 'No such checkout' });
      return;
    }
    // A pending checkout with no gateway order cannot be paid at all: the page
    // has nothing to open the modal with, and the simulated route is refused
    // whenever Razorpay is configured — so it would sit there offering a Pay
    // button that can only fail. That state is reachable for an ordinary
    // reason: the gateway was unreachable, throttled, or misconfigured when the
    // checkout was opened. Creating the order now is what makes it payable
    // instead of stranding the account that is waiting on it.
    let orderId = checkout.orderId || null;
    if (!orderId && checkout.status === 'pending' && razorpay.isConfigured()) {
      try {
        const { plans } = await catalogue();
        const plan = plans.find((p) => p.value === checkout.plan);
        const order = await razorpay.createOrder({
          // The catalogue's price, not the checkout's: if the price moved while
          // this was pending, the payer is charged today's figure, which is the
          // one the page is about to show them.
          amount: plan ? plan.price : checkout.amount,
          currency: checkout.currency,
          receipt: checkout.token.slice(0, 40),
          notes: { plan: checkout.plan, email: checkout.email },
        });
        await checkouts.attachOrder(checkout.token, order.id);
        orderId = order.id;
      } catch (err) {
        console.warn('[checkout] could not open an order for a pending checkout:', err.message);
      }
    }

    res.json({
      checkout: publicCheckout(checkout),
      // The same shape POST answers with, so a page that was reloaded can open
      // the modal without having to remember anything from before.
      gateway: { ...razorpay.publicConfig(), orderId },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/checkout/:token/verify
//   { razorpay_order_id, razorpay_payment_id, razorpay_signature }
//
// What Razorpay's modal hands back, checked before it is believed. The
// signature is an HMAC of "order|payment" under the key secret, which only this
// server holds — so a browser cannot manufacture one, and the success callback
// alone settles nothing.
router.post('/:token/verify', async (req, res) => {
  try {
    const body = req.body || {};
    const orderId = body.razorpay_order_id;
    const paymentId = body.razorpay_payment_id;

    if (!razorpay.verify({ orderId, paymentId, signature: body.razorpay_signature })) {
      res.status(400).json({ error: 'This payment could not be verified' });
      return;
    }

    // The signature proves the payment settled *an* order; this proves it
    // settled *this* checkout's order. Without it, one genuine payment could
    // be replayed against every pending checkout on the system.
    const checkout = await checkouts.find(req.params.token);
    if (!checkout) {
      res.status(404).json({ error: 'No such checkout' });
      return;
    }
    if (checkout.orderId && checkout.orderId !== orderId) {
      res.status(400).json({ error: 'That payment belongs to a different checkout' });
      return;
    }

    res.json(await settlePaid(req.params.token, { orderId, paymentId, gateway: 'razorpay' }));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /api/checkout/:token/pay — the simulated settlement.
//
// Refused outright once Razorpay is configured: leaving a route that settles a
// checkout without paying, on an install that takes real money, is a way to get
// a paid plan for nothing.
router.post('/:token/pay', async (req, res) => {
  try {
    if (razorpay.isConfigured()) {
      res.status(409).json({
        error: 'This install takes real payments — settle the checkout through Razorpay.',
      });
      return;
    }
    res.json(await settlePaid(req.params.token, null));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /api/checkout/:token/cancel — the account stays as it is: created, on
// the plan it chose, and unable to sign in until it is paid for.
router.post('/:token/cancel', async (req, res) => {
  try {
    res.json({ checkout: publicCheckout(await checkouts.settle(req.params.token, 'cancelled')) });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
