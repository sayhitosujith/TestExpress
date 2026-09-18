'use strict';

// The native equivalent of the DOM, for the Appium engine.
//
// The web engines resolve a recorded step by injecting JavaScript into the page:
// installRecorder listens for real DOM events and elementFromPoint answers "what
// did the user just touch". A native app has no JS to inject and no DOM, so both
// jobs are done from the accessibility hierarchy Appium serves as XML — this
// module parses that XML into a tree and answers the same two questions against
// it.
//
// Everything here is pure. A device is expensive and slow to talk to, so the
// parsing, hit-testing and selector-ranking logic is kept free of the driver and
// can be exercised entirely from a captured XML string — see
// scripts/mobile-tree.test.js.

// uiautomator2 and XCUITest both serve attribute values XML-escaped. Using them
// raw was a real bug caught on a device: the Settings row "Services & preferences"
// arrives as "Services &amp; preferences", and every selector built from the
// undecoded value matched nothing at all.
const ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
};

/** Decode the XML entities Appium escapes attribute values with. */
function decodeEntities(raw) {
  return String(raw ?? '').replace(
    /&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g,
    (m) => {
      if (ENTITIES[m]) return ENTITIES[m];
      const dec = /^&#(\d+);$/.exec(m);
      if (dec) return String.fromCodePoint(Number(dec[1]));
      const hex = /^&#x([0-9a-fA-F]+);$/.exec(m);
      return hex ? String.fromCodePoint(parseInt(hex[1], 16)) : m;
    },
  );
}

// Android serves rects as "[x1,y1][x2,y2]"; iOS serves x/y/width/height as
// separate attributes. Normalising here keeps every consumer platform-agnostic.
function rectOf(attrs) {
  const b = attrs.bounds;
  if (b) {
    const m = /^\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]$/.exec(b);
    if (!m) return null;
    const [x1, y1, x2, y2] = m.slice(1).map(Number);
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }
  if (attrs.x != null && attrs.width != null) {
    const r = {
      x: Number(attrs.x),
      y: Number(attrs.y),
      w: Number(attrs.width),
      h: Number(attrs.height),
    };
    return Number.isFinite(r.x + r.y + r.w + r.h) ? r : null;
  }
  return null;
}

const ATTR = /([\w:-]+)="([^"]*)"/g;

function attrsOf(chunk) {
  const out = {};
  let m;
  ATTR.lastIndex = 0;
  while ((m = ATTR.exec(chunk))) out[m[1]] = decodeEntities(m[2]);
  return out;
}

/**
 * Parse an Appium page source into a flat list of nodes carrying real tree
 * structure (`parent`, `depth`, `childIndex`).
 *
 * A flat list rather than a nested one because every consumer here scans by
 * geometry — hit-testing and uniqueness counting both want "all nodes", and the
 * parent links carry the structure the few ancestor walks need.
 *
 * @param {string} xml Appium's `getPageSource()` output.
 * @returns {Array<object>} nodes, document order, each with `{cls, attrs, rect,
 *   parent, depth, childIndex}`. Nodes without a usable rect are kept — an
 *   ancestor walk must not skip a link in the chain — but hit-testing ignores
 *   them.
 */
function parseTree(xml) {
  const nodes = [];
  const stack = [];
  // Tag tokens only: an open tag, a self-closing tag, or a close tag. The XML
  // declaration is skipped by requiring a letter after "<".
  const token = /<(\/)?([A-Za-z][\w.:-]*)((?:\s+[\w:-]+="[^"]*")*)\s*(\/)?>/g;
  let m;
  while ((m = token.exec(xml))) {
    const [, closing, cls, attrChunk, selfClosing] = m;
    if (closing) {
      stack.pop();
      continue;
    }
    const parent = stack.length ? stack[stack.length - 1] : null;
    const node = {
      cls,
      attrs: attrsOf(attrChunk),
      parent,
      depth: stack.length,
      childIndex: 0,
      rect: null,
    };
    node.rect = rectOf(node.attrs);
    if (parent) {
      // 1-based and per class name, because that is what an XPath positional
      // predicate counts.
      parent.kids = parent.kids || [];
      parent.kids.push(node);
      node.childIndex = parent.kids.filter((k) => k.cls === cls).length;
    } else {
      node.childIndex = 1;
    }
    nodes.push(node);
    if (!selfClosing) stack.push(node);
  }
  return nodes;
}

// ---- locator material -----------------------------------------------------

// Platform-neutral readers. iOS names the same concepts differently, so every
// consumer below goes through these rather than touching attribute names.
const descOf = (n) => n.attrs['content-desc'] || n.attrs.name || '';
const textOf = (n) => n.attrs.text || n.attrs.label || n.attrs.value || '';
const idOf = (n) => n.attrs['resource-id'] || '';
// Android states this outright. XCUITest has no equivalent attribute, so iOS
// falls back to the element types that are interactive by definition — testing
// `enabled` instead would be useless, since almost every node is enabled.
const isClickable = (n) =>
  n.attrs.clickable === 'true' ||
  /XCUIElementTypeButton|XCUIElementTypeCell|XCUIElementTypeLink/i.test(n.cls);

/** Does this node carry anything a durable selector could be built from? */
function isIdentifiable(node) {
  return !!(descOf(node) || textOf(node) || idOf(node));
}

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

/**
 * Candidate selectors for a node, most durable first, each annotated with how
 * many nodes in the tree it would match.
 *
 * Uniqueness is measured, not assumed. On a real Settings screen
 * `android:id/title` matches eight rows, so emitting resource-id ahead of text
 * purely because it "looks like an id" produces a selector that lands on the
 * wrong row. Counting against the tree we already hold costs nothing and is what
 * lets `selectorsFor` drop the ambiguous ones.
 *
 * The predicate travels with each candidate so an ambiguous one can be pinned to
 * the right instance later — the index has to be counted against the same
 * predicate that made it ambiguous, not a guessed one.
 *
 * @param {object} node one node from {@link parseTree}
 * @param {Array<object>} all every node, for counting matches
 * @returns {Array<{sel: string, count: number, pred: Function}>}
 */
function rankedSelectors(node, all) {
  const desc = descOf(node);
  const text = textOf(node);
  const id = idOf(node);
  const out = [];
  const add = (sel, pred) => out.push({ sel, count: all.filter(pred).length, pred });

  // Accessibility id first: it is the one locator an app author sets
  // deliberately, and it is the only form that is identical on Android and iOS.
  if (desc) add(`~${desc}`, (n) => descOf(n) === desc);
  if (text) {
    add(`android=new UiSelector().text("${esc(text)}")`, (n) => textOf(n) === text);
    add(`//${node.cls}[@text="${esc(text)}"]`, (n) => n.cls === node.cls && textOf(n) === text);
  }
  if (id) {
    add(`android=new UiSelector().resourceId("${esc(id)}")`, (n) => idOf(n) === id);
    // resource-id plus the node's own text is often unique where neither is.
    if (text) {
      add(
        `android=new UiSelector().resourceId("${esc(id)}").text("${esc(text)}")`,
        (n) => idOf(n) === id && textOf(n) === text,
      );
    }
  }
  return out;
}

/**
 * The selector bundle a recorded step carries: unique locators first, then an
 * indexed fallback so a step is never left with nothing to aim at.
 *
 * Mirrors how the web engines record several selectors per step and let replay
 * walk them — a native UI reshuffles between OS versions much as markup does
 * between releases, so one locator is never enough.
 */
function selectorsFor(node, all) {
  const ranked = rankedSelectors(node, all);
  const unique = ranked.filter((r) => r.count === 1).map((r) => r.sel);
  const ambiguous = ranked.filter((r) => r.count > 1);

  const out = [...unique];
  // An ambiguous locator still beats nothing, but only pinned to the position
  // this node actually occupies among *its own* matches — which is why the
  // predicate had to travel with the candidate.
  for (const { sel, pred } of ambiguous) {
    const nth = all.filter(pred).indexOf(node);
    if (nth < 0) continue;
    // XPath positions are 1-based; UiSelector.instance() is 0-based.
    out.push(sel.startsWith('//') ? `(${sel})[${nth + 1}]` : `${sel}.instance(${nth})`);
  }
  // Always keep a structural locator at the end. It is the most brittle form
  // there is, but a step with no selector at all can never be replayed.
  out.push(xpathFor(node));
  return out;
}

/**
 * Positional XPath, the locator of last resort for a node with no text, no
 * accessibility id and no resource id — a bare layout container, which native
 * UIs are full of.
 */
function xpathFor(node) {
  const parts = [];
  for (let n = node; n && n.parent; n = n.parent) {
    parts.unshift(`${n.cls}[${n.childIndex}]`);
  }
  return '//' + (parts.join('/') || node.cls);
}

// ---- hit testing ----------------------------------------------------------

const area = (n) => (n.rect ? n.rect.w * n.rect.h : Infinity);
const contains = (n, x, y) =>
  !!n.rect &&
  x >= n.rect.x &&
  y >= n.rect.y &&
  x <= n.rect.x + n.rect.w &&
  y <= n.rect.y + n.rect.h;

/**
 * What did the user just touch at (x, y)?
 *
 * The naive answer — the smallest node containing the point — is usually a bare
 * layout container, because that is how native UIs are built. On a Settings row
 * the deepest hit is a `RelativeLayout` whose only distinguishing mark is a
 * shared `resource-id`, while the thing a human would say they tapped is the
 * "Connected devices" label inside it.
 *
 * So the search is ordered by how *durable and meaningful* the result is, not by
 * depth alone:
 *
 *   1. the deepest hit carrying text or an accessibility id — because ancestors
 *      also contain the point, walking the hits by ascending area is the same as
 *      walking up from the deepest;
 *   2. failing that, the first such node *inside* the deepest hit. This is the
 *      Settings-row case: the label sits beside the touch point, not under it;
 *   3. only then a node identified by `resource-id` alone. Measured on a real
 *      device these are frequently shared across every row on screen, so they
 *      yield a positional `.instance(n)` locator and a label like
 *      "RelativeLayout" — correct, but worth far less than the row's own text;
 *   4. finally the deepest clickable node, then simply the deepest.
 *
 * Returning the label rather than the clickable row it sits in is deliberate: a
 * tap on a non-clickable child propagates to the clickable ancestor on both
 * platforms, so aiming at the named node costs nothing and gains a locator that
 * survives a layout change.
 *
 * @returns {object|null} the node to record a step against.
 */
function nodeAt(nodes, x, y) {
  const hits = nodes.filter((n) => contains(n, x, y)).sort((a, b) => area(a) - area(b));
  if (!hits.length) return null;

  // Text or accessibility id — what a person would use to name the thing.
  const named = (n) => !!(descOf(n) || textOf(n));

  const direct = hits.find(named);
  if (direct) return direct;

  // Document order, not size: in a title/summary pair the title comes first and
  // is the row's identity, whereas "largest" would pick whichever line happened
  // to wrap onto two rows.
  const deepest = hits[0];
  const inside = nodes.find((n) => n !== deepest && named(n) && n.rect && within(n, deepest));
  if (inside) return inside;

  return hits.find(isIdentifiable) || hits.find(isClickable) || deepest;
}

const within = (inner, outer) =>
  inner.rect.x >= outer.rect.x &&
  inner.rect.y >= outer.rect.y &&
  inner.rect.x + inner.rect.w <= outer.rect.x + outer.rect.w &&
  inner.rect.y + inner.rect.h <= outer.rect.y + outer.rect.h;

// Editable text fields need a `fill` step, everything else a `tap`. Both
// platforms are identifiable by element type alone.
const isEditable = (n) =>
  /EditText|SearchView|XCUIElementTypeTextField|XCUIElementTypeSecureTextField|XCUIElementTypeTextView/i.test(
    n.cls,
  );

const isCheckable = (n) => n.attrs.checkable === 'true' || /Switch|CheckBox|XCUIElementTypeSwitch/i.test(n.cls);

/**
 * Describe a node as the locator bundle a recorded step carries.
 *
 * Deliberately the same shape the web `pick` endpoint answers with — `selector`,
 * `selectors`, `tag`, `text`, `label` — so the step list, the step editor and
 * the report render a mobile step without knowing it is one.
 */
function describe(node, all) {
  const selectors = selectorsFor(node, all);
  const text = textOf(node);
  const desc = descOf(node);
  return {
    selector: selectors[0],
    selectors,
    tag: node.cls,
    text: text || desc || '',
    label: desc || text || shortClass(node.cls),
    rect: node.rect,
    editable: isEditable(node),
    checkable: isCheckable(node),
    checked: node.attrs.checked === 'true',
    resourceId: idOf(node) || undefined,
  };
}

// "android.widget.TextView" -> "TextView". The full class name is noise in a
// step label; it is still available on the step as `tag`.
const shortClass = (cls) => String(cls).split('.').pop();

module.exports = {
  decodeEntities,
  parseTree,
  nodeAt,
  describe,
  selectorsFor,
  rankedSelectors,
  xpathFor,
  isIdentifiable,
  isEditable,
  isCheckable,
  shortClass,
};
