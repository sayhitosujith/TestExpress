// What the public landing page is doing, for the Super Admin panel.
//
// A router of its own rather than another endpoint on routes/actions.js, which
// is the audit log's write-and-list API and is open on purpose: the landing
// page is served to anonymous visitors, so they have to be able to POST a row.
// Reading the aggregate back is the opposite question with the opposite answer,
// and putting the two behind one router would mean either exposing traffic
// figures to the public or shutting anonymous visitors out of the log.
//
// Not on routes/admin.js either, for two reasons: that router is about accounts
// and this is not one, and it opens with requireConfig, which refuses every
// call until DATABASE_URL is set. This reads the local SQLite audit log, which
// needs no such configuration.
const express = require('express');
const { homePageSummary, listActions } = require('../actionsDb');
// Where the events are mirrored to. The summary above still comes from the
// local log — that SQL is the one place the aggregation lives, and a second
// implementation reading Postgres would eventually disagree with it.
const homeAnalytics = require('../homeAnalyticsDb');
const { authenticate, requireRole } = require('../requireRole');
const { PRIVILEGED_ROLES } = require('../accounts');

const router = express.Router();

// On the router, not the endpoint, so anything added here later inherits the
// guard instead of relying on someone remembering it.
router.use(authenticate, requireRole(...PRIVILEGED_ROLES));

// GET /api/homepage-analytics?days=30
router.get('/', (req, res) => {
  try {
    res.json(homePageSummary({ days: req.query.days }));
  } catch (err) {
    console.error('homePageSummary failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/homepage-analytics/online — is the mirror configured, and how much
// is in it? Answers rather than refuses when there is no database, because
// "not set up" is the useful answer to that question.
router.get('/online', async (req, res) => {
  try {
    res.json(await homeAnalytics.status());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/homepage-analytics/online — copy the local log across.
//
// Idempotent: the rows are keyed on the local row id, so pressing it twice
// copies nothing twice. That is what makes it safe as a button rather than a
// migration somebody has to be told to run once.
router.post('/online', async (req, res) => {
  try {
    const rows = listActions({ limit: 20000 });
    res.json(await homeAnalytics.backfill(rows));
  } catch (err) {
    // No database configured is a setup answer, not a server fault — the same
    // 501 the other online routes give.
    const unset = /No online database configured/.test(err.message);
    res.status(unset ? 501 : 500).json({ error: err.message });
  }
});

module.exports = router;
