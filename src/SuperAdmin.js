import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowPathIcon,
  ArrowRightStartOnRectangleIcon,
  ArrowUturnLeftIcon,
  BanknotesIcon,
  ChartBarIcon,
  CheckCircleIcon,
  CreditCardIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
  Cog6ToothIcon,
  ExclamationTriangleIcon,
  KeyIcon,
  MagnifyingGlassIcon,
  MoonIcon,
  PencilIcon,
  SunIcon,
  TrashIcon,
  UserCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import { useAuth } from "./context/AuthContext";
// The role list this table renders, shared with the registration form, and the
// one role comparison the whole app uses, for the gate at the bottom of this
// file. DEFAULT_LANDING is deliberately not imported: nothing here navigates to
// a landing page — the only navigate on this screen is the sign-out to /my-app.
import { ALL_ROLES, PRIVILEGED_ROLES, roleAllowed } from "./routeAccess";
// This page asks for credentials itself rather than being redirected away from
// -- see the note on the default export.
import AdminSignIn from "./AdminSignIn";
// What the public landing page is doing. Its own module because it is a panel
// with its own data source: this page administers accounts, and traffic to
// /HomePage is not one.
import HomePageAnalyticsModal from "./HomePageAnalyticsModal";
// Who is on which plan. Its own module for the same reason the analytics panel
// is one — see the note at the top of it.
import SubscriptionsModal from "./SubscriptionsModal";
// What was actually charged, as opposed to who is on what. Its own module for
// the same reason — see the note at the top of it.
import PaymentsModal from "./PaymentsModal";
// The table pager, shared with the Payments panel — see ./AdminPagination.
import { PAGE_SIZES, Pagination } from "./AdminPagination";
// Who a plan is sold to. Read from the live catalogue, so a tier remarked as
// corporate in Subscriptions is filtered as one here without a code change.
import { PLANS, PLAN_KINDS, planKind } from "./plans";
// The same mark the runner and the landing page wear -- see the note in that
// module for why it is drawn rather than imported as an image.
import TestExpressMark from "./TestExpressMark";
// Shared with the registration form, so a face uploaded on either screen is
// stored at the same size and the avatar circle is sharp wherever it is drawn.
import { fileToAvatarDataUrl } from "./avatarImage";
// Branding lives outside this page: every screen wears it, and this page is
// only where it is chosen.
import {
  DEFAULT_NAME,
  DEFAULT_TAGLINE,
  LOGO_MAX_BYTES,
  NAME_MAX,
  TAGLINE_MAX,
  resetBranding,
  saveBranding,
  useBranding,
  useBrandingSync,
} from "./appBranding";
// Light or dark, stored where the test runner stores it, so one choice covers
// both screens -- see the note at the top of theme.js. "Auto" resolves against
// the clock and keeps resolving while the page is open, which is why the theme
// arrives as a hook rather than as a value read once.
import { DARK_FROM_HOUR, DARK_UNTIL_HOUR, hourLabel, useAppTheme } from "./theme";
import {
  listAccounts,
  setPayment,
  setRole,
  setSignIn,
  updateAccount,
  resetPassword,
  deleteAccount,
  restoreAccount,
} from "./api/admin";

// Account administration.
//
// Reads and writes the DATABASE through /api/admin, not localStorage. That is
// the difference between this page and NewRegistration: the registration screen
// edits the local copy of a record and lets dbSync mirror it, which cannot work
// for someone else's account -- it may not be in this browser at all, and a
// change made to a stale copy races the tab that owns it.
//
// The password an administrator types is sent once and never stored here.

/**
 * The roles the registration screen offers; the server enforces the same set.
 *
 * Imported rather than restated. This page is where a Super Admin is actually
 * granted -- the registration form no longer offers the role at all -- so the
 * two screens disagreeing about what the roles are would be the kind of drift
 * that leaves a role unassignable anywhere.
 */
const ROLES = ALL_ROLES;

// ---- this page's preferences ---------------------------------------------
// How the administrator wants the table to behave, kept in this browser rather
// than on the account. They are properties of the screen you are sitting at,
// not of who you are: the same person at a shared machine and at their own
// wants the list refreshed differently, and neither answer belongs in a record
// every other administrator can read.
//
// Both defaults reproduce exactly what the page did before the settings
// existed, so an administrator who never opens the panel sees no change.

const SETTINGS_KEY = "superadmin.settings";

/** Sort orders the table offers, in the order the panel lists them. */
const SORT_ORDERS = [
  { value: "attention", label: "Needs attention first" },
  { value: "name", label: "Alphabetical" },
];

/** Auto-refresh intervals, in ms. 0 is off — the Refresh button still works. */
const REFRESH_CHOICES = [
  { value: 0, label: "Off" },
  { value: 30_000, label: "30s" },
  { value: 120_000, label: "2 min" },
];

// ---- which accounts the table is showing ---------------------------------
// A filter is not kept in `settings` and not persisted: the other preferences
// say how this administrator likes to read the table, while a filter is the
// question being asked right now. Restoring "Doctors only" a week later would
// answer a question nobody asked and read as accounts having gone missing.

/** The two views that are about an account's state rather than its role. */
const ACCOUNT_FILTERS = [
  { value: "all", label: "All accounts", match: () => true },
  { value: "attention", label: "Needs attention", match: (a) => !a.canSignIn },
];

/**
 * Roles the rail offers a view for.
 *
 * Every assignable role, now that Doctor and Receptionist are gone from
 * ALL_ROLES: the filter that used to sit here existed only to keep those two
 * out of the rail as permanent zeroes, and a list filtering itself down to
 * itself is a rule nobody can read. An account still holding one of them is
 * reachable through All accounts, and through search by name or email.
 */

/**
 * One view per role the rail offers.
 *
 * Compared with `roleAllowed` rather than `===` so a record stored as
 * "super admin" is counted under Super Admin -- the folded comparison is the
 * one the whole app uses, and a filter that disagreed with the gate would hide
 * exactly the accounts that matter most.
 */
const ROLE_FILTERS = ALL_ROLES.map((role) => ({
  value: "role:" + role,
  label: role,
  match: (a) => roleAllowed([role], a.role),
}));

/**
 * One view per kind of customer.
 *
 * Matched through planKind at render time rather than against a list of plan
 * names captured here: the catalogue is editable, and a filter holding its own
 * copy of which tiers are corporate would go on filtering by last week's.
 */
const KIND_FILTERS = PLAN_KINDS.map((k) => ({
  value: "kind:" + k.id,
  label: k.label,
  match: (a) => planKind(a.payment) === k.id,
}));

const FILTERS = [...ACCOUNT_FILTERS, ...ROLE_FILTERS, ...KIND_FILTERS];

/** The named filter, or "all" for anything unrecognised. */
const filterFor = (value) => FILTERS.find((f) => f.value === value) || FILTERS[0];

/** Rows per page the table offers. */

const DEFAULT_SETTINGS = { sort: "attention", refreshMs: 0, pageSize: 10 };

/**
 * The stored preferences, with anything unrecognised replaced by its default.
 *
 * Validated on the way in rather than trusted: this is hand-editable storage,
 * and a `refreshMs` of 1 read straight through would put the table into a
 * request loop against the database.
 */
const loadSettings = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    if (!parsed || typeof parsed !== "object") return DEFAULT_SETTINGS;
    return {
      sort: SORT_ORDERS.some((o) => o.value === parsed.sort)
        ? parsed.sort
        : DEFAULT_SETTINGS.sort,
      refreshMs: REFRESH_CHOICES.some((o) => o.value === parsed.refreshMs)
        ? parsed.refreshMs
        : DEFAULT_SETTINGS.refreshMs,
      // Validated like the others: a hand-edited 0 here would divide the row
      // count by nothing and put the table on an infinite number of pages.
      pageSize: PAGE_SIZES.includes(parsed.pageSize)
        ? parsed.pageSize
        : DEFAULT_SETTINGS.pageSize,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

/** Best-effort: a preference that failed to save must never cost a page load. */
const persistSettings = (settings) => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn("[SuperAdmin] settings not persisted:", err);
  }
};

// The same shape sign-in and registration accept (App.js, NewRegistration.js):
// something, an @, a host with a dot in it, and no whitespace anywhere. Named
// rather than written inline at the one call site, because the version that was
// inline had lost its backslashes — /^[^s@]+@[^s@]+.[^s@]+$/ reads as "no
// literal s and no @", so every address containing the letter s was rejected as
// malformed, which is most of them.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const fullName = (a) => [a.firstName, a.lastName].filter(Boolean).join(" ").trim();

/**
 * Milliseconds left, as m:ss.
 *
 * Rounded up, so the last second reads 0:01 and then the offer is gone —
 * counting down through a visible 0:00 invites the press that arrives too late.
 */
const countdown = (ms) => {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
};

/** Initials for an account with no photo. Falls back to the email's first letter. */
const initialsOf = (a) => {
  const name = fullName(a);
  if (name) {
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("");
  }
  return (a.email || "?").charAt(0).toUpperCase();
};

/**
 * The account's photo, or its initials.
 *
 * Inline rather than a shared component because TestRunner's equivalent is
 * built on that screen's own theme tokens; the two look alike but answer to
 * different palettes.
 */
function Avatar({ account }) {
  if (account.profilePicture) {
    return (
      <img
        src={account.profilePicture}
        alt=""
        className="h-9 w-9 flex-shrink-0 rounded-full object-cover ring-1 ring-gray-200 dark:ring-gray-700"
      />
    );
  }
  return (
    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40 text-xs font-bold text-green-800 dark:text-green-300">
      {initialsOf(account)}
    </span>
  );
}

/** The tone a corporate tier wears. Named, because the ladder below ends on it. */
const CORPORATE_TONE =
  "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200";

/**
 * The pill palette, in catalogue order — so the colour climbs with the tier.
 *
 * Indexed by a plan's position rather than keyed by its name, because the
 * catalogue is editable: a tier renamed or inserted in the database has to come
 * out coloured without a code change here. A catalogue longer than this ladder
 * wraps, which repeats a colour but never leaves a plan unstyled.
 */
const PLAN_TONES = [
  "bg-slate-100 text-slate-700 dark:bg-slate-700/60 dark:text-slate-200",
  "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
  "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200",
  CORPORATE_TONE,
];

/** A plan the catalogue does not know — shown as stored, styled as nothing. */
const UNKNOWN_TONE = "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";

/**
 * An account's plan, drawn as a pill.
 *
 * A badge on every row rather than only on the exception, which is what this
 * column used to do: the tier is the thing that differs between rows, so it is
 * the thing worth wearing the colour. That replaces the separate "corporate"
 * badge instead of joining it -- a corporate tier keeps its own tone, so the
 * one account that holds seats is still the one that looks different, and the
 * kind it belongs to is on hover rather than spelled out in a second pill.
 *
 * @param {string} [payment] the stored plan name.
 * @param {string} [empty] what an account with no plan reads as. A dash is
 *   right in a column, where the eye is running down it and a word would be
 *   noise; in a line of prose it is ambiguous, so the seat list says so.
 */
function PlanPill({ payment, empty = "—" }) {
  if (!payment) return <span className="text-gray-400 dark:text-gray-500">{empty}</span>;

  const at = PLANS.findIndex((p) => p.value === payment);
  const kind = PLAN_KINDS.find((k) => k.id === planKind(payment));
  const known = at >= 0;
  return (
    <span
      className={
        "inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold " +
        (known ? PLAN_TONES[at % PLAN_TONES.length] : UNKNOWN_TONE)
      }
      title={
        known && kind
          ? kind.label + " — " + kind.hint
          : "Not a plan in the current catalogue"
      }
    >
      {payment}
    </span>
  );
}

/**
 * The signed-in administrator, and what they can do to their own account.
 *
 * The same control TestRunner carries in its top bar, rebuilt on this page's
 * palette rather than imported: TestRunner's is drawn from that screen's theme
 * tokens, which do not exist here, and a menu that renders in the wrong colours
 * is worse than one written twice. What is shared is the behaviour: who you
 * are signed in as, and a way to your own profile. Settings and Sign out used
 * to live here too and now sit in the left rail, in the open -- two copies of
 * one action is a question about which of them does what.
 *
 * The account is looked up in the table's own list rather than taken from the
 * session, because the session is a snapshot from sign-in and the table is what
 * the database says now. Its absence is a real state, not an error: the list is
 * still loading, or the signed-in email is not in it at all -- so `onProfile` is
 * offered only when there is a record to edit, and says why when there is not.
 *
 * @param {object|null} account the administrator's own row, or null.
 * @param {object|null} user the session, for the name and email while loading.
 * @param {string|null} profileBlocked why Profile is unavailable, or null.
 * @param {() => void} onProfile opens the administrator's own account.
 */
function AccountMenu({ account, user, profileBlocked, onProfile }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  // Both ways out of a menu that covers what is behind it. Bound only while it
  // is open, so a closed menu costs the page no listeners.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // The session's own fields stand in until the table has loaded, so the button
  // shows who you are from the first paint rather than popping into place.
  const shown = account || user || {};
  const name = fullName(shown) || shown.email || "Signed in";

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={"Account: " + name}
        title={name + (shown.email ? " — " + shown.email : "") + " — account menu"}
        className={
          "inline-flex items-center gap-2 rounded-full border py-1 pl-1 pr-2 transition " +
          (open
            ? "border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700"
            : "border-transparent hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700")
        }
      >
        <Avatar account={shown} />
        {open ? (
          <ChevronUpIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        ) : (
          <ChevronDownIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-64 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-1.5 shadow-xl"
        >
          <div className="flex items-start gap-3 border-b border-gray-100 dark:border-gray-700 px-2 pb-3 pt-2">
            <Avatar account={shown} />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{name}</div>
              {shown.email && (
                <div className="truncate text-xs text-gray-500 dark:text-gray-400">{shown.email}</div>
              )}
              {shown.role && (
                <span className="mt-1 inline-block rounded-full bg-green-100 dark:bg-green-900/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-green-800 dark:text-green-300">
                  {shown.role}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            role="menuitem"
            disabled={!!profileBlocked}
            title={profileBlocked || "View and edit your own account"}
            onClick={() => {
              setOpen(false);
              onProfile();
            }}
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <UserCircleIcon className="h-4 w-4" /> Profile
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * One preference, as a row of mutually exclusive buttons.
 *
 * A segmented control rather than a `<select>`: there are two or three choices
 * and all of them are worth reading at once, which is the case a dropdown is
 * worst at. The same shape TestRunner's settings use, for the same reason.
 */
function Segmented({ value, options, onChange, label, compact = false }) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      // The track sinks and the chosen pill lifts, in both themes — so on dark
      // the track is the darker of the two, not the lighter.
      className="inline-flex flex-shrink-0 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900 p-0.5"
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            // `name` is what an icon-only option is called. Without it the
            // radio's accessible name would be whatever an SVG contributes,
            // which is nothing, and the control would be unusable by anyone
            // not looking at it -- and unaddressable from a test.
            aria-label={o.name}
            title={o.title || o.name}
            onClick={() => onChange(o.value)}
            className={
              "rounded-md font-semibold transition " +
              (compact ? "px-2 py-1.5 " : "px-3 py-1.5 text-xs ") +
              (on
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100")
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The three theme choices, with the icon each is recognised by.
 *
 * One list so the top bar and the settings panel cannot offer different
 * choices, or the same choice under different names.
 */
const THEME_OPTIONS = [
  { value: "light", name: "Light", Glyph: SunIcon },
  { value: "dark", name: "Dark", Glyph: MoonIcon },
  { value: "auto", name: "Auto", Glyph: ClockIcon },
];

// A top-bar ThemeToggle was written here and never rendered — the theme control
// this page actually shows is the one in the settings panel below, built from
// the same THEME_OPTIONS. Removed rather than left as an unreachable second
// copy of that control; it is in git if the top bar ever wants one.

/** A named setting with its explanation, and whatever control changes it. */
function SettingRow({ name, hint, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-[240px] flex-1">
        <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">{name}</div>
        <p className="mt-0.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{hint}</p>
      </div>
      {children}
    </div>
  );
}

/**
 * The left rail: which accounts the table is showing.
 *
 * Counted over every account rather than over the search results, so the rail
 * stays a stable map of what is in the database while the search narrows what
 * is on screen. The two compose -- a filter and a search are different
 * questions, and answering both is what makes either worth having.
 *
 * Buttons rather than links: this changes what the table shows, not where you
 * are. Nothing here is in the URL, which is a real limitation -- a filtered
 * view cannot be sent to another administrator -- and not worth a router change
 * until somebody asks for it.
 *
 * @param {string} value the active filter's value.
 * @param {Record<string, number>} counts how many accounts each filter matches.
 * @param {(value: string) => void} onChange
 */
function AccountFilters({ value, counts, onChange }) {
  const heading = "px-2 pb-1 pt-2 text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500";
  const item = (f) => {
    const on = f.value === value;
    const count = counts[f.value] || 0;
    return (
      <button
        key={f.value}
        type="button"
        // aria-current rather than aria-pressed: these are mutually exclusive
        // views of one table, so exactly one is the current one.
        aria-current={on ? "true" : undefined}
        onClick={() => onChange(f.value)}
        className={
          "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition " +
          (on
            ? "bg-green-50 dark:bg-green-900/30 font-semibold text-green-800 dark:text-green-300"
            : "font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700")
        }
      >
        <span className="truncate">{f.label}</span>
        <span
          className={
            "flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold " +
            (count
              ? "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
              : "text-gray-400 dark:text-gray-500")
          }
        >
          {count}
        </span>
      </button>
    );
  };

  return (
    // Above the table on a narrow window rather than hidden: a filter that only
    // exists on a wide screen is a feature half the sessions cannot reach.
    <nav aria-label="Filter accounts">
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2 shadow-sm">
        <p className={heading}>Accounts</p>
        {ACCOUNT_FILTERS.map(item)}
        <p className={heading}>By role</p>
        {ROLE_FILTERS.map(item)}
        <p className={heading}>By customer</p>
        {KIND_FILTERS.map(item)}
      </div>
    </nav>
  );
}

/**
 * The runner's lockup — mark, italic green wordmark, tagline — at the head of
 * the rail.
 *
 * It sat in the page header beside the title until the rail existed to hold it.
 * A rail is where a product mark belongs: it names the thing you are inside,
 * which is a property of the whole page rather than of the accounts panel, and
 * the header is now only the page's own title and its controls.
 *
 * Reads the branding itself rather than taking it as a prop — it is the one
 * view of that value, so there is nothing to thread it through for. Restated in
 * Tailwind rather than shared with the runner's own copy of this lockup: that
 * one is drawn from the runner's theme tokens and this page has none of them.
 * The mark is imported, so the one part that would actually drift cannot.
 */
function BrandLockup() {
  const branding = useBranding();
  return (
    <div className="flex items-center gap-3 px-1">
      <TestExpressMark size={34} />
      <span className="min-w-0 leading-none">
        <span className="block truncate text-[17px] font-black italic tracking-[0.06em] text-green-600 dark:text-green-500">
          {branding.name}
        </span>
        {/* The tagline is a full sentence in a 224px rail, so it wraps rather
            than truncating: cut to one line it reads as a broken-off phrase. */}
        <span className="mt-1 block text-xs leading-snug text-gray-500 dark:text-gray-400">
          {branding.tagline}
        </span>
      </span>
    </div>
  );
}

/**
 * The rail's second card: settings and sign out.
 *
 * Its own component rather than more markup inside AccountFilters, which
 * answers one question -- which accounts the table shows -- and would stop
 * being about that. It also keeps the actions out of a <nav> labelled "filter
 * accounts": signing out is not a view of the table.
 *
 * Both already live in the account menu at the top right, and stay there. That
 * menu costs a click to open and hides what is inside it until then, which is
 * fine for the rarely-used Profile and wrong for the two an administrator
 * reaches for on the way out.
 *
 * The analytics entry sits here for the same reason and not in the account
 * menu: it is a view of the product rather than of the account you are signed
 * in as, and the menu at the top right is about the latter.
 *
 * @param {{onSettings: () => void, onAnalytics: () => void,
 *   onSignOut: () => void}} props
 */
function RailActions({ onSettings, onSubscriptions, onPayments, onAnalytics, onSignOut }) {
  const row =
    "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition ";
  return (
    <section
      aria-label="Session"
      // Only as tall as its five rows. It used to take md:flex-1 so the card
      // ended level with the accounts panel beside it, but the panel is a
      // window-height table and this is a short list, so all that bought was a
      // band of empty card between the last entry and the sign-out.
      className="flex flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2 shadow-sm"
    >
      <button
        type="button"
        onClick={onSettings}
        title="Preferences for this page"
        className={row + "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"}
      >
        <Cog6ToothIcon className="h-4 w-4 flex-shrink-0" /> Settings
      </button>
      {/* Above analytics, below settings: this is a view of the accounts the
          page administers, so it belongs beside them rather than out with the
          view of the public site. */}
      <button
        type="button"
        onClick={onSubscriptions}
        title="How the accounts are spread across the plans, and where to move one"
        className={row + "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"}
      >
        <CreditCardIcon className="h-4 w-4 flex-shrink-0" /> Subscriptions
      </button>
      {/* Under Subscriptions, because it is the same subject read the other
          way round: that one is who is on which plan, this is what was actually
          charged for it. */}
      <button
        type="button"
        onClick={onPayments}
        title="Every checkout — what settled, what is still owed, what was abandoned"
        className={row + "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"}
      >
        <BanknotesIcon className="h-4 w-4 flex-shrink-0" /> Payments
      </button>
      <button
        type="button"
        onClick={onAnalytics}
        title="Visits, clicks and scroll depth on the public landing page"
        className={row + "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"}
      >
        <ChartBarIcon className="h-4 w-4 flex-shrink-0" /> Website - analytics
      </button>
      {/* Last, not under Settings: leaving the session is the one action here
          that ends what you are doing, and it should not sit a mis-click away
          from the four that do not. The rule above it is what separates them
          now that the card no longer stretches to put a gap there. */}
      <button
        type="button"
        onClick={onSignOut}
        className={
          row +
          "mt-1 border-t border-gray-100 pt-2 dark:border-gray-700 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
        }
      >
        <ArrowRightStartOnRectangleIcon className="h-4 w-4 flex-shrink-0" /> Sign out
      </button>
    </section>
  );
}

/**
 * User settings for this page.
 *
 * Not built on `Dialog`, which exists for a question that must be answered:
 * every control here writes through the moment it is touched, so there is no
 * pending state to confirm and nothing for a Cancel button to revert to. The
 * one button is Done, and it only closes the panel.
 *
 * What it deliberately does NOT carry is TestRunner's list of preferences —
 * theme, playback window, self-healing, browser. Those are settings for a test
 * runner, and repeating them on a page with no runner on it would offer
 * controls that change nothing you can see from here.
 *
 * The account block is read-only for the same reason it is in TestRunner's:
 * identity is established by signing in, and the two things you might want to
 * do to your own account from here already have a home — the profile dialog and
 * the password dialog — so this hands you to them rather than growing a second
 * copy of either.
 *
 * @param {object|null} user the session.
 * @param {object|null} account the administrator's own row, or null.
 * @param {string|null} accountBlocked why the account actions are unavailable.
 * @param {{sort: string, refreshMs: number}} settings the stored preferences.
 * @param {(next: object) => void} onChange persists and applies a change.
 * @param {{logo: string|null, name: string, tagline: string}} branding what the
 *   app is currently wearing.
 * @param {(patch: object) => string|null} onBranding stores a change; answers
 *   with why this browser rejected it, or null. Whether it then reached the
 *   database is a later answer, read from useBrandingSync.
 * @param {() => string|null} onResetBranding restores the built-in branding.
 * @param {"light"|"dark"} theme the theme being painted, for reading back what
 *   "auto" currently resolves to.
 * @param {"light"|"dark"|"auto"} themeChoice what the control shows selected.
 * @param {(choice: string) => void} onTheme changes it.
 * @param {() => void} onProfile opens the profile dialog.
 * @param {() => void} onPassword opens the password dialog for this account.
 * @param {() => void} onClose dismisses the panel.
 */
function UserSettingsModal({
  user,
  account,
  accountBlocked,
  settings,
  onChange,
  branding,
  onBranding,
  onResetBranding,
  theme,
  themeChoice,
  onTheme,
  onProfile,
  onPassword,
  onClose,
}) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Why the last change was refused by this browser. Kept here rather than in
  // the page: it is about the control you just used, and it should not outlive
  // the panel.
  const [brandingError, setBrandingError] = useState(null);

  // Whether the change reached the database, which is a different question with
  // a different answer: the edit above is applied locally the instant it is
  // made, and can still fail to become everybody else's a moment later.
  const brandingSync = useBrandingSync();

  // The text fields are drafts, not the stored values read straight back: an
  // empty field means "use the built-in one", so binding the input to the store
  // would refill it with TESTEXPRESS the moment you cleared it to type your own.
  const [nameDraft, setNameDraft] = useState(branding.name);
  const [taglineDraft, setTaglineDraft] = useState(branding.tagline);

  const editName = (value) => {
    setNameDraft(value);
    setBrandingError(onBranding({ name: value }));
  };
  const editTagline = (value) => {
    setTaglineDraft(value);
    setBrandingError(onBranding({ tagline: value }));
  };
  const resetAll = () => {
    setNameDraft("");
    setTaglineDraft("");
    setBrandingError(onResetBranding());
  };

  /**
   * Reads a chosen file and hands it to `onBranding` as a data URL.
   *
   * Checked before reading rather than after: FileReader on a 20MB photo costs
   * a visible pause and a copy in memory, and the answer is no either way. The
   * input is cleared so choosing the same file twice still fires a change --
   * the second attempt is exactly what happens after a rejection.
   */
  const handleLogoFile = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setBrandingError("That file is not an image.");
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      setBrandingError(
        "Images must be under " +
          Math.round(LOGO_MAX_BYTES / 1024) +
          " KB — that one is " +
          Math.round(file.size / 1024) +
          " KB.",
      );
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => setBrandingError("That file could not be read.");
    reader.onload = () => setBrandingError(onBranding({ logo: String(reader.result) }));
    reader.readAsDataURL(file);
  };

  // True when anything has been changed from the built-in branding, which is
  // the only case where Reset has something to do.
  const custom =
    !!branding.logo || branding.name !== DEFAULT_NAME || branding.tagline !== DEFAULT_TAGLINE;

  const shown = account || user || {};
  // Sized rather than full-width so it sits beside its label the way the
  // segmented controls above it do, and wraps under it on a narrow window.
  const field =
    "w-56 max-w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 " +
    "px-2.5 py-1.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 " +
    "dark:placeholder-gray-500 focus:border-green-500 focus:outline-none";
  const secondary =
    "rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 " +
    "hover:bg-gray-100 dark:hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50";

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
        aria-label="User settings"
        className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white dark:bg-gray-800 shadow-xl"
      >
        <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <Cog6ToothIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          <h3 className="flex-1 text-lg font-semibold text-gray-900 dark:text-gray-100">User Settings</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-7 overflow-y-auto px-6 py-5">
          <section className="space-y-3">
            <h4 className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              Account
            </h4>
            <div className="flex items-start gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3">
              <Avatar account={shown} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {fullName(shown) || shown.email || "Signed in"}
                </div>
                {shown.email && (
                  <div className="truncate text-xs text-gray-500 dark:text-gray-400">{shown.email}</div>
                )}
                {shown.role && (
                  <span className="mt-1 inline-block rounded-full bg-green-100 dark:bg-green-900/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-green-800 dark:text-green-300">
                    {shown.role}
                  </span>
                )}
                <p className="mt-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                  Read from the database, not from your session — so this is what other
                  administrators see. Your role is the one control you cannot change here.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!!accountBlocked}
                    title={accountBlocked || "Edit your name, email, photo and details"}
                    onClick={onProfile}
                    className={secondary}
                  >
                    Edit profile
                  </button>
                  <button
                    type="button"
                    disabled={!!accountBlocked}
                    title={accountBlocked || "Set a new password for your own account"}
                    onClick={onPassword}
                    className={secondary}
                  >
                    Change password
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h4 className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              Preferences
            </h4>
            <SettingRow
              name="Theme"
              hint={
                "Light, dark, or on the clock: Auto is dark from " +
                hourLabel(DARK_FROM_HOUR) +
                " to " +
                hourLabel(DARK_UNTIL_HOUR) +
                " and switches while the page is open" +
                (themeChoice === "auto" ? " — right now it is " + theme + "." : ".") +
                " Shared with the test runner — one choice for the app rather than one per" +
                " screen — and remembered in this browser."
              }
            >
              <Segmented
                label="Theme"
                value={themeChoice}
                options={THEME_OPTIONS.map(({ value, name }) => ({
                  value,
                  name,
                  label: name,
                }))}
                onChange={onTheme}
              />
            </SettingRow>
            <SettingRow
              name="Sort order"
              hint="Accounts that cannot sign in are the ones needing attention, so they lead by default. Alphabetical is easier when you know who you are looking for."
            >
              <Segmented
                label="Sort order"
                value={settings.sort}
                options={SORT_ORDERS}
                onChange={(sort) => onChange({ sort })}
              />
            </SettingRow>
            <SettingRow
              name="Auto-refresh"
              hint="Re-reads the table on a timer, so another administrator's change appears without pressing Refresh. Paused while an account dialog is open or a row is saving. The analytics panel follows the same cadence, and both show the time of their last read."
            >
              <Segmented
                label="Auto-refresh"
                value={settings.refreshMs}
                options={REFRESH_CHOICES}
                onChange={(refreshMs) => onChange({ refreshMs })}
              />
            </SettingRow>
            <p className="text-xs leading-relaxed text-gray-400 dark:text-gray-500">
              Both are remembered in this browser only — they say how you want to read the
              table, not anything about your account.
            </p>
          </section>

          <section className="space-y-4">
            <h4 className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              Branding
            </h4>
            {/* Said once for the whole section rather than in each hint: all
                three controls answer the same two questions -- where does this
                show, and who sees it. */}
            <SettingRow
              name="App logo"
              hint={
                "A square PNG or SVG under " +
                Math.round(LOGO_MAX_BYTES / 1024) +
                " KB reads best. Anything that is not square is fitted inside the space" +
                " rather than cropped."
              }
            >
              <div className="flex items-center gap-3">
                <span className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-1.5">
                  <TestExpressMark size={36} />
                </span>
                {/* A label wrapping the input rather than a button driving a
                    hidden one through a ref: the file picker opens from the
                    label for free, and it stays keyboard-reachable. */}
                <label className={secondary + " cursor-pointer"}>
                  {branding.logo ? "Replace…" : "Upload…"}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoFile}
                    className="sr-only"
                    aria-label="Upload an app logo"
                  />
                </label>
              </div>
            </SettingRow>
            <SettingRow
              name="App name"
              hint={'The wordmark beside the logo. Leave it empty for "' + DEFAULT_NAME + '".'}
            >
              <input
                type="text"
                value={nameDraft}
                onChange={(e) => editName(e.target.value)}
                maxLength={NAME_MAX}
                placeholder={DEFAULT_NAME}
                aria-label="App name"
                className={field}
              />
            </SettingRow>
            <SettingRow
              name="Sub text"
              hint={'The line under the name. Leave it empty for "' + DEFAULT_TAGLINE + '".'}
            >
              <input
                type="text"
                value={taglineDraft}
                onChange={(e) => editTagline(e.target.value)}
                maxLength={TAGLINE_MAX}
                placeholder={DEFAULT_TAGLINE}
                aria-label="Sub text"
                className={field}
              />
            </SettingRow>
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={!custom}
                title={custom ? "Go back to the built-in branding" : "Already the built-in branding"}
                onClick={resetAll}
                className={secondary}
              >
                Reset branding
              </button>
              {/* Two failures with one slot, in the order they matter: a file
                  this browser rejected was never sent, so reporting that it
                  also did not reach the database would be describing the same
                  event twice. */}
              {(brandingError || brandingSync.error) && (
                <p role="alert" className="text-xs font-medium text-red-700 dark:text-red-400">
                  {brandingError || brandingSync.error}
                </p>
              )}
              {!brandingError && !brandingSync.error && brandingSync.saving && (
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Saving…</p>
              )}
            </div>
            <p className="text-xs leading-relaxed text-gray-400 dark:text-gray-500">
              Branding is stored in the database, so it is what everyone sees — unlike the
              preferences above, which are yours and this browser's.
            </p>
          </section>
        </div>

        <div className="flex justify-end border-t border-gray-200 dark:border-gray-700 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * A modal that must be answered before anything else happens.
 *
 * One dialog for both destructive confirmation and the password prompt: they
 * differ only in what sits between the title and the buttons, and two
 * near-identical overlays is the copy that drifts.
 */
function Dialog({
  title,
  tone = "neutral",
  wide = false,
  confirmLabel,
  busy,
  onConfirm,
  onCancel,
  children,
}) {
  const confirmClass =
    tone === "danger" ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className={
          "w-full rounded-xl bg-white dark:bg-gray-800 p-6 shadow-xl " + (wide ? "max-w-2xl" : "max-w-md")
        }
      >
        <h3 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        {/* The edit form is taller than the viewport on a short window, and a
            dialog whose Save button cannot be reached is a dead end. */}
        <div className="mb-6 max-h-[70vh] overflow-y-auto text-sm text-gray-600 dark:text-gray-300">{children}</div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={"rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 " + confirmClass}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Whether this account may sign in, as a switch.
 *
 * Three states, not two, because there are two unrelated reasons an account
 * cannot sign in and only one of them this control can fix:
 *
 *   * no password at all -- the switch is meaningless, so it is not shown.
 *     Enabling an account with no credential would report success and change
 *     nothing anyone could use;
 *   * switched off -- the switch is what turns it back on;
 *   * signed-in administrator's own row -- locked, for the same reason the
 *     role select is: switching yourself off is a door that locks behind you.
 */
function SignInSwitch({ account, isSelf, busy, onToggle }) {
  if (!account.hasPassword) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-300"
        title="This account has no password, so nobody can sign in as it. Set one with the Password button."
      >
        <ExclamationTriangleIcon className="h-3.5 w-3.5" /> No password
      </span>
    );
  }
  const on = account.canSignIn;
  const locked = isSelf || busy;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={"Sign-in for " + (account.email || account.key)}
      disabled={locked}
      onClick={() => onToggle(account, !on)}
      title={
        isSelf
          ? "You cannot switch off your own sign-in"
          : on
            ? "Switch sign-in off — the password is kept"
            : "Switch sign-in back on"
      }
      className={
        "inline-flex items-center gap-2 rounded-full py-0.5 pl-0.5 pr-2.5 text-xs font-semibold transition " +
        (on ? "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300" : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300") +
        (locked ? " cursor-not-allowed opacity-60" : " hover:brightness-95")
      }
    >
      <span
        className={
          "flex h-4 w-7 items-center rounded-full p-0.5 " +
          (on ? "bg-green-600" : "bg-gray-400 dark:bg-gray-500")
        }
      >
        {/* The knob stays white in both themes: it is the moving part of a
            physical-looking switch, and a knob that darkens with the page
            disappears into the track it is meant to slide along. */}
        <span
          className={
            "h-3 w-3 rounded-full bg-white transition-transform " + (on ? "translate-x-3" : "")
          }
        />
      </span>
      {on ? "Yes" : "Off"}
    </button>
  );
}

/**
 * One header cell: the ground it sits on, its rule, and the fact it stays put.
 *
 * All three are on the cells rather than on the <thead> around them, which is
 * where they were and why the header read as a white band with nothing under
 * it. Tailwind's preflight collapses the table's borders, and a collapsed
 * border belongs to the table's border grid rather than to the row group's own
 * box -- so a `border-b` written on a sticky <thead> is not painted by the
 * layer that stays put, and the rule under the header goes as soon as the rows
 * begin passing beneath it. An inset shadow is not part of that grid and
 * travels with the cell. The two colours are gray-200 and gray-700, the same
 * pair the card around the table is drawn with.
 *
 * The ground is stated here for the same reason: it has to be opaque and it has
 * to belong to the element that is actually sticky, or the rows scrolling
 * underneath show through the one row that has to stay readable.
 */
const TH =
  // gray-100 (#f3f4f6), not gray-50: against the white card gray-50 is a 2%
  // step and reads as no band at all -- the header looked like a first row that
  // happened to be in capitals. Dark keeps gray-900 under a gray-800 card,
  // where the step was already legible: on dark the header is the darker of the
  // two, which is the same relationship the other way up.
  // Every header here is a two- or three-word label ("Can sign in"), so a wrap
  // buys nothing and costs a row of height; the table already scrolls
  // horizontally under its min-width, which is where the extra width goes.
  "sticky top-0 z-10 whitespace-nowrap bg-gray-100 dark:bg-gray-900 px-4 py-3 " +
  // gray-300 rather than gray-200 for the same reason: the rule now has to
  // separate two greys instead of grey from white.
  "shadow-[inset_0_-1px_0_#d1d5db] dark:shadow-[inset_0_-1px_0_#374151]";

/**
 * One account's row.
 *
 * `isSelf` disables the two controls that can lock an administrator out of the
 * page they are standing on. Disabled rather than merely warned about: the
 * warning would be a dialog nobody reads, and the recovery is a database edit.
 *
 * `position` is the 1-based place in the list as currently sorted and filtered.
 */
function AccountRow({
  account,
  position,
  isSelf,
  busy,
  picked,
  seatsOpen,
  onSeats,
  onPick,
  onRole,
  onEdit,
  onToggleSignIn,
  onReset,
  onDelete,
}) {
  return (
    <tr
      className={
        "border-b border-gray-100 dark:border-gray-700 last:border-0 " +
        (picked
          ? "bg-green-50 dark:bg-green-900/20"
          : "hover:bg-gray-50 dark:hover:bg-gray-700")
      }
    >
      {/* Not offered for the administrator's own row: every bulk action here is
          one they must not apply to themselves — a role change or a sign-in
          switch would lock them out of this page, and a delete needs no
          explanation. The single-row controls are disabled for the same reason,
          so an unselectable row is consistent rather than surprising. */}
      <td className="px-4 py-3">
        {isSelf ? (
          <span className="block h-4 w-4" aria-hidden="true" />
        ) : (
          <input
            type="checkbox"
            checked={picked}
            onChange={() => onPick(account.key)}
            disabled={busy}
            aria-label={"Select " + (fullName(account) || account.email)}
            className="h-4 w-4 cursor-pointer accent-green-600"
          />
        )}
      </td>
      {/* Tabular figures so the column stays a straight edge once the count
          runs past nine. gray-900, the same ink as the account name, rather
          than the muted grey a row label would normally take. */}
      <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-900 dark:text-gray-100">
        {position}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Only an account that actually owns seats gets a disclosure. A
              caret on every row would suggest every account has something
              underneath it, and most have nothing. */}
          {account.seats && account.seats.length > 0 ? (
            <button
              type="button"
              onClick={() => onSeats(account.key)}
              aria-expanded={seatsOpen}
              aria-label={
                (seatsOpen ? "Hide" : "Show") + " the " + account.seats.length + " seats on this team"
              }
              title={account.seats.length + " seat(s) on this team"}
              className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              <span className={"transition-transform " + (seatsOpen ? "rotate-90" : "")}>›</span>
            </button>
          ) : (
            <span className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
          )}
          <Avatar account={account} />
          <div className="min-w-0">
            <div className="truncate font-medium text-gray-900 dark:text-gray-100">
              {fullName(account) || "(no name)"}
              {isSelf && <span className="ml-2 text-xs font-normal text-green-700 dark:text-green-400">you</span>}
            </div>
            <div className="truncate text-xs text-gray-500 dark:text-gray-400">{account.email || "(no email)"}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{account.phoneNumber || "—"}</td>
      <td className="px-4 py-3 text-sm">
        <PlanPill payment={account.payment} />
      </td>
      <td className="px-4 py-3">
        <select
          value={ROLES.includes(account.role) ? account.role : ""}
          disabled={isSelf || busy}
          onChange={(e) => onRole(account, e.target.value)}
          title={
            isSelf
              ? "You cannot change your own role — it would lock you out of this page"
              : "Change this account's role"
          }
          className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 dark:text-gray-100 px-2 py-1 text-sm disabled:cursor-not-allowed disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:text-gray-500 dark:disabled:text-gray-400"
        >
          {!ROLES.includes(account.role) && <option value="">(none)</option>}
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3">
        <SignInSwitch account={account} isSelf={isSelf} busy={busy} onToggle={onToggleSignIn} />
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onEdit(account)}
            disabled={busy}
            title="Edit this account's details"
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 dark:border-gray-600 px-2.5 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            <PencilIcon className="h-3.5 w-3.5" /> Edit
          </button>
          <button
            type="button"
            onClick={() => onReset(account)}
            disabled={busy}
            title="Set a new password for this account"
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 dark:border-gray-600 px-2.5 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            <KeyIcon className="h-3.5 w-3.5" /> Password
          </button>
          <button
            type="button"
            onClick={() => onDelete(account)}
            disabled={isSelf || busy}
            title={isSelf ? "You cannot delete the account you are signed in as" : "Delete this account"}
            className="inline-flex items-center gap-1 rounded-md border border-red-200 dark:border-red-800 px-2.5 py-1.5 text-xs font-semibold text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <TrashIcon className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      </td>
    </tr>
  );
}

/** One labelled control, so the form's markup stays about the form. */
function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </span>
      {children}
    </label>
  );
}

// A field's own ground has to be stated for the dark theme: left alone, the
// browser paints an input white and its text black whatever the page around it
// is doing, which is the one thing on a dark page that looks like a fault
// rather than a choice. The placeholder needs saying for the same reason.
const INPUT =
  "w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm " +
  "focus:border-green-500 focus:outline-none " +
  "dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500";

/**
 * The editable profile of one account.
 *
 * Presentational: it owns no state and performs no request, so the dialog
 * around it decides what "save" means and this stays reusable if the same
 * fields are ever needed elsewhere.
 *
 * @param {object} draft the values being edited.
 * @param {(field: string, value: string) => void} onChange
 * @param {boolean} isSelf disables the role control, for the same reason the
 *   table does: an administrator demoting themselves loses this page.
 */
function EditFields({ draft, onChange, isSelf }) {
  const readPicture = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // A data URL rather than an upload, because that is the shape the record
    // already stores and what every other screen renders from. Squared and cut
    // down to the avatar's own size first -- see ./avatarImage for why the raw
    // file is the wrong thing to keep.
    fileToAvatarDataUrl(file)
      .then((dataUrl) => onChange("profilePicture", dataUrl))
      // Only an unreadable file rejects -- one that merely cannot be resized
      // comes back untouched. There is nothing to store and nowhere on this
      // presentational form to say so, so the previous picture stands.
      .catch(() => {});
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Avatar account={draft} />
        <div>
          {/* The UA paints the "Choose file" half itself — a light chip with
              near-black text — so on the dark sheet it is the one control that
              ignores the theme. Only a file-selector rule can reach it. */}
          <input
            type="file"
            accept="image/*"
            onChange={readPicture}
            className="text-xs text-gray-600 dark:text-gray-300 file:mr-3 file:rounded-md file:border file:border-gray-300 file:bg-gray-50 file:px-2 file:py-1 file:text-xs file:font-semibold file:text-gray-700 dark:file:border-gray-600 dark:file:bg-gray-700 dark:file:text-gray-100"
          />
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            Stored inside the record, so a large photo can be refused as too big.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="First name">
          <input
            className={INPUT}
            value={draft.firstName || ""}
            onChange={(e) => onChange("firstName", e.target.value)}
          />
        </Field>
        <Field label="Last name">
          <input
            className={INPUT}
            value={draft.lastName || ""}
            onChange={(e) => onChange("lastName", e.target.value)}
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            className={INPUT}
            value={draft.email || ""}
            onChange={(e) => onChange("email", e.target.value)}
          />
        </Field>
        <Field label="Phone">
          <input
            className={INPUT}
            value={draft.phoneNumber || ""}
            maxLength={10}
            onChange={(e) => onChange("phoneNumber", e.target.value.replace(/D/g, ""))}
          />
        </Field>
        <Field label="Zip code">
          <input
            className={INPUT}
            value={draft.zipCode || ""}
            onChange={(e) => onChange("zipCode", e.target.value)}
          />
        </Field>
        <Field label="Payment">
          <select
            className={INPUT}
            value={draft.payment || ""}
            onChange={(e) => onChange("payment", e.target.value)}
          >
            <option value="">(none)</option>
            {/* The live catalogue, not the shipped default: this page edits the
                plans in Subscriptions, so reading a file here would let it
                disagree with itself. */}
            {PLANS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label || o.value}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Role">
          <select
            className={INPUT + " disabled:cursor-not-allowed disabled:bg-gray-100 dark:disabled:bg-gray-700"}
            value={ROLES.includes(draft.role) ? draft.role : ""}
            disabled={isSelf}
            title={isSelf ? "You cannot change your own role" : undefined}
            onChange={(e) => onChange("role", e.target.value)}
          >
            {!ROLES.includes(draft.role) && <option value="">(none)</option>}
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </div>
  );
}

/**
 * Only the fields whose value actually differs from the stored account.
 *
 * The endpoint merges what it is sent, so sending everything would work — but
 * sending only the difference means an edit to a zip code cannot re-write a
 * profile picture, and the request stays small enough not to hit the body
 * limit that a base64 photo otherwise pushes it over.
 */
const changedFields = (draft, original) =>
  Object.keys(draft).reduce((out, key) => {
    if (draft[key] !== original[key]) out[key] = draft[key];
    return out;
  }, {});

/**
 * The fields a saved account contributes back to the session.
 *
 * An allow-list rather than the whole record, for the same reason the endpoint
 * answers with one: the account carries administrative fields the session has
 * no business holding (`canSignIn`, `signInDisabled`, the registration key),
 * and spreading it wholesale would quietly widen what sits in localStorage
 * under `user`.
 *
 * Only used when an administrator edits their own account -- everyone else's
 * session is on their own machine and is not this page's to write.
 */
const SESSION_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "phoneNumber",
  "zipCode",
  "payment",
  "role",
  "profilePicture",
];

const sessionFields = (account) =>
  SESSION_FIELDS.reduce((out, key) => {
    if (key in account) out[key] = account[key];
    return out;
  }, {});

/**
 * The account table, for a Super Admin who is already established as one.
 *
 * Split from the export below so the gate can decide before any of these hooks
 * run. Two reasons that matters and one that would be a bug: the sign-in form
 * cannot be an early return from a component that has already called useState
 * (the hook order would change between renders), and mounting this while locked
 * would fire its load() at an endpoint certain to answer 401 -- which the axios
 * interceptor reads as an expired session and acts on.
 */
function AccountsAdmin() {
  // `login` is how an edit to your own account reaches the session: it writes
  // the user back without touching the token, so a name or photo changed here
  // is the name and photo the rest of the app shows, rather than the snapshot
  // taken at sign-in.
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  // A quiet refresh cannot use `loading` -- that replaces the table with
  // "Loading accounts..." -- but it still has to be visible, or auto-refresh is
  // a preference with no observable effect at all: a re-read that finds nothing
  // new redraws exactly the same rows. These two are what the status line under
  // the search box reads.
  const [refreshing, setRefreshing] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [subsOpen, setSubsOpen] = useState(false);
  const [paymentsOpen, setPaymentsOpen] = useState(false);
  // Which corporate accounts have their seats showing. A set rather than one
  // open row: an administrator comparing two organisations wants both open.
  const [openSeats, setOpenSeats] = useState(() => new Set());
  const toggleSeats = (key) =>
    setOpenSeats((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  // Which accounts a bulk action would act on, by key.
  //
  // Keys rather than indexes or row objects: the table re-sorts, re-filters and
  // re-pages under the selection, and a selection held by position would end up
  // acting on whichever rows happened to slide into those slots. A key names one
  // account for as long as it exists.
  const [picked, setPicked] = useState(() => new Set());
  // What a bulk run is doing, so the bar can report progress rather than
  // freezing: { done, total, label }.
  const [bulk, setBulk] = useState(null);
  const [query, setQuery] = useState("");
  const [busyKey, setBusyKey] = useState(null);
  const [confirm, setConfirm] = useState(null); // { kind: "password" | "delete", account }
  // The account just deleted and the moment its copy expires, or null.
  //
  // Held here rather than in the notice string because it is an offer with a
  // deadline, not a message: it has to survive the next notice, and it has to
  // withdraw itself. `now` exists only to redraw the countdown -- see the tick
  // below, which runs only while there is something to count down.
  const [undo, setUndo] = useState(null); // { account, until }
  const [now, setNow] = useState(() => Date.now());
  const [newPassword, setNewPassword] = useState("");
  const [draft, setDraft] = useState(null); // the account being edited
  const [settings, setSettings] = useState(loadSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // The analytics panel loads its own data when it opens, so this is the whole
  // of its state here: nothing about landing-page traffic belongs in a page
  // about accounts, and nobody should pay for the query by arriving.
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  // Read rather than held: the store outlives this page, and the header re-renders
  // from it the moment the settings panel writes to it.
  const branding = useBranding();
  const [page, setPage] = useState(1); // 1-based, and clamped where it is read
  const [filter, setFilter] = useState("all"); // the left rail; see FILTERS
  // Kept apart from `settings`: the other two preferences are about this table,
  // while the theme is about the whole app and is stored where every screen
  // reads it. `themeChoice` is what the panel shows selected -- possibly
  // "auto" -- and `theme` is what this page paints.
  const { choice: themeChoice, theme, setTheme: applyTheme } = useAppTheme();

  /**
   * Applies and stores a preference change.
   *
   * One route in, so the panel cannot save something the table is not reading:
   * every control there hands its one changed key through here.
   */
  const changeSettings = (patch) =>
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      persistSettings(next);
      return next;
    });


  /**
   * Re-reads every account from the database.
   *
   * `quiet` leaves the loading flag alone, which is what an auto-refresh needs:
   * setting it would replace the whole table with "Loading accounts…" every
   * thirty seconds, so a preference meant to keep the list current would
   * instead make it unreadable. A failure is still reported either way — an
   * auto-refresh that silently stopped working is worse than a visible banner.
   */
  const load = useCallback(async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setAccounts(await listAccounts());
      setLastLoadedAt(Date.now());
    } catch (err) {
      setError(err.message);
    } finally {
      if (quiet) setRefreshing(false);
      else setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-refresh, when it is switched on. Held off entirely while a dialog is
  // open or a row is mid-write: re-reading under an open editor would replace
  // the record being edited with the server's copy of it, and the save that
  // followed would be an edit of something the administrator never saw.
  useEffect(() => {
    if (!settings.refreshMs || confirm || busyKey || bulk) return undefined;
    const id = setInterval(() => load({ quiet: true }), settings.refreshMs);
    return () => clearInterval(id);
  }, [settings.refreshMs, confirm, busyKey, bulk, load]);

  // The undo countdown, which runs only while there is an undo on offer -- a
  // timer ticking for the whole session to redraw something that is not on
  // screen is a re-render per second for nothing.
  //
  // Withdrawing the offer here rather than only refusing it at the server is
  // the point: the copy really is gone at the deadline, and a button that stays
  // put and then reports failure is a worse answer than one that leaves.
  useEffect(() => {
    if (!undo) return undefined;
    setNow(Date.now());
    const id = setInterval(() => {
      const t = Date.now();
      if (t >= undo.until) setUndo(null);
      else setNow(t);
    }, 1000);
    return () => clearInterval(id);
  }, [undo]);

  // A new search, order or page size means the pages are not the pages you were
  // moving through, so page 3 of the old list is not an answer about the new
  // one. A refresh is deliberately NOT in here: re-reading the same list must
  // not throw an administrator back to the top every thirty seconds.
  useEffect(() => {
    setPage(1);
  }, [query, filter, settings.sort, settings.pageSize]);

  // Matching is on the whole row rather than a chosen field: an administrator
  // looking someone up knows one thing about them and should not have to say
  // which thing it is.
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const inView = accounts.filter(filterFor(filter).match);
    const rows = q
      ? inView.filter((a) =>
          [fullName(a), a.email, a.phoneNumber, a.payment, a.role]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q)),
        )
      : inView;
    // Accounts that cannot sign in come first: they are the ones needing
    // attention, and on a long list they would otherwise never be noticed.
    // That is the default rather than the only order — an administrator who
    // came looking for one person wants the name where the alphabet says it is.
    const byName = (a, b) =>
      (fullName(a) || a.email || "").localeCompare(fullName(b) || b.email || "");
    return rows.slice().sort((a, b) => {
      // Compared as booleans: an account the server sent without the field at
      // all still belongs with the ones that cannot sign in, rather than
      // ordering arbitrarily against an explicit false.
      if (settings.sort === "attention" && !!a.canSignIn !== !!b.canSignIn) {
        return a.canSignIn ? 1 : -1;
      }
      return byName(a, b);
    });
  }, [accounts, filter, query, settings.sort]);

  // Paging is applied after the search and the sort, so a search reaches every
  // account rather than only the page you are standing on.
  const pageCount = Math.max(1, Math.ceil(shown.length / settings.pageSize));
  // Clamped on read rather than corrected in state: a delete or a refresh can
  // empty the last page, and clamping keeps the stored page as what was asked
  // for -- so a row coming back puts you where you were instead of on page 1.
  const currentPage = Math.min(page, pageCount);
  const firstIndex = (currentPage - 1) * settings.pageSize;
  const rows = shown.slice(firstIndex, firstIndex + settings.pageSize);

  // Counted once per load rather than per render: every entry walks the whole
  // list, and the list is re-read on a timer.
  const filterCounts = useMemo(
    () =>
      FILTERS.reduce((out, f) => {
        out[f.value] = accounts.filter(f.match).length;
        return out;
      }, {}),
    [accounts],
  );

  const isSelf = (account) =>
    !!user &&
    !!account.email &&
    account.email.toLowerCase() === String(user.email || "").toLowerCase();

  // The administrator's own row, for the account menu. Matched by email, the
  // same way isSelf does, so the row the menu opens is the row the table marks
  // "you" -- two different answers to "which of these is me" would be worse
  // than having only one of them.
  const me = useMemo(
    () =>
      accounts.find(
        (a) =>
          !!user &&
          !!a.email &&
          a.email.toLowerCase() === String(user.email || "").toLowerCase(),
      ) || null,
    [accounts, user],
  );

  // Why the menu's Profile item cannot be used, in the terms of the two things
  // that actually cause it: the table has not answered yet, or the signed-in
  // email is in no record -- which is a genuine state, since the session
  // survives the account being renamed or removed from under it.
  const profileBlocked = me
    ? null
    : loading
      ? "Still loading accounts…"
      : "No account in the database matches the email you are signed in with.";

  /**
   * Opens the administrator's own account in the same dialog the table's Edit
   * uses. Closes the settings panel on the way, so the two overlays are never
   * stacked — the one underneath would be unreachable and look broken.
   */
  const openProfile = () => {
    if (!me) return;
    setSettingsOpen(false);
    setDraft({ ...me });
    setConfirm({ kind: "edit", account: me });
  };

  /** The same, for the administrator's own password. */
  const openOwnPassword = () => {
    if (!me) return;
    setSettingsOpen(false);
    setNewPassword("");
    setConfirm({ kind: "password", account: me });
  };

  /**
   * Ends the session and returns to the sign-in screen.
   *
   * Navigating afterwards rather than relying on the gate: clearing the user
   * re-renders this page as AdminSignIn, which is a sign-in form sitting at
   * /SuperAdmin -- correct, but it reads as having been refused entry to a page
   * you just left rather than as having signed out.
   */
  const handleSignOut = () => {
    logout();
    navigate("/my-app");
  };

  // ---- selection --------------------------------------------------------
  // Everything below acts on the accounts still visible: filtering or searching
  // narrows what a bulk action can reach, which is the safe direction — a
  // selection that survived out of view could delete a row nobody could see.
  const selectable = shown.filter((a) => !isSelf(a));
  const selected = selectable.filter((a) => picked.has(a.key));
  const allSelected = selectable.length > 0 && selected.length === selectable.length;

  const toggleOne = (key) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  /** Selects every account the current filter and search leave visible. */
  const toggleAll = () =>
    setPicked(allSelected ? new Set() : new Set(selectable.map((a) => a.key)));

  const clearPicked = () => setPicked(new Set());

  /**
   * Runs one action across every selected account, in turn.
   *
   * Sequentially rather than in parallel, deliberately: these are writes to one
   * table through one connection, and twenty at once is how a rate limit or a
   * lock timeout turns a bulk edit into a partial one nobody can account for.
   * Slower, and every account either changed or is named as having failed.
   *
   * One failure does not stop the rest. The alternative — abandoning at the
   * first error — leaves the selection half applied with no way to tell which
   * half, which is the worst of both.
   *
   * @param {string} label what is being done, for the notice.
   * @param {(account: object) => Promise<object>} work one account's change.
   */
  const runBulk = async (label, work) => {
    const targets = selected;
    if (!targets.length) return;
    setError(null);
    setNotice(null);
    setBulk({ done: 0, total: targets.length, label });

    const failed = [];
    for (let i = 0; i < targets.length; i += 1) {
      const account = targets[i];
      setBusyKey(account.key);
      try {
        // eslint-disable-next-line no-await-in-loop
        const saved = await work(account);
        if (saved) replace(saved);
      } catch (err) {
        failed.push((fullName(account) || account.email) + ": " + err.message);
      }
      setBulk({ done: i + 1, total: targets.length, label });
    }

    setBusyKey(null);
    setBulk(null);
    clearPicked();
    const done = targets.length - failed.length;
    setNotice(
      label + " — " + done + " of " + targets.length + " account" + (targets.length === 1 ? "" : "s") + ".",
    );
    // Named, not counted: "3 failed" is not something anybody can act on, and
    // the accounts that failed are the whole point of the message.
    if (failed.length) setError(failed.length + " could not be changed — " + failed.join("; "));
  };

  const bulkRole = (role) =>
    runBulk("Set role to " + role, (a) => setRole(a.key, role));

  const bulkPayment = (payment) =>
    runBulk("Moved to " + payment, async (a) => {
      const saved = await setPayment(a.key, payment);
      return saved;
    });

  const bulkSignIn = (enabled) =>
    runBulk("Sign-in switched " + (enabled ? "on" : "off"), (a) => setSignIn(a.key, enabled));

  /**
   * Deletes every selected account.
   *
   * Behind the same confirmation the single delete uses, and for a stronger
   * reason: one row deleted by mistake is one undo away, and twenty is a
   * sentence somebody has to read before it happens. The undo banner only ever
   * holds one account, so it is deliberately not offered here — the honest
   * thing is to make the confirmation say how many, and mean it.
   */
  const bulkDelete = async () => {
    const targets = selected;
    if (!targets.length) return;
    if (
      !window.confirm(
        "Delete " + targets.length + " account" + (targets.length === 1 ? "" : "s") + "?\n\n" +
          targets
            .slice(0, 8)
            .map((a) => "  • " + (fullName(a) || a.email))
            .join("\n") +
          (targets.length > 8 ? "\n  … and " + (targets.length - 8) + " more" : "") +
          "\n\nThe single-row Undo does not cover a bulk delete.",
      )
    ) {
      return;
    }
    await runBulk("Deleted", async (a) => {
      await deleteAccount(a.key);
      setAccounts((list) => list.filter((x) => x.key !== a.key));
      return null;
    });
  };

  /** Replaces one account in place, so a change does not reorder the table under the pointer. */
  const replace = (saved) =>
    setAccounts((list) => list.map((a) => (a.key === saved.key ? saved : a)));

  /**
   * Runs one administrative action with the row marked busy.
   *
   * Every action shares this so that a failure always lands in the same banner
   * and the row can never be left spinning: the earlier screens in this app each
   * handled their own errors, and the ones that forgot simply looked frozen.
   */
  const run = async (key, work, success) => {
    setBusyKey(key);
    setError(null);
    setNotice(null);
    try {
      await work();
      setNotice(success);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyKey(null);
    }
  };

  const handleRole = (account, role) =>
    run(
      account.key,
      async () => replace(await setRole(account.key, role)),
      (fullName(account) || account.email) + " is now " + role + ".",
    );

  const handlePayment = (account, payment) =>
    run(
      account.key,
      async () => replace(await setPayment(account.key, payment)),
      (fullName(account) || account.email) + " is now on " + payment + ".",
    );

  const handleToggleSignIn = (account, enabled) =>
    run(
      account.key,
      async () => replace(await setSignIn(account.key, enabled)),
      "Sign-in " + (enabled ? "switched on" : "switched off") + " for " +
        (fullName(account) || account.email) + ".",
    );

  const handleEditConfirm = () => {
    const changes = changedFields(draft, confirm.account);
    if (!Object.keys(changes).length) {
      setConfirm(null);
      setNotice("Nothing was changed.");
      return;
    }
    // Checked here as well as on the server. The server's answer is the one
    // that counts, but a round trip to be told an email is malformed is a
    // worse way to find out than the form saying so.
    if ("email" in changes && !EMAIL_RE.test(changes.email)) {
      setError("That email address is not valid.");
      return;
    }
    if ("phoneNumber" in changes && changes.phoneNumber && changes.phoneNumber.length !== 10) {
      setError("A phone number must be exactly 10 digits.");
      return;
    }
    // Decided before the save, not after: an edit may change the very email
    // isSelf compares on, and asking afterwards would answer "no" for exactly
    // the edit that most needs the session updating.
    const mine = isSelf(confirm.account);
    return run(
      confirm.account.key,
      async () => {
        const saved = await updateAccount(confirm.account.key, changes);
        replace(saved);
        if (mine) login({ ...user, ...sessionFields(saved) });
        setConfirm(null);
        setDraft(null);
      },
      "Saved " + Object.keys(changes).length + " change(s) to " +
        (fullName(draft) || draft.email) + ".",
    );
  };

  const handleResetConfirm = () =>
    run(
      confirm.account.key,
      async () => {
        replace(await resetPassword(confirm.account.key, newPassword));
        setConfirm(null);
        setNewPassword("");
      },
      "Password set for " + (fullName(confirm.account) || confirm.account.email) + ".",
    );

  const handleDeleteConfirm = () => {
    // Captured before the request: `confirm` is cleared inside it, and the undo
    // offer needs the account to name it by after that.
    const account = confirm.account;
    return run(
      account.key,
      async () => {
        const { restorableUntil } = await deleteAccount(account.key);
        setAccounts((list) => list.filter((a) => a.key !== account.key));
        setConfirm(null);
        // Offered only when the server said how long it is holding the copy. An
        // older backend answers without that field, and an Undo button with
        // nothing behind it is worse than no button at all.
        if (restorableUntil) setUndo({ account, until: Date.parse(restorableUntil) });
      },
      (fullName(account) || account.email) + " was deleted.",
    );
  };

  /**
   * Takes the deletion back.
   *
   * The account comes back from the server rather than from the row this page
   * still has: the restore re-reads the stored record, so what lands in the
   * table is what the database now holds, hash and all.
   */
  const handleRestore = () => {
    const account = undo.account;
    return run(
      account.key,
      async () => {
        const restored = await restoreAccount(account.key);
        setAccounts((list) => [...list.filter((a) => a.key !== restored.key), restored]);
        setUndo(null);
      },
      (fullName(account) || account.email) + " was restored.",
    );
  };

  // Who is signed in, from the table's row where it has loaded and from the
  // session until then -- the same order AccountMenu uses, so the button and the
  // line under it never name two different people.
  //
  // No email fallback on the name, unlike the menu's: the email is on the line
  // directly below, and an account with no first or last name would otherwise
  // print it twice.
  const signedInName = fullName(me || user || {}) || null;
  const signedInEmail = (me || user || {}).email || null;

  // Both preferences are read out on the page, because neither is reliably
  // visible in the table itself: while every account can sign in the two sort
  // orders are the same list, and a timed re-read that finds no change leaves
  // the screen untouched. Without this, changing either one in the panel looks
  // like nothing happened.
  const sortLabel = (SORT_ORDERS.find((o) => o.value === settings.sort) || SORT_ORDERS[0]).label;
  const filterLabel = filterFor(filter).label;
  const refreshChoice =
    REFRESH_CHOICES.find((o) => o.value === settings.refreshMs) || REFRESH_CHOICES[0];
  const refreshStatus =
    (lastLoadedAt ? "Read at " + new Date(lastLoadedAt).toLocaleTimeString() : "Not read yet") +
    (settings.refreshMs ? " — auto-refresh every " + refreshChoice.label : " — auto-refresh off");

  return (
    // The `dark` class goes on a wrapper rather than on <html>, so the theme is
    // scoped to this page and leaves nothing behind when you navigate away.
    // Tailwind's dark variant is a descendant selector, which is why it cannot
    // sit on the element that also carries the dark: classes -- and why the
    // dialogs work: they are `fixed`, but they are still inside this div.
    <div className={theme === "dark" ? "dark" : undefined}>
      {/* A column that owns the window's height. Everything below divides that
          height up, which is what lets the rail and the accounts panel reach the
          bottom edge on a short list instead of stopping under the last row and
          leaving a band of empty page beneath them. */}
      <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-900 px-4 py-5 md:px-8">
      {/* Wider than the 6xl a page of prose would take: the table carries six
          columns ending in three buttons, and at 1152px the last of them sat
          behind a horizontal scrollbar on a normal laptop. Still capped, so on
          a very wide monitor the row does not stretch to arm's length. */}
      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col">
        {/* The rail runs the full height of the page and the header sits over
            the accounts panel only. It used to span both columns, which put the
            page title above the rail rather than above the thing it titles, and
            left the brand mark hanging a header's height below the top of the
            page with nothing beside it. */}
        <div className="flex flex-1 flex-col gap-4 md:min-h-0 md:flex-row">
        {/* The rail is a column of cards, so the width lives here rather than
            on the filter nav that used to be the only thing in it.

            order-last below md: the two columns stack there, and the rail is
            first in the DOM because it is first on screen once they are side by
            side. Stacked, that would bury the page title and its controls under
            three cards, so on a phone the rail follows the table instead. */}
        <div className="order-last flex flex-col gap-4 md:order-none md:w-56 md:flex-shrink-0">
          {/* Bare rather than in a card of its own: it names the page, and a
              card would make it look like a third thing you can act on. */}
          <BrandLockup />
          <AccountFilters value={filter} counts={filterCounts} onChange={setFilter} />
          <RailActions
            onSettings={() => setSettingsOpen(true)}
            onSubscriptions={() => setSubsOpen(true)}
            onPayments={() => setPaymentsOpen(true)}
            onAnalytics={() => setAnalyticsOpen(true)}
            onSignOut={handleSignOut}
          />
        </div>

        {/* min-w-0 so the table's own horizontal scroll works inside the flex
            row: without it the flex item takes the table's min-content width
            and pushes the rail off the page. */}
        <div className="flex min-w-0 flex-1 flex-col md:min-h-0">
        {/* items-center now that both sides are one row deep. It was items-start
            against a three-row right-hand side — controls, then the name and the
            email stacked under them — which left the title alone at the top of a
            band of empty header. The name and the email have moved into the row
            itself, beside the avatar they describe. */}
        <header className="mb-4 flex flex-wrap items-center justify-between gap-4">
          {/* The lockup used to sit here, left of the title. It is at the head
              of the rail now — see BrandLockup and the rail below. */}
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Super Admin</h1>
            {/* Restoring this needs its count back with it, which is why the
                derivation lives in here rather than above as an unused const:
                  const noPasswordCount = accounts.filter((a) => !a.canSignIn).length;

            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Every account in the database — {accounts.length} total
              {noPasswordCount > 0 && (
                <span className="text-amber-700 dark:text-amber-400">, {noPasswordCount} unable to sign in</span>
              )}
              .
            </p> */}
          </div>
          {/* The controls, and who is using them. The email was only readable
              by opening the account menu, which is two clicks to answer "which
              account am I signed in as" -- the question you ask before changing
              somebody else's role. Taken from the table's own record when it
              has loaded, falling back to the session, so it agrees with the row
              the table marks "you". */}
          <div className="flex items-center gap-3">
            <Link
              to="/NewRegistration"
              className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
           + Add account
            </Link>
            <button
              type="button"
              onClick={() => load()}
              disabled={loading || refreshing}
              title={refreshStatus}
              className="inline-flex items-center gap-2 rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              <ArrowPathIcon className={"h-4 w-4 " + (loading || refreshing ? "animate-spin" : "")} />
            </button>
            {/* Who is administering, and their own account. This page could
                change everyone's details but the administrator's own, which had
                to be found in the table like anyone else's -- and it offered no
                way out of the session at all. */}
            <span className="mx-1 h-8 w-px self-center bg-gray-200 dark:bg-gray-700" aria-hidden="true" />
            {/* Beside the avatar rather than stacked under the whole control
                row: these two lines label that avatar, and read as its caption
                only when they sit next to it. Right-aligned so they run up
                against it. The name leads and the email follows in a lighter
                weight — the name is what an administrator recognises themselves
                by, and the email is what distinguishes two people who share
                one. Hidden below sm, where the row has no width to spare and
                the account menu carries both anyway. */}
            {(signedInName || signedInEmail) && (
              <div className="hidden text-right leading-tight sm:block">
                {signedInName && (
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{signedInName}</p>
                )}
                {signedInEmail && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">{signedInEmail}</p>
                )}
              </div>
            )}
            <AccountMenu
              account={me}
              user={user}
              profileBlocked={profileBlocked}
              onProfile={openProfile}
            />
          </div>
        </header>

        {/* Both banners carry a dismiss. They are the same thing in two
            colours — a report of what just happened — and neither has any
            business staying on screen once it has been read. The next action
            replaces them anyway; this is the way out when there is no next
            action, which is most of the time after a successful save. */}
        {error && (
          <div
            role="alert"
            className="mb-4 flex items-start gap-2 rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/25 px-4 py-3 text-sm text-red-800 dark:text-red-300"
          >
            <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span className="flex-1">{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              title="Dismiss"
              aria-label="Dismiss this message"
              className="-my-1 -mr-1 flex-shrink-0 rounded-md p-1 text-red-700 hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-900/40"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        )}
        {notice && (
          <div
            role="status"
            className="mb-4 flex items-start gap-2 rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/25 px-4 py-3 text-sm text-green-800 dark:text-green-300"
          >
            <CheckCircleIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span className="flex-1">{notice}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              title="Dismiss"
              aria-label="Dismiss this message"
              className="-my-1 -mr-1 flex-shrink-0 rounded-md p-1 text-green-700 hover:bg-green-100 dark:text-green-300 dark:hover:bg-green-900/40"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        )}
        {/* The way back from a deletion. Amber rather than green: this is not a
            result to acknowledge, it is a window that is closing. Its own banner
            rather than a button inside the notice above, because the notice is
            replaced by whatever the administrator does next and this must not
            be -- the whole point is that it survives long enough to be noticed
            and pressed. */}
        {undo && (
          <div
            role="status"
            className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/25 px-4 py-3 text-sm text-amber-900 dark:text-amber-200"
          >
            <ArrowUturnLeftIcon className="h-4 w-4 flex-shrink-0" />
            <span className="flex-1">
              <b>{fullName(undo.account) || undo.account.email}</b> was deleted. The account can
              still be put back — password and all — for another{" "}
              {/* Not aria-live: a countdown announced every second would talk
                  over everything else on the page. The banner itself announces
                  once, and the deadline is in the button's title. */}
              <span className="font-mono font-semibold tabular-nums">
                {countdown(undo.until - now)}
              </span>
              .
            </span>
            <button
              type="button"
              onClick={handleRestore}
              disabled={busyKey === undo.account.key}
              title={"Restore this account — possible until " + new Date(undo.until).toLocaleTimeString()}
              className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
            >
              <ArrowUturnLeftIcon className="h-3.5 w-3.5" />
              {busyKey === undo.account.key ? "Restoring…" : "Undo delete"}
            </button>
            <button
              type="button"
              onClick={() => setUndo(null)}
              title="Dismiss — the account stays deleted"
              className="rounded-md border border-amber-300 dark:border-amber-700 px-2.5 py-1.5 text-xs font-semibold text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="relative mb-4">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, phone, payment or role"
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 py-2 pl-9 pr-3 text-sm focus:border-green-500 focus:outline-none dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
          />
        </div>

        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-gray-500 dark:text-gray-400">
          <span>
            {shown.length === accounts.length
              ? shown.length + " accounts"
              : shown.length + " of " + accounts.length + " accounts"}
            {filter === "all" ? "" : " — " + filterLabel}
            {" — sorted: "}
            <span className="font-semibold text-green-700 dark:text-green-400">{sortLabel}</span>
          </span>
          <span className={refreshing ? "text-green-700 dark:text-green-400" : undefined}>
            {refreshing ? "Refreshing…" : refreshStatus}
          </span>
        </div>

        {/* The bulk bar, above the table it acts on and only while something
            is selected. Above rather than floating: it is the one thing on this
            screen that acts on many records at once, and a control like that
            should be somewhere fixed and obvious rather than appearing over the
            rows it is about to change. */}
        {selected.length > 0 && (
          <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-900/25 px-3 py-2">
            <span className="text-sm font-semibold text-green-900 dark:text-green-200">
              {selected.length} selected
            </span>

            {bulk ? (
              <span className="text-xs text-green-900 dark:text-green-200">
                {bulk.label} — {bulk.done} of {bulk.total}…
              </span>
            ) : (
              <>
                <label className="flex items-center gap-1 text-xs text-gray-700 dark:text-gray-200">
                  Role
                  <select
                    value=""
                    onChange={(e) => e.target.value && bulkRole(e.target.value)}
                    className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 dark:text-gray-100 px-2 py-1 text-xs"
                    aria-label="Set the role on every selected account"
                  >
                    <option value="">change…</option>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex items-center gap-1 text-xs text-gray-700 dark:text-gray-200">
                  Plan
                  <select
                    value=""
                    onChange={(e) => e.target.value && bulkPayment(e.target.value)}
                    className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 dark:text-gray-100 px-2 py-1 text-xs"
                    aria-label="Set the plan on every selected account"
                  >
                    <option value="">change…</option>
                    {PLANS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label || o.value}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  onClick={() => bulkSignIn(true)}
                  className="rounded-md border border-gray-300 dark:border-gray-600 px-2.5 py-1 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-700"
                  title="Let every selected account sign in"
                >
                  Sign-in on
                </button>
                <button
                  type="button"
                  onClick={() => bulkSignIn(false)}
                  className="rounded-md border border-gray-300 dark:border-gray-600 px-2.5 py-1 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-700"
                  title="Stop every selected account signing in. The password is untouched."
                >
                  Sign-in off
                </button>

                <button
                  type="button"
                  onClick={bulkDelete}
                  className="rounded-md border border-red-300 dark:border-red-800 px-2.5 py-1 text-xs font-semibold text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
                  title="Delete every selected account. The single-row Undo does not cover this."
                >
                  Delete
                </button>

                <span className="flex-1" />
                <button
                  type="button"
                  onClick={clearPicked}
                  className="rounded-md px-2.5 py-1 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700"
                >
                  Clear
                </button>
              </>
            )}
          </div>
        )}

        <div className="overflow-auto rounded-xl border border-gray-200 dark:border-green-700 bg-white dark:bg-gray-800 shadow-sm md:min-h-0 md:flex-1">
          <table className="w-full min-w-[820px] text-left text-sm">
            {/* No ground, no rule and no sticky here -- they are on the cells;
                see TH. What is left is the inherited text, which a row group
                does carry. */}
            <thead className="text-xs uppercase tracking-wide text-green-600 dark:text-green-400">
              <tr>
                <th className={TH}>
                  {/* Selects everything the current filter and search leave
                      visible — not every account in the database. Narrowing the
                      table is how a bulk action is aimed, so "all" has to mean
                      "all of these". */}
                  <input
                    type="checkbox"
                    checked={allSelected}
                    // Some but not all: the box shows neither ticked nor empty,
                    // because both would misstate what pressing it does.
                    ref={(el) => {
                      if (el) el.indeterminate = selected.length > 0 && !allSelected;
                    }}
                    onChange={toggleAll}
                    disabled={!selectable.length}
                    aria-label="Select every account shown"
                    title={
                      selectable.length
                        ? "Select the " + selectable.length + " account(s) shown"
                        : "Nothing to select"
                    }
                    className="h-4 w-4 cursor-pointer accent-green-600"
                  />
                </th>
                {/* Position in the list as it is currently sorted and filtered,
                    not a stable id: it is there to count and to point at a row
                    out loud ("the third one"), so it renumbers when the list
                    does. */}
                <th className={TH + " font-semibold text-right"}>#</th>
                <th className={TH + " font-semibold"}>Account</th>
                <th className={TH + " font-semibold"}>Phone</th>
                <th className={TH + " font-semibold"}>Payment</th>
                <th className={TH + " font-semibold"}>Role</th>
                <th className={TH + " font-semibold"}>Can sign in</th>
                <th className={TH} />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                    Loading accounts…
                  </td>
                </tr>
              )}
              {!loading && !shown.length && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                    {!accounts.length
                      ? "No accounts in the database."
                      : query
                        ? "No account matches that search" +
                          (filter === "all" ? "." : " in " + filterLabel + ".")
                        : "No account in " + filterLabel + "."}
                  </td>
                </tr>
              )}
              {!loading &&
                rows.flatMap((account, i) => [
                  // `position` counts from the start of the filtered list, not
                  // the start of the page: page 2 continues at 11 rather than
                  // restarting at 1, which is what the "n accounts" count above
                  // the table is counting.
                  <AccountRow
                    key={account.key}
                    account={account}
                    position={firstIndex + i + 1}
                    isSelf={isSelf(account)}
                    busy={busyKey === account.key}
                    picked={picked.has(account.key)}
                    seatsOpen={openSeats.has(account.key)}
                    onSeats={toggleSeats}
                    onPick={toggleOne}
                    onRole={handleRole}
                    onToggleSignIn={handleToggleSignIn}
                    onEdit={(a) => {
                      setDraft({ ...a });
                      setConfirm({ kind: "edit", account: a });
                    }}
                    onReset={(a) => {
                      setNewPassword("");
                      setConfirm({ kind: "password", account: a });
                    }}
                    onDelete={(a) => setConfirm({ kind: "delete", account: a })}
                  />,
                  // The seats, as a row of their own spanning the table. Not a
                  // nested table: these are accounts in the same list, and the
                  // useful thing is seeing which owner they sit under, not a
                  // second set of columns.
                  openSeats.has(account.key) && account.seats && account.seats.length > 0 ? (
                    <tr key={account.key + "-seats"} className="border-b border-gray-100 dark:border-gray-700 bg-indigo-50/50 dark:bg-indigo-900/10">
                      <td colSpan={2} />
                      <td colSpan={6} className="px-4 py-2">
                        <div className="text-[11px] font-bold uppercase tracking-wide text-indigo-800 dark:text-indigo-300">
                          {account.seats.length} seat{account.seats.length === 1 ? "" : "s"} on this team
                        </div>
                        <ul className="mt-1 space-y-1">
                          {account.seats.map((seat) => {
                            // The seat's own account, when it has one. A seat
                            // held for somebody who has not registered is a
                            // normal state and worth showing as itself.
                            const held = accounts.find(
                              (a) => String(a.email || "").toLowerCase() === seat,
                            );
                            return (
                              <li key={seat} className="flex flex-wrap items-center gap-2 text-xs">
                                <span className="font-medium text-gray-800 dark:text-gray-100">
                                  {held ? fullName(held) || seat : seat}
                                </span>
                                {/* Broken out of the single dot-joined string
                                    this used to be so the plan can wear the
                                    same pill the column above does. The gap
                                    separates the parts now, which is why the
                                    dots are gone: a pill with a dot either
                                    side of it reads as punctuation twice. */}
                                {held ? (
                                  <>
                                    <span className="text-gray-500 dark:text-gray-400">{held.email}</span>
                                    <PlanPill payment={held.payment} empty="no plan" />
                                    {!held.canSignIn && (
                                      <span className="text-gray-500 dark:text-gray-400">sign-in off</span>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-gray-500 dark:text-gray-400">
                                    invited — no account yet
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </td>
                    </tr>
                  ) : null,
                ])}
            </tbody>
          </table>
        </div>

        <Pagination
          total={shown.length}
          page={currentPage}
          pageCount={pageCount}
          pageSize={settings.pageSize}
          from={shown.length ? firstIndex + 1 : 0}
          to={firstIndex + rows.length}
          onPage={setPage}
          onPageSize={(pageSize) => changeSettings({ pageSize })}
        />
        </div>
        </div>
      </div>

      {analyticsOpen && (
        // The same cadence the table above is using, handed down rather than
        // chosen again: one Auto-refresh control governs the whole screen.
        <HomePageAnalyticsModal
          refreshMs={settings.refreshMs}
          refreshLabel={refreshChoice.label}
          onClose={() => setAnalyticsOpen(false)}
        />
      )}

      {/* Handed the table's own rows rather than reading the accounts again:
          two reads would be two answers, and the panel that disagreed would be
          the one nobody is looking at when it goes stale. */}
      {paymentsOpen && <PaymentsModal onClose={() => setPaymentsOpen(false)} />}

      {subsOpen && (
        <SubscriptionsModal
          accounts={accounts}
          busyKey={busyKey}
          onPlan={handlePayment}
          onClose={() => setSubsOpen(false)}
        />
      )}

      {settingsOpen && (
        <UserSettingsModal
          user={user}
          account={me}
          accountBlocked={profileBlocked}
          settings={settings}
          onChange={changeSettings}
          branding={branding}
          onBranding={saveBranding}
          onResetBranding={resetBranding}
          theme={theme}
          themeChoice={themeChoice}
          onTheme={applyTheme}
          onProfile={openProfile}
          onPassword={openOwnPassword}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {confirm && confirm.kind === "edit" && draft && (
        <Dialog
          title={
            isSelf(confirm.account)
              ? "Your profile"
              : "Edit " + (fullName(confirm.account) || confirm.account.email)
          }
          wide
          confirmLabel="Save changes"
          busy={busyKey === confirm.account.key}
          onConfirm={handleEditConfirm}
          onCancel={() => {
            setConfirm(null);
            setDraft(null);
          }}
        >
          <EditFields
            draft={draft}
            isSelf={isSelf(confirm.account)}
            onChange={(field, value) => setDraft((d) => ({ ...d, [field]: value }))}
          />
        </Dialog>
      )}

      {confirm && confirm.kind === "password" && (
        <Dialog
          title={"Set a password for " + (fullName(confirm.account) || confirm.account.email)}
          confirmLabel="Set password"
          busy={busyKey === confirm.account.key}
          onConfirm={handleResetConfirm}
          onCancel={() => setConfirm(null)}
        >
          <p className="mb-3">
            This replaces the current password immediately. Tell them what it is — it is hashed on
            the server and cannot be read back.
          </p>
          <input
            type="text"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 8 characters"
            autoFocus
            className={INPUT}
          />
        </Dialog>
      )}

      {confirm && confirm.kind === "delete" && (
        <Dialog
          title="Delete this account?"
          tone="danger"
          confirmLabel="Delete"
          busy={busyKey === confirm.account.key}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setConfirm(null)}
        >
          {/* The window is stated as "a few minutes" rather than as a number:
              the server owns the retention period and reports the deadline, and
              a figure written here would be the copy that goes stale. The exact
              time is on the banner that follows, as a countdown. */}
          <p>
            <b>{fullName(confirm.account) || confirm.account.email}</b> will be removed from the
            database. An Undo button appears for a few minutes afterwards and puts the account
            back complete, password included; once it goes, this cannot be reversed. Anything
            they recorded keeps their name on it either way.
          </p>
        </Dialog>
      )}
      </div>
    </div>
  );
}

/**
 * The page: its own sign-in when the visitor is not a Super Admin, the account
 * table when they are.
 *
 * The gate lives here rather than in the router because a route guard has only
 * one move -- send the visitor somewhere else. That means the main login screen,
 * which then has to carry the interrupted destination and hand it back, and a
 * signed-in Receptionist gets bounced to a page that never explains why. Asking
 * on the spot is both shorter and clearer, and the answer is immediate: the
 * context updates and this re-renders as the table, with nothing to navigate to.
 *
 * Worth being exact about what this is: it decides what to DRAW. The protection
 * is that /api/admin establishes the caller's role from a signed token and the
 * stored record before it answers -- see Backend/requireRole.js. Someone who
 * edits their way past this form lands on a table whose every request is
 * refused, which is the difference between a gate and a lock.
 */
export default function SuperAdmin() {
  const { user } = useAuth();

  // Folded comparison, shared with the router and the account menu, so a role
  // stored as "super admin" is not turned away from its own page.
  if (!roleAllowed(PRIVILEGED_ROLES, user && user.role)) {
    return <AdminSignIn roles={PRIVILEGED_ROLES} />;
  }

  return <AccountsAdmin />;
}
