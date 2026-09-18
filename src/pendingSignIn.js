// The credentials of an account that has just registered, held for exactly as
// long as it takes to walk it through the payment step.
//
// Why a module variable rather than storage of any kind. The point of it is to
// sign somebody in automatically once their payment settles, which needs the
// password they typed a moment ago — and this app is emphatic that a plaintext
// password must not be persisted: scrubStoredPasswords.js exists to delete ones
// that earlier versions left in localStorage. sessionStorage is no better here,
// since any script on the origin can read it, and React Router's location state
// is worse than it looks: history.state is written to disk by the browser and
// survives a reload.
//
// So it lives in memory, for one navigation, in one tab:
//
//   * a client-side navigation (registration → payment) keeps it;
//   * a reload, a new tab, or closing the browser loses it;
//   * `take()` clears it, so it is readable exactly once.
//
// Losing it is not a failure. The payment still settles server-side and the
// account is still enabled — the person is simply asked to sign in by hand,
// which is the ordinary path and what the fallback below is for.

let pending = null;

/**
 * Remembers who to sign in once their payment settles.
 *
 * @param {{email: string, password: string}} credentials the ones just typed.
 */
export const remember = ({ email, password }) => {
  pending = email && password ? { email, password } : null;
};

/**
 * Takes the remembered credentials, clearing them.
 *
 * Read-once on purpose: a password that stays readable after it has been used
 * is a password kept for no reason.
 *
 * @returns {{email: string, password: string}|null}
 */
export const take = () => {
  const held = pending;
  pending = null;
  return held;
};

/** Whether anything is held, without reading it. For deciding what to offer. */
export const isHeld = () => Boolean(pending);

/** Drops anything held. Called when a flow is abandoned. */
export const forget = () => {
  pending = null;
};
