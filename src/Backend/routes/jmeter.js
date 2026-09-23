'use strict';

// Performance-testing engine for TestExpress (see testrunner/jmeter.js for
// why this is a batch-job runner rather than a session, unlike testrunner.js
// and mobile.js).
//
// Gated to any signed-in account whose plan carries the "performance"
// capability (Enterprise and up — see paymentOptions.json), enforced with
// requirePlan the same way src/api/corporate.js's routes are: the browser's
// own check in src/plans.js is what draws the pricing page, this is what
// actually refuses the request, because a client that could name its own
// plan could name the top one.
//
// Signing in is not enough on its own, unlike the other two engines.
// Playwright and Appium can only ever do what a recorded step already does —
// click, fill, navigate. This is the first engine that originates real,
// sustained network load against a target the caller names, which makes an
// open version of it a DDoS-as-a-service endpoint; restricting it to paying
// tiers is a real control, not just a pricing decision, and the
// thread/loop/duration caps and concurrency limit further down are what keep
// one account from doing real damage even within that. A target allow-list
// and per-account rate limiting are the next real controls if this needs
// tightening further — see the comment on `normalisePlan` in
// testrunner/jmeter.js for the baseline guard already in place.

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const multer = require('multer');
const { authenticate } = require('../requireRole');
const { requirePlan } = require('../requirePlan');
const jmeter = require('../testrunner/jmeter');

// Mounted once and reused on every route below rather than re-created per
// route: same middleware instance, same capability id, one place to change
// if this ever needs to move to a different tier.
const requirePerformancePlan = requirePlan('performance');

const router = express.Router();

// `authenticate` and `requirePerformancePlan` are applied per-route below
// rather than with a blanket `router.use`, because the report route at the
// bottom deliberately has neither — see the comment there for why.

// Uploaded CSVs for {{colName}} data sets. Named by a fresh id rather than
// the upload's own filename, matching mobile.js's APK upload — the point is
// the same: a crafted name in the upload must not be able to steer where it
// lands on disk.
const DATA_SET_DIR = path.join(os.tmpdir(), 'testexpress-jmeter-datasets');
const uploadCsv = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => fs.mkdir(DATA_SET_DIR, { recursive: true }, (err) => cb(err, DATA_SET_DIR)),
    filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}.csv`),
  }),
  // A few thousand short rows fits easily well under 1MB; this is generous
  // headroom, not a sizing target — MAX_DATA_SET_ROWS is the real cap.
  limits: { fileSize: 2 * 1024 * 1024 },
});
// Kept independently of `runs` below: one CSV is commonly reused across
// several runs in the same session (tweak the load profile, run it again),
// so its lifetime is its own retention window rather than tied to any one
// run's.
const DATA_SET_RETENTION_MS = 4 * 60 * 60 * 1000;
/** @type {Map<string, {path: string, columns: string[], rowCount: number, uploadedAt: number}>} */
const dataSets = new Map();

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

// Reassembles the URL a target's normalised {protocol, domain, port, path}
// came from, omitting the port when it is just the protocol's default —
// normaliseTarget always fills one in, but showing ":443" on every https
// target back to the person who typed a plain URL would read as if this
// module had changed what they asked for.
function targetUrlOf(r) {
  const defaultPort = r.protocol === 'https' ? '443' : '80';
  const port = r.port && r.port !== defaultPort ? `:${r.port}` : '';
  return `${r.protocol}://${r.domain}${port}${r.path}`;
}

function publicRun(run) {
  return {
    id: run.id,
    name: run.plan.name,
    status: run.status,
    // One row per target, in the order they were given — the client shows
    // "3 targets" or the full list from this rather than a single
    // targetUrl/method the way a one-target run used to report.
    targets: run.plan.requests.map((r) => ({ url: targetUrlOf(r), method: r.method })),
    threads: run.plan.threads,
    rampUpSeconds: run.plan.rampUpSeconds,
    loops: run.plan.loops,
    // Row count only, never the file path or its content — the client has no
    // legitimate use for either, and the columns are already known to it
    // from the /data-sets response that created this id.
    dataSetRows: run.plan.dataSet ? run.plan.dataSet.rowCount : null,
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

router.get('/capabilities', authenticate, requirePerformancePlan, (req, res) => {
  const pre = jmeter.preflight();
  res.json({
    available: pre.canRun,
    reason: pre.canRun ? undefined : pre.missing.join(' '),
    missing: pre.missing,
    limits: {
      maxThreads: jmeter.MAX_THREADS,
      maxLoops: jmeter.MAX_LOOPS,
      maxRampUpSeconds: jmeter.MAX_RAMP_UP_SECONDS,
      maxTargets: jmeter.MAX_TARGETS,
      maxDataSetRows: jmeter.MAX_DATA_SET_ROWS,
      runTimeoutSeconds: RUN_TIMEOUT_MS / 1000,
      maxConcurrentRuns: MAX_CONCURRENT_RUNS,
    },
    activeRuns: activeCount(),
  });
});

// Uploads a CSV and parses/validates it up front — before it is ever handed
// to `jmeter -n`, where a bad file would only surface minutes later as an
// opaque run failure, not a message naming the row and column at fault.
router.post('/data-sets', authenticate, requirePerformancePlan, uploadCsv.single('file'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file was uploaded.' });
    return;
  }
  const cleanup = () => fs.unlink(req.file.path, () => {});
  let rows;
  try {
    rows = jmeter.parseCsv(fs.readFileSync(req.file.path, 'utf8'));
  } catch (err) {
    cleanup();
    res.status(400).json({ error: `Could not read that file: ${err.message}` });
    return;
  }
  let info;
  try {
    info = jmeter.validateCsvRows(rows, (msg) => {
      const e = new Error(msg);
      e.status = 400;
      throw e;
    });
  } catch (err) {
    cleanup();
    res.status(err.status || 400).json({ error: err.message });
    return;
  }

  const id = crypto.randomUUID();
  dataSets.set(id, { path: req.file.path, columns: info.columns, rowCount: info.rowCount, uploadedAt: Date.now() });
  res.json({ id, columns: info.columns, rowCount: info.rowCount });
});

router.get('/runs', authenticate, requirePerformancePlan, (req, res) => {
  const list = [...runs.values()]
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, 50)
    .map(publicRun);
  res.json({ runs: list });
});

router.post('/runs', authenticate, requirePerformancePlan, (req, res) => {
  const pre = jmeter.preflight();
  if (!pre.canRun) {
    res.status(501).json({ error: pre.missing.join(' ') });
    return;
  }
  if (activeCount() >= MAX_CONCURRENT_RUNS) {
    res.status(429).json({ error: `Only ${MAX_CONCURRENT_RUNS} load tests may run at once — wait for one to finish.` });
    return;
  }

  let dataSet = null;
  if (req.body?.dataSetId) {
    dataSet = dataSets.get(req.body.dataSetId);
    if (!dataSet || !fs.existsSync(dataSet.path)) {
      res.status(400).json({ error: 'That data set was not found — it may have expired. Upload the CSV again.' });
      return;
    }
  }

  let plan;
  try {
    plan = jmeter.normalisePlan(req.body, dataSet);
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
    return;
  }

  const id = crypto.randomUUID();
  const run = {
    id,
    plan,
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

router.get('/runs/:id', authenticate, requirePerformancePlan, (req, res) => {
  const run = runs.get(req.params.id);
  if (!run) {
    res.status(404).json({ error: 'No such run.' });
    return;
  }
  res.json(publicRun(run));
});

router.delete('/runs/:id', authenticate, requirePerformancePlan, (req, res) => {
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

// Deliberately not behind `authenticate`, unlike every other route here — and
// not just because a browser navigation can't carry the bearer header the
// rest of the API needs (true, but solvable with a query-string token). The
// real reason is that the report is not one request: JMeter's dashboard is
// index.html plus its own CSS/JS/image assets, each fetched by the browser as
// a separate, ordinary <link>/<script>/<img> request that has no way to carry
// a token at all, query string or otherwise. Making every one of those
// authenticate would mean rewriting JMeter's own generated HTML to thread a
// token through every asset reference — fragile, and more code than the
// report is worth protecting further.
//
// What protects it instead is the same thing that already protects
// /api/checkout (see routes/checkout.js): a 122-bit random id
// (crypto.randomUUID(), assigned in POST /runs above) standing in for a
// session. It is never guessable, and `GET /runs` — which is what could hand
// one to somebody who did not already have it — is itself behind
// `authenticate`. Knowing this URL already means you were an authenticated
// caller when the run was created or listed.
//
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
  // The bare .../report path (no trailing slash) is where jmeterReportUrl()
  // used to point, and it looks like it works — index.html loads — but every
  // relative asset reference inside it (content/*.css, sbadmin2-*/*.js) then
  // resolves against .../runs/<id>/ instead of .../runs/<id>/report/, one
  // level too high, and every one of them 404s. Redirecting to add the slash
  // fixes it the same way a static file server redirects a directory request
  // without one — the browser then resolves those relative paths correctly.
  if (req.params[1] === undefined) {
    res.redirect(302, `${req.originalUrl}/`);
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
  for (const [id, ds] of dataSets) {
    if (now - ds.uploadedAt < DATA_SET_RETENTION_MS) continue;
    dataSets.delete(id);
    fs.unlink(ds.path, () => {});
  }
}
setInterval(reap, REAP_INTERVAL_MS).unref();

module.exports = router;
