// Where a signed-in user is allowed to go, in one place.
//
// Two callers need the same fact: the router in index.js, which wraps
// /SuperAdmin in a RoleRoute, and the post-login redirect in App.js, which has
// to decide whether the path it is about to return someone to is a path that
// will let them in. Kept apart, those two copies drift -- and the failure is
// silent either way: a redirect that lands on a guard which bounces it straight
// back out, or a screen nobody can reach at all.

/**
 * Paths that require a role, and the roles allowed through each.
 *
 * Anything absent from this map is open to any signed-in user; AuthRoute has
 * already answered whether anyone is signed in at all.
 */
export const ROLE_GUARDED_PATHS = {
  "/SuperAdmin": ["Super Admin"],
};

/**
 * The app's main screen.
 *
 * Where most sign-ins land, and what "back" means from a page that is off to one
 * side of it. Not itself role-aware -- see landingFor.
 */
export const DEFAULT_LANDING = "/TestRunner";

/**
 * Where a role belongs when it has not asked for anywhere in particular.
 *
 * A Super Admin signs in to administer accounts, so that is the page they get;
 * everyone else signs in to use the runner. Kept as a table rather than an `if`
 * because the next role with a home of its own is then one line, and because
 * this is the same shape as ROLE_GUARDED_PATHS above -- the two are read
 * together often enough that matching them is worth more than brevity.
 */
export const ROLE_LANDING = {
  "Super Admin": "/SuperAdmin",
};

/**
 * The page `role` lands on with no interrupted destination to return to.
 *
 * @param {string} role the signed-in user's role.
 * @returns {string} a path.
 */
export function landingFor(role) {
  const match = Object.keys(ROLE_LANDING).find((named) => roleAllowed([named], role));
  return match ? ROLE_LANDING[match] : DEFAULT_LANDING;
}

/**
 * Every role an account can hold.
 *
 * The Super Admin table and the registration form both render this list; the
 * server keeps its own copy in routes/admin.js, for the same reason the payment
 * options do -- it cannot import an ES module, and it must validate rather than
 * trust what arrives.
 *
 * Doctor and Receptionist were removed: nothing in the app grants either any
 * access an ordinary User does not already have, so they were two extra answers
 * to "what is this person" that no rule anywhere read. An account still holding
 * one is not broken -- roleAllowed treats an unrecognised role as unprivileged,
 * which is what it always did -- and the Super Admin role select shows it as
 * "(none)" until somebody picks one of these two.
 */
export const ALL_ROLES = ["Super Admin", "User"];

/**
 * Roles that may only be handed out by someone who already holds one.
 *
 * /NewRegistration is a public route, and its role control offered Super Admin
 * to anyone who opened it. That is not a subtle bypass of the guard on
 * /SuperAdmin -- it is the front door: a visitor could sign themselves up as a
 * Super Admin, sign in, and hold the role legitimately. Gating the control is
 * what closes it.
 */
export const PRIVILEGED_ROLES = ["Super Admin"];

/**
 * The roles an account holding `byRole` may assign.
 *
 * Everything for a Super Admin; everything except the privileged roles for
 * anyone else, including a visitor who is not signed in at all.
 *
 * @param {string|null|undefined} byRole the role of whoever is filling the form.
 * @returns {string[]} roles to offer, in ALL_ROLES order.
 */
export function assignableRoles(byRole) {
  if (roleAllowed(PRIVILEGED_ROLES, byRole)) return ALL_ROLES;
  return ALL_ROLES.filter((role) => !roleAllowed(PRIVILEGED_ROLES, role));
}

/**
 * A role reduced to the form two spellings of the same role share.
 *
 * Nothing here widens access -- an allow-list stays an allow-list, and a role
 * absent from it is still absent after folding. What it prevents is the
 * opposite failure: a record whose role reads "super admin" or " Super Admin"
 * being locked out of a page it owns, by a comparison that only ever saw the
 * exact string the registration form happens to emit today.
 */
const fold = (role) => String(role == null ? "" : role).trim().toLowerCase();

/**
 * Whether one of `roles` is `role`.
 *
 * The single comparison behind every role decision in the app, so the guard on
 * the route, the item in the account menu and the post-login redirect cannot
 * reach three different verdicts about the same account.
 *
 * @param {string[]} roles the roles admitted.
 * @param {string} role the signed-in user's role.
 */
export function roleAllowed(roles, role) {
  if (!Array.isArray(roles)) return false;
  const wanted = fold(role);
  // An empty or missing role matches nothing: a record with no role is not a
  // record that has every role.
  if (!wanted) return false;
  return roles.some((allowed) => fold(allowed) === wanted);
}

/**
 * Whether `role` may open `path`.
 *
 * @param {string} path a pathname, without a query string.
 * @param {string} role the signed-in user's role.
 */
export function canVisit(path, role) {
  const allowed = ROLE_GUARDED_PATHS[path];
  return !allowed || roleAllowed(allowed, role);
}

/**
 * Where to send someone who has just signed in.
 *
 * `from` is the location AuthRoute turned away when it sent them to login, so
 * an interrupted deep link resumes instead of being dropped on the default
 * landing page. It is only honoured when the role can actually get in:
 * returning a Receptionist to /SuperAdmin would hand them to RoleRoute, which
 * redirects again, and the sign-in would appear to have gone somewhere random.
 *
 * Only same-origin paths are returned. A `from` value arrives through router
 * state rather than the URL, so it is not attacker-controlled today, but the
 * check costs nothing and this is exactly the function that would be given a
 * `?next=` parameter the day one is added.
 *
 * @param {{pathname: string, search?: string}|string|null} from
 * @param {string} role
 * @returns {string} a path to navigate to.
 */
export function landingAfterLogin(from, role) {
  const pathname = typeof from === "string" ? from : from && from.pathname;
  const search = (from && typeof from === "object" && from.search) || "";
  // Every fallback below is "where does this person belong", which is a question
  // about the role -- so a Super Admin who was not going anywhere in particular
  // lands on the page they signed in to use.
  const home = landingFor(role);

  if (!pathname || typeof pathname !== "string") return home;
  // "//host" is a protocol-relative URL, not a local path.
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return home;
  // Returning to the login page itself would strand them on it.
  if (pathname === "/" || pathname === "/my-app") return home;

  // An interrupted destination still wins over the role's home: it is the one
  // thing the person actually asked for. Following a link to /Profile, being
  // sent to login, and arriving at /SuperAdmin instead would read as the link
  // having been ignored.
  return canVisit(pathname, role) ? pathname + search : home;
}
