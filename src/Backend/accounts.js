// Shared reads over the registrations collection.
//
// Extracted from routes/auth.js when the Super Admin page turned out to need
// the same three things sign-in needed: every account on an email, one account
// by key, and a decision about which fields may leave the server. That last one
// is the reason this file exists rather than a second copy in the admin route:
// registrations carry a bcrypt hash AND a readable password, so an allow-list
// that drifts between two callers is the drift that ends with an admin screen
// handing out the column sign-in was careful never to send.
const { store, registrationKey } = require('./registrationsDb');

// Fields that may travel back to the browser. An allow-list rather than
// deleting `passwordHash`, because the next field added to a registration is
// added by someone thinking about registrations, not about what leaks.
const SAFE_FIELDS = [
  'id',
  'firstName',
  'lastName',
  'email',
  'phoneNumber',
  'zipCode',
  'payment',
  'role',
  'profilePicture',
  // Whether sign-in is switched off for this account. Safe to send -- it is
  // not a secret, and the screens that show an account need to say so.
  'signInDisabled',
  // How this account signs in, when it is not with a password. Safe, and
  // needed: an account created through Google has no hash, and without this
  // every screen would report it as unable to sign in.
  'authProvider',
];

/**
 * The subset of a registration that is safe to send to a browser.
 *
 * @param {object} user a stored registration.
 * @returns {object} the same record with only SAFE_FIELDS on it.
 */
const publicUser = (user) => {
  const out = {};
  SAFE_FIELDS.forEach((f) => {
    if (user[f] !== undefined) out[f] = user[f];
  });
  return out;
};

/** Emails are free text on the registration screen, so they compare folded. */
const normalisedEmail = (value) => String(value ?? '').trim().toLowerCase();

/**
 * Roles nobody may grant themselves.
 *
 * The browser's copy of this rule is PRIVILEGED_ROLES in src/routeAccess.js,
 * which hides the option on the registration form. This one is the rule: the
 * form is not the only way to reach /api/auth/register, and a role handed out
 * by a POST from a terminal counts just as much as one picked from a dropdown.
 */
const PRIVILEGED_ROLES = ['Super Admin'];

/** A role folded to the form two spellings of the same role share. */
const foldRole = (role) => String(role ?? '').trim().toLowerCase();

/**
 * Whether one of `roles` is `role`.
 *
 * Folded, matching roleAllowed in src/routeAccess.js. Case is not what decides
 * an authorisation: a stored role of "super admin" is the same authority as
 * "Super Admin", and treating them differently would lock a real administrator
 * out while admitting nobody new. An absent role matches nothing.
 *
 * @param {string[]} roles the roles admitted.
 * @param {string} role the role held.
 */
function roleMatches(roles, role) {
  if (!Array.isArray(roles)) return false;
  const held = foldRole(role);
  if (!held) return false;
  return roles.some((allowed) => foldRole(allowed) === held);
}

/** Whether `role` is one nobody may grant themselves. */
const isPrivilegedRole = (role) => roleMatches(PRIVILEGED_ROLES, role);

/**
 * Whether the database already holds a Super Admin.
 *
 * The bootstrap question. A brand-new installation has no Super Admin, so
 * nothing can open the page that grants the role, so the role could never be
 * granted at all -- a deadlock. Answering false here is what lets the very
 * first one be created through the ordinary registration form; from the moment
 * one exists, only that account can create another.
 *
 * @returns {Promise<boolean>}
 */
async function superAdminExists() {
  const users = await store.list({ limit: 5000 });
  return users.some((u) => isPrivilegedRole(u.role));
}

/**
 * Whether a save is an escalation — a request for a privileged role by someone
 * who neither holds one nor is editing a record that already has one.
 *
 * Named because two places need the same question: the decision below, and the
 * caller that decides whether the database is worth reading to answer it.
 */
const isEscalation = ({ requested, storedRole, actorRole }) =>
  isPrivilegedRole(requested) &&
  !isPrivilegedRole(actorRole) &&
  !isPrivilegedRole(storedRole);

/**
 * The role a save may actually set, given who is asking.
 *
 * Pure, so the rules can be tested without a database standing up -- they are
 * the rules that decide who can administer the system, which makes them the
 * last thing that should only ever be exercised by hand. resolveRole is the
 * thin wrapper that supplies the one fact this cannot know.
 *
 * Registration is a public endpoint that writes the field every authorisation
 * decision in the app reads, which is a combination worth being explicit about.
 * Four rules, in order:
 *
 *   1. an actor who is already a Super Admin may set anything;
 *   2. a record that already holds the privileged role keeps it, even when the
 *      caller could not have granted it. A Super Admin correcting their own zip
 *      code through the registration screen must not demote themselves, and a
 *      browser holding a copy from before a promotion must not undo it;
 *   3. the first Super Admin may be created by anyone, because otherwise no
 *      Super Admin can ever exist -- see superAdminExists;
 *   4. anything else asking for a privileged role is refused.
 *
 * @param {object} options
 * @param {string} options.requested the role on the incoming record.
 * @param {string} [options.storedRole] the role the record holds today.
 * @param {string} [options.actorRole] the role of the authenticated caller.
 * @param {boolean} [options.superAdminPresent] whether the database already
 *   holds a Super Admin. Consulted only by rule 3, so a caller may leave it out
 *   when isEscalation is false — nothing else reads it.
 * @returns {string} the role to store.
 * @throws {Error} tagged `status = 403` when the request is an escalation.
 */
function decideRole({ requested, storedRole, actorRole, superAdminPresent }) {
  if (isPrivilegedRole(actorRole)) return requested;

  // Rule 2, both directions: a privileged record's role is not the registration
  // endpoint's to change, up or down.
  if (isPrivilegedRole(storedRole)) return storedRole;

  if (!isPrivilegedRole(requested)) return requested;

  // Rule 3. Explicitly `=== false` rather than falsy: an omitted flag is "not
  // asked", and treating that as "no Super Admin exists" would make the
  // bootstrap exemption apply to every caller who forgot to look it up.
  if (superAdminPresent === false) return requested;

  const refused = new Error(
    'Only a Super Admin can grant the Super Admin role. ' +
      'Create the account with another role, then change it from the Super Admin page.',
  );
  refused.status = 403;
  throw refused;
}

/**
 * decideRole, with the database question answered.
 *
 * The lookup is skipped unless the request is actually an escalation, so the
 * ordinary case -- someone signing up as a Receptionist -- does not pay for a
 * full table read to be told what it already knew.
 *
 * @param {object} options
 * @param {string} options.requested the role on the incoming record.
 * @param {object|null} options.stored the record already in the database, if any.
 * @param {object|null} options.actor the authenticated caller, if any.
 * @returns {Promise<string>} the role to store.
 * @throws {Error} tagged `status = 403` when the request is an escalation.
 */
async function resolveRole({ requested, stored, actor }) {
  const context = {
    requested,
    storedRole: stored && stored.role,
    actorRole: actor && actor.role,
  };
  if (!isEscalation(context)) return decideRole(context);
  return decideRole({ ...context, superAdminPresent: await superAdminExists() });
}

/**
 * Every registration with this email, most recently updated first.
 *
 * Plural on purpose. Nothing constrains the email column to be unique -- the
 * key is the record id -- so two rows can carry the same address, and returning
 * only the first meant a login failed whenever that first row happened to be
 * the one without a usable hash. Observed for real: a stray row sharing an
 * address with a real account rejected the correct password.
 *
 * @param {string} email
 * @returns {Promise<object[]>}
 */
async function findAllByEmail(email) {
  const wanted = normalisedEmail(email);
  if (!wanted) return [];
  const users = await store.list({ limit: 5000 });
  return users.filter((u) => normalisedEmail(u.email) === wanted);
}

/**
 * The first registration with this email, for reading back a saved record.
 *
 * @param {string} email
 * @returns {Promise<object|null>}
 */
async function findByEmail(email) {
  const [first] = await findAllByEmail(email);
  return first || null;
}

/**
 * The stored record for this key.
 *
 * By key rather than by email, because an edit is allowed to change the email —
 * and looking the old record up by its new address would find nothing.
 *
 * @param {string} key a registration key (record id, or phone as fallback).
 * @returns {Promise<object|null>}
 */
async function findByKey(key) {
  if (!key) return null;
  const users = await store.list({ limit: 5000 });
  return users.find((u) => registrationKey(u) === key) || null;
}

/**
 * Express guard: refuse with setup steps when no database is configured.
 *
 * Same 501-with-instructions contract as the online collections. Sign-in and
 * account administration both genuinely cannot work without a database, and
 * saying which piece is missing beats looking like a server fault.
 */
function requireConfig(req, res, next) {
  if (store.isConfigured()) return next();
  res.status(501).json({
    error: 'No online database configured, so accounts cannot be read or verified',
    setup: [
      'Create a free Postgres database (Neon, Supabase, Render or Railway).',
      'Set DATABASE_URL to its connection string in src/Backend/.env.',
      'Restart the backend, then run: node src/Backend/scripts/hash-passwords.js',
    ],
  });
}

module.exports = {
  SAFE_FIELDS,
  PRIVILEGED_ROLES,
  publicUser,
  normalisedEmail,
  roleMatches,
  isPrivilegedRole,
  isEscalation,
  superAdminExists,
  decideRole,
  resolveRole,
  findAllByEmail,
  findByEmail,
  findByKey,
  requireConfig,
};
