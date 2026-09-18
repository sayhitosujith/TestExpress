const express = require('express');
const router = express.Router();
const {
  upsertPatient,
  upsertPatients,
  listPatients,
  deletePatient,
} = require('../patientsDb');

// GET /api/patients?limit=1000  → full list of persisted profiles
router.get('/', (req, res) => {
  try {
    res.json(listPatients({ limit: Number(req.query.limit) || 1000 }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/patients
//   body = profile object              → upsert one
//   body = [ ...profiles ]             → bulk upsert
//   body = { profiles: [ ...profiles ] } → bulk upsert
router.post('/', (req, res) => {
  try {
    if (Array.isArray(req.body)) {
      return res.status(201).json({ ids: upsertPatients(req.body) });
    }
    if (Array.isArray(req.body?.profiles)) {
      return res.status(201).json({ ids: upsertPatients(req.body.profiles) });
    }
    const id = upsertPatient(req.body);
    res.status(201).json({ id });
  } catch (err) {
    console.error('upsertPatient failed:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/patients/:id
router.delete('/:id', (req, res) => {
  try {
    deletePatient(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
