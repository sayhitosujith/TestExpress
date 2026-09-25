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
const {
  sendContactNotification,
  sendContactAutoReply,
  sendContactReply,
  isConfigured: emailConfigured,
} = require('../emailNotify');
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
    // The visitor's own acknowledgement -- a separate send from the one
    // above, which goes to the admin inbox instead. One failing must not
    // stop the other: an admin who never got notified still deserves the
    // visitor to hear "we got it", and the reverse.
    const autoReply = await sendContactAutoReply({ name, email, subject });
    if (!autoReply.sent) console.error('[contact] auto-reply email not sent:', autoReply.reason);
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

// POST /api/contact/:id/reply  { message }  — Super Admin only.
//
// Sends before it saves: a reply's whole purpose is reaching the person who
// wrote in, so a delivery failure must not be recorded as one anyway -- that
// would show an administrator a reply that was never sent.
router.post('/:id/reply', authenticate, requireRole(...PRIVILEGED_ROLES), async (req, res) => {
  const { message } = req.body || {};

  if (!String(message || '').trim()) {
    return res.status(400).json({ error: 'A reply message is required' });
  }
  if (String(message).length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: `Reply must be under ${MAX_MESSAGE_LENGTH} characters` });
  }
  if (!emailConfigured()) {
    return res.status(501).json({
      error: 'Email is not configured, so a reply cannot be sent',
      setup: [
        'Set RESEND_API_KEY and CONTACT_NOTIFY_EMAIL in src/Backend/.env.',
        'Restart the backend (npm run server).',
      ],
    });
  }

  try {
    const original = await contactMessages.get(req.params.id);
    if (!original) return res.status(404).json({ error: 'Message not found' });

    const { sent, reason } = await sendContactReply({
      to: original.email,
      name: original.name,
      subject: original.subject,
      originalMessage: original.message,
      reply: message,
    });
    if (!sent) {
      return res.status(502).json({ error: `Could not send the reply: ${reason}` });
    }

    const updated = await contactMessages.addReply(req.params.id, {
      message,
      repliedBy: req.account.email,
    });
    res.json({ message: updated });
  } catch (err) {
    if (err.notFound) return res.status(404).json({ error: 'Message not found' });
    console.error('[contact] reply failed:', err.message);
    res.status(500).json({ error: 'Could not send the reply. Please try again.' });
  }
});

// POST /api/contact/bulk-reply  { ids: string[], message }  — Super Admin only.
//
// Same send-before-save contract as the single-message route, applied per id:
// each recipient either gets the reply and a recorded history entry, or gets
// neither -- a partial failure here must never look like an admin answered
// someone who in fact received nothing. Sent one at a time rather than with
// Promise.all so a slow or throttled send cannot fan out into a burst of
// concurrent requests against the email provider's API.
router.post('/bulk-reply', authenticate, requireRole(...PRIVILEGED_ROLES), async (req, res) => {
  const { ids, message } = req.body || {};

  if (!Array.isArray(ids) || !ids.length) {
    return res.status(400).json({ error: 'ids must be a non-empty array' });
  }
  if (!String(message || '').trim()) {
    return res.status(400).json({ error: 'A reply message is required' });
  }
  if (String(message).length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: `Reply must be under ${MAX_MESSAGE_LENGTH} characters` });
  }
  if (!emailConfigured()) {
    return res.status(501).json({
      error: 'Email is not configured, so a reply cannot be sent',
      setup: [
        'Set RESEND_API_KEY and CONTACT_NOTIFY_EMAIL in src/Backend/.env.',
        'Restart the backend (npm run server).',
      ],
    });
  }

  const results = [];
  for (const id of ids) {
    try {
      const original = await contactMessages.get(id);
      if (!original) {
        results.push({ id, sent: false, error: 'Message not found' });
        continue;
      }

      const { sent, reason } = await sendContactReply({
        to: original.email,
        name: original.name,
        subject: original.subject,
        originalMessage: original.message,
        reply: message,
      });
      if (!sent) {
        results.push({ id, sent: false, error: reason });
        continue;
      }

      const updated = await contactMessages.addReply(id, {
        message,
        repliedBy: req.account.email,
      });
      results.push({ id, sent: true, message: updated });
    } catch (err) {
      results.push({ id, sent: false, error: err.message });
    }
  }
  res.json({ results });
});

// POST /api/contact/bulk-delete  { ids: string[] }  — Super Admin only.
//
// A body-bearing POST rather than DELETE, same reasoning as bulk-reply: the
// selection is a list, not one resource in the URL. Permanent and
// unconfirmed by the server -- the confirm dialog lives in the panel, this
// route trusts whatever ids it is given.
router.post('/bulk-delete', authenticate, requireRole(...PRIVILEGED_ROLES), async (req, res) => {
  const { ids } = req.body || {};

  if (!Array.isArray(ids) || !ids.length) {
    return res.status(400).json({ error: 'ids must be a non-empty array' });
  }

  try {
    const { deleted } = await contactMessages.removeMany(ids);
    res.json({ deleted });
  } catch (err) {
    console.error('[contact] bulk delete failed:', err.message);
    res.status(500).json({ error: 'Could not delete the selected messages' });
  }
});

module.exports = router;
