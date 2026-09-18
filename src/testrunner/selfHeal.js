// ---- self-healing locators ------------------------------------------------
//
// A recorded step carries an ordered list of selectors, each verified against
// the live element at record time. Playback tries them in turn and then falls
// back to the element's text. When all of that fails the step is dead, and the
// usual cause is not that the element is gone — it is that the markup around it
// moved: a <button> became an <a>, a wrapper added a class, an id grew a
// generated suffix.
//
// Healing is one more escalation past the recorded locators: loosen what was
// recorded until something matches again. It runs ONLY after every recorded
// selector has failed, so a healthy test pays nothing for it.
//
// Two rules keep a heal from being worse than the failure it replaces:
//
//   * A healed selector must match EXACTLY ONE element. A loosened selector is
//     by definition broader than what was recorded, and one that matches nine
//     elements would silently act on the wrong one — turning a real regression
//     into a green run, which is the only outcome worse than a red one.
//   * A heal is never silent. It is reported on the step, counted in the run's
//     verdict, and the locator it writes back is re-derived from the element it
//     actually found rather than being the loosened guess itself.
//
// Shared by both engines — the  one in src/TestRunner.jsx and the
// Playwright one in src/Backend/testrunner/replay.js — so a test heals the same
// way whichever runs it. CommonJS for the same reason ./spec.js is: the backend
// requires it directly from Node.

// One attribute clause: [name="value"], or [name] on its own.
const ATTR = /\[[a-zA-Z_:-][\w:.-]*(?:[~|^$*]?=(?:"[^"]*"|'[^']*'|[^\]]*))?\]/g;

// The tag at the head of a simple selector, if there is one: "button[x]" -> "button".
const HEAD_TAG = /^([a-zA-Z][a-zA-Z0-9]*)(?=[.#[])/;

// Attributes worth loosening a selector down to. Each identifies an element by
// what it IS rather than by where it sits, which is exactly the property that
// survives a markup reshuffle. `id` and `data-testid` are deliberately absent:
// a recorded selector already tries those on their own, so loosening one would
// only ever reproduce a candidate that has just failed.
const STABLE_ATTRS = ["aria-label", "name", "placeholder", "href", "title", "alt", "type", "role"];

// How much of the recorded identity each strategy keeps, most first. A caller
// takes the first candidate that matches exactly one element, so this is the
// order in which a heal is preferred — never a set of rival guesses.
const HEAL_RANK = { detached: 0, "attr-tag": 1, attr: 2, "id-stem": 3, class: 4 };

// An unranked strategy sorts last. Written out rather than with ??, which the
// bundler's own parser trips over in a CommonJS module shared with Node — and
// || cannot stand in here, because rank 0 is a real rank.
const rankOf = (id) => (id in HEAL_RANK ? HEAL_RANK[id] : 9);

const attrName = (clause) => {
  const m = /^\[([a-zA-Z_:-][\w:.-]*)/.exec(clause);
  return m ? m[1] : null;
};

// The last simple selector in a combinator chain: the thing being targeted,
// with the path that led to it dropped. "div > form > button[name=go]" becomes
// "button[name=go]" — which is what survives when the page is re-nested.
//
// Scanned rather than split on a regex: an attribute value may contain both
// spaces and combinators, so [aria-label="Save changes"] split on whitespace
// comes apart in the middle of the one part that identifies the element. Only
// unquoted, depth-zero whitespace and combinators separate segments.
const lastSegment = (sel) => {
  const str = String(sel);
  let depth = 0;
  let quote = null;
  let start = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (quote) {
      if (c === quote && str[i - 1] !== '\\') quote = null;
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === '[' || c === '(') depth++;
    else if (c === ']' || c === ')') depth--;
    else if (depth === 0 && (c === ' ' || c === '>' || c === '+' || c === '~')) start = i + 1;
  }
  return str.slice(start).trim() || str;
};

// The stem of a generated id: "user-row-4821-name" -> "user-row". Ids the app
// numbers per record are a recording's most common slow death — the selector
// was correct on the day and names a row that no longer exists.
// Only ids that actually carry a number have a stem: without one the stem is
// the whole id, and a prefix match on it is strictly broader than the exact
// match that has already failed — so it could only ever find a different
// element.
const idStem = (id) => {
  const str = String(id);
  if (!/\d/.test(str)) return null;
  const stem = str.split(/\d+/)[0].replace(/[-_:.]+$/, "");
  return stem.length >= 3 ? stem : null;
};

/**
 * Loosened selectors to try once every recorded locator has failed, in
 * descending order of how much of the original identity they keep.
 *
 * Derived only from what the step already recorded — nothing here guesses at
 * the page. A caller must still require each one to match exactly one element
 * before acting on it.
 *
 * @param {object} st a recorded step.
 * @returns {Array<{id: string, why: string, selector: string}>} candidates,
 *   de-duplicated, never including a selector the step already tried.
 */
function healCandidates(st) {
  const recorded = ((st && st.selectors && st.selectors.length ? st.selectors : [st && st.selector]) || [])
    .filter(Boolean)
    .map(String);
  const out = [];
  const seen = new Set(recorded);
  const add = (id, why, selector) => {
    if (!selector || seen.has(selector)) return;
    seen.add(selector);
    out.push({ id, why, selector });
  };

  recorded.forEach((sel) => {
    const target = lastSegment(sel);
    const clauses = target.match(ATTR) || [];

    // 1. The identifying attribute, with the tag and the path around it dropped.
    //    Survives <button> becoming <a>, and any amount of re-nesting.
    clauses
      .filter((c) => STABLE_ATTRS.includes(attrName(c)))
      .forEach((c) => {
        add("attr", `matched on ${attrName(c)} alone — the tag or the path around it changed`, c);
        const tag = HEAD_TAG.exec(target);
        // Same attribute, tag kept: narrower than the bare clause, so it is
        // offered first when the path is what moved and the tag did not.
        if (tag) add("attr-tag", `matched on ${tag[1]} + ${attrName(c)} — the path around it changed`, `${tag[1]}${c}`);
      });

    // 2. The whole target, cut loose from the path that led to it.
    if (target !== sel && /[.#[]/.test(target)) {
      add("detached", "matched the element itself — the path to it changed", target);
    }

    // 3. A generated id, matched by its stem.
    const idMatch = /^#([\w-]+)/.exec(target) || /\[id="([^"]+)"\]/.exec(target);
    const stem = idMatch && idStem(idMatch[1]);
    if (stem) add("id-stem", `matched on the id stem "${stem}" — the generated part changed`, `[id^="${stem}"]`);

    // 4. One class where several were recorded: a state class ("is-active")
    //    coming or going invalidates the whole chain.
    const classes = target.match(/\.[\w-]+/g) || [];
    if (classes.length > 1) {
      const tag = HEAD_TAG.exec(target);
      add(
        "class",
        `matched on ${classes[0]} alone — the other classes on it changed`,
        `${tag ? tag[1] : ""}${classes[0]}`,
      );
    }
  });

  // Stable within a rank, so a candidate derived from the first (most
  // specific) recorded selector is still tried before the same strategy
  // applied to a weaker one.
  return out
    .map((c, i) => ({ c, i }))
    .sort((a, b) => rankOf(a.c.id) - rankOf(b.c.id) || a.i - b.i)
    .map((x) => x.c);
}

/**
 * Heal a step against a live document: the first loosened candidate that
 * matches exactly one element wins.
 *
 * The uniqueness rule is the whole safety of this. Every candidate is by
 * construction broader than the recorded selector that just failed, so one
 * that matches several elements tells us nothing about WHICH of them the
 * recording meant — and acting on the wrong one turns a real regression into
 * a green run.
 *
 * @param {Document} doc the page under test.
 * @param {object} st the recorded step whose locators have all failed.
 * @returns {{el: Element, id: string, why: string, selector: string}|null}
 */
function healInDocument(doc, st) {
  for (const cand of healCandidates(st)) {
    let hits;
    try {
      hits = doc.querySelectorAll(cand.selector);
    } catch (err) {
      continue; // loosening produced something that does not parse
    }
    // Object.assign, not spread — and this is not a style preference. Writing
    // `{ el: hits[0], ...cand }` here makes the production bundle throw "ES
    // Modules may not assign module.exports" against `module.exports` at the
    // bottom of this file, while the bundle is still evaluating. That aborts
    // the whole bundle, so the entire app renders nothing at all — an empty
    // #root and one console error naming a module id, pointing nowhere near
    // here. Verified by A/B: restoring the spread reproduces the dead app and
    // even the same bundle hash, swapping it back fixes it.
    //
    // Note the trigger is webpack's own handling, not Babel's: this file
    // compiles to clean CommonJS with no injected imports under either form,
    // so the usual "a spread helper is imported as ESM" explanation does not
    // hold and the precise mechanism inside webpack is not pinned down. What
    // is certain is the effect. ./testdata.js and ./spec.js carry the same
    // no-spread rule; .eslintrc enforces it now so this cannot regress
    // silently again.
    if (hits.length === 1) return Object.assign({ el: hits[0] }, cand);
  }
  return null;
}

// How a step ended up matching. `recorded` is the healthy path and is never
// reported; everything else is a heal and is.
const VIA_RECORDED = "recorded";
const VIA_TEXT = "text";

/**
 * The hint describing a match that came from the text fallback, for a caller
 * that has found the element itself and only needs to say how.
 *
 * A function rather than the bare constant because this module is required
 * from Node by the backend engine AND bundled for the browser, and the
 * bundler's CommonJS interop resolves exported functions but not exported
 * string constants — so a constant crossing that boundary breaks the build
 * while a function does not. Duplicating the literal on the far side would
 * work too, and would be the version that silently drifts.
 */
const textMatch = () => ({ via: VIA_TEXT });

/**
 * One line saying what a heal did, for the report and the step's tooltip.
 *
 * @param {{via: string, why?: string, selector?: string}} heal
 */
function describeHeal(heal) {
  if (!heal) return "";
  if (heal.via === VIA_TEXT)
    return "no recorded selector matched — found by the element's text instead";
  return heal.why || `matched by a loosened selector (${heal.selector})`;
}

module.exports = {
  VIA_RECORDED,
  VIA_TEXT,
  describeHeal,
  textMatch,
  healCandidates,
  healInDocument,
  idStem,
  lastSegment,
};
