const express = require('express');
const router = express.Router();
const { TABS, isConfigured, readTab, writeTab } = require('../sheetsDb');
const { extractMedia, inlineMedia } = require('../mediaDb');

// Tabs whose records carry base64 payloads that must not reach the sheet.
const MEDIA_TABS = new Set(['recordedTests']);

// Answers 501 with setup instructions when credentials are absent, matching how
// the testrunner router reports a missing Playwright — an unconfigured install
// should say what to do, not look like a server fault.
function requireConfig(req, res, next) {
  if (isConfigured()) return next();
  res.status(501).json({
    error: 'Google Sheets not configured',
    setup: [
      'Enable the Google Sheets API in a Google Cloud project.',
      'Create a service account and download its JSON key.',
      'Share the spreadsheet with the service account email (Editor).',
      'Set GOOGLE_SHEET_ID and GOOGLE_SERVICE_ACCOUNT_KEY_FILE in src/Backend/.env.',
    ],
  });
}

function knownTab(req, res, next) {
  if (TABS[req.params.tab]) return next();
  res.status(404).json({
    error: `Unknown collection "${req.params.tab}"`,
    known: Object.keys(TABS),
  });
}

// GET /api/sheets  — what is syncable, and whether the sheet is reachable
router.get('/', (req, res) => {
  res.json({ configured: isConfigured(), tabs: TABS });
});

// GET /api/sheets/:tab  — read a whole collection
router.get('/:tab', knownTab, requireConfig, async (req, res) => {
  try {
    const rows = await readTab(req.params.tab);
    const out = MEDIA_TABS.has(req.params.tab) ? rows.map(inlineMedia) : rows;
    res.json(out);
  } catch (err) {
    console.error(`readTab(${req.params.tab}) failed:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

// PUT /api/sheets/:tab  — replace a whole collection
router.put('/:tab', knownTab, requireConfig, async (req, res) => {
  try {
    const body = Array.isArray(req.body) ? req.body : [];
    const rows = MEDIA_TABS.has(req.params.tab) ? body.map(extractMedia) : body;
    const count = await writeTab(req.params.tab, rows);
    res.json({ tab: req.params.tab, count });
  } catch (err) {
    console.error(`writeTab(${req.params.tab}) failed:`, err.message);
    res.status(502).json({ error: err.message });
  }
});

module.exports = router;
