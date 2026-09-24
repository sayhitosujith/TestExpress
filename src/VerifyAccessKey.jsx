import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { verifyAccessKey, resetAccessKey } from "./api/auth";
import { useAuth } from "./context/AuthContext";
import { landingAfterLogin } from "./routeAccess";
import { sessionFrom } from "./sessionFrom";

const MIN_PASSWORD_LENGTH = 8;

/**
 * Where the "Sign in to TestExpress" link in an access-key email lands.
 *
 * Deliberately not a straight sign-in: an access key is a temporary,
 * admin-issued credential (see accessKeys.js on the server), and letting it
 * go on working indefinitely would leave it as a permanent password nobody
 * chose. This page checks the key first, then requires the account holder to
 * pick their own password before it ever opens a session — one click still
 * gets them in, but through a password that is actually theirs.
 */
function VerifyAccessKey() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login: startSession } = useAuth();

  const email = searchParams.get("email") || "";
  const key = searchParams.get("key") || "";

  // idle -> checking -> ready | invalid ; ready -> submitting -> done | ready (on error)
  const [status, setStatus] = useState("checking");
  const [name, setName] = useState("");
  const [checkError, setCheckError] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [disabledNotice, setDisabledNotice] = useState("");

  useEffect(() => {
    if (!email || !key) {
      setStatus("invalid");
      setCheckError("This link is missing its access key. Ask an administrator to send it again.");
      return;
    }
    verifyAccessKey(email, key)
      .then((data) => {
        setName(data.name || email);
        setStatus("ready");
      })
      .catch((err) => {
        setCheckError(err.message);
        setStatus("invalid");
      });
  }, [email, key]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    setFormError("");
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setFormError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormError("Passwords do not match");
      return;
    }

    setSubmitting(true);
    try {
      const data = await resetAccessKey(email, key, newPassword);
      if (data.signedIn) {
        const session = sessionFrom(data.user, email);
        startSession(session, data.token);
        navigate(landingAfterLogin(null, session.role), { replace: true });
        return;
      }
      // The password was set, but sign-in is blocked for an unrelated reason
      // (see reset-access-key on the server) -- worth saying so plainly
      // rather than leaving the page looking like it failed.
      setDisabledNotice(data.error || "Password set, but this account cannot sign in yet.");
      setStatus("done");
    } catch (err) {
      setFormError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-r from-green-100 via-green-700 to-green-900 flex items-center justify-center p-6">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-8">
        {status === "checking" && (
          <p className="text-center text-gray-600">Checking your access key…</p>
        )}

        {status === "invalid" && (
          <>
            <h2 className="text-xl font-bold text-center text-red-600 mb-3">
              This link isn't valid
            </h2>
            <p className="text-center text-gray-600 text-sm mb-6">{checkError}</p>
            <Link
              to="/my-app"
              className="block text-center rounded-md bg-black text-white font-semibold py-2 hover:bg-gray-800 transition"
            >
              Go to sign in
            </Link>
          </>
        )}

        {status === "ready" && (
          <>
            <h2 className="text-xl font-bold text-center text-green-700 mb-1">
              Welcome, {name}
            </h2>
            <p className="text-center text-gray-600 text-sm mb-6">
              Your access key is valid. Choose a password to finish setting up your account.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1">
                  New password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full border rounded-md p-2"
                  disabled={submitting}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1">
                  Confirm password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full border rounded-md p-2"
                  disabled={submitting}
                />
              </div>
              {formError && <p className="text-red-600 text-sm">{formError}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-md bg-black text-white font-semibold py-2 hover:bg-gray-800 transition disabled:opacity-60"
              >
                {submitting ? "Setting password…" : "Set password and sign in"}
              </button>
            </form>
          </>
        )}

        {status === "done" && (
          <>
            <h2 className="text-xl font-bold text-center text-green-700 mb-3">
              Password set
            </h2>
            <p className="text-center text-gray-600 text-sm mb-6">{disabledNotice}</p>
            <Link
              to="/my-app"
              className="block text-center rounded-md bg-black text-white font-semibold py-2 hover:bg-gray-800 transition"
            >
              Go to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default VerifyAccessKey;
