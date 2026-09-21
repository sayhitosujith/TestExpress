// The plan catalogue: what plans exist, and what each one includes.
//
// Online (Postgres) like the other collections, with one difference that shapes
// the whole module: this list is not optional. The registration form cannot
// render without it and the admin API cannot validate a plan against nothing,
// so an install with no DATABASE_URL — or a database that is up but empty, or
// briefly unreachable — must still get a catalogue. paymentOptions.json is that
// floor: it ships with the app, it seeds the table on first use, and it is what
// `catalogue()` answers with when the database cannot be asked.
//
// The consequence worth knowing: an empty table is treated as "never seeded"
// rather than as "no plans". Deleting every plan therefore reseeds from the file
// on the next read. That is deliberate — a product with no plans at all is not a
// state anyone means to be in, and the alternative is a registration form with
// an empty select and no way back to one that works.
const { createCollectionStore } = require('./collectionStore');
const SEED = require('../paymentOptions.json');

/** A plan is identified by the value stored on an account, not by its label. */
const planKey = (plan) => String(plan?.value ?? '').trim();

const store = createCollectionStore({
  table: 'plans',
  keyColumn: 'plan_value',
  keyOf: planKey,
  keyHint: 'must have a value',
  indexes: ['position'],
  columns: [
    { name: 'label', from: (p) => p.label },
    // Mirrored out of the JSONB so the table can be read, summed and sorted by
    // hand — "what do we charge for Pro" should not need a JSON operator.
    { name: 'price', from: (p) => p.price },
    { name: 'currency', from: (p) => p.currency },
    { name: 'interval', from: (p) => p.interval },
    // Who a tier is sold to, which is not the same question as what it costs:
    // a cheap tier can be for a company and an expensive one for a person, and
    // the two are filtered and reported on separately.
    { name: 'kind', from: (p) => p.kind },
    // Tier order is meaning, not presentation: a plan includes every earlier
    // plan's capabilities (see src/plans.js), so the position has to survive the
    // round trip. `list()` orders by updated_at, which says nothing about tiers.
    { name: 'position', from: (p) => p.position },
  ],
});

// A price is three facts, and all three have to survive: the amount, what it is
// denominated in, and what period it buys. An amount alone cannot be rendered —
// "999" is not a price — and a missing period is how a monthly figure ends up
// compared against an annual one.
//
// null is a real value here and is not the same as 0: 0 is free, null is "not
// priced yet", and only one of those may be shown to somebody as a price. A
// plan seeded without one stays null until an administrator sets it.
const money = (value) => {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** The shape every reader downstream expects, whatever the row looked like. */
const normalise = (plan, i) => ({
  value: planKey(plan),
  label: String(plan?.label ?? planKey(plan)),
  blurb: typeof plan?.blurb === 'string' ? plan.blurb : '',
  adds: Array.isArray(plan?.adds) ? plan.adds.map(String) : [],
  price: money(plan?.price),
  // ISO 4217, upper-cased. Defaulted rather than left blank so a row written by
  // hand still renders; the editor is what changes it.
  currency: String(plan?.currency || 'INR').toUpperCase().slice(0, 3),
  // What the price buys. 'once' covers a one-off, and null belongs with a null
  // price — a period without an amount says nothing.
  interval: ['month', 'year', 'once'].includes(plan?.interval) ? plan.interval : null,
  // Individual unless it says otherwise: every tier that existed before this
  // field was for one person, and defaulting the other way would relabel them.
  kind: plan?.kind === 'corporate' ? 'corporate' : 'individual',
  position: Number.isFinite(Number(plan?.position)) ? Number(plan.position) : i,
});

const inTierOrder = (plans) =>
  plans
    .filter((p) => planKey(p))
    .map(normalise)
    .sort((a, b) => a.position - b.position)
    .map((p, i) => ({ ...p, position: i }));

/** The file, as the catalogue. Also what seeds the table. */
const fromFile = () => inTierOrder(SEED);

const SEED_BY_VALUE = new Map(fromFile().map((p) => [p.value, p]));

/**
 * Fills in fields a stored row predates.
 *
 * A row written before price existed has no `price` key at all, which is a
 * different thing from a row that has one set to null: the first has never been
 * asked the question, the second has been answered "not priced". Only the first
 * is filled in, from the shipped seed, which is how Free stays free after the
 * columns are added to a table that was already populated.
 *
 * Observed exactly that way: the catalogue was seeded, price was added
 * afterwards, and Free came back reading "Price on request".
 *
 * @param {object} row a stored plan.
 * @returns {object} the row, with any never-set fields taken from the seed.
 */
const withSeedDefaults = (row) => {
  const seed = SEED_BY_VALUE.get(planKey(row));
  if (!seed) return row;
  const filled = { ...row };
  ['price', 'currency', 'interval', 'blurb', 'adds', 'kind'].forEach((field) => {
    if (!(field in row)) filled[field] = seed[field];
  });
  return filled;
};

/**
 * Every plan, in tier order.
 *
 * Never throws and never returns an empty list: a caller asking what the plans
 * are is always answered, because every screen that asks is unusable without
 * one. `source` says where the answer came from, so the panel can show whether
 * it is looking at the database or at the shipped default.
 *
 * @returns {Promise<{plans: object[], source: 'database'|'seed'|'file'}>}
 */
async function catalogue() {
  if (!store.isConfigured()) return { plans: fromFile(), source: 'file' };
  try {
    const rows = await store.list({ limit: 200 });
    if (rows.length) {
      const filled = rows.map(withSeedDefaults);
      // Written back once, so the fill-in is a migration rather than something
      // every read has to redo — and so the table itself is correct when
      // somebody looks at it by hand.
      const stale = rows.filter((r, i) => JSON.stringify(r) !== JSON.stringify(filled[i]));
      if (stale.length) {
        await store.upsertMany(inTierOrder(filled));
        console.info(`[plans] filled in fields ${stale.length} plan row(s) predated`);
      }
      return { plans: inTierOrder(filled), source: 'database' };
    }
    const seeded = fromFile();
    await store.upsertMany(seeded);
    return { plans: seeded, source: 'seed' };
  } catch (err) {
    // A database that is configured but unreachable must not take the
    // registration form down with it.
    console.warn('[plans] falling back to paymentOptions.json:', err.message);
    return { plans: fromFile(), source: 'file' };
  }
}

/**
 * Replaces the catalogue with `plans`, in the order given.
 *
 * replaceAll rather than upserts: editing a catalogue includes removing a plan,
 * and a list of upserts can only ever add. Refuses an empty list — see the note
 * at the top of this file about what no plans would mean.
 *
 * @param {object[]} plans the new catalogue, in tier order.
 * @returns {Promise<{plans: object[], saved: number, deleted: number}>}
 */
async function saveCatalogue(plans) {
  if (!Array.isArray(plans) || !plans.length) {
    throw new Error('at least one plan is required');
  }
  const ordered = inTierOrder(plans);
  if (!ordered.length) throw new Error('every plan must have a value');
  const seen = new Set();
  ordered.forEach((p) => {
    if (seen.has(p.value)) throw new Error(`two plans are called "${p.value}"`);
    seen.add(p.value);
  });
  const result = await store.replaceAll(ordered);
  return { plans: ordered, ...result };
}

/** The plan values the admin API will accept. Always at least the file's. */
async function planValues() {
  const { plans } = await catalogue();
  return plans.map((p) => p.value);
}

module.exports = { catalogue, saveCatalogue, planValues, fromFile, store };
