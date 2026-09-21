// WebdriverIO/Appium export for TestExpress mobile recordings.
//
// The counterpart of ./spec.js, which emits Playwright for the two browser
// engines. A native recording cannot export as Playwright — there is no page to
// goto and no CSS to select with — so it exports as the runner that actually
// drives it.
//
// Everything not specific to the runner is imported from ./spec rather than
// reimplemented: quoting, the test-data block, owner and tag handling. A second
// copy of those would drift the first time a data feature changed, and the drift
// would only show up as an exported spec that quietly used stale values.
//
// Deliberately CommonJS and free of any React or DOM reference, for the same
// reason ./spec.js is: the Node CLI requires it and the app imports it.

const {
  ITER_CLOSE,
  ITER_OPEN,
  dataBlock,
  expr,
  indent,
  iterTitle,
  iteratesOver,
  ownerLabel,
  ownerOf,
  q,
  slug,
  tagLabel,
  tagsOf,
} = require('./spec');

const mobileSpecName = (name) => `${slug(name, 'test')}.mobile.spec.js`;

// Actions and locator forms that only exist on a device.
const MOBILE_ACTIONS = new Set(['back', 'launchApp', 'tapAt', 'swipe']);
const MOBILE_SELECTOR = /^(~|android=|ios=|\/\/(android|XCUIElement))/;

/**
 * Is this recording a native-mobile one?
 *
 * `engine` is stamped on anything recorded after the mobile engine existed and
 * is the authoritative answer. The step sniffing behind it is for recordings
 * that arrive from an `Import` of a hand-edited file, where the field may be
 * missing but the steps are unmistakably native — exporting one of those as
 * Playwright would produce a spec that cannot run.
 */
function isMobileTest(test) {
  if (!test) return false;
  if (test.engine === 'mobile') return true;
  if (test.engine) return false;
  return (test.steps || []).some(
    (st) =>
      MOBILE_ACTIONS.has(st.action) ||
      MOBILE_SELECTOR.test(String(st.selector || '')) ||
      (st.selectors || []).some((s) => MOBILE_SELECTOR.test(String(s))),
  );
}

// Default when a recording carries no app of its own — a hand-edited export
// should still name something rather than launching "undefined".
const DEFAULT_APP = 'com.example.app';

/**
 * One recorded step as one or more lines of WebdriverIO.
 *
 * The locator bundle is preserved as a comment exactly as the Playwright export
 * preserves it, because a native locator rots the same way a CSS one does and
 * the next candidate in the list is usually the fix.
 *
 * @param {object} st        the recorded step
 * @param {string} [locExpr] the expression that yields the element, for callers
 *   with a better source than a raw selector — the screen object emitter passes
 *   `await this.userField`, which is what lets a screen object and a flat spec
 *   share one mapping rather than keeping two that drift apart.
 * @param {function} [valueFn] how a recorded value becomes an expression.
 *   Defaults to resolving {{refs}} against DATA; a screen object passes the
 *   name of the method parameter, so the value arrives from its caller.
 */
function stepToAppium(st, locExpr, valueFn) {
  const sel = (st.selectors && st.selectors[0]) || st.selector;
  const loc = locExpr || `await driver.$(${q(sel)})`;
  const val = valueFn || expr;
  const alts = (st.selectors || []).slice(1);
  const note = alts.length ? `    // fallbacks: ${alts.join('  |  ')}\n` : '';

  switch (st.action) {
    // On mobile the address of a screen is the foreground app, so both spellings
    // of "go somewhere" mean the same thing.
    case 'launchApp':
    case 'navigate':
      return `  await driver.activateApp(${expr(st.app || st.url)});\n`;

    case 'click':
    case 'tap':
      return `${note}  await (${loc}).click();\n`;

    case 'fill':
      return (
        `${note}  {\n` +
        `    const el = ${loc};\n` +
        // Mirrors mobileReplay.js: some drivers append rather than replace, which
        // silently doubles the text.
        `    await el.clearValue();\n` +
        `    await el.setValue(${val(st.value)});\n` +
        `  }\n`
      );

    // A native toggle has no setChecked — it is tapped, so tapping one that is
    // already right would turn it back off.
    case 'check':
      return (
        `${note}  {\n` +
        `    const el = ${loc};\n` +
        `    if ((await el.getAttribute('checked')) !== ${q(st.value ? 'true' : 'false')}) await el.click();\n` +
        `  }\n`
      );

    case 'back':
      return `  await driver.back();\n`;

    case 'scroll':
    case 'swipe':
      return (
        `  await driver.execute('mobile: scrollGesture', {\n` +
        `    left: 100, top: 300, width: 600, height: 1200,\n` +
        `    direction: ${q(st.direction || 'down')}, percent: ${Number(st.percent) || 0.8},\n` +
        `  });\n`
      );

    case 'wait':
      return `  await driver.pause(${Number(st.ms) || 0});\n`;

    case 'implicitWait':
      return `  await driver.setTimeout({ implicit: ${Number(st.ms) || 8000} });\n`;

    // Nothing to reload in a native app; restarting it proves the same thing a
    // browser reload does — that what was saved survived leaving the screen.
    case 'reload':
      return (
        `  await driver.execute('mobile: terminateApp', { appId: APP });\n` +
        `  await driver.activateApp(APP);\n`
      );

    case 'tapAt':
      return (
        `  // Recorded as a coordinate: nothing identifiable was under the finger.\n` +
        `  // This will not survive a layout change — re-record it against an element.\n` +
        `  await driver.action('pointer', { parameters: { pointerType: 'touch' } })\n` +
        `    .move({ x: ${Number(st.x) || 0}, y: ${Number(st.y) || 0} })\n` +
        `    .down().pause(60).up().perform();\n`
      );

    case 'assert':
      if (st.assertType === 'exists') {
        return `${note}  assert.ok(await (${loc}).isDisplayed(), ${q(`expected ${st.label || sel} to be visible`)});\n`;
      }
      // `value` and `text` are the same attribute on a native control — a field's
      // contents are its text — so both read the same way. Substring rather than
      // equality, matching what the recorder's own playback checks.
      return (
        `${note}  {\n` +
        `    const actual = await (${loc}).getText();\n` +
        `    const expected = ${val(st.expected)};\n` +
        `    assert.ok(actual.includes(expected), \`expected \${JSON.stringify(actual)} to contain \${JSON.stringify(expected)}\`);\n` +
        `  }\n`
      );

    case 'select':
    case 'hover':
    case 'upload':
      return `  // "${st.action}" has no native equivalent — recorded in a browser engine.\n`;

    default:
      return `  // unsupported step: ${st.action}\n`;
  }
}

/**
 * A recorded mobile test as a runnable WebdriverIO spec.
 *
 * Emitted as a Mocha spec driving `remote()` directly rather than as a
 * `wdio.conf.js` project: it runs with nothing but `mocha` and `webdriverio`
 * installed, which is what makes an exported file useful on its own.
 *
 * @param {object} test the recording
 * @param {string} [defaultApp] app package to fall back to
 * @param {object} [set] the test data set its {{refs}} resolve against
 */
function toAppiumSpec(test, defaultApp, set) {
  const steps = test.steps || [];
  // The app under test: what the recording started in, else the first launch
  // step it contains, else the caller's default.
  const app =
    test.startUrl ||
    (steps.find((s) => s.action === 'launchApp' || s.action === 'navigate') || {}).app ||
    (steps.find((s) => s.url) || {}).url ||
    defaultApp ||
    DEFAULT_APP;

  // Wrapped rather than passed by reference: map hands its callback the index
  // and the array too, which now land in stepToAppium's optional locator and
  // value parameters and produce a spec that fills every field with an array.
  const body = steps.map((st) => stepToAppium(st)).join('');
  const data = dataBlock(steps, set, `npx mocha ${mobileSpecName(test.name)}`);
  const tags = tagsOf(test);
  const title = tags.length ? `${test.name} ${tags.map(tagLabel).join(' ')}` : test.name;
  const grepHint = tags.length ? `//   npx mocha ${mobileSpecName(test.name)} --grep ${tagLabel(tags[0])}\n` : '';
  const owner = ownerOf(test);
  const ownerLine = owner ? `// Owner: ${ownerLabel(owner)}\n` : '';
  const platform = test.platform === 'iOS' ? 'iOS' : 'Android';
  const automation = platform === 'iOS' ? 'XCUITest' : 'UiAutomator2';

  // The same loop the Playwright export uses, for the same reason and from the
  // same helpers — a mobile recording driven by a row table has to produce one
  // `it` per row, or a twelve-case table silently becomes one case on a device.
  const iterating = iteratesOver(steps, set);
  const block =
    `it(${iterating ? iterTitle(title) : q(title)}, async function () {\n` +
    `  this.timeout(180000);\n` +
    `  await driver.activateApp(APP);\n` +
    body +
    `});\n`;
  const runBlock = iterating ? ITER_OPEN + indent(block, '  ') + ITER_CLOSE : block;

  return `import { remote } from 'webdriverio';
import assert from 'node:assert/strict';

// Generated from the in-browser recording "${test.name}".
${ownerLine}// Runs against any device Appium can see. Start a server first:
//   appium --address 127.0.0.1 --port 4723
// and make sure ANDROID_HOME and JAVA_HOME are set in that shell.
//
// Point it at another device or build without editing this file:
//   APP_PACKAGE=com.example.staging DEVICE_UDID=emulator-5556 npx mocha ${mobileSpecName(test.name)}
${grepHint}const APPIUM_URL = process.env.APPIUM_URL ?? 'http://127.0.0.1:4723';
const APP = process.env.APP_PACKAGE ?? ${q(app)};
const DEVICE_UDID = process.env.DEVICE_UDID;

${data}let driver;

before(async function () {
  // Starting a session installs and launches nothing until activateApp below,
  // so a slow first run is the driver warming up, not the app.
  this.timeout(120000);
  const url = new URL(APPIUM_URL);
  driver = await remote({
    protocol: url.protocol.replace(':', ''),
    hostname: url.hostname,
    port: Number(url.port) || 4723,
    path: '/',
    logLevel: 'error',
    capabilities: {
      platformName: ${q(platform)},
      'appium:automationName': ${q(automation)},
      ...(DEVICE_UDID ? { 'appium:udid': DEVICE_UDID } : {}),
      'appium:noReset': true,
      'appium:newCommandTimeout': 600,
    },
  });
});

after(async () => {
  if (driver) await driver.deleteSession();
});

${runBlock}`;
}

module.exports = { toAppiumSpec, stepToAppium, mobileSpecName, isMobileTest, DEFAULT_APP };
