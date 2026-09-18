// Session tokens, the gate they open, and the role rules.
// Run with: npm run test:sessions
//
// Pure-function and middleware checks -- no database, no listening server -- on
// the pieces that decide who may administer this system. They are here because
// every one of them fails silently in the direction that matters: a token check
// that accepts a forgery still lets every legitimate user in, and a role rule
// that permits an escalation still shows the right screens to the right people.
// Nothing about normal use would reveal either.
const assert = require('assert');
const crypto = require('crypto');
const { issue, verify, tokenFrom, TTL_SECONDS } = require('../sessions');

const accounts = require('../accounts');
const {
  roleMatches,
  isPrivilegedRole,
  isEscalation,
  decideRole,
  PRIVILEGED_ROLES,
} = accounts;

// The middleware reads accounts from the database. Standing Postgres up for a
// unit test would mean these rules are only ever exercised where a database is,
// so the lookup is replaced here -- before requireRole.js is required, because
// it destructures what it needs at import time and would otherwise have already
// captured the real function.
let storedAccounts = {};
accounts.findByKey = async (key) => storedAccounts[key] || null;
const { authenticate, requireRole, identify } = require('../requireRole');

const results = [];
const test = async (name, fn) => {
  try {
    await fn();
    results.push(['ok  ', name]);
  } catch (err) {
    results.push(['FAIL', name + '\n        ' + err.message]);
  }
};

const ACCOUNT = { key: 'reg-1', email: 'boss@practice.com' };

/** Re-signs a payload with a different key, the way a forger without the secret would. */
const forge = (payload) => {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', 'not-the-real-secret')
    .update(encoded)
    .digest('base64url');
  return encoded + '.' + signature;
};

/** A res that records what a middleware answered instead of writing to a socket. */
const fakeRes = () => ({
  statusCode: null,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

/** Runs one middleware and reports whether it passed the request on. */
const run = async (middleware, req) => {
  const res = fakeRes();
  let passed = false;
  await middleware(req, res, () => {
    passed = true;
  });
  return { res, passed, req };
};

/** Runs a synchronous middleware, reporting the same shape as run(). */
const runSync = (middleware, req) => {
  const res = fakeRes();
  let passed = false;
  middleware(req, res, () => {
    passed = true;
  });
  return { res, passed, req };
};

/** A request carrying a freshly issued token for one account key. */
const requestFor = (key) => ({
  headers: { authorization: 'Bearer ' + issue({ key, email: 'x@y.z' }).token },
});

(async () => {
  // ---- tokens ----------------------------------------------------------

  await test('a token this server issued verifies, and names the account', () => {
    const { token } = issue(ACCOUNT);
    const payload = verify(token);
    assert(payload, 'must verify');
    assert.strictEqual(payload.k, 'reg-1', 'the registration key is the identity');
    assert.strictEqual(payload.e, 'boss@practice.com');
  });

  await test('the token carries no role — the role is read from the database', () => {
    // If the role were in here, demoting a Super Admin would leave them a
    // working one until the token expired. See the note in sessions.js.
    const { token } = issue({ ...ACCOUNT, role: 'Super Admin' });
    const payload = verify(token);
    assert.strictEqual(payload.role, undefined);
    assert(!JSON.stringify(payload).includes('Super Admin'), 'no role in the payload');
  });

  await test('the token carries no password or hash', () => {
    const { token } = issue({ ...ACCOUNT, password: 'hunter2', passwordHash: '$2b$12$x' });
    const body = Buffer.from(token.split('.')[0], 'base64url').toString();
    assert(!body.includes('hunter2'));
    assert(!body.includes('$2b$'));
  });

  await test('expiresAt matches the advertised lifetime', () => {
    const { expiresAt } = issue(ACCOUNT);
    const seconds = Math.round((Date.parse(expiresAt) - Date.now()) / 1000);
    assert(Math.abs(seconds - TTL_SECONDS) <= 2, 'expected ~' + TTL_SECONDS + 's, got ' + seconds);
  });

  await test('an edited payload is refused (the whole point)', () => {
    const { token } = issue(ACCOUNT);
    const signature = token.split('.')[1];
    const swapped = Buffer.from(
      JSON.stringify({ k: 'someone-else', e: 'x@y.z', exp: Math.floor(Date.now() / 1000) + 600 }),
    ).toString('base64url');
    assert.strictEqual(verify(swapped + '.' + signature), null);
  });

  await test('a token signed with the wrong key is refused', () => {
    const forged = forge({
      k: 'reg-1',
      e: 'boss@practice.com',
      exp: Math.floor(Date.now() / 1000) + 600,
    });
    assert.strictEqual(verify(forged), null);
  });

  await test('an expired token is refused', () => {
    // Built by hand rather than by waiting twelve hours: the payload is the
    // contract, so a stale exp is the honest way to express one.
    const payload = verify(issue(ACCOUNT).token);
    assert(payload, 'sanity: the fresh token verifies');
    assert.strictEqual(verify(forge({ ...payload, exp: Math.floor(Date.now() / 1000) - 1 })), null);
  });

  await test('malformed tokens are refused rather than throwing', () => {
    for (const bad of [undefined, null, '', 'nodot', 'a.b.c', '.', 'a.', '.b', {}, 12345, 'e30=.']) {
      assert.strictEqual(verify(bad), null, 'must refuse ' + JSON.stringify(bad));
    }
  });

  await test('a token with no expiry is refused', () => {
    assert.strictEqual(verify(forge({ k: 'reg-1' })), null);
  });

  await test('the bearer header is read, case-insensitively', () => {
    assert.strictEqual(tokenFrom({ headers: { authorization: 'Bearer abc.def' } }), 'abc.def');
    assert.strictEqual(tokenFrom({ headers: { authorization: 'bearer abc.def' } }), 'abc.def');
    assert.strictEqual(tokenFrom({ headers: { authorization: '  Bearer   abc.def  ' } }), 'abc.def');
  });

  await test('a missing or unusable header yields no token', () => {
    for (const headers of [{}, { authorization: '' }, { authorization: 'Basic abc' }, undefined]) {
      assert.strictEqual(tokenFrom({ headers }), null);
    }
    assert.strictEqual(tokenFrom({}), null);
  });

  // ---- role matching ---------------------------------------------------

  await test('roles match folded, so case cannot lock the right person out', () => {
    assert(roleMatches(['Super Admin'], 'Super Admin'));
    assert(roleMatches(['Super Admin'], 'super admin'));
    assert(roleMatches(['Super Admin'], ' SUPER ADMIN '));
  });

  await test('a role that merely resembles the allowed one does not match', () => {
    for (const near of ['SuperAdmin', 'Super Admins', 'super-admin', 'Admin', 'Super']) {
      assert(!roleMatches(['Super Admin'], near), near + ' must not match');
    }
  });

  await test('an absent role matches nothing, and an empty list admits nobody', () => {
    for (const role of [undefined, null, '', '   ']) {
      assert(!roleMatches(['Super Admin'], role));
      assert(!isPrivilegedRole(role));
    }
    assert(!roleMatches([], 'Super Admin'));
    assert(!roleMatches(undefined, 'Super Admin'));
  });

  await test('the browser and the server agree on which role is privileged', () => {
    // src/routeAccess.js holds the same list for the form; it cannot be
    // imported here (ES module), so the value is asserted rather than shared.
    assert.deepStrictEqual(PRIVILEGED_ROLES, ['Super Admin']);
  });

  // ---- who may set which role -----------------------------------------

  await test('a stranger cannot sign themselves up as a Super Admin', () => {
    // The hole this closes: /NewRegistration is a public route, and the role it
    // posts is the field every authorisation decision reads.
    assert.throws(
      () => decideRole({ requested: 'Super Admin', superAdminPresent: true }),
      (err) => err.status === 403,
    );
  });

  await test('a signed-in non-Super-Admin cannot promote themselves either', () => {
    for (const actorRole of ['Admin', 'Doctor', 'Receptionist', 'CUSTOMER']) {
      assert.throws(
        () =>
          decideRole({
            requested: 'Super Admin',
            storedRole: actorRole,
            actorRole,
            superAdminPresent: true,
          }),
        (err) => err.status === 403,
        actorRole + ' must be refused',
      );
    }
  });

  await test('a Super Admin may grant any role', () => {
    for (const requested of ['Super Admin', 'Admin', 'Doctor', 'Receptionist']) {
      assert.strictEqual(
        decideRole({ requested, actorRole: 'Super Admin', superAdminPresent: true }),
        requested,
      );
    }
  });

  await test('the very first Super Admin can be created by anyone (bootstrap)', () => {
    // Otherwise nothing can ever grant the role: the page that grants it is
    // itself behind the role.
    assert.strictEqual(
      decideRole({ requested: 'Super Admin', superAdminPresent: false }),
      'Super Admin',
    );
  });

  await test('"not asked" is not treated as "no Super Admin exists"', () => {
    // The bootstrap exemption keys on an explicit false. A caller that forgot to
    // look must not be granted the exemption by omission.
    assert.throws(
      () => decideRole({ requested: 'Super Admin' }),
      (err) => err.status === 403,
    );
  });

  await test('a Super Admin editing their own profile is not demoted', () => {
    // Reached with no token -- /NewRegistration saving an unrelated field. The
    // stored role wins, so correcting a zip code does not cost them the role.
    assert.strictEqual(decideRole({ requested: 'Receptionist', storedRole: 'Super Admin' }), 'Super Admin');
    assert.strictEqual(decideRole({ requested: '', storedRole: 'Super Admin' }), 'Super Admin');
  });

  await test('a stale browser cannot re-grant a role from an old copy', () => {
    // Someone demoted from Super Admin to Admin, whose other tab still holds
    // the record from before: the stored role is what stands.
    assert.throws(
      () => decideRole({ requested: 'Super Admin', storedRole: 'Admin', superAdminPresent: true }),
      (err) => err.status === 403,
    );
  });

  await test('an ordinary role passes straight through', () => {
    for (const requested of ['Admin', 'Doctor', 'Receptionist', '']) {
      assert.strictEqual(decideRole({ requested, superAdminPresent: true }), requested);
    }
  });

  await test('only an escalation needs the database read', () => {
    // isEscalation is what lets resolveRole skip a full table scan on every
    // ordinary sign-up. If it ever says false for a real escalation, the
    // bootstrap branch is reached without the fact it depends on.
    assert(isEscalation({ requested: 'Super Admin' }), 'stranger asking for it');
    assert(!isEscalation({ requested: 'Doctor' }), 'ordinary role');
    assert(!isEscalation({ requested: 'Super Admin', actorRole: 'Super Admin' }), 'a SA granting it');
    assert(
      !isEscalation({ requested: 'Super Admin', storedRole: 'Super Admin' }),
      'a record that already holds it',
    );
  });

  // ---- the gate itself -------------------------------------------------

  await test('no token at all is 401, not a pass', async () => {
    const { res, passed } = await run(authenticate, { headers: {} });
    assert(!passed, 'must not reach the route');
    assert.strictEqual(res.statusCode, 401);
  });

  await test('a forged token is 401', async () => {
    const forged = forge({ k: 'reg-1', exp: Math.floor(Date.now() / 1000) + 600 });
    const { res, passed } = await run(authenticate, {
      headers: { authorization: 'Bearer ' + forged },
    });
    assert(!passed);
    assert.strictEqual(res.statusCode, 401);
  });

  await test('a valid token for an account that no longer exists is 401', async () => {
    storedAccounts = {};
    const { res, passed } = await run(authenticate, requestFor('reg-gone'));
    assert(!passed, 'a deleted account must stop working immediately');
    assert.strictEqual(res.statusCode, 401);
  });

  await test('a disabled account is refused even with a good token', async () => {
    storedAccounts = { 'reg-1': { role: 'Super Admin', signInDisabled: true } };
    const { res, passed } = await run(authenticate, requestFor('reg-1'));
    assert(!passed, 'switching sign-in off must revoke a live session');
    assert.strictEqual(res.statusCode, 403);
  });

  await test('a valid token establishes the account from the database', async () => {
    storedAccounts = { 'reg-1': { role: 'Super Admin', email: 'boss@practice.com' } };
    const { res, passed, req } = await run(authenticate, requestFor('reg-1'));
    assert(passed, 'expected a pass, got ' + res.statusCode + ' ' + JSON.stringify(res.body));
    assert.strictEqual(req.account.role, 'Super Admin');
  });

  await test('the role comes from the database, so a demotion takes effect at once', async () => {
    // The same token throughout. This is the behaviour that would be impossible
    // if the role were a claim inside it.
    const req = requestFor('reg-1');

    storedAccounts = { 'reg-1': { role: 'Super Admin' } };
    const before = await run(authenticate, { ...req });
    assert(before.passed);
    assert(runSync(requireRole('Super Admin'), before.req).passed, 'authorised while a SA');

    storedAccounts = { 'reg-1': { role: 'Receptionist' } };
    const after = await run(authenticate, { ...req });
    assert(after.passed, 'still authenticated -- they are still a real user');
    const authorised = runSync(requireRole('Super Admin'), after.req);
    assert(!authorised.passed, 'but no longer authorised');
    assert.strictEqual(authorised.res.statusCode, 403);
  });

  await test('requireRole refuses the wrong role with 403, not 401', async () => {
    // The distinction the browser acts on: 401 means sign in again, 403 means
    // signing in again will not help.
    for (const role of ['Admin', 'Doctor', 'Receptionist', 'CUSTOMER', '', undefined]) {
      const { res, passed } = runSync(requireRole('Super Admin'), { account: { role } });
      assert(!passed, String(role) + ' must be refused');
      assert.strictEqual(res.statusCode, 403);
    }
  });

  await test('requireRole fails closed when authenticate was never mounted', async () => {
    // A route added later without the first middleware must refuse everyone
    // rather than admit everyone.
    const { res, passed } = runSync(requireRole('Super Admin'), { headers: {} });
    assert(!passed);
    assert.strictEqual(res.statusCode, 401);
  });

  await test('identify attaches an account when there is one and shrugs otherwise', async () => {
    storedAccounts = { 'reg-1': { role: 'Super Admin' } };
    const withToken = await run(identify, requestFor('reg-1'));
    assert(withToken.passed, 'must always carry on');
    assert.strictEqual(withToken.req.account.role, 'Super Admin');

    const without = await run(identify, { headers: {} });
    assert(without.passed, 'an anonymous caller is still allowed through');
    assert.strictEqual(without.req.account, undefined);
  });

  results.forEach(([status, name]) => console.log('  ' + status + '  ' + name));
  const failed = results.filter(([s]) => s === 'FAIL').length;
  console.log('\n' + (results.length - failed) + '/' + results.length + ' passed');
  process.exit(failed ? 1 : 0);
})();
