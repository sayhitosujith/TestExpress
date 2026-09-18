'use strict';

// Playback of one recorded step against a native app.
//
// The mobile counterpart of ./replay.js, and deliberately the same contract:
// `runStep(driver, step, session)` returns `{ holdMs }`, throws on failure with a
// message that says what was tried, and leaves pacing and reporting to the
// caller. That is what lets the client run one playback loop for all three
// engines.
//
// The step vocabulary is shared with the web engines wherever the concept
// survives the move to native — click, fill, check, assert, wait, implicitWait,
// scroll — so an existing step list, step editor and report render a mobile test
// without knowing it is one. Three actions are mobile-only: `launchApp` (the
// analogue of navigate), `back` (Android's hardware button) and `swipe`.

const { parseTree, nodeAt, describe } = require('./mobileTree');

const DEFAULT_TIMEOUT = 8000;
// Native screens settle slower than web pages: an activity transition plus an
// animation routinely outlasts a web navigation, so the assertion budget is
// higher than replay.js's 10s.
const ASSERT_TIMEOUT = 12_000;
// Same deliberate post-action pauses as the web engines, so step timings and
// "did the save land?" behaviour are comparable across engines.
const SAVE_HOLD_MS = 30_000;
const SAVE_HOLD_PATTERN = /\bsaves?\b/i;

const holdMsFor = (st) =>
  (st.action === 'click' || st.action === 'check') &&
  SAVE_HOLD_PATTERN.test(`${st.label || ''} ${st.text || ''}`)
    ? SAVE_HOLD_MS
    : 0;

const normText = (s) => (s || '').trim().replace(/\s+/g, ' ');

/**
 * Locators a step can be aimed at, in recorded order, plus the element's
 * original text as a last resort.
 *
 * Text is often the most durable thing about a native control too — a row keeps
 * its label across an OS upgrade that renumbered every internal id — so it is
 * appended even when the recorded selectors look specific.
 */
function selectorsOf(st) {
  const list = (st.selectors && st.selectors.length ? st.selectors : [st.selector]).filter(Boolean);
  const text = st.text || (st.action === 'assert' && st.assertType === 'text' ? st.expected : null);
  if (text) {
    const esc = String(text).replace(/"/g, '\\"');
    if (!list.some((s) => s.includes(`"${esc}"`))) {
      list.push(`android=new UiSelector().text("${esc}")`);
      list.push(`~${text}`);
    }
  }
  return list;
}

const summary = (st) => selectorsOf(st).join('  |  ') || '(no selector recorded)';

async function requireMatch(driver, st, timeout) {
  const found = await driver.findFirst(selectorsOf(st), timeout);
  if (found) return found.el;

  // Same diagnosis the web engines give: "not found" has two very different
  // causes, and saying which turns a dead end into a lead.
  const text = st.text || st.label;
  let why = `in ${(await driver.currentApp()) || 'the foreground app'}`;
  if (text) {
    const onScreen = normText(await driver.visibleText().catch(() => '')).toLowerCase();
    why += onScreen.includes(normText(text).toLowerCase())
      ? ' — the text IS on screen, so the element moved; re-record this step'
      : ` — "${text}" appears nowhere on screen, so the expected data was never rendered`;
  }
  throw new Error(`no element matched ${why}\ntried ${summary(st)}`);
}

async function assertStep(driver, st, timeout) {
  const end = Date.now() + timeout;
  let last = `no element matched — tried ${summary(st)}`;
  for (;;) {
    const found = await driver.findFirst(selectorsOf(st), 400);
    if (found) {
      try {
        if (st.assertType === 'exists') {
          if (await found.el.isDisplayed()) return;
          last = `element found but never became visible — ${summary(st)}`;
        } else {
          // `value` and `text` are the same attribute on a native control: a
          // field's contents are its text, so both read the same way.
          const actual = normText(await found.el.getText());
          if (String(actual).includes(st.expected || '')) return;
          last = `expected "${st.expected}", got "${String(actual).slice(0, 60)}"`;
        }
      } catch (err) {
        last = err.message;
      }
    }
    if (Date.now() >= end) throw new Error(last);
    await driver.driver.pause(200);
  }
}

/**
 * Run one step against a device.
 *
 * @param {import('./appium').MobileDriver} driver live session
 * @param {object} st the recorded step
 * @param {object} session carries `implicit`, the running auto-wait budget, and
 *   `baseApp`, the package the recording started in
 * @param {Function} [onHold] called for deliberate pauses so the client can show
 *   a countdown instead of appearing to hang
 * @returns {Promise<{holdMs: number}>}
 */
async function runStep(driver, st, session, onHold) {
  const timeout = session.implicit || DEFAULT_TIMEOUT;

  switch (st.action) {
    // The analogue of navigate: on mobile the address of a screen is its app.
    case 'launchApp':
    case 'navigate': {
      const pkg = st.app || st.url || session.baseApp;
      if (!pkg) throw new Error('no app to launch — the step names none and the session has no default');
      await driver.launchApp(pkg);
      return { holdMs: 0 };
    }

    case 'implicitWait':
      session.implicit = Math.max(250, Number(st.ms) || DEFAULT_TIMEOUT);
      return { holdMs: 0 };

    case 'wait': {
      const ms = Math.max(0, Number(st.ms) || 0);
      if (onHold) await onHold(ms, st.label || 'wait');
      else await driver.driver.pause(ms);
      return { holdMs: ms };
    }

    case 'back':
      await driver.back();
      await driver.driver.pause(400);
      return { holdMs: 0 };

    case 'scroll':
    case 'swipe':
      await driver.swipe(st.direction || 'down', st.percent);
      // Let the fling settle: reading the tree mid-animation yields rects that
      // are already stale by the time the next step uses them.
      await driver.driver.pause(500);
      return { holdMs: 0 };

    case 'assert':
      await assertStep(driver, st, Math.max(ASSERT_TIMEOUT, timeout));
      return { holdMs: 0 };

    // A native app has nothing to reload. Re-launching is the closest honest
    // equivalent and proves the same thing a web reload does: that what the
    // previous step saved survived leaving the screen.
    case 'reload': {
      const pkg = (await driver.currentApp()) || session.baseApp;
      await driver.driver.execute('mobile: terminateApp', { appId: pkg }).catch(() => {});
      await driver.launchApp(pkg);
      return { holdMs: 0 };
    }

    default:
      break;
  }

  // Everything below acts on an element. A step recorded in another app means the
  // previous one navigated there; bring it forward rather than failing to find a
  // control that is not on screen because the wrong app is.
  if (st.url && st.url !== (await driver.currentApp())) {
    await driver.launchApp(st.url).catch(() => {
      /* the app may simply have been backgrounded by the previous step */
    });
  }

  switch (st.action) {
    case 'fill': {
      const el = await requireMatch(driver, st, timeout);
      // clearValue then setValue rather than setValue alone: a native field
      // appends on some drivers, which silently doubles the text.
      await el.clearValue().catch(() => {});
      await el.setValue(String(st.value ?? ''));
      break;
    }
    case 'check': {
      const el = await requireMatch(driver, st, timeout);
      const want = !!st.value;
      const now = (await el.getAttribute('checked')) === 'true';
      // setChecked has no native equivalent — a toggle is tapped, so tapping an
      // already-correct switch would turn it back off.
      if (now !== want) await el.click();
      break;
    }
    case 'click':
    case 'tap': {
      const el = await requireMatch(driver, st, timeout);
      await el.click();
      break;
    }
    // Recorded when nothing identifiable was under the finger. Brittle by
    // nature — it survives no layout change at all — but a recording that
    // silently dropped the tap would be worse.
    case 'tapAt':
      await driver.tapAt(st.x, st.y);
      break;

    case 'select':
    case 'hover':
    case 'upload':
      throw new Error(
        `"${st.action}" has no native equivalent — this step was recorded in a browser engine`,
      );

    default:
      throw new Error(`unsupported step: ${st.action}`);
  }

  // Let the consequences finish — the tap handler, the activity transition, the
  // animation — before the next step reads the screen.
  await driver.driver.pause(350);

  const hold = holdMsFor(st);
  if (hold) {
    if (onHold) await onHold(hold, st.label || 'save');
    else await driver.driver.pause(hold);
  }
  return { holdMs: hold };
}

/**
 * Synthesise a step from a tap the recorder just forwarded.
 *
 * This is where the mobile engine differs most from the web ones. A web page
 * reports its own events from an injected listener; a native app cannot, so the
 * only events that exist are the ones this process performs. The tree is read
 * *before* the tap — afterwards the screen may already have changed — and the
 * node under the finger becomes the step.
 *
 * @returns {Promise<object|null>} a step, or null if nothing was under the tap.
 */
async function stepForTap(driver, x, y) {
  const nodes = parseTree(await driver.source());
  const hit = nodeAt(nodes, x, y);
  const app = await driver.currentApp();
  if (!hit) {
    // Nothing identifiable: record the raw coordinate rather than losing the
    // interaction. The step carries why it is a coordinate so the UI can say so.
    return { action: 'tapAt', x: Math.round(x), y: Math.round(y), url: app, label: `tap (${Math.round(x)}, ${Math.round(y)})`, coordinateOnly: true };
  }
  const d = describe(hit, nodes);
  // A tap on a text field is a click that focuses it — there is no separate
  // "focus" action, and inventing one would record a step nothing can replay.
  // `editable` travels with the step so the caller knows where subsequent
  // keystrokes belong, and coalesces them into a single fill against this same
  // locator bundle.
  return {
    action: d.checkable ? 'check' : 'click',
    selector: d.selector,
    selectors: d.selectors,
    tag: d.tag,
    text: d.text || undefined,
    label: d.label,
    url: app,
    ...(d.editable ? { editable: true } : {}),
    ...(d.checkable ? { value: !d.checked } : {}),
    ...(d.resourceId ? { resourceId: d.resourceId } : {}),
  };
}

module.exports = { runStep, stepForTap, holdMsFor, selectorsOf, DEFAULT_TIMEOUT };
