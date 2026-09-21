'use strict';

// The  half of the real-browser recorder.
//
// `installRecorder` is handed to Playwright's page.addInitScript(), which
// serialises it to source and runs it in the target page before any of that
// page's own scripts — on every navigation, on every origin. It therefore has
// NO access to this module: every helper it needs is declared inside it.
//
// It is a deliberate mirror of locatorFor() and the capture-phase listeners in
// src/TestRunner.jsx. Both engines must emit identical step objects, or a test
// recorded against a real browser would not replay in the  engine (and
// vice versa). Change the locator strategy in one, change it in both.
//
// Events leave the page through window.__trEvent, an exposeBinding installed by
// routes/testrunner.js. The page always reports; whether a report becomes a step
// is decided server-side. That matters because a fresh document resets every
//  flag, so "am I recording?" cannot live here.
function installRecorder() {
  if (window !== window.top) return; // main frame only, as in the iframe engine
  if (window.__trInstalled) return;
  window.__trInstalled = true;
  if (typeof window.__trEvent !== 'function') return; // binding absent — nothing to talk to

  // Assert mode is re-applied by the server on every load; default off.
  if (typeof window.__trAssert !== 'boolean') window.__trAssert = false;

  var UPLOAD_INLINE_LIMIT = 256 * 1024;

  function attrEsc(v) {
    return String(v).replace(/"/g, '\\"');
  }
  function normText(s) {
    return (s || '').trim().replace(/\s+/g, ' ');
  }

  function locatorFor(el) {
    if (!el || el.nodeType !== 1) return { selector: null, selectors: [], tag: null, text: '' };
    var doc = el.ownerDocument;
    var esc =
      window.CSS && window.CSS.escape
        ? window.CSS.escape
        : function (s) {
            return String(s).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
          };
    var tag = el.tagName.toLowerCase();
    var selectors = [];

    var add = function (sel) {
      if (!sel || selectors.indexOf(sel) !== -1) return;
      try {
        if (doc.querySelector(sel) === el) selectors.push(sel);
      } catch (e) {
        /* invalid selector — skip */
      }
    };

    var scope = el.parentElement && el.parentElement.closest('[data-testid]');
    var scopeSel = scope ? '[data-testid="' + attrEsc(scope.getAttribute('data-testid')) + '"]' : null;

    if (el.id) add('#' + esc(el.id));
    var testid = el.getAttribute('data-testid');
    if (testid) {
      add('[data-testid="' + attrEsc(testid) + '"]');
      if (scopeSel) add(scopeSel + ' [data-testid="' + attrEsc(testid) + '"]');
    }
    var aria = el.getAttribute('aria-label');
    if (aria) add(tag + '[aria-label="' + attrEsc(aria) + '"]');
    var nm = el.getAttribute('name');
    if (nm) add(tag + '[name="' + attrEsc(nm) + '"]');
    var ph = el.getAttribute('placeholder');
    if (ph) add(tag + '[placeholder="' + attrEsc(ph) + '"]');
    if (tag === 'a' && el.getAttribute('href')) add('a[href="' + attrEsc(el.getAttribute('href')) + '"]');

    var classes = [];
    var cl = el.classList || [];
    for (var ci = 0; ci < cl.length; ci++) {
      if (cl[ci].length < 40 && !/[0-9a-f]{6,}/i.test(cl[ci])) classes.push(cl[ci]);
    }
    if (classes.length) add(tag + '.' + classes.map(esc).join('.'));

    var segment = function (node) {
      var sel = node.tagName.toLowerCase();
      var parent = node.parentElement;
      if (parent) {
        var sibs = [];
        for (var k = 0; k < parent.children.length; k++) {
          if (parent.children[k].tagName === node.tagName) sibs.push(parent.children[k]);
        }
        if (sibs.length > 1) sel += ':nth-of-type(' + (sibs.indexOf(node) + 1) + ')';
      }
      return sel;
    };

    if (scopeSel) {
      var rel = [];
      for (var n1 = el; n1 && n1 !== scope; n1 = n1.parentElement) rel.unshift(segment(n1));
      if (rel.length) add(scopeSel + ' > ' + rel.join(' > '));
    }

    var path = [];
    for (var n2 = el; n2 && n2.nodeType === 1 && n2.tagName !== 'BODY'; n2 = n2.parentElement) {
      path.unshift(segment(n2));
    }
    if (path.length) add('body > ' + path.join(' > '));

    return {
      selector: selectors[0] || null,
      selectors: selectors,
      tag: tag,
      text: normText(el.textContent).slice(0, 80),
    };
  }

  function describeEl(el) {
    var aria = el.getAttribute('aria-label');
    var txt = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    return aria || el.getAttribute('placeholder') || txt || el.tagName.toLowerCase();
  }

  // Every report carries the URL as seen *at that moment*: pushState routing
  // fires no load event, so a value captured once per document would stamp later
  // steps with a stale page.
  function send(step) {
    try {
      step.path = location.pathname + location.search;
      step.href = location.href;
      window.__trEvent(step);
    } catch (e) {
      /* page tearing down mid-event */
    }
  }

  function sendUpload(el, file) {
    var base = locatorFor(el);
    base.action = 'upload';
    base.name = file.name;
    base.mime = file.type;
    base.size = file.size;
    base.label = file.name;
    if (file.size > UPLOAD_INLINE_LIMIT) {
      base.truncated = true;
      send(base);
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      base.dataUrl = reader.result;
      send(base);
    };
    reader.onerror = function () {
      base.truncated = true;
      send(base);
    };
    reader.readAsDataURL(file);
  }

  // Aiming, as opposed to recording. `POST /session/:id/pick` calls this to ask
  // what is at a point in the viewport without clicking it — that is how a hover
  // target is chosen on this engine, where the user is looking at a screenshot
  // and there is no DOM on their side to inspect. Exposed from in here because
  // locatorFor cannot be reached from outside the closure, and re-implementing
  // it in the route is exactly the drift the header warns about.
  window.__trPick = function (x, y) {
    var el = document.elementFromPoint(x, y);
    if (!el) return null;
    var interactive = el.closest
      ? el.closest("button, a, [role='button'], [role='menuitem'], li, [class*='menu'], [class*='nav']")
      : null;
    var target = interactive || el;
    var step = locatorFor(target);
    step.label = describeEl(target);
    return step;
  };

  // The same bundle for an element already in hand, rather than one found by
  // coordinates. Self-healing needs this: once a loosened selector has matched,
  // the locator written back into the test must be re-derived from the element
  // itself — going via elementFromPoint would describe whatever happens to be
  // painted over its centre instead.
  window.__trLocator = function (el) {
    if (!el) return null;
    var step = locatorFor(el);
    step.label = describeEl(el);
    return step;
  };

  // What an assertion should actually be about.
  //
  // A click lands on whatever is painted under the pointer, which on a modern
  // form is the wrapper around the field rather than the field. Asserting on
  // that wrapper records `exists: div` -- a step that passes on any page at all
  // and checks nothing. Observed on Agoda's sign-in, where clicking the Email
  // box produced exactly that.
  //
  // So: a text-less element wrapping exactly one control is treated as that
  // control's box, and the control is what gets asserted. Both halves of the
  // condition matter. "Exactly one" keeps a whole form from collapsing onto
  // whichever field it happens to contain, and "text-less" keeps an element you
  // meant to assert the text of -- a labelled row, an error banner -- as
  // itself; its own text is the more specific check, so it wins.
  //
  // The  engine applies the same rule in TestRunner.jsx. It is written
  // twice because this file is injected into the page under test and has to
  // stand alone, and the two must agree: a test recorded in one engine replays
  // in the other.
  function assertTarget(t) {
    if (!t || !t.querySelectorAll) return t;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return t;
    if (normText(t.textContent)) return t;
    var controls = t.querySelectorAll('input, textarea, select');
    return controls.length === 1 ? controls[0] : t;
  }

  document.addEventListener(
    'click',
    function (e) {
      // Assert mode: describe the clicked element instead of acting on it.
      //
      // preventDefault is what makes this "describe, don't act" -- and it also
      // cancels the focus a click on a field would have given it, which is why
      // nothing can be typed while assert mode is on. That is the intended
      // behaviour, not a bug: pause asserting to type.
      if (window.__trAssert) {
        e.preventDefault();
        e.stopPropagation();
        var t = assertTarget(e.target);
        var isForm = /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
        var expected = isForm ? t.value : normText(t.textContent).slice(0, 80);
        var a = locatorFor(t);
        a.action = 'assert';
        a.assertType = expected ? (isForm ? 'value' : 'text') : 'exists';
        a.expected = expected;
        a.label = expected || describeEl(t);
        send(a);
        return;
      }
      var el = e.target.closest
        ? e.target.closest(
            "button, a, [role='button'], input[type='submit'], input[type='checkbox'], input[type='radio']",
          )
        : null;
      if (!el) return;
      var step = locatorFor(el);
      if (el.tagName === 'INPUT' && (el.type === 'checkbox' || el.type === 'radio')) {
        step.action = 'check';
        step.value = el.checked;
      } else {
        step.action = 'click';
      }
      step.label = describeEl(el);
      send(step);
    },
    true,
  );

  document.addEventListener(
    'input',
    function (e) {
      var el = e.target;
      // File inputs are handled on `change` as an upload — their value is a
      // read-only "C:\fakepath\…" that can never be replayed.
      if (el.tagName === 'INPUT' && el.type === 'file') return;
      if (
        (el.tagName === 'INPUT' && el.type !== 'checkbox' && el.type !== 'radio') ||
        el.tagName === 'TEXTAREA'
      ) {
        var step = locatorFor(el);
        step.action = 'fill';
        step.value = el.value;
        step.label = describeEl(el) || el.placeholder;
        step.coalesce = true; // server folds consecutive fills of one field
        send(step);
      }
    },
    true,
  );

  document.addEventListener(
    'change',
    function (e) {
      var el = e.target;
      if (el.tagName === 'SELECT') {
        var opt = el.options[el.selectedIndex];
        var step = locatorFor(el);
        step.action = 'select';
        step.value = el.value;
        step.label = (opt && opt.text) || el.value;
        send(step);
        return;
      }
      if (el.tagName === 'INPUT' && el.type === 'file' && el.files && el.files[0]) {
        sendUpload(el, el.files[0]);
      }
    },
    true,
  );

  // Client-side route changes so the server can keep the address bar honest and
  // record navigation between steps. Reported as a marker, never a step itself.
  if (!window.__trRoutePatched) {
    window.__trRoutePatched = true;
    ['pushState', 'replaceState'].forEach(function (method) {
      var orig = history[method];
      history[method] = function () {
        var result = orig.apply(this, arguments);
        send({ action: '__route' });
        return result;
      };
    });
    window.addEventListener('popstate', function () {
      send({ action: '__route' });
    });
  }
}

module.exports = { installRecorder };
