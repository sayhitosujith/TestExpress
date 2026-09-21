// What has been paid, what is still owed, and what was abandoned.
//
// Its own router rather than a second endpoint on routes/checkout.js, and the
// reason is the guard: that one is deliberately public, because the account a
// checkout belongs to cannot sign in yet and identifies itself with a token.
// Reading everybody's payments is the opposite question with the opposite
// answer, and putting the two behind one router would mean either exposing the
// ledger or shutting payers out of their own checkout.
const express = require('express');
const checkouts = require('../checkoutsDb');
const razorpay = require('../razorpay');
const { authenticate, requireRole } = require('../requireRole');
const { PRIVILEGED_ROLES } = require('../accounts');

const router = express.Router();

// On the router, so anything added here later inherits it.
router.use(authenticate, requireRole(...PRIVILEGED_ROLES));

/**
 * The totals worth reading at a glance.
 *
 * Only settled money is counted as collected. A pending checkout is not
 * revenue — it is somebody who got as far as the payment page and stopped — and
 * adding the two together is how a dashboard reports money that was never
 * taken.
 */
const summarise = (rows) => {
  const of = (status) => rows.filter((r) => r.status === status);
  const sum = (list) => list.reduce((n, r) => n + (Number(r.amount) || 0), 0);
  const paid = of('paid');
  return {
    currency: (rows.find((r) => r.currency) || {}).currency || 'INR',
    collected: sum(paid),
    paid: paid.length,
    pendingAmount: sum(of('pending')),
    pending: of('pending').length,
    cancelled: of('cancelled').length,
    // How much of what was collected went through a real gateway. A simulated
    // settlement is a real change to an account and no money at all, so a total
    // that mixed the two would overstate the bank balance.
    simulated: paid.filter((r) => r.gateway !== 'razorpay').length,
  };
};

// GET /api/payments?limit=500
router.get('/', async (req, res) => {
  try {
    const rows = await checkouts.list({ limit: Math.min(Number(req.query.limit) || 500, 2000) });
    res.json({
      payments: rows,
      summary: summarise(rows),
      // Which gateway produced them, so the panel can say whether "paid" means
      // money moved.
      gateway: razorpay.publicConfig(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
