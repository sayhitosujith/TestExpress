// Account administration for the Super Admin page.
//
// Everything here operates on the DATABASE, not on a browser's localStorage,
// and that is the whole point of the page: NewRegistration edits the local copy
// and lets dbSync mirror it, which works for the account you are sitting in
// front of and not at all for anyone else's. An administrator changing someone
// else's role or clearing a forgotten password has to reach the stored record.
//
// Two consequences worth stating rather than discovering:
//
//   * a change made here reaches other browsers on their next hydrate. Until
//     then a stale tab still holds the old copy, and if it pushes first it can
//     put the old value back. That race is inherent to mirroring localStorage
//     to a database and is not introduced by this route.
//   * this route no longer trusts its caller. Every endpoint below sits behind
//     `authenticate` and `requireRole('Super Admin')`, so the role is one the
//     server established from a token it signed and then looked up in the
//     database -- not one the browser asserted. The gate on /SuperAdmin in the
//     app is now a convenience that hides a screen nobody else can use, rather
//     than the only thing standing in the way.
//
// No endpoint here ever returns a password or a hash: everything goes out
// through publicUser, and "can this account sign in?" is answered as a boolean.
const express = require('express');
const { store, registrationKey } = require('../registrationsDb');
const { isHashed } = require('../passwords');
const { publicUser, findByKey, requireConfig, PRIVILEGED_ROLES } = require('../accounts');
const { authenticate, requireRole } = require('../requireRole');
// The recycle bin behind Delete/Undo. Its own module because it is a store, not
// a route, and because nothing else in the app should have to know it exists.
const { archive, take } = require('../deletedAccountsDb');

const router = express.Router();

// Mounted on the router rather than repeated per endpoint, deliberately: an
// endpoint added later inherits the guard instead of needing someone to
// remember it. Forgetting to protect a new route on an admin API is not a
// mistake that announces itself.
//
// requireConfig comes first so a server with no DATABASE_URL still answers with
// its setup steps rather than with 401 -- "sign in" is misleading advice when
// there is nothing to sign in against.
router.use(requireConfig, authenticate, requireRole(...PRIVILEGED_ROLES));

// The roles the registration screen offers. Kept as an allow-list because the
// role decides what someone can reach, so "whatever the client sent" is not an
// acceptable answer -- a typo would silently create a role nothing recognises,
// and an arbitrary string is how you grant yourself one.
// Must stay in step with ALL_ROLES in src/routeAccess.js, which is the copy the
// registration form and the Super Admin table render.
const ROLES = ['Super Admin', 'User'];

// The same list the registration form renders, read from the file both halves
// share. Validated here as well as chosen there: the form is not the only way
// to reach this endpoint, and a payment nothing offers would show as a blank
// control the next time somebody opened the record.
// Read per request rather than frozen at require time: the catalogue lives in
// the database now (see ../plansDb), so a plan added there has to be accepted
// without restarting the server. plansDb falls back to paymentOptions.json when
// there is no database, which is the same list this used to be.
const { planValues } = require('../plansDb');
// Who moved which account between plans. Recorded here rather than in the
// client, because this is the one place a plan actually changes.
const planChanges = require('../planChangesDb');
// Team seats, read here rather than through the corporate router: that one is
// scoped to the caller's own team by design, which is precisely what an
// administrator looking at somebody else's is not.
const team = require('../teamDb');

// Fields an administrator may change. An allow-list, so a caller cannot reach
// past the profile into the credential: 'password' has its own endpoint that
// hashes it, 'passwordHash' must never be settable directly at all, and the
// registration key is the record's identity rather than one of its fields.
const EDITABLE = [
  'firstName',
  'lastName',
  'email',
  'phoneNumber',
  'zipCode',
  'payment',
  'role',
  'profilePicture',
  // Switching sign-in off. Deliberately a flag rather than clearing the
  // password hash: clearing it would work, and would be irreversible -- the
  // plaintext is not recoverable, so switching the account back on would mean
  // inventing a new password for someone who already has one.
  'signInDisabled',
];

/**
 * A stored registration as the admin table needs it.
 *
 * publicUser plus two things the table cannot work out for itself: the key to
 * address the record by, and whether the account has a usable bcrypt hash. That
 * second one is the column that matters -- an account with no hash exists, can
 * be edited, and cannot sign in, and nothing else on the screen would show it.
 */
const adminView = (user) => ({
  ...publicUser(user),
  key: registrationKey(user),
  // The two independent reasons an account cannot sign in, kept apart because
  // the screen has to act on them differently: a missing password is fixed by
  // setting one, a disabled account by switching it back on. Collapsing them
  // into a single boolean would leave the toggle offering to enable an account
  // that has no password to enable.
  hasPassword: isHashed(user.passwordHash),
  signInDisabled: !!user.signInDisabled,
  // How this account gets in, when not by password.
  authProvider: user.authProvider || null,
  // A password OR a federated identity. Without the second half, an account
  // created through Google — which has no hash by design — would show in this
  // table as unable to sign in, next to a switch that is already on.
  canSignIn: (isHashed(user.passwordHash) || Boolean(user.authProvider)) && !user.signInDisabled,
});

/**
 * Why one set of changes must be refused, or null if it may proceed.
 *
 * Separate from the route so the rules read as rules. Only fields actually
 * present are checked: this is a PATCH, and "absent" means "leave alone",
 * which is not the same as "set to empty".
 *
 * @param {object} changes the requested field changes.
 * @returns {string|null} a message for the caller, or null.
 */
async function rejectionReason(changes) {
  const unknown = Object.keys(changes).filter((k) => !EDITABLE.includes(k));
  if (unknown.length) return 'cannot change: ' + unknown.join(', ');
  if ('role' in changes && !ROLES.includes(changes.role)) {
    return 'role must be one of: ' + ROLES.join(', ');
  }
  if ('payment' in changes && changes.payment) {
    const payments = await planValues();
    if (!payments.includes(changes.payment)) {
      return 'payment must be one of: ' + payments.join(', ');
    }
  }
  // A real boolean, not "false" or 0. A truthy string would switch sign-in
  // off for an account somebody meant to switch on.
  if ('signInDisabled' in changes && typeof changes.signInDisabled !== 'boolean') {
    return 'signInDisabled must be true or false';
  }
  // Required rather than merely well-formed: sign-in looks an account up by
  // address, so blanking it leaves a record nobody can ever log in to.
  if ('email' in changes && !String(changes.email || '').trim()) {
    return 'an email is required';
  }
  return null;
}

router.get('/accounts', requireConfig, async (req, res) => {
  try {
    const users = await store.list({ limit: 5000 });
    // Which accounts hold a seat on which team. Sent with the accounts rather
    // than fetched per row: the table would otherwise make one request per
    // corporate account to answer a question one read already knows.
    const seats = await team.store
      .list({ limit: 2000 })
      .catch(() => []);
    const byOwner = seats.reduce((out, m) => {
      const owner = String(m.ownerEmail || '').toLowerCase();
      (out[owner] = out[owner] || []).push(m.memberEmail);
      return out;
    }, {});
    res.json({
      accounts: users.map((u) => {
        const view = adminView(u);
        const held = byOwner[String(view.email || '').toLowerCase()];
        return held ? { ...view, seats: held } : view;
      }),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Changes any subset of an account's editable fields.
 *
 * PATCH rather than PUT, and merged onto the stored record rather than
 * replacing it: a screen that sends only what it changed can never blank a
 * field it did not know existed. It also means the credential rides through
 * untouched -- the sanitizer leaves a hash-only record alone, which is what
 * stops an edit to a zip code silently invalidating a password. Asserted in
 * scripts/auth.test.js.
 *
 * This is the single write path for the profile, role included. A role-only
 * endpoint existed first; folding it in leaves one place where the allow-list
 * and the validation live.
 */
router.patch('/accounts/:key', requireConfig, async (req, res) => {
  const changes = req.body || {};
  try {
    const reason = await rejectionReason(changes);
    if (reason) {
      res.status(400).json({ error: reason });
      return;
    }
    const stored = await findByKey(req.params.key);
    if (!stored) {
      res.status(404).json({ error: 'No account with that key' });
      return;
    }
    await store.upsert({ ...stored, ...changes });
    const saved = await findByKey(req.params.key);
    if ('payment' in changes && changes.payment !== stored.payment) {
      await planChanges.record({
        accountKey: req.params.key,
        accountEmail: saved.email || stored.email || '',
        fromPlan: stored.payment || '',
        toPlan: changes.payment || '',
        // requireRole establishes req.account, not req.user — see ../requireRole.
        changedBy: (req.account && req.account.email) || '',
      });
    }
    res.json({ account: adminView(saved) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Sets a new password on an account.
 *
 * The plaintext is hashed by the collection's sanitizer on the way in, exactly
 * as it is for a self-service change, so there is one hashing path rather than
 * an administrative one that could fall behind it.
 */
router.post('/accounts/:key/password', requireConfig, async (req, res) => {
  const { password } = req.body || {};
  try {
    // Long enough to be worth setting. Deliberately the only rule: a complexity
    // policy invented here would not match the registration screen's, and two
    // disagreeing rules is worse than one weak one.
    if (typeof password !== 'string' || password.length < 8) {
      res.status(400).json({ error: 'a password of at least 8 characters is required' });
      return;
    }
    const stored = await findByKey(req.params.key);
    if (!stored) {
      res.status(404).json({ error: 'No account with that key' });
      return;
    }
    await store.upsert({ ...stored, password });
    const saved = await findByKey(req.params.key);
    res.json({ account: adminView(saved) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Deletes an account from the database, keeping it recoverable for a few minutes.
 *
 * Still not a soft delete, and for the reason this route always gave: there is
 * no "disabled" flag on a registration, and inventing one here would leave every
 * other reader -- sign-in included -- unaware of it, so a deleted account would
 * still be able to log in. The row really does leave `registrations`.
 *
 * What is new is that a copy goes to `deleted_accounts` on the way out, so
 * pressing Delete by mistake is survivable. That copy is the whole record, hash
 * included, because anything less is not a restore -- see deletedAccountsDb.js.
 *
 * The copy is written BEFORE the delete. The other order is the one that loses
 * the account: a failure between the two would leave nothing in either table,
 * which is exactly the situation being fixed. This way the same failure leaves
 * a recoverable copy of an account that still exists, and restoring it puts
 * back what is already there.
 */
router.delete('/accounts/:key', requireConfig, async (req, res) => {
  try {
    const key = req.params.key;
    const record = await findByKey(key);
    if (!record) {
      res.status(404).json({ error: 'No account with that key' });
      return;
    }

    const restorableUntil = await archive(key, record);
    const removed = await store.remove(key);
    if (!removed) {
      res.status(404).json({ error: 'No account with that key' });
      return;
    }
    res.json({ deleted: key, restorableUntil });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Puts a just-deleted account back, exactly as it was.
 *
 * POST rather than PUT: it does not take a body describing the result, and
 * pressing it twice is not the same as pressing it once -- the copy is consumed,
 * so the second attempt correctly reports that there is nothing to restore.
 *
 * Refuses to overwrite. Between the delete and the undo somebody may have
 * registered onto the same key -- the key is the id or the phone number, so that
 * is a real possibility rather than a theoretical one -- and silently replacing
 * that person with the deleted one would turn an undo into a second deletion.
 */
router.post('/accounts/:key/restore', requireConfig, async (req, res) => {
  try {
    const key = req.params.key;
    const existing = await findByKey(key);
    if (existing) {
      res.status(409).json({
        error: 'That account exists again, so restoring would overwrite it.',
      });
      return;
    }

    const record = await take(key);
    if (!record) {
      res.status(404).json({
        error: 'There is nothing left to restore — the undo window has closed.',
      });
      return;
    }

    await store.upsert(record);
    // Re-read rather than trusting the record just written: the store sanitises
    // on the way in, and the screen should show what the database now holds.
    const saved = await findByKey(key);
    res.json({ account: adminView(saved || record) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
