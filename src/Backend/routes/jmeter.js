'use strict';

// Performance-testing engine for TestExpress (see testrunner/jmeter.js for
// why this is a batch-job runner rather than a session, unlike testrunner.js
// and mobile.js).
//
// Super Admin only, unlike the other two engines' routers. Playwright and
// Appium can only ever do what a recorded step already does — click, fill,
// navigate. This is the first engine that originates real, sustained network
// load against a target the caller names, which makes an open version of it a
// DDoS-as-a-service endpoint. Restricting who may start a run is the cheapest
// real control available today; a target allow-list and per-account rate
// limiting are the next ones, and are a product decision rather than a coding
// one — see the comment on `normalisePlan` in testrunner/jmeter.js for the
// baseline guard already in place.

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const { authenticate, requireRole } = require('../requireRole');
const { PRIVILEGED_ROLES } = require('../accounts');
const jmeter = require('../testrunner/jmeter');

const router = express.Router();
router.use(authenticate, requireRole(...PRIVILEGED_ROLES));

// Wall-clock cap on a single run, independent of thread/loop counts: a plan
// that validated fine can still misbehave against a slow or hanging target,
// and the cap is what turns that into a run that ends rather than one that
// generates load indefinitely.
const RUN_TIMEOUT_MS = 5 * 60 * 1000;
// Only this many load tests actually generating traffic at once — the VPS
// this runs on also serves the rest of the API.
const MAX_CONCURRENT_RUNS = 2;
// How long a finished run's files stay on disk before the sweep reclaims
// them. Long enough to read the report after lunch, not so long that a busy
// day of runs fills the disk.
const RUN_RETENTION_MS = 2 * 60 * 60 * 1000;
const REAP_INTERVAL_MS = 10 * 60 * 1000;
const MAX_LOG_LINES = jmeter.LOG_LINES;

const WORK_ROOT = path.join(os.tmpdir(), 'testexpress-jmeter');

/** @type {Map<string, object>} */
const runs = new Map();

function activeCount() {
  let n = 0;
  for (const r of runs.values()) if (r.status === 'running') n += 1;
  return n;
}

function pushLog(run, line) {
  run.log.push(line);
  if (run.log.length > MAX_LOG_LINES * 2) run.log = run.log.slice(-MAX_LOG_LINES);
}

function publicRun(run) {
  return {
    id: run.id,
    name: run.plan.name,
    status: run.status,
    targetUrl: run.targetUrl,
    method: run.plan.method,
    threads: run.plan.threads,
    rampUpSeconds: run.plan.rampUpSeconds,
    loops: run.plan.loops,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    error: run.error,
    log: run.log.slice(-40).join('\n'),
    summary: run.summary,
    hasReport: !!run.summary,
  };
}

/**
 * Runs a plan end to end and updates `run` in place as it goes.
 *
 * Not awaited by the route that starts it: the route answers as soon as the
 * run exists, and the client polls GET /runs/:id the same way the other two
 * engines' clients poll for step results — see the module comment for why
 * this can't be a synchronous request/response like a single recorded step.
 */
async function execute(run, pre) {
  try {
    await fs.promises.mkdir(run.dir, { recursive: true });
    const { code, signal, timedOut } = await jmeter.runToCompletion({
      jmeterHome: pre.jmeterHome,
      javaHome: pre.javaHome,
      dir: run.dir,
      plan: run.plan,
      timeoutMs: RUN_TIMEOUT_MS,
      onLog: (line) => pushLog(run, line),
      onSpawn: (child) => {
        run.child = child;
      },
    });
    run.child = null;

    const jtlPath = path.join(run.dir, 'results.jtl');
    const reportDir = path.join(run.dir, 'report');
    const reported = await jmeter.generateReport({
      jmeterHome: pre.jmeterHome,
      javaHome: pre.javaHome,
      jtlPath,
      reportDir,
      onLog: (line) => pushLog(run, line),
    });

    run.summary = reported ? jmeter.readSummary(reportDir) : null;
    run.reportDir = reported ? reportDir : null;
    run.finishedAt = Date.now();

    if (run.cancelRequested) {
      run.status = 'cancelled';
      run.error = run.summary
        ? 'Cancelled — showing results from the samples collected before then.'
        : 'Cancelled before any sample completed.';
    } else if (timedOut) {
      run.status = run.summary ? 'done' : 'failed';
      run.error = run.summary
        ? `Stopped after ${Math.round(RUN_TIMEOUT_MS / 1000)}s — showing results from the samples collected before then.`
        : `Stopped after ${Math.round(RUN_TIMEOUT_MS / 1000)}s before any sample completed.`;
    } else if (code === 0 && run.summary) {
      run.status = 'done';
    } else {
      run.status = 'failed';
      run.error = signal
        ? `jmeter was killed (${signal}).`
        : `jmeter exited with code ${code}.` + (run.summary ? '' : ' No samples were recorded.');
    }
  } catch (err) {
    run.status = 'failed';
    run.error = err.message;
    run.finishedAt = Date.now();
  }
}

// ---- routes ----------------------------------------------------------

router.get('/capabilities', (req, res) => {
  const pre = jmeter.preflight();
  res.json({
    available: pre.canRun,
    reason: pre.canRun ? undefined : pre.missing.join(' '),
    missing: pre.missing,
    limits: {
      maxThreads: jmeter.MAX_THREADS,
      maxLoops: jmeter.MAX_LOOPS,
      maxRampUpSeconds: jmeter.MAX_RAMP_UP_SECONDS,
      runTimeoutSeconds: RUN_TIMEOUT_MS / 1000,
      maxConcurrentRuns: MAX_CONCURRENT_RUNS,
    },
    activeRuns: activeCount(),
  });
});

router.get('/runs', (req, res) => {
  const list = [...runs.values()]
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, 50)
    .map(publicRun);
  res.json({ runs: list });
});

router.post('/runs', (req, res) => {
  const pre = jmeter.preflight();
  if (!pre.canRun) {
    res.status(501).json({ error: pre.missing.join(' ') });
    return;
  }
  if (activeCount() >= MAX_CONCURRENT_RUNS) {
    res.status(429).json({ error: `Only ${MAX_CONCURRENT_RUNS} load tests may run at once — wait for one to finish.` });
    return;
  }

  let plan;
  try {
    plan = jmeter.normalisePlan(req.body);
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
    return;
  }

  const id = crypto.randomUUID();
  const run = {
    id,
    plan,
    targetUrl: String(req.body?.targetUrl || '').trim(),
    status: 'running',
    startedAt: Date.now(),
    finishedAt: null,
    error: null,
    summary: null,
    reportDir: null,
    log: [],
    dir: path.join(WORK_ROOT, id),
    child: null,
    cancelRequested: false,
  };
  runs.set(id, run);
  execute(run, pre); // not awaited — the client polls GET /runs/:id

  res.json(publicRun(run));
});

router.get('/runs/:id', (req, res) => {
  const run = runs.get(req.params.id);
  if (!run) {
    res.status(404).json({ error: 'No such run.' });
    return;
  }
  res.json(publicRun(run));
});

router.delete('/runs/:id', (req, res) => {
  const run = runs.get(req.params.id);
  if (!run) {
    res.status(404).json({ error: 'No such run.' });
    return;
  }
  if (run.status === 'running' && run.child) {
    run.cancelRequested = true;
    run.child.kill('SIGTERM');
  }
  res.json({ ok: true });
});

// A named RegExp route rather than a `*` wildcard segment: Express 5's
// wildcard syntax (path-to-regexp v6+) requires a named parameter for a
// multi-segment splat, and a RegExp route is one fewer place for that syntax
// to disagree with the Express version actually installed.
router.get(/^\/runs\/([^/]+)\/report(\/.*)?$/, (req, res) => {
  const run = runs.get(req.params[0]);
  if (!run || !run.reportDir) {
    res.status(404).json({ error: 'No report for this run.' });
    return;
  }
  const rel = (req.params[1] || '/index.html').replace(/^\/+/, '') || 'index.html';
  const root = path.resolve(run.reportDir);
  const full = path.resolve(root, rel);
  // The report dir's own files only: `rel` comes from the URL, and JMeter's
  // dashboard has no reason to ever reference anything outside it.
  if (full !== root && !full.startsWith(root + path.sep)) {
    res.status(400).json({ error: 'Bad path.' });
    return;
  }
  res.sendFile(full, (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: 'Not found.' });
  });
});

// ---- cleanup -----------------------------------------------------------

function reap() {
  const now = Date.now();
  for (const [id, run] of runs) {
    if (run.status === 'running') continue;
    if (!run.finishedAt || now - run.finishedAt < RUN_RETENTION_MS) continue;
    runs.delete(id);
    fs.rm(run.dir, { recursive: true, force: true }, () => {});
  }
}
setInterval(reap, REAP_INTERVAL_MS).unref();

module.exports = router;
