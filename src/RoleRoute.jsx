import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
// The one comparison every role decision goes through -- see routeAccess.js.
// Shared so this guard and the menus that offer the guarded pages cannot
// disagree about whether an account holds a role.
import { roleAllowed } from "./routeAccess";

/**
 * Renders its children only for a signed-in user holding one of `roles`.
 *
 * Composes with AuthRoute rather than repeating it: AuthRoute answers "is
 * anyone signed in", this answers "is it the right someone". Nesting the two
 * keeps one definition of each question.
 *
 * IMPORTANT, and not a detail: this hides a screen, it does not protect data.
 * The app has no session token, so the role is read from the same localStorage
 * the browser can edit, and the API this page calls will answer anyone who asks
 * it directly. Making the guard real means the server has to be able to tell
 * who is calling — see the note at the top of Backend/routes/auth.js.
 *
 * @param {string[]} roles roles allowed through.
 * @param {React.ReactNode} children the guarded screen.
 */
export default function RoleRoute({ roles, children }) {
  const { user } = useAuth();

  // Not signed in at all is AuthRoute's answer to give, not this one's. Sending
  // them to login here too would mean two components deciding where an
  // unauthenticated visitor lands, and they would eventually disagree.
  if (!user) return <Navigate to="/my-app" replace />;

  // Somewhere they can actually use, rather than a dead end that says no.
  if (!roleAllowed(roles, user.role)) return <Navigate to="/HomePage" replace />;

  return children;
}
