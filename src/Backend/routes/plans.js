// The plan catalogue, and the history of accounts moving between plans.
//
// Split from routes/admin.js on purpose. That router is about accounts and
// opens with requireConfig, which refuses every call until DATABASE_URL is set
// — right for accounts, wrong here: reading the catalogue must work on an
// install with no database at all, because the public registration form cannot
// render its plan select without it.
//
// So the read is open and always answers; everything that writes, and the
// history, are behind the same Super Admin guard the rest of administration is.
const express = require('express');
const { catalogue, saveCatalogue } = require('../plansDb');
const planChanges = require('../planChangesDb');
const { authenticate, requireRole } = require('../requireRole');
const { PRIVILEGED_ROLES } = require('../accounts');

const router = express.Router();

// GET /api/plans — open, for the same reason /NewRegistration is a public route.
// `source` says whether this came from the database or from the shipped
// default, so a panel can show which one it is looking at rather than implying
// the database is answering when it is not.
router.get('/', async (req, res) => {
  try {
    res.json(await catalogue());
  } catch (err) {
    // catalogue() is written not to throw; if it ever does, the plans are still
    // the one thing this endpoint must not fail to return.
    console.error('plan catalogue failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Everything below administers the catalogue.
router.use(authenticate, requireRole(...PRIVILEGED_ROLES));

// PUT /api/plans  { plans: [...] } — the whole catalogue, in tier order.
//
// The whole list rather than one plan at a time, because the order is meaning:
// a plan includes every earlier tier's capabilities, so "move Pro above Free"
// is an edit to the catalogue and not to either plan.
router.put('/', async (req, res) => {
  try {
    const plans = Array.isArray(req.body) ? req.body : req.body && req.body.plans;
    res.json(await saveCatalogue(plans));
  } catch (err) {
    // A rejected catalogue is the caller's mistake — an empty list, a duplicate
    // value — so it is a 400, not a server fault.
    res.status(400).json({ error: err.message });
  }
});

// GET /api/plans/changes?limit=200&accountKey=…
router.get('/changes', async (req, res) => {
  try {
    res.json({
      changes: await planChanges.history({
        limit: req.query.limit,
        accountKey: req.query.accountKey,
      }),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
