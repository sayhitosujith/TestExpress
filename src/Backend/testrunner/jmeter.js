'use strict';

// Performance-testing engine for TestExpress: builds a minimal JMeter test
// plan from a no-code load profile (target URL, threads, ramp-up, loops),
// runs it as an external `jmeter` process, and turns the dashboard report
// JMeter itself generates into the summary the UI shows.
//
// This does not follow the shape of the other three engines. Playwright and
// Appium are step-by-step: the client drives one HTTP call per recorded step
// and gets an answer back in milliseconds. A load test is the opposite — one
// long-running external process that JMeter itself paces for minutes and that
// produces its result as a file once it exits — so this module is a batch-job
// runner (spawn, wait, parse an artifact) rather than a session the client
// steps through. See routes/jmeter.js for the run lifecycle this drives.

const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ---- discovery --------------------------------------------------------

/**
 * Locate a JDK. JMeter is a JVM application and does not run without one.
 *
 * Checked in the same spirit as testrunner/appiumServer.js's findJavaHome:
 * a deploy image installs a JRE at a known apt path, and a developer's own
 * machine may have JAVA_HOME set or a JDK under one of the usual roots —
 * neither should require typing a path in by hand.
 *
 * @returns {string|null} a JAVA_HOME whose bin/java exists.
 */
function findJavaHome() {
  const exe = process.platform === 'win32' ? 'java.exe' : 'java';
  const ok = (home) => home && fs.existsSync(path.join(home, 'bin', exe)) && home;

  if (ok(process.env.JAVA_HOME)) return process.env.JAVA_HOME;

  const roots = [
    '/usr/lib/jvm',
    '/usr/lib64/jvm',
    '/Library/Java/JavaVirtualMachines',
    'C:\\Program Files\\Java',
    'C:\\Program Files\\Eclipse Adoptium',
    'C:\\Program Files\\Microsoft\\jdk',
  ];
  for (const dir of roots) {
    if (!fs.existsSync(dir)) continue;
    let names = [];
    try {
      names = fs.readdirSync(dir).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    } catch {
      continue;
    }
    for (const n of names) {
      if (ok(path.join(dir, n))) return path.join(dir, n);
      // macOS bundles nest the home inside the version directory.
      if (ok(path.join(dir, n, 'Contents', 'Home'))) return path.join(dir, n, 'Contents', 'Home');
    }
  }

  // Last resort: whatever `java` on PATH resolves to, asked for its own home.
  try {
    const probe = spawnSync('java', ['-XshowSettings:properties', '-version'], { encoding: 'utf8' });
    const out = `${probe.stdout || ''}${probe.stderr || ''}`;
    const m = out.match(/java\.home\s*=\s*(.+)/);
    if (m && ok(m[1].trim())) return m[1].trim();
  } catch {
    /* no java on PATH either */
  }
  return null;
}

/**
 * Locate a JMeter install: the folder holding `bin/ApacheJMeter.jar`.
 *
 * The jar rather than the `bin/jmeter`/`jmeter.bat` launcher script: that
 * script is what sets JVM options and calls `java -jar ApacheJMeter.jar`
 * itself, and on Windows a `.bat` cannot be handed to `child_process.spawn`
 * directly — Windows' CreateProcess only runs real executables, so spawning
 * one without `shell: true` fails with EINVAL. Rather than go through a
 * shell (the thing appiumServer.js avoids for the same reason, spawning
 * `node <entry.js>` instead of the `appium` shim), this invokes `java -jar`
 * on the jar directly, which is exactly what the wrapper script does as its
 * last step and works identically on every platform.
 *
 * @returns {string|null} absolute path to the JMeter home directory.
 */
function findJmeterHome() {
  const ok = (home) => home && fs.existsSync(path.join(home, 'bin', 'ApacheJMeter.jar')) && home;

  if (ok(process.env.JMETER_HOME)) return process.env.JMETER_HOME;

  const roots = ['/opt', '/usr/local', '/usr/share', process.env.HOME, process.env.USERPROFILE, path.join(process.env.USERPROFILE || '', 'tools')].filter(Boolean);
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    let names = [];
    try {
      names = fs.readdirSync(root);
    } catch {
      continue;
    }
    for (const n of names) {
      if (/^apache-jmeter/i.test(n) && ok(path.join(root, n))) return path.join(root, n);
    }
  }

  // `jmeter`/`jmeter.bat` already on PATH (a system package, or a shell
  // profile export) — asked for its own home via a JMeter system property
  // rather than run for real, since this is only a discovery probe.
  const exe = process.platform === 'win32' ? 'jmeter.bat' : 'jmeter';
  try {
    const probe = spawnSync(exe, ['--version'], { encoding: 'utf8', shell: process.platform === 'win32' });
    const out = `${probe.stdout || ''}${probe.stderr || ''}`;
    if (/Apache JMeter/i.test(out)) {
      // The launcher script sits at <home>/bin/<exe>; resolve it the same way
      // the shell would, via PATH, then walk up two directories.
      const where = spawnSync(process.platform === 'win32' ? 'where' : 'which', [exe], { encoding: 'utf8' });
      const resolved = (where.stdout || '').split(/\r?\n/)[0].trim();
      const home = resolved && path.dirname(path.dirname(resolved));
      if (ok(home)) return home;
    }
  } catch {
    /* not on PATH */
  }
  return null;
}

/**
 * Can this machine run a load test, and with what?
 *
 * Answered up front, the same way appiumServer.preflight() is: "JMeter is not
 * installed" is a setup problem the UI should show as a disabled engine with
 * install steps, not something discovered by pressing Run and reading a stack
 * trace.
 */
function preflight() {
  const javaHome = findJavaHome();
  const jmeterHome = findJmeterHome();
  const missing = [];
  if (!javaHome) {
    missing.push('No JDK found. Install one (e.g. `apt-get install openjdk-17-jre-headless`), or set JAVA_HOME.');
  }
  if (!jmeterHome) {
    missing.push(
      'Apache JMeter is not installed. Download it from https://jmeter.apache.org/download_jmeter.cgi, ' +
        'unpack it to /opt, and either set JMETER_HOME to that folder or put its bin/ on PATH.',
    );
  }
  return { canRun: !missing.length, javaHome, jmeterHome, missing };
}

// ---- plan building ------------------------------------------------------

function escapeXml(value) {
  return String(value ?? '').replace(/[<>&'"]/g, (c) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
  }[c]));
}

const MAX_THREADS = 50;
const MAX_LOOPS = 200;
const MAX_RAMP_UP_SECONDS = 300;

/**
 * Validates and normalises a load-test request from the UI.
 *
 * The caps here are deliberate, not arbitrary round numbers: this engine is
 * the first one in the product that can point real, sustained network load at
 * a third party, so "no code" must not also mean "no limit". A test that
 * genuinely needs more than this is exactly the kind of test that should be
 * run from a dedicated load-testing setup, not a landing-page feature.
 *
 * @throws {Error} with `.status = 400` on anything that fails validation.
 */
function normalisePlan(input = {}) {
  const bad = (msg) => {
    const e = new Error(msg);
    e.status = 400;
    throw e;
  };

  const targetUrl = String(input.targetUrl || '').trim();
  if (!targetUrl) bad('targetUrl is required.');
  let url;
  try {
    url = new URL(targetUrl);
  } catch {
    bad(`"${targetUrl}" is not a valid URL.`);
  }
  if (!/^https?:$/.test(url.protocol)) bad('Only http and https targets are supported.');

  // A baseline guard, not a substitute for a real allow-list: this only
  // catches the target naming a loopback/private address literally. It does
  // not resolve DNS to catch a hostname that *points at* one (a rebind), which
  // would need an async lookup here — worth doing before this is opened up
  // beyond Super Admin.
  const host = url.hostname.toLowerCase();
  const isPrivateLiteral =
    host === 'localhost' ||
    host === '::1' ||
    /^127\./.test(host) ||
    /^0\.0\.0\.0$/.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^169\.254\./.test(host);
  if (isPrivateLiteral) bad('The target cannot be a loopback or private address.');

  const threads = Math.round(Number(input.threads));
  if (!Number.isFinite(threads) || threads < 1 || threads > MAX_THREADS) {
    bad(`threads must be a whole number from 1 to ${MAX_THREADS}.`);
  }
  const rampUpSeconds = Math.round(Number(input.rampUpSeconds));
  if (!Number.isFinite(rampUpSeconds) || rampUpSeconds < 0 || rampUpSeconds > MAX_RAMP_UP_SECONDS) {
    bad(`rampUpSeconds must be a whole number from 0 to ${MAX_RAMP_UP_SECONDS}.`);
  }
  const loops = Math.round(Number(input.loops));
  if (!Number.isFinite(loops) || loops < 1 || loops > MAX_LOOPS) {
    bad(`loops must be a whole number from 1 to ${MAX_LOOPS}.`);
  }

  const method = String(input.method || 'GET').toUpperCase();
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'].includes(method)) {
    bad(`"${method}" is not a supported HTTP method.`);
  }

  const headers =
    input.headers && typeof input.headers === 'object' && !Array.isArray(input.headers)
      ? Object.entries(input.headers)
          .filter(([k]) => k && String(k).trim())
          .map(([k, v]) => [String(k).trim(), String(v ?? '')])
      : [];

  const body = ['POST', 'PUT', 'PATCH'].includes(method) ? String(input.body || '') : '';

  return {
    name: String(input.name || 'Load test').slice(0, 120),
    protocol: url.protocol.replace(':', ''),
    domain: url.hostname,
    port: url.port || (url.protocol === 'https:' ? '443' : '80'),
    path: (url.pathname || '/') + (url.search || ''),
    method,
    threads,
    rampUpSeconds,
    loops,
    headers,
    body,
  };
}

/**
 * Renders a plan into the .jmx XML JMeter's non-GUI mode reads.
 *
 * Hand-built rather than templated from a saved sample file: the shape is
 * small (one thread group, one HTTP sampler, an optional header manager) and
 * every value that came from a caller is escaped going in, which a copied
 * .jmx-with-placeholders approach makes easy to get wrong in exactly the
 * fields an attacker would target.
 */
function buildPlanXml(plan) {
  const headerManager = plan.headers.length
    ? `
        <HeaderManager guiclass="HeaderPanel" testclass="HeaderManager" testname="Headers" enabled="true">
          <collectionProp name="HeaderManager.headers">
            ${plan.headers
              .map(
                ([k, v]) => `<elementProp name="" elementType="Header">
              <stringProp name="Header.name">${escapeXml(k)}</stringProp>
              <stringProp name="Header.value">${escapeXml(v)}</stringProp>
            </elementProp>`,
              )
              .join('\n            ')}
          </collectionProp>
        </HeaderManager>
        <hashTree/>`
    : '';

  const bodyProp = plan.body
    ? `
          <boolProp name="HTTPSampler.postBodyRaw">true</boolProp>
          <elementProp name="HTTPsampler.Arguments" elementType="Arguments">
            <collectionProp name="Arguments.arguments">
              <elementProp name="" elementType="HTTPArgument">
                <boolProp name="HTTPArgument.always_encode">false</boolProp>
                <stringProp name="Argument.value">${escapeXml(plan.body)}</stringProp>
                <stringProp name="Argument.metadata">=</stringProp>
              </elementProp>
            </collectionProp>
          </elementProp>`
    : `
          <elementProp name="HTTPsampler.Arguments" elementType="Arguments">
            <collectionProp name="Arguments.arguments"/>
          </elementProp>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<jmeterTestPlan version="1.2" properties="5.0" jmeter="5.6.3">
  <hashTree>
    <TestPlan guiclass="TestPlanGui" testclass="TestPlan" testname="${escapeXml(plan.name)}" enabled="true">
      <boolProp name="TestPlan.functional_mode">false</boolProp>
      <boolProp name="TestPlan.tearDown_on_shutdown">true</boolProp>
      <boolProp name="TestPlan.serialize_threadgroups">false</boolProp>
      <elementProp name="TestPlan.user_defined_variables" elementType="Arguments" testclass="Arguments" testname="User Defined Variables" enabled="true">
        <collectionProp name="Arguments.arguments"/>
      </elementProp>
    </TestPlan>
    <hashTree>
      <ThreadGroup guiclass="ThreadGroupGui" testclass="ThreadGroup" testname="Load" enabled="true">
        <stringProp name="ThreadGroup.on_sample_error">continue</stringProp>
        <elementProp name="ThreadGroup.main_controller" elementType="LoopController" testclass="LoopController" testname="Loop Controller" enabled="true">
          <boolProp name="LoopController.continue_forever">false</boolProp>
          <stringProp name="LoopController.loops">${plan.loops}</stringProp>
        </elementProp>
        <stringProp name="ThreadGroup.num_threads">${plan.threads}</stringProp>
        <stringProp name="ThreadGroup.ramp_time">${plan.rampUpSeconds}</stringProp>
        <boolProp name="ThreadGroup.scheduler">false</boolProp>
      </ThreadGroup>
      <hashTree>
        <HTTPSamplerProxy guiclass="HttpTestSampleGui" testclass="HTTPSamplerProxy" testname="${escapeXml(plan.name)}" enabled="true">
          <stringProp name="HTTPSampler.domain">${escapeXml(plan.domain)}</stringProp>
          <stringProp name="HTTPSampler.port">${escapeXml(plan.port)}</stringProp>
          <stringProp name="HTTPSampler.protocol">${escapeXml(plan.protocol)}</stringProp>
          <stringProp name="HTTPSampler.path">${escapeXml(plan.path)}</stringProp>
          <stringProp name="HTTPSampler.method">${escapeXml(plan.method)}</stringProp>
          <boolProp name="HTTPSampler.follow_redirects">true</boolProp>
          <boolProp name="HTTPSampler.use_keepalive">true</boolProp>${bodyProp}
        </HTTPSamplerProxy>
        <hashTree>${headerManager}
        </hashTree>
      </hashTree>
    </hashTree>
  </hashTree>
</jmeterTestPlan>
`;
}

// ---- running -------------------------------------------------------------

const LOG_LINES = 100;

/** The `java` binary inside a JAVA_HOME. */
function javaExe(javaHome) {
  return path.join(javaHome, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
}

/**
 * The `java -jar ApacheJMeter.jar` invocation the wrapper script itself ends
 * with, minus the shell around it — see findJmeterHome() for why this module
 * calls java directly instead of `bin/jmeter(.bat)`.
 *
 * `-Djmeter.home` is what the wrapper script sets and this has to set for
 * itself, since without it JMeter cannot find its own `bin/jmeter.properties`
 * or `lib/` when launched this way.
 */
function jmeterCommand(jmeterHome, javaHome, args) {
  return {
    exe: javaExe(javaHome),
    args: [`-Djmeter.home=${jmeterHome}`, '-jar', path.join(jmeterHome, 'bin', 'ApacheJMeter.jar'), ...args],
  };
}

/**
 * Runs a load test to completion (or until `timeoutMs` kills it) and leaves a
 * results.jtl + generated dashboard report on disk under `dir`.
 *
 * Deliberately two JMeter invocations rather than one `-n -t -l -e -o`: a run
 * that is killed for overrunning its timeout still exits with samples already
 * written to the .jtl, and generating the dashboard as a second, separate
 * `-g` step means those partial results still turn into a real report instead
 * of the run producing nothing at all.
 *
 * @param {{jmeterHome: string, javaHome: string, dir: string, plan: object,
 *   timeoutMs: number, onLog: (line: string) => void,
 *   onSpawn?: (child: import('child_process').ChildProcess) => void}} args
 * @returns {Promise<{code: number|null, signal: string|null, timedOut: boolean}>}
 */
function runToCompletion({ jmeterHome, javaHome, dir, plan, timeoutMs, onLog, onSpawn }) {
  const jmxPath = path.join(dir, 'plan.jmx');
  const jtlPath = path.join(dir, 'results.jtl');
  fs.writeFileSync(jmxPath, buildPlanXml(plan), 'utf8');

  return new Promise((resolve) => {
    // `-j` pins JMeter's own log file inside this run's directory explicitly,
    // rather than relying on `cwd` alone: JMeter defaults that log to
    // `jmeter.log` in whatever directory it considers "current", and without
    // `-j` a caller that forgets `cwd` (generateReport once did) gets a stray
    // log file written into the backend's own folder on every run.
    const { exe, args } = jmeterCommand(jmeterHome, javaHome, [
      '-n', '-t', jmxPath, '-l', jtlPath, '-j', path.join(dir, 'jmeter.log'),
    ]);
    const child = spawn(exe, args, {
      cwd: dir,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    if (onSpawn) onSpawn(child);

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      onLog(`[timeout] run exceeded ${Math.round(timeoutMs / 1000)}s — stopping it`);
      child.kill(process.platform === 'win32' ? undefined : 'SIGTERM');
      // JMeter can ignore SIGTERM while a sampler is mid-request; escalate
      // rather than leaving a run this module thinks is "cancelled" still
      // generating load in the background.
      setTimeout(() => {
        if (child.exitCode === null) child.kill('SIGKILL');
      }, 5000);
    }, timeoutMs);

    const onData = (b) => {
      for (const line of b.toString().split(/\r?\n/)) {
        if (line.trim()) onLog(line.trimEnd());
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', (err) => onLog(`spawn failed: ${err.message}`));
    child.on('exit', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, timedOut });
    });
  });
}

/**
 * Builds the HTML dashboard (and its statistics.json) from a results file
 * that already exists on disk.
 *
 * A second, short-lived JMeter process (`-g` report-only mode) rather than
 * folding this into the run above, so a killed or partially-successful run
 * still gets a real report from whatever samples it produced.
 *
 * @returns {Promise<boolean>} whether a report was produced.
 */
function generateReport({ jmeterHome, javaHome, jtlPath, reportDir, onLog }) {
  if (!fs.existsSync(jtlPath) || fs.statSync(jtlPath).size === 0) return Promise.resolve(false);
  // JMeter refuses to write into a report directory that already exists.
  fs.rmSync(reportDir, { recursive: true, force: true });

  // Same run directory as runToCompletion's .jtl and .jmx — see the -j note
  // there for why the log path is pinned explicitly rather than left to cwd.
  const runDir = path.dirname(jtlPath);
  return new Promise((resolve) => {
    const { exe, args } = jmeterCommand(jmeterHome, javaHome, [
      '-g', jtlPath, '-o', reportDir, '-j', path.join(runDir, 'jmeter-report.log'),
    ]);
    const child = spawn(exe, args, {
      cwd: runDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const onData = (b) => {
      for (const line of b.toString().split(/\r?\n/)) {
        if (line.trim()) onLog(line.trimEnd());
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', () => resolve(false));
    child.on('exit', (code) => resolve(code === 0 && fs.existsSync(path.join(reportDir, 'statistics.json'))));
  });
}

/**
 * Reads the dashboard's own aggregate file and normalises it.
 *
 * Reusing JMeter's `statistics.json` rather than parsing the .jtl ourselves:
 * the percentiles, error rate and throughput math it contains is the same
 * math JMeter's own HTML report is built from, so the numbers this module
 * shows can never disagree with the report a click away from them.
 */
function readSummary(reportDir) {
  const file = path.join(reportDir, 'statistics.json');
  if (!fs.existsSync(file)) return null;
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
  const row = (r) => ({
    label: r.transaction,
    samples: r.sampleCount,
    errors: r.errorCount,
    errorPct: r.errorPct,
    avgMs: Math.round(r.meanResTime),
    p90Ms: Math.round(r.pct1ResTime),
    p95Ms: Math.round(r.pct2ResTime),
    p99Ms: Math.round(r.pct3ResTime),
    minMs: Math.round(r.minResTime),
    maxMs: Math.round(r.maxResTime),
    throughputPerSec: Math.round(r.throughput * 100) / 100,
  });
  const overall = raw.Total ? row(raw.Total) : null;
  const samplers = Object.entries(raw)
    .filter(([label]) => label !== 'Total')
    .map(([, r]) => row(r));
  return { overall, samplers };
}

module.exports = {
  preflight,
  findJavaHome,
  findJmeterHome,
  normalisePlan,
  buildPlanXml,
  runToCompletion,
  generateReport,
  readSummary,
  LOG_LINES,
  MAX_THREADS,
  MAX_LOOPS,
  MAX_RAMP_UP_SECONDS,
};
