// Exercises the shared healing rules against real markup drift: the recording
// is made against one DOM, the DOM then changes the way a refactor changes it,
// and the question is whether the step still finds the SAME element — and
// refuses to find one when it cannot be sure.
const { JSDOM } = require("jsdom");
const { healInDocument } = require("../src/testrunner/selfHeal.js");

let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  if (ok) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name + (detail ? "  -> " + detail : "")); }
};

const doc = (html) => new JSDOM(`<body>${html}</body>`).window.document;

console.log("\nheals when the drift is unambiguous:");

// 1. <button> became <a> — the aria-label is untouched.
{
  const d = doc(`<div class="bar"><a href="/save" aria-label="Save changes">Save</a></div>`);
  const st = { selectors: ['body > div > button[aria-label="Save changes"]'], tag: "button" };
  const hit = healInDocument(d, st);
  check("tag change (button -> a)", hit && hit.el.tagName === "A", hit ? hit.selector : "no match");
}

// 2. A wrapper appeared, so the structural path is wrong.
{
  const d = doc(`<main><section><form><input name="email" /></form></section></main>`);
  const st = { selectors: ['body > form > input[name="email"]'] };
  const hit = healInDocument(d, st);
  check("re-nesting (wrapper added)", hit && hit.el.getAttribute("name") === "email", hit ? hit.selector : "no match");
}

// 3. A generated id changed its number.
{
  const d = doc(`<ul><li id="row-99-name">Priya</li></ul>`);
  const st = { selectors: ["#row-42-name"] };
  const hit = healInDocument(d, st);
  check("generated id renumbered", hit && hit.el.id === "row-99-name", hit ? hit.selector : "no match");
}

// 4. A state class came off.
{
  const d = doc(`<div class="card"><span>x</span></div>`);
  const st = { selectors: ["div.card.is-open"] };
  const hit = healInDocument(d, st);
  check("state class removed", hit && hit.el.className === "card", hit ? hit.selector : "no match");
}

console.log("\nrefuses when it cannot be sure:");

// 5. THE important one: the loosened selector matches several elements. Acting
//    on any of them would be a guess, so it must decline and let the step fail.
{
  const d = doc(`
    <div class="row"><button aria-label="Delete">x</button></div>
    <div class="row"><button aria-label="Delete">x</button></div>
    <div class="row"><button aria-label="Delete">x</button></div>`);
  const st = { selectors: ['body > div:nth-of-type(2) > button[aria-label="Delete"]'] };
  check("ambiguous match declines", healInDocument(d, st) === null);
}

// 6. Genuinely gone: nothing to heal onto.
{
  const d = doc(`<p>the form is not on this page</p>`);
  const st = { selectors: ['form > button[aria-label="Save changes"]'] };
  check("element genuinely gone", healInDocument(d, st) === null);
}

// 7. An id with no digits must not become a prefix match, which would land on a
//    different element that merely starts the same way.
{
  const d = doc(`<button id="login-cancel">Cancel</button>`);
  const st = { selectors: ["#login"] };
  check("no digits, no id-stem guess", healInDocument(d, st) === null);
}

// 8. A step with nothing worth loosening produces nothing.
{
  const d = doc(`<div><span>hello</span></div>`);
  const st = { selectors: ["body > div > span"] };
  check("purely structural locator", healInDocument(d, st) === null);
}

console.log("\nprefers the narrowest repair:");

// 9. Both the tagged and untagged forms match; the tagged one is more specific
//    and must win, so the repair keeps as much of the original identity as it can.
{
  const d = doc(`<section><input name="email" /></section>`);
  const st = { selectors: ['body > form > input[name="email"]'] };
  const hit = healInDocument(d, st);
  check("tag kept where it still holds", hit && hit.selector === 'input[name="email"]', hit ? hit.selector : "no match");
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
