// The branding every screen wears: the logo, the app name and the line under it.
//
// This is the only place that knows what a settings key means. settingsDb.js
// stores strings under keys and has no opinion about them; the contract -- which
// keys exist, what a valid value for one is, and who may write it -- is here.
//
// Two different guards, on purpose:
//
//   * GET is open to anyone. The sign-in screen, the loading overlay and the
//     landing page all render the branding, and none of them has a session yet.
//     Gating the read would mean the app wore its built-in name until you signed
//     in and then changed identity underneath you. Nothing here is a secret --
//     it is the wordmark on the page every visitor already sees.
//   * PUT needs a Super Admin. The logo is a data URL that goes straight into an
//     <img src> on every screen, so an open write endpoint for it is a
//     defacement vector, and the app's name is not something a signed-in
//     receptionist should be able to change for everybody.
const express = require('express');
const { getSettings, putSettings, isConfigured } = require('../settingsDb');
const { authenticate, requireRole } = require('../requireRole');
const { PRIVILEGED_ROLES } = require('../accounts');

const router = express.Router();

/** Storage keys, one per field: a name edit must not rewrite the logo's base64. */
const KEYS = { logo: 'app_logo', name: 'app_name', tagline: 'app_tagline' };

// These mirror the constants in src/appBranding.js, which cannot be imported
// here: that file is an ES module in the browser bundle and this is CommonJS in
// the server process. Duplicating three numbers across that boundary is the
// cheaper of the two evils -- the alternative is a shared module in a third
// format that both build systems have to be taught about. They are enforced in
// both places rather than only in the form, because the form is not the only
// way to reach this endpoint.
const LOGO_MAX_BYTES = 512 * 1024;
const NAME_MAX = 40;
const TAGLINE_MAX = 80;

/**
 * Why `value` is not a usable logo, or null when it is.
 *
 * Only base64 data URLs are accepted. That is exactly what FileReader's
 * readAsDataURL produces, which is the one thing that writes this field, and
 * restricting to it means the size below can be measured rather than guessed.
 */
function logoProblem(value) {
  if (value == null || value === '') return null; // a request for the built-in mark
  if (typeof value !== 'string' || !value.startsWith('data:image/')) {
    return 'The logo must be an image data URL.';
  }
  const base64 = value.split(';base64,')[1];
  if (!base64) return 'The logo must be a base64 image data URL.';
  // Four base64 characters carry three bytes; the padding this ignores is at
  // most two bytes, which does not matter against a half-megabyte limit.
  if ((base64.length * 3) / 4 > LOGO_MAX_BYTES) {
    return `The logo must be under ${Math.round(LOGO_MAX_BYTES / 1024)} KB.`;
  }
  return null;
}

/** Trimmed and capped. Truncates rather than refuses, matching the form's maxLength. */
const clean = (value, max) => String(value ?? '').trim().slice(0, max);

/**
 * The stored branding, with an unset field reported as null rather than as the
 * default.
 *
 * The defaults live in the browser -- they are what the app calls itself, and
 * the server has no business having a second opinion about it. Answering null
 * lets the client apply its own, and keeps "nobody has set this" distinguishable
 * from "somebody set it to the same thing as the default".
 */
async function readBranding() {
  const stored = await getSettings(Object.values(KEYS));
  return {
    logo: stored[KEYS.logo] ?? null,
    name: stored[KEYS.name] ?? null,
    tagline: stored[KEYS.tagline] ?? null,
  };
}

// Answers 501 with setup steps when there is no connection string, matching the
// collection routers -- an install without a database should say what to do
// rather than look like a server fault. The client treats it as "no shared
// branding" and keeps using this browser's copy.
function requireConfig(req, res, next) {
  if (isConfigured()) return next();
  res.status(501).json({
    error: 'No online database configured, so branding cannot be shared',
    setup: [
      'Create a free Postgres database (Neon, Supabase, Render or Railway).',
      'Set DATABASE_URL to its connection string in src/Backend/.env.',
      'Restart the backend; the settings table is created automatically.',
    ],
  });
}

router.get('/status', (req, res) => {
  res.json({ configured: isConfigured() });
});

router.get('/branding', requireConfig, async (req, res) => {
  try {
    res.json(await readBranding());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put(
  '/branding',
  // requireConfig first so a server with no DATABASE_URL answers with its setup
  // steps rather than with 401 -- "sign in" is misleading advice when there is
  // nothing to sign in against.
  requireConfig,
  authenticate,
  requireRole(...PRIVILEGED_ROLES),
  async (req, res) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      res.status(400).json({ error: 'A branding patch object is required.' });
      return;
    }

    // A patch, not a replacement: only the fields actually present are touched,
    // so saving a name cannot clear a logo the caller never mentioned.
    const patch = {};
    if ('logo' in body) {
      const problem = logoProblem(body.logo);
      if (problem) {
        res.status(400).json({ error: problem });
        return;
      }
      patch[KEYS.logo] = body.logo || null;
    }
    if ('name' in body) patch[KEYS.name] = clean(body.name, NAME_MAX);
    if ('tagline' in body) patch[KEYS.tagline] = clean(body.tagline, TAGLINE_MAX);

    if (!Object.keys(patch).length) {
      res.status(400).json({ error: 'Nothing to change: send logo, name or tagline.' });
      return;
    }

    try {
      await putSettings(patch);
      // The stored branding rather than an acknowledgement, so the caller adopts
      // the values as trimmed and capped here instead of keeping its own guess
      // at what was saved.
      res.json(await readBranding());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

module.exports = router;
