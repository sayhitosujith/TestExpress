// Password hashing rules, run with: npm run test:auth
//
// These are pure-function checks on the registrations sanitizer and the hashing
// helpers -- no database, so they run anywhere. They exist because the two rules
// they cover pull in opposite directions and getting the balance wrong fails
// silently in both directions:
//
//   * a typed password must REPLACE the stored hash, or a password change is a
//     no-op that still reports success (this shipped once and is the reason the
//     file exists);
//   * a record arriving with only a hash must keep it untouched, or every sync
//     re-hashes the hash and nobody's password matches any more.
const assert = require('assert');
const { hashPassword, verifyPassword, isHashed } = require('../passwords');
const { hashRegistrationPassword } = require('../registrationsDb');

const results = [];
const test = async (name, fn) => {
  try {
    await fn();
    results.push(['ok  ', name]);
  } catch (err) {
    results.push(['FAIL', `${name}\n        ${err.message}`]);
  }
};

(async () => {
  await test('a typed password is hashed, and the readable copy is kept', async () => {
    const out = await hashRegistrationPassword({ id: 'u1', password: 'secret1' });
    assert(isHashed(out.passwordHash));
    assert(await verifyPassword('secret1', out.passwordHash));
    // Storing the readable password beside the hash is a deliberate choice —
    // see the note at the top of registrationsDb.js. Asserted rather than
    // assumed, because the sanitizer used to delete it and a silent revert here
    // would empty the column nobody would think to check.
    assert.strictEqual(out.password, 'secret1', 'the readable copy must be kept');
  });

  await test('a typed password REPLACES an existing hash (the update bug)', async () => {
    const old = await hashPassword('first-password');
    const out = await hashRegistrationPassword({
      id: 'u1',
      passwordHash: old,
      password: 'second-password',
    });
    assert.notStrictEqual(out.passwordHash, old, 'the stored hash must change');
    assert(await verifyPassword('second-password', out.passwordHash), 'new password must work');
    assert(!(await verifyPassword('first-password', out.passwordHash)), 'old password must stop working');
    assert.strictEqual(out.password, 'second-password', 'the readable copy must follow the hash');
  });

  await test('a record with only a hash is left alone (sync re-push, clone)', async () => {
    const hash = await hashPassword('unchanged');
    const out = await hashRegistrationPassword({ id: 'u1', passwordHash: hash });
    assert.strictEqual(out.passwordHash, hash, 'must be byte-identical, not re-hashed');
    assert(await verifyPassword('unchanged', out.passwordHash));
  });

  await test('re-running the sanitizer is stable', async () => {
    let rec = await hashRegistrationPassword({ id: 'u1', password: 'stable' });
    const first = rec.passwordHash;
    for (let i = 0; i < 3; i += 1) rec = await hashRegistrationPassword(rec);
    assert.strictEqual(rec.passwordHash, first);
    assert(await verifyPassword('stable', rec.passwordHash));
  });

  await test('an already-hashed value sent as `password` is adopted, not re-hashed', async () => {
    // An older client, or a record migrated in place, sends the hash in the
    // field the old schema used.
    const hash = await hashPassword('legacy');
    const out = await hashRegistrationPassword({ id: 'u1', password: hash });
    assert.strictEqual(out.passwordHash, hash);
    assert.strictEqual(out.password, undefined);
    assert(await verifyPassword('legacy', out.passwordHash));
  });

  await test('a record with no password keeps none and is not rejected', async () => {
    const out = await hashRegistrationPassword({ id: 'u1', email: 'a@b.c' });
    assert.strictEqual(out.passwordHash, undefined);
    assert.strictEqual(out.email, 'a@b.c', 'the rest of the record must survive');
  });

  await test('a junk hash with no plaintext is dropped rather than trusted', async () => {
    const out = await hashRegistrationPassword({ id: 'u1', passwordHash: 'not-a-hash' });
    assert.strictEqual(out.passwordHash, undefined);
    assert(!(await verifyPassword('not-a-hash', out.passwordHash)));
  });

  await test('the input record is not mutated', async () => {
    const input = { id: 'u1', password: 'secret1' };
    await hashRegistrationPassword(input);
    assert.strictEqual(input.password, 'secret1', 'caller’s object must be untouched');
  });

  results.forEach(([status, name]) => console.log(`  ${status}  ${name}`));
  const failed = results.filter(([s]) => s === 'FAIL').length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})();
