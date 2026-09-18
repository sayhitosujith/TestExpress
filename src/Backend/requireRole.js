// Who is calling, and may they.
//
// Two middlewares rather than one, because they answer two questions that fail
// differently: `authenticate` answers "is there a caller at all" with 401, and
// `requireRole` answers "is it the right caller" with 403. A client can act on
// that difference -- 401 means sign in again, 403 means signing in again will
// not help -- and collapsing them into one status forces the browser to guess.
//
// The role is read from the DATABASE here, not from the token. See the note at
// the top of sessions.js: a role carried in the token would keep working until
// the token expired, so demoting a Super Admin would not actually demote them
// until tomorrow.
const { verify, tokenFrom } = require('./sessions');
const { findByKey, findByEmail, roleMatches } = require('./accounts');
// API tokens, the other way an account can identify itself — see apiTokensDb.
// Required lazily inside authenticate rather than here: this module is loaded by
// almost every route, and an API token store that needs a database should not be
// a condition of the app booting without one.

/**
 * Establishes `req.account` from the bearer token, or answers 401.
 *
 * Re-reads the account every request. That is a database read per call, which
 * this API already does for everything else it serves, and it buys three things
 * a token claim cannot: a deleted account stops working immediately, a disabled
 * one does too, and a role change takes effect on the next request.
 */
async function authenticate(req, res, next) {
  const token = tokenFrom(req);
  if (!token) {
    res.status(401).json({ error: 'Sign in to do that.' });
    return;
  }

  // An API token identifies an account without a session, which is the point of
  // it: a CI job has no browser to sign in with. Tried before the session
  // token, and only for values carrying the prefix, so an ordinary session is
  // never sent to the token store.
  if (String(token).startsWith(require('./apiTokensDb').PREFIX)) {
    try {
      const held = await require('./apiTokensDb').resolve(token);
      if (!held) {
        res.status(401).json({ error: 'That API token is not valid, or has been revoked.' });
        return;
      }
      const account = await findByEmail(held.ownerEmail);
      if (!account || account.signInDisabled) {
        // The token outlived the account, or the account was disabled. Either
        // way the token stops working immediately rather than at expiry — the
        // same rule the session path follows, and the reason both re-read.
        res.status(403).json({ error: 'The account this token belongs to cannot be used.' });
        return;
      }
      req.account = account;
      // Marked, so a route can tell a machine from a person. Nothing refuses a
      // token yet; the distinction exists for the ones that eventually should.
      req.viaApiToken = held.id;
      next();
      return;
    } catch (err) {
      next(err);
      return;
    }
  }

  const payload = verify(token);
  if (!payload) {
    // Expired and forged are the same answer on purpose -- see verify().
    res.status(401).json({ error: 'Your session has expired. Sign in again.' });
    return;
  }
  try {
    const account = await findByKey(payload.k);
    if (!account) {
      res.status(401).json({ error: 'That account no longer exists.' });
      return;
    }
    if (account.signInDisabled) {
      res.status(403).json({ error: 'This account has been disabled.' });
      return;
    }
    req.account = account;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Refuses anyone whose established role is not in `roles`.
 *
 * Must be mounted after `authenticate`; without `req.account` it refuses
 * everyone rather than letting the request through, so a route that forgets the
 * first middleware fails closed and is noticed.
 *
 * @param {...string} roles the roles admitted.
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.account) {
      res.status(401).json({ error: 'Sign in to do that.' });
      return;
    }
    if (!roleMatches(roles, req.account.role)) {
      res.status(403).json({
        error: `This needs the ${roles.join(' or ')} role.`,
      });
      return;
    }
    next();
  };
}

/**
 * Establishes `req.account` if a usable token is present, and carries on either
 * way.
 *
 * For a route that is open to everyone but behaves differently for a privileged
 * caller -- /api/auth/register, which anyone may use to sign up and only a Super
 * Admin may use to hand out the Super Admin role.
 */
async function identify(req, res, next) {
  const payload = verify(tokenFrom(req) || '');
  if (!payload) return next();
  try {
    const account = await findByKey(payload.k);
    if (account && !account.signInDisabled) req.account = account;
  } catch (err) {
    // An unreadable database is the next handler's problem to report; this one
    // is only decorating the request.
  }
  next();
}

module.exports = { authenticate, requireRole, identify };
