// May the calling account use this capability?
//
// The browser asks the same question (src/plans.js) to decide what to draw, and
// that is all it is for: a disabled button is a courtesy, not a control. This is
// the control. Everything a plan grants has to be refused here too, or the plan
// is a suggestion that anyone with a fetch call can ignore.
//
// The tier rules are deliberately the same ones the browser uses, but they are
// applied to the catalogue read from the database rather than to a copy sent by
// the caller — a client that could name its own plan could name the top one.
const { catalogue } = require('./plansDb');
const { isPrivilegedRole } = require('./accounts');

/**
 * Every capability a plan carries: its own, and every earlier tier's.
 *
 * The same accumulate-by-position rule as src/plans.js. Written twice because
 * this file cannot import an ES module and that one cannot import a CommonJS
 * one — the same reason the roles and the payment options are also stated in
 * both halves. The catalogue itself is shared, which is the part that matters:
 * a plan added to the database is a plan here without anyone editing this file.
 *
 * @param {object[]} plans the catalogue, in tier order.
 * @param {string} name the plan to resolve.
 * @returns {string[]} capability ids.
 */
function capabilitiesOf(plans, name) {
  const at = plans.findIndex((p) => p.value === name);
  // An unrecognised plan is the first tier, matching the browser: an account
  // recorded before a plan existed, or carrying one since renamed, keeps the
  // floor rather than being refused everything.
  const upTo = at < 0 ? 0 : at;
  return plans.slice(0, upTo + 1).flatMap((p) => (Array.isArray(p.adds) ? p.adds : []));
}

/**
 * Whether an account may use a capability.
 *
 * A Super Admin may always, for the reason the browser gives: they administer
 * the plans, including their own, so a Super Admin refused by the field they
 * are there to edit is a loop with no way out.
 *
 * @param {object|null} account the caller, as established by authenticate.
 * @param {string} capability one of the ids in the catalogue's `adds`.
 * @returns {Promise<boolean>}
 */
async function accountCan(account, capability) {
  if (!account) return false;
  if (isPrivilegedRole(account.role)) return true;
  const { plans } = await catalogue();
  return capabilitiesOf(plans, account.payment).includes(capability);
}

/**
 * Middleware: refuses a caller whose plan does not include `capability`.
 *
 * 402 rather than 403. They are authenticated and their role is fine — what is
 * missing is the plan, and that is a different remedy: signing in again will not
 * help, buying the tier will. The body names the plan that carries it so the
 * client can say so without a second request.
 *
 * Mounted after `authenticate`; without req.account it refuses everyone, which
 * is the safe direction for a guard that has been wired up wrongly.
 *
 * @param {string} capability
 * @returns {import('express').RequestHandler}
 */
function requirePlan(capability) {
  return async (req, res, next) => {
    try {
      if (await accountCan(req.account, capability)) {
        next();
        return;
      }
      const { plans } = await catalogue();
      const needed = plans.find((p) => (p.adds || []).includes(capability));
      res.status(402).json({
        error: needed
          ? `Your plan does not include this. It is part of ${needed.value}.`
          : 'Your plan does not include this.',
        capability,
        needed: needed ? needed.value : null,
      });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { requirePlan, accountCan, capabilitiesOf };
