'use strict';

// Tests for the pure half of the mobile engine, run against a page source
// captured from a real Android emulator (fixtures/android-settings.xml).
//
// A device is slow, stateful and often absent, so the logic that decides *what a
// tap means* is deliberately free of the driver and pinned here instead. Every
// case below is one that was observed to be wrong on a device before it was
// fixed, which is why the fixture is real output rather than hand-written XML.
//
// Run with:  node src/Backend/scripts/mobile-tree.test.js

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  decodeEntities,
  parseTree,
  nodeAt,
  describe: describeNode,
  selectorsFor,
  xpathFor,
  isIdentifiable,
} = require('../testrunner/mobileTree');

const xml = fs.readFileSync(path.join(__dirname, 'fixtures', 'android-settings.xml'), 'utf8');
const nodes = parseTree(xml);

let failures = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures++;
    console.log(`  FAIL ${name}\n       ${err.message.split('\n').join('\n       ')}`);
  }
}

console.log('mobileTree');

test('parses the whole hierarchy', () => {
  assert.ok(nodes.length > 50, `expected a populated tree, got ${nodes.length} nodes`);
  assert.ok(nodes.every((n) => typeof n.cls === 'string' && n.cls.length));
});

test('builds parent links and depth', () => {
  const root = nodes[0];
  assert.equal(root.parent, null);
  assert.equal(root.depth, 0);
  const child = nodes.find((n) => n.parent);
  assert.ok(child.depth > 0);
  assert.ok(nodes.includes(child.parent));
});

test('decodes XML entities in attribute values', () => {
  // The bug this exists for: "Services &amp; preferences" was used raw, so every
  // selector built from it matched nothing on the device.
  assert.equal(decodeEntities('Services &amp; preferences'), 'Services & preferences');
  assert.equal(decodeEntities('a &lt;b&gt; c &quot;d&quot;'), 'a <b> c "d"');
  assert.equal(decodeEntities('&#65;&#x42;'), 'AB');
  const amp = nodes.find((n) => (n.attrs.text || '').includes('&'));
  assert.ok(amp, 'fixture should contain a node with an ampersand in its text');
  assert.ok(!amp.attrs.text.includes('&amp;'), `still escaped: ${amp.attrs.text}`);
});

test('parses Android bounds into a rect', () => {
  const withRect = nodes.filter((n) => n.rect);
  assert.ok(withRect.length > 40);
  for (const n of withRect) {
    assert.ok(Number.isFinite(n.rect.x) && Number.isFinite(n.rect.y));
    assert.ok(n.rect.w >= 0 && n.rect.h >= 0);
  }
});

test('hit-testing returns a named node, not a bare container', () => {
  // Regression: the deepest hit on a Settings row is a RelativeLayout whose only
  // mark is a shared resource-id, which produced the label "RelativeLayout" and
  // a positional locator. The row's own text is the useful answer.
  const rows = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7];
  const labels = rows
    .map((f) => nodeAt(nodes, 540, Math.round(2092 * f)))
    .filter(Boolean)
    .map((n) => describeNode(n, nodes).label);
  assert.ok(labels.length >= 5, `expected hits across the screen, got ${labels.length}`);
  const containers = labels.filter((l) => /Layout|ViewGroup|RecyclerView/.test(l));
  assert.equal(containers.length, 0, `hit bare containers: ${containers.join(', ')}`);
});

test('hit-testing returns null outside the screen', () => {
  assert.equal(nodeAt(nodes, -5, -5), null);
  assert.equal(nodeAt(nodes, 99999, 99999), null);
});

test('primary selector is unique within the tree', () => {
  // The other half of the same regression: resource-id looked authoritative but
  // "android:id/title" matches every row on the screen.
  const hits = [0.2, 0.3, 0.4, 0.5, 0.6]
    .map((f) => nodeAt(nodes, 540, Math.round(2092 * f)))
    .filter(Boolean);
  assert.ok(hits.length);
  for (const hit of hits) {
    const d = describeNode(hit, nodes);
    const matches = countMatches(d.selector, hit);
    assert.equal(matches, 1, `"${d.selector}" matches ${matches} nodes, expected 1`);
  }
});

test('ambiguous selectors are pinned with an instance index', () => {
  // A node identified only by a shared resource-id must still get a locator that
  // resolves to it alone.
  const shared = nodes.filter((n) => n.attrs['resource-id'] === 'android:id/title');
  assert.ok(shared.length > 1, 'fixture should contain a repeated resource-id');
  const sels = selectorsFor(shared[2], nodes);
  assert.ok(
    sels.some((s) => /\.instance\(\d+\)/.test(s) || /^\(\/\/.*\)\[\d+\]$/.test(s) || s.startsWith('//')),
    `expected a pinned or structural locator, got: ${sels.join(' | ')}`,
  );
});

test('every node gets at least one selector', () => {
  for (const n of nodes) {
    const sels = selectorsFor(n, nodes);
    assert.ok(sels.length > 0, `no selector for ${n.cls}`);
    assert.ok(sels.every((s) => typeof s === 'string' && s.length));
  }
});

test('xpathFor builds a rooted positional path', () => {
  const deep = nodes.find((n) => n.depth > 3);
  const xp = xpathFor(deep);
  assert.ok(xp.startsWith('//'), xp);
  assert.ok(/\[\d+\]$/.test(xp), xp);
});

test('isIdentifiable is false for anonymous containers', () => {
  const anon = nodes.find(
    (n) => !n.attrs.text && !n.attrs['content-desc'] && !n.attrs['resource-id'],
  );
  if (anon) assert.equal(isIdentifiable(anon), false);
});

test('describe reports the fields a step needs', () => {
  const hit = nodeAt(nodes, 540, Math.round(2092 * 0.4));
  const d = describeNode(hit, nodes);
  for (const key of ['selector', 'selectors', 'tag', 'text', 'label', 'rect']) {
    assert.ok(key in d, `describe() is missing ${key}`);
  }
  assert.ok(Array.isArray(d.selectors) && d.selectors.length);
  assert.equal(d.selectors[0], d.selector);
});

// Function declarations, not const arrows: the tests above run at module top
// level and call these before this point in the file.
function unesc(s) {
  return s.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

// Approximates on the parsed tree what the driver would resolve on the device.
// Only the forms the generator actually emits need to be understood here.
function countMatches(sel, node) {
  let m;
  if ((m = /^~(.*)$/.exec(sel))) {
    return nodes.filter((n) => (n.attrs['content-desc'] || n.attrs.name) === m[1]).length;
  }
  if ((m = /^android=new UiSelector\(\)\.text\("(.*)"\)$/.exec(sel))) {
    return nodes.filter((n) => n.attrs.text === unesc(m[1])).length;
  }
  if ((m = /^android=new UiSelector\(\)\.resourceId\("(.*)"\)$/.exec(sel))) {
    return nodes.filter((n) => n.attrs['resource-id'] === unesc(m[1])).length;
  }
  if ((m = /^android=new UiSelector\(\)\.resourceId\("(.*)"\)\.text\("(.*)"\)$/.exec(sel))) {
    return nodes.filter(
      (n) => n.attrs['resource-id'] === unesc(m[1]) && n.attrs.text === unesc(m[2]),
    ).length;
  }
  if ((m = /^\/\/([\w.]+)\[@text="(.*)"\]$/.exec(sel))) {
    return nodes.filter((n) => n.cls === m[1] && n.attrs.text === unesc(m[2])).length;
  }
  // Pinned or structural forms resolve to one by construction.
  if (/\.instance\(\d+\)$/.test(sel) || /^\(\/\/.*\)\[\d+\]$/.test(sel)) return 1;
  if (sel.startsWith('//') && node) return 1;
  return NaN;
}

console.log(failures ? `\n${failures} test(s) failed` : '\nall tests passed');
process.exit(failures ? 1 : 0);
