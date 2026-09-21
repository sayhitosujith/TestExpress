const express = require('express');

// Builds the REST surface for one online collection store. registrations and
// doctors expose the identical five endpoints with identical error handling, so
// the router is generated from the store rather than written out twice.
//
// @param {object} store  A createCollectionStore instance.
// @param {string} label  Collection name used in error text.
function createCollectionRouter(store, label) {
  const router = express.Router();

  // Answers 501 with setup steps when there is no connection string, matching the
  // sheets and testrunner routers -- an install without a database should say what
  // to do rather than look like a server fault.
  function requireConfig(req, res, next) {
    if (store.isConfigured()) return next();
    res.status(501).json({
      error: 'No online database configured',
      setup: [
        'Create a free Postgres database (Neon, Supabase, Render or Railway).',
        'Copy its connection string (starts with postgres:// or postgresql://).',
        'Set DATABASE_URL to it in src/Backend/.env.',
        `Restart the backend; the ${label} table is created automatically.`,
      ],
    });
  }

  router.get('/status', (req, res) => {
    res.json({ configured: store.isConfigured() });
  });

  router.get('/', requireConfig, async (req, res) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 1000, 5000);
      res.json(await store.list({ limit }));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // One record, or an array to backfill in bulk.
  router.post('/', requireConfig, async (req, res) => {
    try {
      if (Array.isArray(req.body)) {
        const saved = await store.upsertMany(req.body);
        return res.json({ saved: saved.length, keys: saved });
      }
      const key = await store.upsert(req.body);
      res.json({ saved: 1, key });
    } catch (err) {
      // A missing key field is the caller's mistake, not a server fault.
      const clientError = /required|must have/.test(err.message);
      res.status(clientError ? 400 : 500).json({ error: err.message });
    }
  });

  // Reconciling write: make the collection match the body exactly, deleting rows
  // the body does not contain. Only the UI's own delete and clear actions should
  // call this -- the background push loop must never infer a deletion from a
  // record simply being absent from one browser.
  //
  // Emptying the whole collection needs ?allowEmpty=true. Without that guard a
  // browser with nothing in localStorage could wipe the table in one request,
  // which is the single worst thing this endpoint could do by accident.
  router.put('/', requireConfig, async (req, res) => {
    try {
      const rows = Array.isArray(req.body) ? req.body : null;
      if (!rows) {
        return res.status(400).json({ error: `an array of ${label} records is required` });
      }
      if (!rows.length && req.query.allowEmpty !== 'true') {
        return res.status(400).json({
          error: `Refusing to empty ${label}: pass ?allowEmpty=true to confirm`,
        });
      }
      res.json(await store.replaceAll(rows));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Deletes exactly the keys named in the body. This is what the sync uses to
  // propagate a deletion: it can only remove records the client knew about, so a
  // row imported directly into the database is never collateral. Prefer this over
  // the reconciling PUT above, which remains for an explicit administrative flush.
  router.post('/delete', requireConfig, async (req, res) => {
    try {
      const keys = Array.isArray(req.body?.keys) ? req.body.keys : null;
      if (!keys) {
        return res.status(400).json({ error: 'body must be { keys: [...] }' });
      }
      res.json(await store.removeMany(keys));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // The key is whatever the store's keyOf returns -- the same value a successful
  // POST reports back.
  router.delete('/:key', requireConfig, async (req, res) => {
    try {
      res.json({ deleted: await store.remove(req.params.key) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { createCollectionRouter };
