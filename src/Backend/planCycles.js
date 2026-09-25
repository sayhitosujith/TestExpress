// A paid plan's billing cycle: no new table, computed from planChangesDb's
// existing history.
//
// A cycle only exists for an account that is (a) on a plan with a real price
// and (b) has at least one recorded plan change to anchor it to. An account
// whose payment field was set directly at registration, or by an admin edit
// made before this feature existed, has no real "when did this start" --
// inventing one would be a fabricated date with no payment behind it. Such
// an account is exempt until its plan next genuinely changes, at which point
// planChangesDb records the moment that becomes the anchor.
//
// Renewal is manual, not automatic: this app's Razorpay integration creates
// one-time orders (see routes/checkout.js), not recurring subscriptions --
// building real auto-charge would mean integrating Razorpay's separate
// Subscriptions API. A lapsed cycle instead blocks sign-in the same way an
// unpaid new signup already does, and emails a fresh checkout link. A cycle
// that is merely close to lapsing gets a one-time heads-up instead -- see
// isCycleNearExpiry -- so renewal is not always a surprise sprung at the
// moment sign-in already stopped working.
const CYCLE_DAYS = 30;

// How far out "near expiry" starts. A separate constant from CYCLE_DAYS
// rather than a fraction of it: the two answer different questions -- one is
// how long a cycle lasts, the other is how much runway is worth a heads-up --
// and tying them together would move the reminder window as a side effect of
// ever changing the cycle length.
const REMINDER_DAYS_BEFORE = 3;

/**
 * When a cycle anchored at `lastChangeAt` runs out.
 *
 * @param {string} lastChangeAt ISO timestamp of the most recent plan_changes
 *   row for this account.
 * @returns {string} ISO timestamp.
 */
function cycleExpiry(lastChangeAt) {
  return new Date(new Date(lastChangeAt).getTime() + CYCLE_DAYS * 24 * 3600 * 1000).toISOString();
}

/**
 * Whether a cycle expiry is in the past. `null`/absent is not lapsed -- it
 * means no cycle applies to this account at all (see the file note above),
 * which is a different thing from one that has run out.
 *
 * @param {string|null} expiresAt
 * @returns {boolean}
 */
function isCycleLapsed(expiresAt) {
  return Boolean(expiresAt) && new Date(expiresAt).getTime() < Date.now();
}

/**
 * Whether a cycle is still current but due soon enough to warn about -- the
 * window for the one-time renewal reminder, as opposed to isCycleLapsed's
 * "already blocked". Only true in the gap between now and REMINDER_DAYS_BEFORE
 * out; a cycle that already lapsed is not "near" expiry, it is past it, and
 * gets the lapse email instead.
 *
 * @param {string|null} expiresAt
 * @returns {boolean}
 */
function isCycleNearExpiry(expiresAt) {
  if (!expiresAt) return false;
  const msLeft = new Date(expiresAt).getTime() - Date.now();
  return msLeft > 0 && msLeft <= REMINDER_DAYS_BEFORE * 24 * 3600 * 1000;
}

module.exports = { CYCLE_DAYS, REMINDER_DAYS_BEFORE, cycleExpiry, isCycleLapsed, isCycleNearExpiry };
