// The public Contact Us form, and the Super Admin's read of what it has
// collected.
//
// POST is unauthenticated by design -- a visitor filling this in has no
// account yet. GET is the opposite question and answers it the opposite way:
// behind the same guard as the other admin-only panels, so a stranger cannot
// reach everyone else's contact details just because the form itself needs
// no password.
const express = require('express');
const router = express.Router();
const contactMessages = require('../contactMessagesDb');
const { sendContactNotification } = require('../emailNotify');
const { authenticate, requireRole } = require('../requireRole');
const { PRIVILEGED_ROLES } = require('../accounts');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Generous enough for a real message, small enough that a script cannot use
// this form to store megabytes of text for free.
const MAX_MESSAGE_LENGTH = 5000;

// POST /api/contact  { name, email, subject?, message }
router.post('/', async (req, res) => {
  const { name, email, subject, message } = req.body || {};

  if (!String(name || '').trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  if (!EMAIL_PATTERN.test(String(email || '').trim())) {
    return res.status(400).json({ error: 'a valid email is required' });
  }
  if (!String(message || '').trim()) {
    return res.status(400).json({ error: 'message is required' });
  }
  if (String(message).length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: `message must be under ${MAX_MESSAGE_LENGTH} characters` });
  }

  try {
    await contactMessages.submit({ name, email, subject, message });
    res.status(201).json({ ok: true });
    const { sent, reason } = await sendContactNotification({ name, email, subject, message });
    if (!sent) console.error('[contact] notification email not sent:', reason);
  } catch (err) {
    if (err.notConfigured) {
      // Same contract as sheets/qase/registrations: an unconfigured install
      // says what to do, rather than looking like the form itself is broken.
      return res.status(501).json({
        error: 'Contact form storage not configured',
        setup: [
          'Provision a Postgres database (Neon, Supabase, Render, Railway, or self-hosted).',
          'Set DATABASE_URL in src/Backend/.env.',
          'Restart the backend (npm run server).',
        ],
      });
    }
    console.error('[contact] submission failed:', err.message);
    res.status(500).json({ error: 'Could not save your message. Please try again.' });
  }
});

// GET /api/contact — every submission, newest first. Super Admin only.
router.get('/', authenticate, requireRole(...PRIVILEGED_ROLES), async (req, res) => {
  try {
    res.json({ messages: await contactMessages.list({ limit: req.query.limit }) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
