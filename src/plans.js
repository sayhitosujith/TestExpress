import { PAYMENT_OPTIONS } from "./constants";
import { getPlans } from "./api/plans";

/**
 * What each plan includes, and the one question the rest of the app asks about
 * it: may this account use this capability?
 *
 * The plans themselves come from the database, through /api/plans — the same
 * catalogue the registration form renders and the server validates against, so
 * a plan added there is a plan here with no second list to keep in step.
 * paymentOptions.json is the floor under it: it seeds the table, and it answers
 * before the first fetch and on a machine with no backend. This module adds the
 * meaning — which capabilities each tier introduces, and what to say when one
 * is refused.
 *
 * Two rules worth knowing before reading anything below.
 *
 * **Order is meaning.** A plan's `adds` names only what that tier introduces;
 * a plan includes its own `adds` and every earlier plan's. That is what tiers
 * are, and it keeps the catalogue free of the same six ids written three times —
 * but it does mean reordering the plans changes who can do what.
 *
 * **Absence is the first plan.** An account with no plan, or one carrying a
 * value no longer offered, is treated as being on the first plan rather than
 * refused everything. Sessions predate this field, and signing in yesterday is
 * not a reason to lose the recorder today.
 */

/**
 * Every capability a plan can carry.
 *
 * `label` is what the Subscriptions panel lists. `refusal` is what the blocked
 * control says when it is pointed at — written as a sentence about the feature
 * rather than about the plan, because a tooltip reading "upgrade" tells you
 * nothing you did not already work out from the control being grey.
 */
export const CAPABILITIES = [
  {
    id: "record",
    label: "Record & replay in this browser",
    refusal: "Recording needs a plan.",
  },
  {
    id: "organise",
    label: "Projects, suites, tags and assertions",
    refusal: "Organising test cases needs a plan.",
  },
  {
    id: "export",
    label: "Playwright / page-object export",
    refusal: "Exporting a spec needs a plan.",
  },
  {
    id: "reports",
    label: "Run history and failure evidence",
    refusal: "Run reports need a plan.",
  },
  {
    id: "browsers",
    label: "Real browsers (Chromium, Firefox, WebKit) and device emulation",
    refusal: "Driving a real browser on the backend is not part of this plan.",
  },
  {
    id: "heal",
    label: "Self-healing locators",
    refusal: "Self-healing locators are not part of this plan.",
  },
  {
    id: "data",
    label: "Test data sets and row-driven runs",
    refusal: "Named test data is not part of this plan.",
  },
  {
    id: "schedule",
    label: "Scheduled runs",
    refusal: "Scheduled runs are not part of this plan.",
  },
  {
    id: "cicd",
    // Names the parallel run as well as the file, because the toggle that
    // chooses it is gated on this same id — see Suite execution in User
    // Settings. A label that mentioned only the file would leave the one
    // capability people actually compare tiers over unlisted on the pricing
    // grid, which reads that label verbatim.
    label: "CI pipeline generation, parallel or sequential",
    refusal: "Generating a CI pipeline is not part of this plan.",
  },
  {
    id: "extent",
    label: "Downloadable Extent-style report",
    refusal: "The downloadable report is not part of this plan.",
  },
  {
    id: "android",
    label: "Native Android recording over Appium",
    refusal: "Recording against an Android device is not part of this plan.",
  },
  {
    id: "team",
    label: "Team seats — members under one account",
    refusal: "Team seats are not part of this plan.",
  },
  {
    id: "audit",
    label: "Activity log for your own account and its members",
    refusal: "The activity log is not part of this plan.",
  },
  {
    id: "apitokens",
    label: "API tokens, so CI can drive the runner without a browser",
    refusal: "API tokens are not part of this plan.",
  },
  {
    id: "apitesting",
    label: "API request steps — call an endpoint and assert on the response",
    refusal: "API request steps are not part of this plan.",
  },
  {
    id: "performance",
    label: "Performance testing — load-test multiple URLs at once with JMeter",
    refusal: "Performance testing is not part of this plan.",
  },
  {
    id: "support",
    label: "Named support contact",
    refusal: "Priority support is not part of this plan.",
  },
];

const CAPABILITY_BY_ID = new Map(CAPABILITIES.map((c) => [c.id, c]));

// ---- where the catalogue comes from --------------------------------------
// The database, through /api/plans (see ./api/plans). Cached here so that every
// screen reads it synchronously — a select cannot await — and so a reload has a
// catalogue before the first request comes back. paymentOptions.json is the
// floor under both: it ships with the app, it is what seeds the table, and it
// is what answers before the first fetch and on a machine with no backend.
const CACHE_KEY = "plans.catalogue";

const usable = (list) =>
  Array.isArray(list) && list.length && list.every((p) => p && p.value);

const fromCache = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY));
    return usable(parsed) ? parsed : null;
  } catch {
    return null; // unreadable storage costs the cache, never the catalogue
  }
};

/**
 * The plans, in tier order. The first is what an unknown plan falls back to.
 *
 * Deliberately not a frozen constant any more: the catalogue is editable, and a
 * module that captured it at import time would go on gating against last
 * week's plans until the tab was reloaded. Read it through the helpers below
 * rather than binding it — `import { PLANS }` takes a snapshot.
 */
export let PLANS = fromCache() || PAYMENT_OPTIONS;

/**
 * The plan an account with no recognised one is treated as being on.
 *
 * A function, not a constant: the catalogue can be re-ordered, and a value
 * captured at import time would go on naming a plan that is no longer the first.
 */
export const defaultPlan = () => PLANS[0].value;

/**
 * Adopts a catalogue read from the server, and remembers it for next time.
 *
 * Ignores anything unusable rather than throwing: a catalogue that arrived
 * malformed is a reason to keep the one that works, not to leave the app with
 * no plans at all.
 *
 * @param {object[]} plans the catalogue, in tier order.
 * @returns {object[]} whatever is now in force.
 */
export const adoptPlans = (plans) => {
  if (!usable(plans)) return PLANS;
  PLANS = plans;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(plans));
  } catch {
    /* the cache is an optimisation; the fetch will fill it again next boot */
  }
  return PLANS;
};

/**
 * Reads the catalogue from the server and adopts it.
 *
 * Called once at boot (see src/index.js). Never rejects: the cache or the
 * shipped default is already in force, and a backend that is down or absent is
 * a reason to keep using them rather than to fail the page that asked.
 *
 * @returns {Promise<object[]>} whatever catalogue is in force afterwards.
 */
export const refreshPlans = async () => {
  try {
    const { plans } = await getPlans();
    return adoptPlans(plans);
  } catch (err) {
    console.warn("[plans] using the cached catalogue:", err.message);
    return PLANS;
  }
};

/** The plan record for a name, or the first plan when it names nothing. */
export const planFor = (name) =>
  PLANS.find((p) => p.value === name) || PLANS[0];

// ---- who a plan is for ---------------------------------------------------
// Not the same question as what it costs, and worth its own field rather than
// being inferred from the capabilities: "does this tier include team seats" is
// a fact about the software, "is this sold to a company" is a fact about the
// customer, and a cheap tier could one day be either.

/** The two kinds a plan can be. Individual is the default and the floor. */
export const PLAN_KINDS = [
  { id: "individual", label: "Individual", hint: "One person, one account" },
  { id: "corporate", label: "Corporate", hint: "An organisation, with seats for its people" },
];

/**
 * What kind of customer a plan is sold to.
 *
 * @param {object|string} plan a plan record, or a plan name.
 * @returns {"individual"|"corporate"}
 */
export const planKind = (plan) => {
  const p = typeof plan === "string" ? planFor(plan) : plan;
  return p && p.kind === "corporate" ? "corporate" : "individual";
};

/** Whether an account is on a corporate tier. For filtering a list of them. */
export const isCorporate = (account) => planKind(account && account.payment) === "corporate";

// ---- what a plan costs ---------------------------------------------------
// Three states, and they are not interchangeable: 0 is free, a number is a
// price, and null is "not priced yet". Only the middle one may be shown as a
// figure — rendering an unpriced plan as "₹0" would advertise it as free, which
// is a commercial claim nobody made.

/** How the interval reads after the amount. */
const PER = { month: "/mo", year: "/yr", once: " once" };

/**
 * A plan's price, as a person should read it.
 *
 * Formatted with Intl so the currency's own symbol and grouping are used —
 * ₹1,999 rather than INR 1999 — and falls back to "CODE 1999" on a runtime that
 * does not know the code, which is still readable.
 *
 * @param {object|string} plan a plan record, or a plan name.
 * @returns {string} "Free", a formatted price, or "Price on request".
 */
export const priceLabel = (plan) => {
  const p = typeof plan === "string" ? planFor(plan) : plan;
  if (!p) return "";
  if (p.price == null) return "Price on request";
  if (p.price === 0) return "Free";
  let amount;
  try {
    amount = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: p.currency || "INR",
      // Whole units unless the price genuinely has a fraction: "₹1,999" reads
      // as a price, "₹1,999.00" reads as an invoice line.
      minimumFractionDigits: Number.isInteger(p.price) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(p.price);
  } catch {
    amount = `${p.currency || ""} ${p.price}`.trim();
  }
  return amount + (PER[p.interval] || "");
};

/**
 * What a set of accounts is worth per month, by plan.
 *
 * The one thing a price is actually for. Annual prices are divided by twelve so
 * the total is comparable; a one-off price is left out of the recurring figure
 * entirely rather than smeared across it, and unpriced plans are counted as
 * accounts but not as money — with `unpriced` saying how many, so a total that
 * is missing a tier says so instead of quietly understating.
 *
 * @param {object[]} accounts records carrying `payment`.
 * @returns {{monthly: number, currency: string, unpriced: number,
 *   byPlan: object[]}}
 */
export const revenueOf = (accounts) => {
  const rows = PLANS.map((plan) => {
    const count = (accounts || []).filter((a) => a && a.payment === plan.value).length;
    const per =
      plan.price == null || plan.interval === "once"
        ? null
        : plan.interval === "year"
          ? plan.price / 12
          : plan.price;
    return { plan, count, monthly: per == null ? null : per * count };
  });
  return {
    monthly: rows.reduce((n, r) => n + (r.monthly || 0), 0),
    currency: (PLANS.find((p) => p.price) || PLANS[0]).currency || "INR",
    unpriced: rows.filter((r) => r.monthly == null && r.count > 0).reduce((n, r) => n + r.count, 0),
    byPlan: rows,
  };
};

/** A bare amount in a currency, for a total that is not one plan's price. */
export const money = (amount, currency = "INR") => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount)}`;
  }
};

/**
 * Every capability a plan carries: its own, and every earlier tier's.
 *
 * @param {string} name a plan name.
 * @returns {string[]} capability ids, in the order the tiers introduce them.
 */
export const capabilitiesOf = (name) => {
  const at = PLANS.findIndex((p) => p.value === planFor(name).value);
  return PLANS.slice(0, at + 1).flatMap((p) => (Array.isArray(p.adds) ? p.adds : []));
};

/** The capabilities a tier introduces, for a panel that lists them per plan. */
export const addedBy = (name) =>
  (planFor(name).adds || []).map((id) => CAPABILITY_BY_ID.get(id)).filter(Boolean);

/**
 * The plan a signed-in user is on.
 *
 * The session carries it (`payment` is in the server's SAFE_FIELDS), so this
 * needs no request — with the consequence the Super Admin page already warns
 * about: someone signed in when their plan changed keeps the old one until
 * they next sign in.
 *
 * @param {object|null} user the signed-in user, or null.
 * @returns {string} a plan name that is always one of PLANS.
 */
export const planOfUser = (user) => planFor(user && user.payment).value;

/**
 * May this user use this capability?
 *
 * A Super Admin may always. They administer the plans — including their own —
 * so a Super Admin locked out of an engine by the field they are there to edit
 * is a loop with no way out of it, and it would be their own screen that broke.
 *
 * @param {object|null} user the signed-in user, or null.
 * @param {string} capability one of CAPABILITIES' ids.
 * @returns {boolean}
 */
export const can = (user, capability) => {
  if (user && typeof user.role === "string" && user.role.trim().toLowerCase() === "super admin") {
    return true;
  }
  return capabilitiesOf(planOfUser(user)).includes(capability);
};

/** The cheapest plan that carries a capability, or null if nothing does. */
export const planNeededFor = (capability) => {
  const found = PLANS.find((p) => (p.adds || []).includes(capability));
  return found ? found.value : null;
};

/**
 * What a blocked control should say when pointed at.
 *
 * One sentence about the feature and one about the way out, so the tooltip
 * answers both "why is this grey" and "what do I do" without the reader having
 * to find a pricing page to work out which plan they are missing.
 *
 * @param {object|null} user the signed-in user, or null.
 * @param {string} capability one of CAPABILITIES' ids.
 * @returns {string|null} the message, or null when the user may use it.
 */
export const refusalFor = (user, capability) => {
  if (can(user, capability)) return null;
  const cap = CAPABILITY_BY_ID.get(capability);
  const needed = planNeededFor(capability);
  const why = (cap && cap.refusal) || "This is not part of your plan.";
  return needed
    ? `${why}\nYou are on ${planOfUser(user)} — this is part of ${needed}.`
    : why;
};
