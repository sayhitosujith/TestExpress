const express = require('express');
const router = express.Router();
const { upsertAppointment, listAppointments } = require('../appointmentsDb');

// POST /api/appointments  (upsert full appointment record)
router.post('/', (req, res) => {
  try {
    const id = upsertAppointment(req.body);
    res.status(201).json({ id });
  } catch (err) {
    console.error('upsertAppointment failed:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// GET /api/appointments?limit=500
router.get('/', (req, res) => {
  try {
    res.json(listAppointments({ limit: Number(req.query.limit) || 500 }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
