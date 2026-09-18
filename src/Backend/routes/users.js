const express = require('express');
const router = express.Router();
const pool = require('../db');

// Get all users
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new user
router.post('/', async (req, res) => {
  const { firstName, lastName, email, phoneNumber, password, zipCode } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO users (firstName, lastName, email, phoneNumber, password, zipCode) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [firstName, lastName, email, phoneNumber, password, zipCode]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// TODO: Add PUT and DELETE routes as needed

module.exports = router;
