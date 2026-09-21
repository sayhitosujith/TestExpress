const express = require('express');
const router = express.Router();
const qase = require('../qaseClient');
const generator = require('../storyToCases');

// The two credentials are independent on purpose: generating cases needs only
// Claude, and pushing them needs only Qase. Half a configuration still gets you
// the half that works — generate and export CSV with no Qase token, or push
// hand-edited cases with no Anthropic key.
//
// Answers 501 with setup instructions when a credential is absent, matching how
// the sheets and testrunner routers report a missing dependency — an
// unconfigured install should say what to do, not look like a server fault.

function requireClaude(req, res, next) {
  if (generator.isConfigured()) return next();
  res.status(501).json({
    error: 'Claude API not configured',
    setup: [
      'Create an API key at https://console.anthropic.com/settings/keys.',
      'Set ANTHROPIC_API_KEY in src/Backend/.env.',
      'Restart the backend (npm run server).',
    ],
  });
}

function requireQase(req, res, next) {
  if (qase.isConfigured()) return next();
  res.status(501).json({
    error: 'Qase not configured',
    setup: [
      'In Qase, open your avatar -> API tokens and create a token.',
      'Set QASE_API_TOKEN in src/Backend/.env.',
      'Restart the backend (npm run server).',
    ],
  });
}

// A Qase failure is almost always the caller's — a stale token, a project code
// that does not exist, a suite id from another project. 502 would blame the
// server for it, so pass Qase's own wording through with a 400 and reserve 502
// for the transport actually failing.
const qaseFail = (res, err, what) => {
  console.error(`${what} failed:`, err.message);
  const transport = /fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT/i.test(err.message);
  res.status(transport ? 502 : 400).json({ error: err.message });
};

// GET /api/qase  — which half of the pipeline is usable
router.get('/', (req, res) => {
  res.json({
    claude: { configured: generator.isConfigured(), model: generator.MODEL },
    qase: { configured: qase.isConfigured() },
  });
});

// POST /api/qase/generate  — user story in, reviewable cases out. Nothing is
// written anywhere: the browser holds the result until you push or export it.
router.post('/generate', requireClaude, async (req, res) => {
  const { title, story, acceptanceCriteria, context, count } = req.body || {};
  if (!title || !story) {
    return res.status(400).json({ error: 'title and story are both required' });
  }
  try {
    const result = await generator.generateCases({ title, story, acceptanceCriteria, context, count });
    res.json(result);
  } catch (err) {
    console.error('generateCases failed:', err.message);
    // The SDK's typed errors carry the status that tells these apart: a bad key
    // is not a rate limit is not an outage, and the fix differs for each.
    const status = err.status === 401 || err.status === 403 ? 401 : err.status === 429 ? 429 : 502;
    res.status(status).json({ error: err.message });
  }
});

// GET /api/qase/projects  — for the project dropdown
router.get('/projects', requireQase, async (req, res) => {
  try {
    res.json(await qase.listProjects());
  } catch (err) {
    qaseFail(res, err, 'listProjects');
  }
});

// GET /api/qase/suites/:code  — for the suite dropdown
router.get('/suites/:code', requireQase, async (req, res) => {
  try {
    res.json(await qase.listSuites(req.params.code));
  } catch (err) {
    qaseFail(res, err, `listSuites(${req.params.code})`);
  }
});

// POST /api/qase/push  — create the reviewed cases in Qase.
//
// newSuiteTitle creates the suite first and files the cases into it, so a story
// becomes a named suite in one call. Passing an existing suiteId instead files
// them there; passing neither leaves them at the project root, which is what
// Qase does with a suite-less case.
router.post('/push', requireQase, async (req, res) => {
  const { code, cases, suiteId, newSuiteTitle, suiteDescription } = req.body || {};
  if (!code) return res.status(400).json({ error: 'code (Qase project code) is required' });
  if (!Array.isArray(cases) || cases.length === 0) {
    return res.status(400).json({ error: 'cases must be a non-empty array' });
  }

  try {
    let targetSuite = suiteId || null;
    let createdSuite = null;
    if (!targetSuite && newSuiteTitle) {
      targetSuite = await qase.createSuite(code, newSuiteTitle, suiteDescription);
      createdSuite = { id: targetSuite, title: newSuiteTitle };
    }
    const ids = await qase.bulkCreateCases(code, cases, targetSuite);
    res.json({ ids, count: ids.length, suiteId: targetSuite, createdSuite });
  } catch (err) {
    qaseFail(res, err, `push to ${code}`);
  }
});

module.exports = router;
