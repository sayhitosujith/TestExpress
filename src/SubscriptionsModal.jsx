import React, { useEffect, useMemo, useState } from "react";
import { CreditCardIcon, MagnifyingGlassIcon } from "@heroicons/react/24/solid";
// What each tier introduces, and what the recorder enforces from it. Read from
// the one module that answers that question everywhere else, so this panel
// cannot list a capability the app does not actually gate.
import {
  PLANS as PLAN_RECORDS,
  addedBy,
  adoptPlans,
  capabilitiesOf,
  CAPABILITIES,
  money,
  PLAN_KINDS,
  planFor,
  planKind,
  priceLabel,
  revenueOf,
} from "./plans";
// Who moved between plans, and when. Kept server-side because it is a fact
// about the account rather than about this browser — see Backend/planChangesDb.
import { getPlanChanges, savePlans } from "./api/plans";
// Opening a checkout on somebody's behalf, so an administrator can send them a
// link instead of asking them to find the plans page themselves.
import { openCheckout } from "./api/checkout";

/**
 * Who is on which plan, and the one control that moves them.
 *
 * Its own module for the same reason HomePageAnalyticsModal is one: SuperAdmin
 * administers accounts, and "how is the base distributed across the plans" is a
 * different question asked of the same rows. The panel owns no data — it is
 * handed the accounts the table already has, so it can never disagree with the
 * table about who exists or what they are paying.
 *
 * What a plan means is not decided here either: ./plans owns the tiers and the
 * capabilities each one introduces, and the recorder enforces them from the
 * same module. This panel reads that list so it can never advertise a
 * capability the app does not actually gate.
 *
 * One limit, stated on the panel rather than only here: a plan carries no price
 * and no renewal date, because no such field exists. Moving an account between
 * plans changes what they can do; it bills nobody.
 */

/**
 * Plan names, in tier order, read at call time.
 *
 * A function rather than a constant because the catalogue is editable from this
 * very panel: a list captured when the module loaded would go on showing the
 * plans as they were before the last save.
 */
const planNames = () => PLAN_RECORDS.map((o) => o.value);

/**
 * The plan a record is on, as one of the known plans or null.
 *
 * Null rather than a default: an account written before the field existed, or
 * imported with a plan that has since been renamed, is genuinely unassigned,
 * and quietly counting it as Free would overstate the smallest plan and hide
 * the records an administrator most needs to find.
 *
 * @param {object} account a row from the admin table.
 * @returns {string|null} the plan, or null when it is missing or unrecognised.
 */
const planOf = (account) => (planNames().includes(account.payment) ? account.payment : null);

/** The name to show, falling back to the email an account always has. */
const nameOf = (a) => [a.firstName, a.lastName].filter(Boolean).join(" ").trim() || a.email;

/** A count as a whole percent of the base, with no total meaning nothing. */
const share = (n, total) => (total ? Math.round((n / total) * 100) : 0);

/**
 * The colour a plan wears, by its position in the list rather than by name.
 *
 * Position, so a fourth plan added to paymentOptions.json gets a colour without
 * anyone editing this file — and a renamed plan keeps the one it had. Every
 * value clears 3:1 on both the light and the dark panel, which is what lets one
 * array serve both themes.
 */
const TONES = ["#0284c7", "#059669", "#7c3aed", "#b45309", "#be185d"];
const toneFor = (plan) => TONES[Math.max(0, planNames().indexOf(plan)) % TONES.length];

/**
 * One plan's share of the base: the count, the percentage, and a bar.
 *
 * A bar rather than a number alone because the question this panel answers is
 * comparative — "is anybody on Enterprise" is read off the length in a glance,
 * where three numbers have to be held in the head and divided.
 */
function PlanBar({ plan, count, total, tone }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-3">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{plan}</span>
        {/* The price beside the name, because "12 accounts on Pro" only means
            something once you know what Pro costs. */}
        <span className="text-[11px] text-gray-500 dark:text-gray-400">{priceLabel(plan)}</span>
        <span className="ml-auto text-2xl font-black tabular-nums" style={{ color: tone }}>
          {count}
        </span>
      </div>
      {/* aria-hidden: the bar is the same fact as the caption under it, and a
          progressbar announced here would read the number twice. */}
      <div
        aria-hidden="true"
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
      >
        <div
          className="h-full rounded-full"
          style={{ width: share(count, total) + "%", background: tone }}
        />
      </div>
      <div className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
        {share(count, total)}% of {total} account{total === 1 ? "" : "s"}
      </div>
    </div>
  );
}

/**
 * The Subscriptions panel.
 *
 * @param {{accounts: object[], busyKey: string|null,
 *   onPlan: (account: object, plan: string) => void, onClose: () => void}} props
 */
export default function SubscriptionsModal({ accounts, busyKey, onPlan, onClose }) {
  // The catalogue this panel is rendering, as state.
  //
  // Seeded from the module binding and replaced when the editor saves. State
  // rather than reading the binding on every render, because a module variable
  // is not something React can re-render on — the panel would be relying on
  // some other state change happening to repaint it at the same moment.
  const [catalogue, setCatalogue] = useState(PLAN_RECORDS);
  const PLANS = useMemo(() => catalogue.map((p) => p.value), [catalogue]);
  const [query, setQuery] = useState("");
  // "" is every plan. A filter rather than a second list: the rows below are
  // the same rows whichever plan is selected, and a per-plan section list would
  // repeat the search box once per plan.
  const [plan, setPlan] = useState("");

  React.useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // The plan history. Read once when the panel opens rather than polled: it
  // only changes when somebody uses this panel, and the row that changed it is
  // already on screen.
  const [changes, setChanges] = useState(null); // null = still reading
  const [historyError, setHistoryError] = useState(null);
  useEffect(() => {
    let live = true;
    getPlanChanges({ limit: 200 })
      .then((rows) => live && setChanges(rows))
      .catch((err) => {
        if (!live) return;
        setChanges([]);
        setHistoryError(err.message);
      });
    return () => {
      live = false;
    };
  }, []);

  // Editing the catalogue. Held apart from the plans in force until it is
  // saved: a half-typed price must not start being what the app charges, and
  // the panel below the editor goes on reporting what is actually live.
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveNote, setSaveNote] = useState(null);

  const openEditor = () => {
    setDraft(catalogue.map((p) => ({ ...p })));
    setSaveNote(null);
    setEditing(true);
  };

  const editPlan = (i, patch) =>
    setDraft((rows) => rows.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  const commit = async () => {
    setSaving(true);
    setSaveNote(null);
    try {
      const { plans: saved } = await savePlans(
        draft.map((p) => ({
          ...p,
          // An empty box is "not priced", not zero — see ./plans on why those
          // are different things.
          price: p.price === "" || p.price == null ? null : Number(p.price),
        })),
      );
      // The rest of the app reads the catalogue through ./plans, so what was
      // saved has to be put in force here rather than waiting for a reload.
      // Both: the module binding is what every other screen reads, and the
      // state is what repaints this one.
      adoptPlans(saved);
      setCatalogue(saved);
      setEditing(false);
      setSaveNote("Saved. New sign-ups see these prices immediately.");
    } catch (err) {
      setSaveNote(err.message);
    } finally {
      setSaving(false);
    }
  };

  // A payment link an administrator has just made, kept per account so the
  // row that produced it is the row that shows it.
  const [links, setLinks] = useState({});
  const [linking, setLinking] = useState(null);

  /**
   * Opens a checkout for an account and hands back a link to it.
   *
   * An administrator cannot pay on somebody's behalf — the payment page is the
   * payer's, and the card details are theirs. What can be done from here is the
   * useful half: create the checkout at the right plan and price, and produce a
   * URL to send. Anyone holding it can settle that one checkout, so it is
   * treated like a one-time credential: shown once, and copied rather than
   * left lying around the table.
   */
  const makeLink = async (account) => {
    const plan = planOf(account);
    if (!plan) return;
    setLinking(account.key);
    try {
      const { checkout } = await openCheckout({ email: account.email, plan });
      const url = window.location.origin + "/Checkout?token=" + encodeURIComponent(checkout.token);
      setLinks((prev) => ({ ...prev, [account.key]: url }));
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        // Clipboard refused — the link is on screen to copy by hand, which is
        // why it is rendered rather than only copied.
      }
    } catch (err) {
      setLinks((prev) => ({ ...prev, [account.key]: "error: " + err.message }));
    } finally {
      setLinking(null);
    }
  };

  // What the accounts on screen are worth per month. The one thing a price is
  // for, and it belongs here rather than in a spreadsheet: it moves whenever
  // somebody changes a plan two rows above it.
  const revenue = useMemo(() => revenueOf(accounts), [accounts]);

  const total = accounts.length;

  // One entry per plan plus, only when it is not empty, the unassigned bucket.
  // Empty is left out because a plan nobody is on is a zero worth seeing, while
  // "0 unassigned" is the healthy state and says nothing.
  const counts = useMemo(() => {
    const byPlan = new Map(PLANS.map((p) => [p, 0]));
    let none = 0;
    accounts.forEach((a) => {
      const p = planOf(a);
      if (p) byPlan.set(p, byPlan.get(p) + 1);
      else none += 1;
    });
    return { byPlan, none };
  }, [accounts, PLANS]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return accounts
      .filter((a) => {
        const p = planOf(a);
        if (plan === "__none__" ? p !== null : plan && p !== plan) return false;
        return !q || nameOf(a).toLowerCase().includes(q) || String(a.email).toLowerCase().includes(q);
      })
      .slice()
      .sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  }, [accounts, plan, query]);

  const chip = (value, label, count) => (
    <button
      key={value || "all"}
      type="button"
      onClick={() => setPlan(value)}
      aria-pressed={plan === value}
      className={
        "rounded-md px-2.5 py-1 text-xs font-semibold transition " +
        (plan === value
          ? "bg-green-600 text-white"
          : "border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700")
      }
    >
      {label} {count}
    </button>
  );

  return (
    <div
      // Only a hit on the backdrop itself closes it; a click that started on
      // the sheet must not, or dragging to select text throws the panel away.
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Subscriptions"
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white dark:bg-gray-800 shadow-xl"
      >
        <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <CreditCardIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          <h3 className="flex-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
            Subscriptions
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close subscriptions"
            className="rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {/* What a plan is here, said once and plainly. Without it the panel
              implies billing it does not do, and the first question it would
              provoke — "so did that charge them?" — has an answer nobody should
              have to read the source to get. */}
          <p className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
            The recorder enforces these plans: a capability a plan does not include is disabled
            there, and says which plan carries it. Two things it is not — there is no price or
            renewal date behind a plan, so changing one bills nobody; and someone already signed
            in keeps the plan their session was opened with until they next sign in.
          </p>

          {/* What each tier is, laid out as tiers: only what it adds, because
              the whole point of the ladder is that everything below comes with
              it, and repeating six lines three times hides the difference the
              reader is here to find. */}
          <div className="flex items-center gap-2">
            <h4 className="flex-1 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Plans
            </h4>
            {saveNote && (
              <span className="text-[11px] text-gray-500 dark:text-gray-400">{saveNote}</span>
            )}
            {editing ? (
              <>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  disabled={saving}
                  className="rounded-md border border-gray-300 dark:border-gray-600 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={commit}
                  disabled={saving}
                  className="rounded-md bg-green-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save prices"}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={openEditor}
                title="Set what each plan costs. Saved to the database and used by the registration form immediately."
                className="rounded-md border border-gray-300 dark:border-gray-600 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Edit prices
              </button>
            )}
          </div>

          {editing && (
            <div className="space-y-2 rounded-lg border border-green-200 dark:border-green-800 bg-green-50/40 dark:bg-green-900/10 px-4 py-3">
              {draft.map((plan, i) => (
                <div key={plan.value} className="flex flex-wrap items-center gap-2">
                  <span className="w-24 flex-shrink-0 text-sm font-bold text-gray-800 dark:text-gray-100">
                    {plan.label || plan.value}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={plan.price == null ? "" : plan.price}
                    onChange={(e) => editPlan(i, { price: e.target.value })}
                    // Blank is a state, not a mistake: it is what "not priced
                    // yet" looks like, and it is what the form shows as
                    // "Price on request".
                    placeholder="no price"
                    aria-label={"Price for " + plan.value}
                    className="w-28 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 dark:text-gray-100 px-2 py-1 text-sm"
                  />
                  <input
                    value={plan.currency || ""}
                    onChange={(e) =>
                      editPlan(i, { currency: e.target.value.toUpperCase().slice(0, 3) })
                    }
                    aria-label={"Currency for " + plan.value}
                    title="ISO currency code — INR, USD, GBP"
                    className="w-16 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 dark:text-gray-100 px-2 py-1 text-sm uppercase"
                  />
                  <select
                    value={plan.interval || ""}
                    onChange={(e) => editPlan(i, { interval: e.target.value || null })}
                    aria-label={"Billing period for " + plan.value}
                    className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 dark:text-gray-100 px-2 py-1 text-sm"
                  >
                    <option value="">no period</option>
                    <option value="month">per month</option>
                    <option value="year">per year</option>
                    <option value="once">one-off</option>
                  </select>
                  {/* Who the tier is sold to. Editable rather than fixed to the
                      one plan that is corporate today: which tiers are sold to
                      organisations is a commercial decision, not a property of
                      the code. */}
                  <select
                    value={plan.kind || "individual"}
                    onChange={(e) => editPlan(i, { kind: e.target.value })}
                    aria-label={"Customer type for " + plan.value}
                    title="Who this tier is sold to. Super Admin can filter accounts by it."
                    className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 dark:text-gray-100 px-2 py-1 text-sm"
                  >
                    {PLAN_KINDS.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.label}
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">
                    shows as{" "}
                    <b>
                      {priceLabel({
                        ...plan,
                        price:
                          plan.price === "" || plan.price == null ? null : Number(plan.price),
                      })}
                    </b>
                  </span>
                </div>
              ))}
              <p className="pt-1 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
                Prices are what the app <b>shows</b>. Nothing here takes a payment or talks to a
                payment provider — moving an account between plans changes what they can do,
                and billing them is still a separate act.
              </p>
            </div>
          )}

          <div className="space-y-3">
            {PLANS.map((name, i) => {
              const record = planFor(name);
              const adds = addedBy(name);
              return (
                <div
                  key={name}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3"
                >
                  <div className="flex items-baseline gap-2">
                    <span
                      className="text-sm font-bold"
                      style={{ color: toneFor(name) }}
                    >
                      {record.label || name}
                    </span>
                    {planKind(record) === "corporate" && (
                      <span
                        className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200"
                        title="Sold to an organisation rather than a person"
                      >
                        corporate
                      </span>
                    )}
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                      {record.blurb}
                    </span>
                    <span className="ml-auto text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
                      {priceLabel(record)}
                    </span>
                    <span className="text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
                      {capabilitiesOf(name).length} of {CAPABILITIES.length}
                    </span>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {i > 0 && (
                      <li className="text-[11px] italic text-gray-500 dark:text-gray-400">
                        Everything in {PLANS[i - 1]}, plus:
                      </li>
                    )}
                    {adds.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-start gap-2 text-[11px] text-gray-600 dark:text-gray-300"
                      >
                        <span aria-hidden="true" style={{ color: toneFor(name) }}>
                          ✓
                        </span>
                        <span>{c.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {PLANS.map((p) => (
              <PlanBar
                key={p}
                plan={p}
                count={counts.byPlan.get(p)}
                total={total}
                tone={toneFor(p)}
              />
            ))}
          </div>

          {/* The figure a price exists to produce. Recurring only: a one-off
              price is left out rather than smeared across the months, and an
              unpriced plan is counted in accounts but not in money — said out
              loud, so a total missing a tier cannot read as the whole picture. */}
          <div className="flex flex-wrap items-baseline gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
              Recurring, per month
            </span>
            <span className="text-xl font-black tabular-nums text-gray-900 dark:text-gray-100">
              {money(Math.round(revenue.monthly), revenue.currency)}
            </span>
            <span className="ml-auto text-[11px] text-gray-500 dark:text-gray-400">
              {revenue.byPlan
                .filter((r) => r.count > 0)
                .map((r) => r.count + " × " + r.plan.value)
                .join(" · ") || "no accounts"}
              {revenue.unpriced > 0 &&
                " · " + revenue.unpriced + " on a plan with no price set"}
            </span>
          </div>

          {counts.none > 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {counts.none} account{counts.none === 1 ? " is" : "s are"} on no recognised plan —
              either recorded before the field existed, or carrying a value that is no longer
              offered. They are under <b>Unassigned</b> below.
            </p>
          )}

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {chip("", "All", total)}
              {PLANS.map((p) => chip(p, p, counts.byPlan.get(p)))}
              {counts.none > 0 && chip("__none__", "Unassigned", counts.none)}
            </div>

            <div className="relative">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name or email"
                aria-label="Search accounts by name or email"
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 py-2 pl-9 pr-3 text-sm focus:border-green-500 focus:outline-none dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
              />
            </div>

            {!shown.length ? (
              <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                {query.trim() ? "Nothing matches that search." : "No accounts on this plan."}
              </p>
            ) : (
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {shown.map((a) => {
                  const current = planOf(a);
                  return (
                    <li key={a.key} className="flex flex-wrap items-center gap-3 py-2.5">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-gray-800 dark:text-gray-100">
                          {nameOf(a)}
                          {/* An account that cannot sign in is nearly always one
                              that has not paid — the checkout is what switches
                              it back on. Worth saying on the row, because it is
                              the reason somebody is looking at this panel. */}
                          {a.canSignIn === false && (
                            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                              unpaid
                            </span>
                          )}
                        </span>
                        <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                          {a.email}
                        </span>
                      </span>
                      {/* The same control the table's role select is: change it
                          and it saves, because a plan is one field and a
                          confirm step for one field is a step nobody thanks you
                          for. Unlike a role it locks nobody out, so there is
                          nothing here to guard against. */}
                      <select
                        value={current || ""}
                        disabled={busyKey === a.key}
                        onChange={(e) => onPlan(a, e.target.value)}
                        aria-label={"Plan for " + nameOf(a)}
                        title={"Move " + nameOf(a) + " to another plan"}
                        className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 dark:text-gray-100 px-2 py-1 text-sm disabled:cursor-not-allowed disabled:bg-gray-100 dark:disabled:bg-gray-700"
                      >
                        {/* Only for a record that has no recognised plan, and
                            never selectable back into: the server takes a plan
                            it knows, so "(none)" is a state to leave, not one to
                            choose. */}
                        {!current && <option value="">(none)</option>}
                        {PLANS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                      {/* Only for a paid plan: a free one has nothing to
                          settle, and the server refuses to open a checkout for
                          it. */}
                      {(planFor(current).price || 0) > 0 && (
                        <button
                          type="button"
                          onClick={() => makeLink(a)}
                          disabled={linking === a.key || busyKey === a.key}
                          title={`Open a checkout for ${nameOf(a)} on ${current} and copy the link`}
                          className="rounded-md border border-gray-300 dark:border-gray-600 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                        >
                          {linking === a.key ? "Opening…" : "Payment link"}
                        </button>
                      )}
                      {links[a.key] && (
                        <span className="w-full">
                          {links[a.key].startsWith("error: ") ? (
                            <span className="text-[11px] text-red-700 dark:text-red-400">
                              {links[a.key].slice(7)}
                            </span>
                          ) : (
                            <>
                              <input
                                readOnly
                                value={links[a.key]}
                                onFocus={(e) => e.target.select()}
                                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 dark:text-gray-100 px-2 py-1 font-mono text-[11px]"
                                aria-label={`Payment link for ${nameOf(a)}`}
                              />
                              <span className="mt-1 block text-[10px] text-gray-500 dark:text-gray-400">
                                Copied. Anyone with this link can settle this one checkout — send
                                it to {a.email} and nowhere else.
                              </span>
                            </>
                          )}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* What has actually happened, as opposed to what is true now. The
              account row shows the plan somebody is on; only this says when it
              changed and who changed it, which is the question asked of a
              subscription list the moment the current state looks wrong. */}
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Recent plan changes
              </h4>
              {changes && changes.length > 0 && (
                <span className="text-[11px] text-gray-400 dark:text-gray-500">
                  {changes.length} recorded
                </span>
              )}
            </div>

            {changes === null ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">Reading…</p>
            ) : historyError ? (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                The history could not be read — {historyError}
              </p>
            ) : !changes.length ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Nothing recorded yet. Every plan change from here is written to the database
                with who made it and when; changes made before that was true are not in it.
              </p>
            ) : (
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {changes.slice(0, 12).map((c) => (
                  <li key={c.at + c.accountKey} className="flex items-baseline gap-2 py-2 text-xs">
                    <span className="min-w-0 flex-1 truncate text-gray-700 dark:text-gray-200">
                      {c.accountEmail || c.accountKey}
                    </span>
                    <span className="flex-shrink-0 text-gray-500 dark:text-gray-400">
                      {c.fromPlan || "(none)"} → <b className="text-gray-800 dark:text-gray-100">{c.toPlan}</b>
                    </span>
                    <span
                      className="flex-shrink-0 text-gray-400 dark:text-gray-500"
                      title={(c.changedBy ? "by " + c.changedBy + " · " : "") + c.at}
                    >
                      {new Date(c.at).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-gray-200 dark:border-gray-700 px-6 py-3">
          <span className="flex-1 text-[11px] text-gray-500 dark:text-gray-400">
            Plans come from the database, through /api/plans — the same catalogue the
            registration form renders and the server validates against. paymentOptions.json
            is the floor under it: it seeds the table and answers when there is no database.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
