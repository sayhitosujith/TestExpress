// Moves stored users from `practice` to `payment`, in this browser.
//
// The database column was renamed and its values migrated, but every browser
// that has ever registered or synced a user still holds the old field name in
// localStorage. That copy is not harmless: dbSync mirrors localStorage to the
// database, so the first tab to sync after the rename would push records with
// no `payment` on them at all and quietly undo the migration -- re-adding
// `practice` to the JSONB and blanking the column.
//
// So this has to run before dbSync does, which is why it is wired into
// index.js next to the password scrub rather than into a page.
//
// The value is rewritten as well as the key, and that is deliberate. The old
// values are practice names -- "HerveyBay" is not a payment, and carrying it
// across would leave the field populated with something no dropdown offers and
// nothing can mean. Anything not on the current list becomes the default, which
// someone can then change; the alternative, leaving it, produces a form whose
// control shows a blank because its stored value matches no option.
//
// This is a migration with a natural end. Once every browser in use has booted
// once on a build containing it, it is dead code and can go.
import { PAYMENT_OPTIONS } from "./constants";

const KEY = "registeredUsers";

/** What an unrecognised value becomes. First on the list, so the cheapest. */
const DEFAULT_PAYMENT = PAYMENT_OPTIONS[0].value;

const isKnown = (value) => PAYMENT_OPTIONS.some((o) => o.value === value);

/**
 * Renames `practice` to `payment` on every stored user, normalising the value.
 *
 * A record that already has a valid `payment` is left completely alone, so this
 * cannot overwrite a choice somebody has since made.
 *
 * @returns {number} how many records were changed — 0 on every boot after the
 *   first, which is what tells you it is finished.
 */
export function migrateStoredPayment() {
  let raw;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    // Storage can be unavailable outright (private mode, blocked site data).
    return 0;
  }
  if (!raw) return 0;

  try {
    const users = JSON.parse(raw);
    if (!Array.isArray(users)) return 0;

    let changed = 0;
    const migrated = users.map((user) => {
      if (!user || typeof user !== "object") return user;

      const hadPractice = user.practice !== undefined;
      const needsValue = user.payment !== undefined && !isKnown(user.payment);
      if (!hadPractice && !needsValue) return user;

      const { practice, ...rest } = user;
      const current = user.payment !== undefined ? user.payment : practice;
      changed += 1;
      return { ...rest, payment: isKnown(current) ? current : DEFAULT_PAYMENT };
    });

    if (!changed) return 0;
    localStorage.setItem(KEY, JSON.stringify(migrated));
    return changed;
  } catch {
    // A corrupt value is left exactly as it is. Rewriting something that could
    // not be parsed risks destroying a record someone could still recover by
    // hand, and a value this code cannot read is not one it should replace.
    return 0;
  }
}
