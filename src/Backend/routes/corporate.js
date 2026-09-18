// What the Corporate plan buys: a team, an activity log, and API tokens.
//
// One router because they are one plan's worth of features and share the same
// two guards — a session, and a plan that includes the capability. Each mount
// names its own capability rather than the router naming one, so a tier that
// later includes only part of this works without splitting the file.
//
// Every read is scoped to the calling account. That is the whole security model
// here: nothing takes an owner from the request, so there is no version of these
// endpoints that reads somebody else's team, log or tokens.
const express = require('express');
const team = require('../teamDb');
const tokens = require('../apiTokensDb');
const { listActions } = require('../actionsDb');
// The offsite copy of what the recorder produces. dbSync pushes every browser's
// tests here, which is what makes a shared library possible at all — without it
// a recording exists only in the browser that made it.
const { tests: testStore } = require('../testRunnerOnlineDb');
const { authenticate } = require('../requireRole');
const { requirePlan } = require('../requirePlan');
const { findByEmail } = require('../accounts');

const router = express.Router();

router.use(authenticate);

const emailOf = (req) => String(req.account.email || '').trim().toLowerCase();

// ---- team seats ----------------------------------------------------------

// GET /api/corporate/team
router.get('/team', requirePlan('team'), async (req, res) => {
  try {
    const rows = await team.members(emailOf(req));
    // The member's own record, so the panel can show a name and whether the
    // account can actually sign in — a seat that cannot is worth seeing.
    const detailed = await Promise.all(
      rows.map(async (m) => {
        const account = await findByEmail(m.memberEmail);
        return {
          ...m,
          name: account ? [account.firstName, account.lastName].filter(Boolean).join(' ').trim() : '',
          plan: account ? account.payment : null,
          canSignIn: account ? !account.signInDisabled : false,
          // An email with no account behind it is an invitation to somebody who
          // has not registered yet, which is a normal state and worth saying.
          registered: Boolean(account),
        };
      }),
    );
    res.json({ members: detailed });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /api/corporate/team  { email }
router.post('/team', requirePlan('team'), async (req, res) => {
  try {
    const member = await team.add({
      ownerEmail: emailOf(req),
      memberEmail: (req.body || {}).email,
      invitedBy: emailOf(req),
    });
    res.json({ member });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

// DELETE /api/corporate/team/:email
router.delete('/team/:email', requirePlan('team'), async (req, res) => {
  try {
    res.json({ removed: await team.remove({ ownerEmail: emailOf(req), memberEmail: req.params.email }) });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

// ---- activity log --------------------------------------------------------

// GET /api/corporate/activity?limit=200
//
// The audit log already exists (actionsDb); what this adds is a view of it
// scoped to one account and its team. Filtered here rather than in SQL because
// the log's own columns do not know about teams — and the alternative, teaching
// the audit table about membership, would couple two things that change for
// different reasons.
router.get('/activity', requirePlan('audit'), async (req, res) => {
  try {
    const owner = emailOf(req);
    const mine = new Set([owner, ...(await team.members(owner)).map((m) => m.memberEmail)]);
    const rows = listActions({ limit: 2000 })
      .filter((r) => {
        const who = r.payload && (r.payload.email || r.payload.actor);
        return who && mine.has(String(who).toLowerCase());
      })
      .slice(0, Math.min(Number(req.query.limit) || 200, 1000));
    res.json({ activity: rows, scope: [...mine] });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ---- the shared library --------------------------------------------------

// GET /api/corporate/library
//
// Every recording made by this account or its members, from the online copy.
//
// Read-only, and deliberately: a test belongs to the browser that records it —
// that is where it is edited and replayed — so this lists what colleagues have
// rather than pretending to be a second place to change it. Taking a copy is
// what the recorder offers, and a copy is a new test with its own id.
router.get('/library', requirePlan('team'), async (req, res) => {
  try {
    const owner = emailOf(req);
    const mine = new Set([owner, ...(await team.members(owner)).map((m) => m.memberEmail)]);
    if (!testStore.isConfigured()) {
      // Not an error: an install with no online database has no shared copy to
      // read, and saying so is more use than an empty list that looks like
      // nobody has recorded anything.
      res.json({ tests: [], configured: false });
      return;
    }
    const rows = await testStore.list({ limit: 2000 });
    const shared = rows
      .filter((t) => {
        const by = t && t.owner && t.owner.email;
        return by && mine.has(String(by).toLowerCase());
      })
      // The steps are the bulk of a recording and nothing here renders them.
      // Sending them would turn a team list into megabytes for no reader.
      .map((t) => ({
        id: t.id,
        name: t.name,
        suiteId: t.suiteId || null,
        engine: t.engine || 'web',
        steps: Array.isArray(t.steps) ? t.steps.length : 0,
        tags: t.tags || [],
        owner: t.owner || null,
      }));
    res.json({ tests: shared, configured: true, scope: [...mine] });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// GET /api/corporate/library/:id — one recording in full, to copy into your own.
router.get('/library/:id', requirePlan('team'), async (req, res) => {
  try {
    const owner = emailOf(req);
    const mine = new Set([owner, ...(await team.members(owner)).map((m) => m.memberEmail)]);
    const rows = await testStore.list({ limit: 2000 });
    const found = rows.find((t) => t.id === req.params.id);
    const by = found && found.owner && found.owner.email;
    // Scoped, not merely found: without this, any id would be readable by
    // anyone on any team.
    if (!found || !by || !mine.has(String(by).toLowerCase())) {
      res.status(404).json({ error: 'No such test on your team' });
      return;
    }
    res.json({ test: found });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ---- API tokens ----------------------------------------------------------

// GET /api/corporate/tokens
router.get('/tokens', requirePlan('apitokens'), async (req, res) => {
  try {
    res.json({ tokens: await tokens.list(emailOf(req)) });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /api/corporate/tokens  { name }
//
// The only response that ever carries the token itself. Said plainly in the
// body, because a client that does not show it to the user has lost it.
router.post('/tokens', requirePlan('apitokens'), async (req, res) => {
  try {
    const { record, token } = await tokens.issue({
      ownerEmail: emailOf(req),
      name: (req.body || {}).name,
    });
    res.json({
      token: record,
      secret: token,
      note: 'This is the only time the token is shown. Store it now.',
    });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

// DELETE /api/corporate/tokens/:id
router.delete('/tokens/:id', requirePlan('apitokens'), async (req, res) => {
  try {
    res.json({ token: await tokens.revoke({ ownerEmail: emailOf(req), id: req.params.id }) });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

module.exports = router;
