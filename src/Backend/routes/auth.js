// Sign-in and registration, verified on the server.
//
// This route exists because the check it replaces could not work. Sign-in used
// to read `registeredUsers` out of localStorage and compare the password as a
// plain string in App.js, which meant two things: every password was readable in
// devtools, and the comparison could be skipped altogether by editing
// localStorage to add a Super Admin. Hashing alone would have fixed neither --
// with a client-side check the hash simply becomes the password.
//
// So the authority moves here. The browser sends what was typed, the server
// compares it against a bcrypt hash it alone can read, and answers with a user
// object that has never contained a password or a hash.
//
// /login now also issues a session token, which is what closed the gap this
// comment used to describe as remaining. Before it, a successful sign-in
// answered with a user object and nothing else, so every request afterwards was
// anonymous and the client was simply believed about who it was; the role gate
// on /SuperAdmin hid a screen while /api/admin answered anybody. The token is an
// HMAC the server signs and checks -- see ../sessions.js for what is in it, and
// ../requireRole.js for how a protected route uses it.
const express = require('express');
// Google sign-in. The whole of the trust in it lives in that module — see the
// note at the top of it, and note especially that a decoded token proves
// nothing.
const google = require('../googleAuth');
const { store, registrationKey } = require('../registrationsDb');
const { verifyPassword } = require('../passwords');
const { issue } = require('../sessions');
// Registration is public but writes the role, so it needs to know whether the
// caller happens to be a Super Admin. `identify` attaches one if the request
// carries a token and shrugs if it does not.
const { identify } = require('../requireRole');
// Account lookups and the what-may-leave-the-server allow-list are shared
// with the Super Admin route -- see the note at the top of ../accounts.
const {
  publicUser,
  normalisedEmail,
  resolveRole,
  findAllByEmail,
  findByEmail,
  findByKey,
  requireConfig,
} = require('../accounts');

const router = express.Router();

router.post('/login', requireConfig, async (req, res) => {
  const { email, password } = req.body || {};
  try {
    // Checked against every account on this address, not just the first, and
    // sequentially rather than in parallel: bcrypt at cost 12 is deliberately
    // expensive, and firing one per duplicate row at once would turn a repeated
    // login attempt into a way to load the server.
    const candidates = await findAllByEmail(email);
    let user = null;
    for (const candidate of candidates) {
      if (await verifyPassword(password, candidate.passwordHash)) {
        user = candidate;
        break;
      }
    }
    if (!user) {
      // One message for both "no such account" and "wrong password". Telling
      // them apart hands an attacker a way to enumerate who has an account.
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    // Checked AFTER the password, deliberately. Answering "disabled" before
    // verifying would let anyone discover which addresses have accounts by
    // reading which ones say something other than "invalid credentials";
    // reaching this line means the password was already correct, so nothing
    // is revealed that the caller did not already know.
    //
    // Named plainly rather than folded into "invalid credentials": someone
    // whose password is right and who is told it is wrong raises a support
    // ticket, and the honest answer is the one that resolves it.
    if (user.signInDisabled) {
      res.status(403).json({
        error: 'This account has been disabled. Ask an administrator to switch it back on.',
      });
      return;
    }
    // Keyed on the registration key, not the email: the key is the record's
    // identity, and an account whose address is later corrected must not have
    // its session silently point at nothing -- or, worse, at whoever else is
    // sharing that address (findAllByEmail exists because rows can).
    const { token, expiresAt } = issue({
      key: registrationKey(user),
      email: normalisedEmail(user.email),
    });
    res.json({ user: publicUser(user), token, expiresAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Creates or updates a registration, hashing its password on the way in.
 *
 * The hashing itself is the store's job (see sanitize in registrationsDb.js), so
 * a record pushed by any other path is hashed too. This route exists so the
 * screen can hand over the plaintext exactly once, get back a record that is
 * safe to keep in localStorage, and never hold the password again.
 */
router.post('/register', requireConfig, identify, async (req, res) => {
  let user = req.body || {};
  try {
    if (!normalisedEmail(user.email)) {
      res.status(400).json({ error: 'an email is required' });
      return;
    }
    if (!registrationKey(user)) {
      res.status(400).json({ error: 'a registration must have an id or phoneNumber' });
      return;
    }

    // What is already stored wins over whatever the caller sent about
    // credentials. A caller may supply a NEW plaintext password; it may not
    // dictate the hash.
    //
    // Two things go wrong without this, and neither announces itself:
    //
    //   * a second tab holding the record from before a password change would
    //     send that older hash back with an unrelated edit, silently reverting
    //     the password to the previous one;
    //   * the readable copy would be blanked by any edit that did not include
    //     it — and the browser deliberately does not keep one to send.
    //
    // So the stored hash and the stored readable copy are both carried forward,
    // and only an explicitly typed password displaces them.
    const stored = await findByKey(registrationKey(user));
    if (stored) {
      user = {
        ...user,
        passwordHash: stored.passwordHash,
        password: user.password || stored.password,
        // Carried forward for the same reason as the credential: only the
        // admin endpoint may change it, and a browser holding a record from
        // before it was switched off would otherwise re-enable the account
        // simply by saving an unrelated field.
        signInDisabled: stored.signInDisabled,
      };
    }

    if (!user.password && !user.passwordHash) {
      res.status(400).json({ error: 'a password is required' });
      return;
    }

    // The role is decided here rather than taken, because this endpoint is
    // public and the role is the field every authorisation decision in the app
    // reads. Anyone could previously sign themselves up as a Super Admin from
    // the registration form -- not a bypass of the guard on /SuperAdmin, but the
    // front door: the account genuinely held the role. See resolveRole for the
    // four rules, including how the first Super Admin ever gets created.
    user = { ...user, role: await resolveRole({
      requested: user.role,
      stored,
      actor: req.account || null,
    }) };

    const key = await store.upsert(user);
    // Read back rather than echoing the request, so the caller stores what was
    // actually persisted — including the hash the store generated, which is what
    // makes the record re-syncable without the plaintext ever coming back.
    const saved = await findByEmail(user.email);
    res.json({
      key,
      user: publicUser(saved || user),
      // The hash, so the screen can keep the record in localStorage and let
      // dbSync push it without a password field. Safe to hold: it is not a
      // credential this API will accept in place of one — /login only ever
      // compares plaintext against it.
      passwordHash: saved ? saved.passwordHash : undefined,
    });
  } catch (err) {
    // An explicit status wins. resolveRole refuses an escalation with 403, and
    // reporting that as a 500 would read as a server fault rather than as the
    // deliberate answer it is.
    if (err.status) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    const clientError = /required|must have/.test(err.message);
    res.status(clientError ? 400 : 500).json({ error: err.message });
  }
});

// GET /api/auth/google — is Google sign-in available, and under which client id?
//
// Open, and it has to be: the sign-in page asks before anybody is signed in.
// The client id is public by design — it identifies the application to Google
// and is embedded in every button Google renders.
router.get('/google', (req, res) => {
  res.json({ configured: google.isConfigured(), clientId: google.clientId() });
});

// POST /api/auth/google  { credential }
//
// The ID token Google handed the browser, exchanged for a session of ours.
//
// requireConfig is deliberately here as well: an account has to be looked up or
// created, and both need the database. Without it this would verify a token
// perfectly and then fail somewhere less obvious.
router.post('/google', requireConfig, async (req, res) => {
  try {
    const profile = await google.verifyIdToken((req.body || {}).credential);

    // An address can have more than one row (findAllByEmail exists for that
    // reason), so the first is taken rather than assumed unique.
    const existing = (await findAllByEmail(profile.email))[0] || null;

    if (existing && existing.signInDisabled) {
      // Said plainly, as the password path does: someone whose Google account
      // is fine and who is told nothing raises a support ticket instead.
      res.status(403).json({
        error: 'This account has been disabled. Ask an administrator to switch it back on.',
      });
      return;
    }

    let user = existing;
    if (!user) {
      // First sign-in: the account is created from the verified profile.
      //
      // No password is set, and that is the point — there is nothing to set one
      // to, and inventing one would be a credential nobody chose. The account
      // signs in through Google until somebody gives it a password, which the
      // Super Admin password control can do.
      //
      // The role and the plan are the floor, not taken from anywhere: this is a
      // public route, and an account that could name its own role or tier on
      // the way in would be the front door standing open.
      const created = {
        id: 'sso-' + profile.sub,
        firstName: profile.givenName || profile.name || '',
        lastName: profile.familyName || '',
        email: profile.email,
        role: 'User',
        payment: 'Free',
        // Where this account came from, and what lets the admin table tell an
        // account with no password from one that cannot sign in at all.
        authProvider: 'google',
        profilePicture: profile.picture || '',
      };
      await store.upsert(created);
      user = await findByEmail(profile.email);
      if (!user) throw new Error('The account could not be created');
    }

    const { token, expiresAt } = issue({
      key: registrationKey(user),
      email: normalisedEmail(user.email),
    });
    res.json({ user: publicUser(user), token, expiresAt, created: !existing });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
