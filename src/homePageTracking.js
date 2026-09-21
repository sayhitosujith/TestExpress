// What the public landing page reports about itself.
//
// Its own module rather than logAction calls scattered through HomePage.js, for
// two reasons. The vocabulary -- three action names, the ordered section list,
// the call-to-action ids -- has to be identical on the page that writes it and
// in the Super Admin panel that reads it back, and one module is how that stays
// true. And every call here shares one failure contract: a landing page must
// never break, stall or lose a navigation because an audit row could not be
// written, so nothing is awaited and nothing throws.
//
// The rows land in the same action_logs table as the rest of the audit trail --
// see src/Backend/actionsDb.js. They are aggregated by
// src/Backend/routes/homePageAnalytics.js, which is behind a Super Admin token;
// writing them is open, because the visitors being counted are anonymous.
import { logAction } from "./api/actions";

/** The three rows this page writes. Matched verbatim by the summary queries. */
export const HOMEPAGE_VIEW = "homepage_view";
export const HOMEPAGE_CTA = "homepage_cta";
export const HOMEPAGE_SECTION = "homepage_section";

/**
 * The page's sections, top to bottom.
 *
 * The order is the whole point: reach is a funnel, so the panel reports these
 * in the order a visitor meets them rather than ranked by how many got there.
 * Ranking would hide the only thing worth knowing -- where people stop.
 */
export const HOMEPAGE_SECTIONS = [
  { id: "hero", label: "Hero" },
  { id: "facts", label: "Fact strip" },
  { id: "features", label: "Features" },
  { id: "export", label: "Export banner" },
  { id: "engines", label: "Engines" },
  { id: "workflow", label: "Workflow" },
  { id: "built_on", label: "Built on" },
  { id: "plans", label: "Plans" },
  { id: "faq", label: "Questions" },
  { id: "cta", label: "Closing call to action" },
  { id: "footer", label: "Footer" },
];

/**
 * Readable names for the tracked calls to action.
 *
 * A map rather than a list because the panel has to render whatever is in the
 * table, including an id from a button that has since been renamed or removed.
 * Anything unknown is prettified rather than dropped -- see ctaLabel.
 */
const CTA_LABELS = {
  nav_brand: "Header — wordmark",
  nav_menu: "Header — menu link",
  nav_open_recorder: "Header — Open Recorder",
  mobile_menu: "Header — open menu",
  drawer_create_account: "Drawer — Create account",
  drawer_open_recorder: "Drawer — Open Recorder",
  hero_register: "Hero — Register for free",
  feature_tile: "Features — a capability tile",
  export_try: "Export banner — Try the export",
  plan_choose: "Plans — chose a plan",
  cta_register: "Closing band — Register for free",
  cta_sign_in: "Closing band — Sign in",
  faq_open: "Questions — opened one",
  floating_sign_in: "Floating bar — Sign in",
  floating_open_recorder: "Floating bar — Open the Recorder",
  back_to_top: "Back to top",
};

/**
 * A call-to-action id as a person should read it.
 *
 * @param {string} id the recorded target.
 * @returns {string} its label, or the id with its underscores opened out.
 */
export const ctaLabel = (id) =>
  CTA_LABELS[id] || String(id || "unknown").replace(/_/g, " ");

/**
 * The current visit, or null before the page has reported itself.
 *
 * Module scope rather than component state on purpose: a click handler deep in
 * the page needs it without the id being threaded through every component that
 * happens to sit between them.
 */
let visitId = null;

/** Sections already reported for this visit, so reach counts a visitor once. */
const reached = new Set();

const newVisitId = () =>
  Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);

/**
 * Writes one row, and never lets the attempt reach the visitor.
 *
 * Silent rather than console.warn, which is what the signed-in screens do: this
 * page is served to the public with a backend that may not be running at all,
 * and a marketing page that fills the console with failed audit writes looks
 * broken to exactly the developer audience it is addressed to.
 */
const send = (action, payload) => {
  logAction(action, { ...payload, visitId }).catch(() => {});
};

/**
 * Reports one visit, and opens the visit every later event is attributed to.
 *
 * Idempotent for the life of the page load. React.StrictMode mounts the page
 * twice in development and the router can remount it on a same-page navigation;
 * neither is a second person arriving, and a duplicate row here would inflate
 * every rate the panel derives from this count. A genuine second visit is a
 * fresh page load, which is a fresh module and so a fresh id.
 */
export function trackHomePageView() {
  if (visitId) return;
  visitId = newVisitId();
  reached.clear();
  send(HOMEPAGE_VIEW, {
    path: window.location.pathname,
    // Where they came from and what they are reading it on. Both are on the
    // view row rather than in a separate one: they describe the visit, and a
    // second row would have to be joined back to it to mean anything.
    referrer: document.referrer || null,
    viewport: window.innerWidth,
  });
}

/**
 * Reports a click on a call to action.
 *
 * Every click is recorded, including a second click on the same button: the
 * panel reports both the raw count and how many distinct visits produced it,
 * and it can only do that if the repeats are actually written down.
 *
 * @param {string} target one of the ids in CTA_LABELS.
 * @param {object} [detail] anything worth keeping about this particular click,
 *   such as which capability tile was pressed.
 */
export function trackHomePageCta(target, detail = {}) {
  send(HOMEPAGE_CTA, { target, ...detail });
}

/**
 * Reports that a section came into view, once per visit.
 *
 * Deduplicated here rather than in SQL because scrolling back up a page is
 * normal and would otherwise read as extra reach.
 *
 * @param {string} section an id from HOMEPAGE_SECTIONS.
 */
export function trackHomePageSection(section) {
  if (!section || reached.has(section)) return;
  reached.add(section);
  send(HOMEPAGE_SECTION, { section });
}
