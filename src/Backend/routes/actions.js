const express = require('express');
const router = express.Router();
const { logAction, listActions } = require('../actionsDb');
// The landing page's events are copied to the online database as they land.
// Not awaited below: an anonymous visitor opening the page must not wait on a
// round trip to Postgres, and must not see an error if it is down — the row is
// already in the local log either way. See ../homeAnalyticsDb.
const homeAnalytics = require('../homeAnalyticsDb');

// POST /api/actions  { action, appointmentId?, patientName?, phone?, payload? }
router.post('/', (req, res) => {
  const { action, appointmentId, patientName, phone, payload } = req.body;
  if (!action) return res.status(400).json({ error: 'action is required' });
  try {
    const id = logAction({ action, appointmentId, patientName, phone, payload });
    homeAnalytics.mirror({
      id,
      action,
      appointmentId,
      created_at: new Date().toISOString(),
      payload: payload || null,
    });
    res.status(201).json({ id });
  } catch (err) {
    console.error('logAction failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/actions?limit=100&action=payment
router.get('/', (req, res) => {
  try {
    res.json(
      listActions({
        limit: Number(req.query.limit) || 100,
        action: req.query.action,
      }),
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
