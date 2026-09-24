/**
 * Shapes an account the server returned into the session the app keeps.
 *
 * Shared rather than duplicated: the password login form and the
 * access-key reset page (App.js and VerifyAccessKey.jsx) both turn a server
 * response into a session, and "what a signed-in user is" must not depend on
 * which screen proved it — two copies of this is how one path ends up
 * carrying a field the other does not, and the plan gating throughout the
 * app reads `payment`.
 *
 * @param {object} account the account as the server returned it.
 * @param {string} [typedEmail] what was in the form, as a last resort for the
 *   display name.
 * @returns {object} the session.
 */
export function sessionFrom(account, typedEmail) {
  return {
    name:
      `${account.firstName || ""} ${account.lastName || ""}`.trim() ||
      account.name ||
      account.email ||
      typedEmail ||
      "",
    firstName: account.firstName || "",
    lastName: account.lastName || "",
    email: account.email,
    role: account.role || "CUSTOMER",
    // Carried because everything downstream gates on it — without this a
    // Google sign-in would land on the floor plan whatever the account is on.
    payment: account.payment || "",
    // How they got in. Nothing branches on it yet; it is here so that a
    // screen asking "can this account change its password" has an answer.
    authProvider: account.authProvider || "password",
  };
}
