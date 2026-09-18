// Who belongs to whose team.
//
// A membership is its own record rather than an `owner` column on the account,
// and the reason is that the two are different lifetimes: an account exists on
// its own, joins a team, and outlives leaving one. A column would make "removed
// from the team" indistinguishable from "never in one", and would quietly tie
// the member's record to an owner who may later be deleted.
//
// One team per member, enforced by the key: an account cannot be billed as a
// seat twice. The key is the member's email, so re-adding them to another team
// moves them rather than duplicating them.
const { createCollectionStore } = require('./collectionStore');

const email = (v) => String(v || '').trim().toLowerCase();

const store = createCollectionStore({
  table: 'team_members',
  keyColumn: 'member_email',
  keyOf: (m) => email(m && m.memberEmail),
  keyHint: 'must have a memberEmail',
  indexes: ['owner_email'],
  columns: [
    { name: 'owner_email', from: (m) => m.ownerEmail },
    { name: 'invited_by', from: (m) => m.invitedBy },
  ],
});

/**
 * Adds an account to a team, or moves it between teams.
 *
 * @param {{ownerEmail: string, memberEmail: string, invitedBy: string}} spec
 * @returns {Promise<object>} the membership.
 */
async function add({ ownerEmail, memberEmail, invitedBy }) {
  const member = {
    ownerEmail: email(ownerEmail),
    memberEmail: email(memberEmail),
    invitedBy: email(invitedBy),
    addedAt: new Date().toISOString(),
  };
  if (!member.ownerEmail || !member.memberEmail) throw new Error('an owner and a member are required');
  if (member.ownerEmail === member.memberEmail) {
    // Not a validation nicety: the owner is already on the team by definition,
    // and a self-membership would make the seat count wrong and the removal
    // button offer to remove the person pressing it.
    throw new Error('an account cannot be a member of its own team');
  }
  await store.upsert(member);
  return member;
}

/** Everyone on this owner's team, oldest first — the order they joined. */
async function members(ownerEmail) {
  if (!store.isConfigured()) return [];
  const owner = email(ownerEmail);
  const rows = await store.list({ limit: 2000 });
  return rows
    .filter((m) => m.ownerEmail === owner)
    .sort((a, b) => String(a.addedAt || '').localeCompare(String(b.addedAt || '')));
}

/** The team an account belongs to, or null. */
async function teamOf(memberEmail) {
  if (!store.isConfigured()) return null;
  const rows = await store.list({ limit: 2000 });
  return rows.find((m) => m.memberEmail === email(memberEmail)) || null;
}

/**
 * Removes a member from a team.
 *
 * Scoped to the owner rather than taking the key alone: without it, anyone who
 * could reach this could remove a member from somebody else's team by naming
 * their email.
 */
async function remove({ ownerEmail, memberEmail }) {
  const found = await teamOf(memberEmail);
  if (!found || found.ownerEmail !== email(ownerEmail)) {
    throw Object.assign(new Error('That account is not on your team'), { status: 404 });
  }
  await store.removeMany([email(memberEmail)]);
  return found;
}

module.exports = { add, members, teamOf, remove, store };
