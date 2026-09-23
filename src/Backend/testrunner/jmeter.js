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
// Each target gets its own thread group running at the full thread count
// concurrently with every other one — ten targets at fifty threads is
// already five hundred concurrent requests, which is plenty for what this
// engine is for (see the module comment on MAX_THREADS et al.).
const MAX_TARGETS = 10;

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'];

// ---- CSV data sets --------------------------------------------------------
// A run can attach a CSV so `{{colName}}` in a URL, header, username,
// password or body pulls a different value on every iteration — the same
// `{{ref}}` syntax the recorder's own data sets use (see testrunner/testdata.js),
// translated to JMeter's `${colName}` variable syntax at plan-build time.

const MAX_DATA_SET_ROWS = 2000;
const COLUMN_NAME_RE = /^[A-Za-z_]\w*$/;

/**
 * A minimal RFC 4180 CSV parser: quoted fields, doubled-quote escaping,
 * commas and newlines inside quotes, and either line ending. `String.split`
 * would break on the first quoted field containing a comma, which is common
 * enough in real exports (a name, an address) that it is not an edge case.
 *
 * @returns {string[][]} one array per row, including the header row.
 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"' && field === '') {
      inQuotes = true;
    } else if (c === ',') {
      pushField();
    } else if (c === '\r') {
      /* paired \n handles the line break */
    } else if (c === '\n') {
      pushRow();
    } else {
      field += c;
    }
  }
  if (field.length || row.length) pushRow();
  // A trailing blank line (the common case of a file ending in \n) parses as
  // one empty field, not "no row" — dropped so it is not counted as data.
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

/**
 * Validates a CSV's header row and row lengths.
 *
 * @throws {Error} with `.status = 400` naming the first problem found.
 */
function validateCsvRows(rows, bad) {
  if (rows.length < 2) bad('The CSV needs a header row plus at least one data row.');
  const [header, ...dataRows] = rows;
  const seen = new Set();
  for (const name of header) {
    if (!COLUMN_NAME_RE.test(name)) {
      bad(`"${name}" is not a usable column name — use letters, digits and underscores, starting with a letter.`);
    }
    if (seen.has(name)) bad(`Column "${name}" appears more than once.`);
    seen.add(name);
  }
  if (dataRows.length > MAX_DATA_SET_ROWS) {
    bad(`At most ${MAX_DATA_SET_ROWS} data rows are supported (this file has ${dataRows.length}).`);
  }
  const badRow = dataRows.findIndex((r) => r.length !== header.length);
  if (badRow !== -1) {
    bad(`Row ${badRow + 2} has ${dataRows[badRow].length} column(s); the header has ${header.length}.`);
  }
  return { columns: header, rowCount: dataRows.length };
}

const TEMPLATE_RE = /\{\{(\w+)\}\}/g;
const PROTECTED_TOKEN_RE = /__TPL_(\w+)_TPL__/g;

// A target URL is parsed with `new URL()` to validate and split it into
// domain/path/etc — but the WHATWG URL parser percent-encodes `{` and `}` in
// a path (turning "{{row}}" into "%7B%7Brow%7D%7D") while leaving them alone
// in a query string, an inconsistency that would make `{{name}}` work in
// "?x={{name}}" and silently break in "/users/{{name}}". Swapping each
// placeholder for a plain-identifier token before parsing, then swapping it
// back afterwards, keeps it intact through either code path.
const protectTemplates = (str) => String(str).replace(TEMPLATE_RE, (_, name) => `__TPL_${name}_TPL__`);

/**
 * Turns a protected placeholder into JMeter's `${name}` when a data set is
 * attached to supply it a value, or back into the exact `{{name}}` text the
 * caller typed when there is none — so referencing a column without a CSV
 * attached is inert text instead of a silently broken half-transform.
 */
const restoreTemplates = (str, asVariables) =>
  String(str).replace(PROTECTED_TOKEN_RE, (_, name) => (asVariables ? `\${${name}}` : `{{${name}}}`));

/** Applies the `{{name}}` -> `${name}` swap directly, for fields that never
 *  go through URL parsing (headers, body, username, password). */
const applyTemplate = (str, hasDataSet) =>
  hasDataSet ? String(str).replace(TEMPLATE_RE, (_, name) => `\${${name}}`) : str;

// A baseline guard, not a substitute for a real allow-list: this only catches
// a target naming a loopback/private address literally. It does not resolve
// DNS to catch a hostname that *points at* one (a rebind), which would need
// an async lookup here — worth doing before this is opened up further.
function isPrivateLiteral(hostname) {
  const host = hostname.toLowerCase();
  return (
    host === 'localhost' ||
    host === '::1' ||
    /^127\./.test(host) ||
    /^0\.0\.0\.0$/.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^169\.254\./.test(host)
  );
}

/**
 * Validates and normalises one target URL + method, sharing the caller's
 * headers/body — every target in a run answers to the same auth header or
 * request body, since a run is "these URLs, under this load", not a
 * different request built per target.
 *
 * @throws {Error} with `.status = 400` on anything that fails validation.
 */
function normaliseTarget(input, index, sharedHeaders, sharedBody, hasDataSet, bad) {
  const label = `Target #${index + 1}`;
  const targetUrl = String(input?.targetUrl || '').trim();
  if (!targetUrl) bad(`${label}: a URL is required.`);
  let url;
  try {
    url = new URL(protectTemplates(targetUrl));
  } catch {
    bad(`${label}: "${targetUrl}" is not a valid URL.`);
  }
  if (!/^https?:$/.test(url.protocol)) bad(`${label}: only http and https are supported.`);
  // Checked on the restored hostname: a templated host ("{{tenant}}.example.com")
  // would otherwise compare its protected placeholder token against this list
  // and never match, silently skipping a guard that matters more, not less,
  // once the actual host is only known at run time from a CSV.
  if (isPrivateLiteral(restoreTemplates(url.hostname, false))) {
    bad(`${label}: cannot be a loopback or private address.`);
  }

  const method = String(input?.method || 'GET').toUpperCase();
  if (!METHODS.includes(method)) bad(`${label}: "${method}" is not a supported HTTP method.`);

  return {
    name: `${method} ${restoreTemplates(url.hostname, false)}${restoreTemplates(url.pathname, false)}`.slice(0, 120),
    protocol: url.protocol.replace(':', ''),
    domain: restoreTemplates(url.hostname, hasDataSet),
    port: url.port || (url.protocol === 'https:' ? '443' : '80'),
    path: restoreTemplates((url.pathname || '/') + (url.search || ''), hasDataSet),
    method,
    headers: sharedHeaders,
    body: ['POST', 'PUT', 'PATCH'].includes(method) ? sharedBody : '',
  };
}

/**
 * Validates and normalises a load-test request from the UI: one or more
 * target URLs, each run as its own thread group so they generate load
 * concurrently rather than one after another, sharing one thread/ramp-up/loop
 * profile and one set of headers/body.
 *
 * The caps here are deliberate, not arbitrary round numbers: this engine is
 * the first one in the product that can point real, sustained network load at
 * a third party, so "no code" must not also mean "no limit". A test that
 * genuinely needs more than this is exactly the kind of test that should be
 * run from a dedicated load-testing setup, not a landing-page feature.
 *
 * `dataSet`, if given (`{path, columns}`, as stored by routes/jmeter.js after
 * a CSV upload), is what makes `{{colName}}` in a target URL, header,
 * username, password or body mean something — see applyTemplate()/
 * restoreTemplates() above. Without one, that text is inert: it is not an
 * error to type it, it simply is not replaced with anything.
 *
 * @throws {Error} with `.status = 400` on anything that fails validation.
 */
function normalisePlan(input = {}, dataSet = null) {
  const bad = (msg) => {
    const e = new Error(msg);
    e.status = 400;
    throw e;
  };

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

  const hasDataSet = !!dataSet;
  const tpl = (s) => applyTemplate(s, hasDataSet);

  const sharedHeaders =
    input.headers && typeof input.headers === 'object' && !Array.isArray(input.headers)
      ? Object.entries(input.headers)
          .filter(([k]) => k && String(k).trim())
          .map(([k, v]) => [tpl(String(k).trim()), tpl(String(v ?? ''))])
      : [];
  const sharedBody = tpl(String(input.body || ''));

  // Optional: HTTP Basic/Digest credentials, shared across every target the
  // same way headers and the body are. A username with no password is kept
  // as an empty password rather than rejected — some services genuinely use
  // one — but no username means no auth at all, since a password alone is
  // not a credential JMeter's Authorization Manager can use.
  const username = tpl(String(input.username || '').trim());
  const password = tpl(String(input.password || ''));
  const auth = username ? { username, password } : null;

  const rawTargets = Array.isArray(input.targets) ? input.targets : [];
  if (!rawTargets.length) bad('At least one target URL is required.');
  if (rawTargets.length > MAX_TARGETS) bad(`At most ${MAX_TARGETS} target URLs are supported in one run.`);

  const requests = rawTargets.map((t, i) => normaliseTarget(t, i, sharedHeaders, sharedBody, hasDataSet, bad));

  return {
    name: String(input.name || 'Load test').slice(0, 120),
    threads,
    rampUpSeconds,
    loops,
    requests,
    auth,
    dataSet,
  };
}

/**
 * One thread group + its HTTP sampler (+ optional header manager), for one
 * request in the plan. JMeter runs every thread group in a test plan
 * concurrently by default, which is exactly "independent targets, tested
 * together" — no scheduler or ordering needed, one thread group per target is
 * the whole mechanism.
 */
function threadGroupXml(request, threads, rampUpSeconds, loops) {
  const headerManager = request.headers.length
    ? `
        <HeaderManager guiclass="HeaderPanel" testclass="HeaderManager" testname="Headers" enabled="true">
          <collectionProp name="HeaderManager.headers">
            ${request.headers
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

  const bodyProp = request.body
    ? `
          <boolProp name="HTTPSampler.postBodyRaw">true</boolProp>
          <elementProp name="HTTPsampler.Arguments" elementType="Arguments">
            <collectionProp name="Arguments.arguments">
              <elementProp name="" elementType="HTTPArgument">
                <boolProp name="HTTPArgument.always_encode">false</boolProp>
                <stringProp name="Argument.value">${escapeXml(request.body)}</stringProp>
                <stringProp name="Argument.metadata">=</stringProp>
              </elementProp>
            </collectionProp>
          </elementProp>`
    : `
          <elementProp name="HTTPsampler.Arguments" elementType="Arguments">
            <collectionProp name="Arguments.arguments"/>
          </elementProp>`;

  return `
    <ThreadGroup guiclass="ThreadGroupGui" testclass="ThreadGroup" testname="${escapeXml(request.name)}" enabled="true">
      <stringProp name="ThreadGroup.on_sample_error">continue</stringProp>
      <elementProp name="ThreadGroup.main_controller" elementType="LoopController" testclass="LoopController" testname="Loop Controller" enabled="true">
        <boolProp name="LoopController.continue_forever">false</boolProp>
        <stringProp name="LoopController.loops">${loops}</stringProp>
      </elementProp>
      <stringProp name="ThreadGroup.num_threads">${threads}</stringProp>
      <stringProp name="ThreadGroup.ramp_time">${rampUpSeconds}</stringProp>
      <boolProp name="ThreadGroup.scheduler">false</boolProp>
    </ThreadGroup>
    <hashTree>
      <HTTPSamplerProxy guiclass="HttpTestSampleGui" testclass="HTTPSamplerProxy" testname="${escapeXml(request.name)}" enabled="true">
        <stringProp name="HTTPSampler.domain">${escapeXml(request.domain)}</stringProp>
        <stringProp name="HTTPSampler.port">${escapeXml(request.port)}</stringProp>
        <stringProp name="HTTPSampler.protocol">${escapeXml(request.protocol)}</stringProp>
        <stringProp name="HTTPSampler.path">${escapeXml(request.path)}</stringProp>
        <stringProp name="HTTPSampler.method">${escapeXml(request.method)}</stringProp>
        <boolProp name="HTTPSampler.follow_redirects">true</boolProp>
        <boolProp name="HTTPSampler.use_keepalive">true</boolProp>${bodyProp}
      </HTTPSamplerProxy>
      <hashTree>${headerManager}
      </hashTree>
    </hashTree>`;
}

/**
 * One HTTP Authorization Manager, shared by every thread group, holding one
 * Basic/Digest credential entry per distinct target origin.
 *
 * A single manager at the test-plan level rather than one per thread group:
 * JMeter matches an Authorization entry to a sampler by comparing the
 * entry's URL against the request's, so one manager whose entries cover
 * every origin in the plan authenticates every target exactly the way a
 * per-thread-group copy would, without repeating the same username/password
 * once per target.
 *
 * Basic/Digest only — this cannot log into a page that authenticates with a
 * form post and a session cookie (or, as in Gmail's case, a full OAuth flow);
 * that would need a login request plus extracting a token from its response
 * before every sampler, which is a materially different feature from "this
 * origin wants an Authorization header".
 */
function authManagerXml(auth, requests) {
  if (!auth) return '';
  const origins = [...new Set(requests.map((r) => `${r.protocol}://${r.domain}:${r.port}`))];
  return `
    <AuthManager guiclass="AuthPanel" testclass="AuthManager" testname="HTTP Authorization Manager" enabled="true">
      <collectionProp name="AuthManager.auth_list">
        ${origins
          .map(
            (origin) => `<elementProp name="" elementType="Authorization">
          <stringProp name="Authorization.url">${escapeXml(origin)}</stringProp>
          <stringProp name="Authorization.username">${escapeXml(auth.username)}</stringProp>
          <stringProp name="Authorization.password">${escapeXml(auth.password)}</stringProp>
          <stringProp name="Authorization.mechanism">BASIC_DIGEST</stringProp>
        </elementProp>`,
          )
          .join('\n        ')}
      </collectionProp>
    </AuthManager>
    <hashTree/>`;
}

/**
 * One CSV Data Set Config, feeding `{{colName}}` -> `${colName}` its values.
 *
 * Placed once at the test-plan level rather than per thread group, with
 * `shareMode.all`: every thread across every target pulls from the same
 * advancing position in the file, so a hundred rows are spread once across
 * the whole run's requests rather than each target replaying the same
 * hundred rows independently. `recycle` is on so a run with more iterations
 * than rows wraps back to the top instead of erroring out.
 */
function csvDataSetXml(dataSet) {
  if (!dataSet) return '';
  return `
    <CSVDataSet guiclass="TestBeanGUI" testclass="CSVDataSet" testname="Data" enabled="true">
      <stringProp name="filename">${escapeXml(dataSet.path)}</stringProp>
      <stringProp name="fileEncoding">UTF-8</stringProp>
      <stringProp name="variableNames"></stringProp>
      <boolProp name="ignoreFirstLine">false</boolProp>
      <stringProp name="delimiter">,</stringProp>
      <boolProp name="quotedData">true</boolProp>
      <boolProp name="recycle">true</boolProp>
      <boolProp name="stopThread">false</boolProp>
      <stringProp name="shareMode">shareMode.all</stringProp>
    </CSVDataSet>
    <hashTree/>`;
}

/**
 * Renders a plan into the .jmx XML JMeter's non-GUI mode reads: one thread
 * group per target URL, all siblings under the same test plan so they run
 * concurrently.
 *
 * Hand-built rather than templated from a saved sample file: the shape is
 * small and every value that came from a caller is escaped going in, which a
 * copied .jmx-with-placeholders approach makes easy to get wrong in exactly
 * the fields an attacker would target.
 */
function buildPlanXml(plan) {
  const threadGroups = plan.requests
    .map((r) => threadGroupXml(r, plan.threads, plan.rampUpSeconds, plan.loops))
    .join('\n');
  const auth = authManagerXml(plan.auth, plan.requests);
  const dataSet = csvDataSetXml(plan.dataSet);

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
    <hashTree>${dataSet}${auth}${threadGroups}
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
  parseCsv,
  validateCsvRows,
  LOG_LINES,
  MAX_THREADS,
  MAX_LOOPS,
  MAX_RAMP_UP_SECONDS,
  MAX_TARGETS,
  MAX_DATA_SET_ROWS,
};
