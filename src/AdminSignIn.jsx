import React, { useState } from "react";
import { ExclamationTriangleIcon, LockClosedIcon } from "@heroicons/react/24/solid";
import { useAuth } from "./context/AuthContext";
import { login as authenticate } from "./api/auth";
import { roleAllowed } from "./routeAccess";

// Sign-in for a page that admits one role.
//
// Deliberately in the page rather than in front of it. A route guard can only
// send an unrecognised visitor somewhere else -- to the main login screen, which
// then has to remember where they were going and hand them back. Here the page
// asks for credentials itself and reveals its own content when they are the
// right ones, so there is no round trip and nothing to remember.
//
// Two answers, not one:
//
//   * the password was wrong -- the same message for a bad password and an
//     unknown account, which is what stops this form being used to discover who
//     has one;
//   * the password was right and the role is wrong -- said plainly, and NO
//     session is opened. Signing someone in and then refusing them is a state
//     with no name: they would be authenticated, standing on a page that will
//     not show them anything, with nothing to click.
//
// None of this is the protection. /api/admin refuses a caller whose established
// role is wrong (see Backend/requireRole.js), so a visitor who edits their way
// past this form arrives at a page whose every request answers 403. This is the
// door; the endpoint is the lock.

/**
 * The credentials form, and what to do with what it collects.
 *
 * @param {string[]} roles roles that may open the page behind this.
 * @param {string} [title] heading, when a page wants its own wording.
 */
export default function AdminSignIn({ roles, title = "Super Admin sign-in" }) {
  const { user, login: startSession, logout } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Someone is signed in, just not as anyone who can be here. Worth saying
  // outright: the alternative is a bare login form in front of a person who
  // believes they are already signed in, which reads as the session having been
  // lost rather than as being the wrong account for this page.
  const wrongAccount = !!user;

  const submit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setError("");

    if (!email || !password) {
      setError("Enter both an email address and a password.");
      return;
    }

    setSubmitting(true);
    let proven;
    try {
      proven = await authenticate(email, password);
    } catch (err) {
      setSubmitting(false);
      setError(err.message);
      return;
    }

    if (!roleAllowed(roles, proven.user && proven.user.role)) {
      setSubmitting(false);
      // Named rather than folded into "invalid credentials". The password was
      // correct; telling them it was not sends them to reset a password that
      // was never the problem.
      setError(
        `That account is ${proven.user && proven.user.role ? `a ${proven.user.role}` : "not assigned a role"}. ` +
          `This page needs the ${roles.join(" or ")} role.`,
      );
      return;
    }

    // Opens the session for the whole app, not just this page: it is the same
    // sign-in, and the token it stores is what every protected endpoint wants.
    // The page behind this re-renders as soon as the context updates -- there is
    // nothing to navigate to.
    startSession(proven.user, proven.token);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-green-100">
            <LockClosedIcon className="h-5 w-5 text-green-700" />
          </span>
          <h1 className="text-lg font-bold text-gray-900">{title}</h1>
          <p className="mt-1 text-sm text-gray-500">
            This page administers every account, so it asks for a{" "}
            {roles.join(" or ")} sign-in.
          </p>
        </div>

        {wrongAccount && (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Signed in as <b>{user.email || user.name || "someone"}</b>
            {user.role ? ` (${user.role})` : ""}, which cannot open this page. Sign in below as a{" "}
            {roles.join(" or ")}, or{" "}
            <button
              type="button"
              onClick={logout}
              className="font-semibold underline hover:no-underline"
            >
              sign out
            </button>
            .
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* A real form, so Enter submits and a password manager recognises the
            pair -- the same reason App.js uses one. */}
        <form onSubmit={submit} noValidate className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Email
            </span>
            <input
              id="admin-email"
              name="email"
              type="email"
              autoComplete="username"
              autoFocus
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Password
            </span>
            <input
              id="admin-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
