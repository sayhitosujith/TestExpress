import "./App.css";
import React, { useEffect, useState, useRef } from "react";
import Background_img from "./assets/D-logo.jpg";
import logo from "./assets/TestExpress.jpg";
// Uploaded branding replaces the shipped image here too: the sign-in screen is
// the first thing anyone sees, and it wearing the old mark would read as having
// landed somewhere else.
import { useBranding } from "./appBranding";
import { useLocation, useNavigate } from "react-router-dom";
// Sign-in is verified on the backend — see the note in handleLogin. Aliased
// because the session this page opens is started by AuthContext's login, and
// two functions called `login` in one file is a mistake waiting to be made.
import { login as authenticate } from "./api/auth";
// The signed-in user belongs to the context, not to a localStorage key this
// page writes behind its back — see the note in handleLogin.
import { useAuth } from "./context/AuthContext";
// Where a sign-in lands, defined once and shared with the router.
import { landingAfterLogin } from "./routeAccess";
// Sign in with Google. Google draws the button and collects the credentials —
// see the note at the top of that module for why that division matters.
import GoogleSignIn from "./GoogleSignIn";
// Shared with VerifyAccessKey.jsx — see the note there for why one copy.
import { sessionFrom } from "./sessionFrom";

/**
 * Where the email of someone who ticked "Remember Me" is kept.
 *
 * The address only — never the password. There is nothing to remember about the
 * session itself: it has no expiry, so it already outlives the browser whether
 * the box is ticked or not, and pretending otherwise would be a switch that
 * changes nothing. What the box does buy is not retyping the address.
 */
const REMEMBERED_EMAIL_KEY = "rememberedEmail";

/** How long the success message is left on screen before the redirect. */
const REDIRECT_DELAY_MS = 2000;

/**
 * Shared style for the login form's field labels.
 * Extracted because Email and Password had byte-identical inline copies —
 * one place to change keeps them from drifting apart.
 */
const FIELD_LABEL_STYLE = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.5px",
  color: "#000000",
  textTransform: "uppercase",
  marginBottom: 6,
};

function App() {
  const { logo: uploadedLogo, name: appName } = useBranding();
  const navigate = useNavigate();
  const location = useLocation();
  // Renamed on the way in: this one opens the session, the imported
  // `authenticate` only proves the password.
  const { login: startSession } = useAuth();

  // Read once, in the initialiser, rather than assigned by an effect after the
  // first paint — a field that fills in a frame later is a field someone has
  // already started typing into.
  const rememberedEmail = useRef(
    (() => {
      try {
        return localStorage.getItem(REMEMBERED_EMAIL_KEY) || "";
      } catch (e) {
        // Private-mode Safari throws on access rather than returning null.
        return "";
      }
    })(),
  ).current;

  const [email, setEmail] = useState(rememberedEmail);
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(!!rememberedEmail);

  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginSuccess, setLoginSuccess] = useState("");
  // Covers the request and the pause before the redirect, both: bcrypt at cost
  // 12 takes long enough to invite a second click, and a second sign-in landing
  // while the first is still resolving is two navigations racing each other.
  const [submitting, setSubmitting] = useState(false);

  // The redirect is deferred so the success message can be read, which leaves a
  // timer outliving the component if anything navigates away first.
  const redirectTimer = useRef(null);
  useEffect(() => () => clearTimeout(redirectTimer.current), []);

  // ---- Draggable Modal ---- //
  const cardRef = useRef(null);
  const drag = useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
    dx: 0,
    dy: 0,
  });

  const startDrag = (e) => {
    if (["INPUT", "BUTTON", "LABEL"].includes(e.target.tagName))
      return;
    drag.current.isDragging = true;
    drag.current.startX = e.clientX - drag.current.dx;
    drag.current.startY = e.clientY - drag.current.dy;
    document.addEventListener("mousemove", onDrag);
    document.addEventListener("mouseup", stopDrag);
  };

  const onDrag = (e) => {
    if (!drag.current.isDragging || !cardRef.current) return;
    drag.current.dx = e.clientX - drag.current.startX;
    drag.current.dy = e.clientY - drag.current.startY;
    cardRef.current.style.transform = `translate(${drag.current.dx}px, ${drag.current.dy}px)`;
  };

  const stopDrag = () => {
    drag.current.isDragging = false;
    document.removeEventListener("mousemove", onDrag);
    document.removeEventListener("mouseup", stopDrag);
  };

  /**
   * Opens the session and leaves, whichever way the account was proved.
   *
   * The redirect is deferred so the success line can be read, and the timer is
   * the one the unmount effect above clears.
   *
   * @param {object} account the account the server returned.
   * @param {string} token the session token.
   * @param {string} [message] what to say while the redirect waits.
   */
  const finishSignIn = (account, token, message) => {
    const session = sessionFrom(account, email);
    setLoginSuccess(message || "Login successful! Redirecting...");
    startSession(session, token);
    redirectTimer.current = setTimeout(
      () =>
        navigate(landingAfterLogin(location.state && location.state.from, session.role), {
          replace: true,
        }),
      REDIRECT_DELAY_MS,
    );
  };

  // ---- LOGIN ---- //
  // Async because verification is a request to the backend now, not a string
  // compare against localStorage.
  //
  // Takes the submit event because the fields live in a <form>: that is what
  // makes Enter in either field sign in, which is how a login form is expected
  // to behave and how a password manager drives one.
  const handleLogin = async (event) => {
    if (event) event.preventDefault();
    if (submitting) return;

    setEmailError("");
    setPasswordError("");
    setLoginError("");
    setLoginSuccess("");

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let valid = true;

    if (!email) {
      setEmailError("Email is required");
      valid = false;
    } else if (!emailPattern.test(email)) {
      setEmailError("Enter a valid email");
      valid = false;
    }

    if (!password) {
      setPasswordError("Password is required");
      valid = false;
    }

    if (!valid) return;

    // Verified by the backend, not here.
    //
    // This used to read `registeredUsers` out of localStorage and compare the
    // password as a plain string. That meant every password was readable in
    // devtools, and — worse — the comparison could be skipped entirely by
    // editing the same key it read from, so anyone could add themselves as a
    // Super Admin and walk in without knowing a password at all. Hashing the
    // stored value would not have helped while the check lived here: the hash
    // would simply have become the password.
    //
    // The server now compares what was typed against a bcrypt hash the browser
    // never sees. Note that this still does not make what happens *after*
    // sign-in trustworthy — there is no session token, and the session written
    // below is as forgeable as it always was.
    setSubmitting(true);
    let existingUser;
    let sessionToken;
    try {
      const proven = await authenticate(email, password);
      existingUser = proven.user;
      // The part that makes the role mean something. Without it the app still
      // renders the same screens, and every protected endpoint answers 401.
      sessionToken = proven.token;
    } catch (err) {
      setSubmitting(false);
      // A rejected password belongs against the password field; "cannot reach
      // the server" does not, and used to be shown there anyway — which reads
      // as "your password is wrong because the backend is down". The banner is
      // for everything that is not about what was typed.
      //
      // "Invalid credentials" covers both a wrong password and an unknown
      // account, deliberately: telling them apart lets someone enumerate who
      // has an account.
      if (err.credentials) setPasswordError(err.message);
      else setLoginError(err.message);
      return;
    }


    // Through the context, not straight into localStorage.
    //
    // Writing the keys directly left every consumer of useAuth() holding the
    // null it started with: AuthProvider reads localStorage once, in a useState
    // initialiser, and its `storage` listener never fires for a write made by
    // the tab that made it. So the session existed as far as AuthRoute was
    // concerned -- it reads the key itself -- and did not exist at all as far as
    // RoleRoute and TestRunner were concerned, which read the context. A Super
    // Admin signing in was bounced off /SuperAdmin back to this page, and
    // TestRunner showed nobody signed in, until a full reload. One writer for
    // the session is what makes those two answers the same answer.
    //
    // `loggedInUser` is deliberately not written any more: nothing reads it --
    // the only other mentions in the app are three places that remove it on
    // sign-out -- and a second copy of the session is a second copy to keep
    // current.
    try {
      if (remember) localStorage.setItem(REMEMBERED_EMAIL_KEY, existingUser.email || email);
      else localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    } catch (e) {
      // A full or blocked store must not cost someone their sign-in.
    }

    // Back to whatever they were trying to open when AuthRoute sent them here,
    // if the role can get in; the default landing page otherwise. The redirect
    // used to be /TestRunner unconditionally, which quietly dropped every deep
    // link and bookmark.
    finishSignIn(existingUser, sessionToken);
  };

  return (
    <div
      style={{
        backgroundImage: `url(${Background_img})`,
        minHeight: "100vh",
        backgroundSize: "cover",
        backgroundPosition: "center",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        fontFamily: "'Outfit', sans-serif",
      }}
    >
      {/* Blur overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.65)",
          backdropFilter: "blur(8px)",
        }}
      />

      {/* Background orbs */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap');
        @keyframes floatOrb {
          0%, 100% { transform: translate(0,0) scale(1); }
          50% { transform: translate(20px,20px) scale(1.05); }
        }
        .orb1 {
          position: fixed; width: 500px; height: 500px; border-radius: 50%;
          background: #7C3AED; filter: blur(80px); opacity: 0.15;
          top: -100px; left: -100px; pointer-events: none;
          animation: floatOrb 8s ease-in-out infinite;
        }
        .orb2 {
          position: fixed; width: 400px; height: 400px; border-radius: 50%;
          background: #10b981; filter: blur(80px); opacity: 0.15;
          bottom: -80px; right: -80px; pointer-events: none;
          animation: floatOrb 8s ease-in-out infinite; animation-delay: -4s;
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .login-card {
          display: flex;
          width: 860px;
          max-width: 95vw;
          min-height: 520px;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05);
          animation: slideUp 0.6s cubic-bezier(0.16,1,0.3,1) both;
          position: relative; z-index: 10;
          cursor: default;
        }
        .panel-left {
          flex: 1;
          /* White panel. The right panel is also #ffffff, so a divider is what
             keeps the card from reading as one undivided slab. */
          background: #ffffff;
          border-right: 1px solid #e5e7eb;
          display: flex; flex-direction: column; justify-content: space-between;
          padding: 40px; position: relative; overflow: hidden;
        }
        .panel-left::before {
          content: ''; position: absolute; inset: 0;
          background-image:
            /* Barely-there brand tint. Anything stronger stops the panel reading as white. */
            radial-gradient(circle at 20% 80%, rgba(16,185,129,0.05) 0%, transparent 55%),
            radial-gradient(circle at 80% 20%, rgba(124,58,237,0.05) 0%, transparent 55%);
        }
        .topo {
          /* Dark rings now that the panel is white — white-on-white was invisible. */
          position: absolute; inset: 0; opacity: 0.07;
          background-image: repeating-radial-gradient(
            circle at 60% 40%,
            transparent 0px, transparent 28px,
            rgba(15,23,42,0.8) 28px, rgba(15,23,42,0.8) 30px
          );
        }
        .panel-right {
          width: 380px; background: #ffffff;
          padding: 44px 40px; display: flex; flex-direction: column; justify-content: center;
        }
        .form-input {
          /* Light-panel values. The previous near-white text and translucent
             border were left over from a dark form — invisible on #ffffff. */
          width: 100%; background: #ffffff;
          border: 1px solid #d1d5db; border-radius: 10px;
          padding: 12px 16px; color: #111827;
          font-family: 'Outfit', sans-serif; font-size: 15px;
          outline: none; transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
          appearance: none; box-sizing: border-box;
        }
        .form-input:focus {
          border-color: #7C3AED;
          box-shadow: 0 0 0 3px rgba(124,58,237,0.3);
          background: rgba(124,58,237,0.08);
        }
        .form-input.error-field { border-color: #f87171; }
        .form-input::placeholder { color: #9ca3af; }
        .btn-primary {
          width: 100%; border: none; border-radius: 10px; padding: 13px;
          font-family: 'Outfit', sans-serif; font-size: 15px; font-weight: 700;
          letter-spacing: 1px; text-transform: uppercase; cursor: pointer;
          background: linear-gradient(135deg, #7C3AED 0%, #C026D3 50%, #10b981 100%);
          color: white; transition: opacity 0.2s, transform 0.1s;
        }
        .btn-primary:hover { opacity: 0.9; }
        .btn-primary:active { transform: scale(0.98); }
        .btn-secondary {
          width: 100%; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 13px;
          font-family: 'Outfit', sans-serif; font-size: 15px; font-weight: 700;
          letter-spacing: 1px; text-transform: uppercase; cursor: pointer;
          background: rgba(255,255,255,0.05); color: #10b981;
          transition: background 0.2s, transform 0.1s;
        }
        .btn-secondary:hover { background: #fffff; }
        .btn-secondary:active { transform: scale(0.98); }
        @media (max-width: 640px) {
          .panel-left { display: none; }
          .panel-right { width: 100%; }
        }
      `}</style>

      <div className="orb1" />
      <div className="orb2" />

      {/* Card */}
      <div ref={cardRef} className="login-card" onMouseDown={startDrag}>
        {/* Left Panel */}
        <div className="panel-left">
          <div className="topo" />
          <div
            style={{
              position: "relative",
              zIndex: 1,
              display: "flex",
              flexDirection: "column",
              height: "100%",
              justifyContent: "space-between",
            }}
          >
            {/* Brand */}
            <div style={{ display: "flex", alignItems: "center" }}>
              <img
                src={uploadedLogo || logo}
                alt={appName}
                className="logo-animate"
                style={{
                  height: 100,
                  objectFit: "contain",
                }}
              />
            </div>

            {/* Tagline */}
            <div
              style={{
                color: "#1f2937",
                fontSize: 28,
                fontWeight: 600,
                lineHeight: 1.3,
                letterSpacing: "-0.5px",
              }}
            >
              Modern AI Powered
              <br />
              <span
                style={{
                  background: "linear-gradient(135deg,#7C3AED,#10b981)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Test Automation
              </span>
              <br />
              Tool
            </div>

            <div
              style={{
                // Mid-grey: subordinate to the tagline, still AA on white.
                color: "#6b7280",
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: 3,
                textTransform: "uppercase",
              }}
            >
             Designed for SDET Professionals
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div className="panel-right">
          <div style={{ marginBottom: 28 }}>
            <div
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: "#10b981",
                letterSpacing: "-0.5px",
              }}
            >
              Welcome Back!
            </div>
            <div style={{ color: "#1c6906", fontSize: 14, marginTop: 6 }}>
              Sign in to your Test Express portal
            </div>
          </div>

          {/* Alerts */}
          {loginError && (
            <div
              style={{
                background: "rgba(248,113,113,0.1)",
                border: "1px solid rgba(248,113,113,0.3)",
                color: "#f87171",
                borderRadius: 8,
                padding: "10px 14px",
                fontSize: 13,
                fontWeight: 500,
                marginBottom: 12,
              }}
            >
              {loginError}
            </div>
          )}
          {loginSuccess && (
            <div
              style={{
                background: "rgba(52,211,153,0.1)",
                border: "1px solid rgba(52,211,153,0.3)",
                color: "#34d399",
                borderRadius: 8,
                padding: "10px 14px",
                fontSize: 13,
                fontWeight: 500,
                marginBottom: 12,
              }}
            >
              {loginSuccess}
            </div>
          )}

          {/* A real form, so Enter in either field signs in and a password
              manager recognises the pair. `noValidate` because the messages
              below are the ones we want shown -- the browser's own bubble for
              type="email" would fire first and say something different. */}
          <form onSubmit={handleLogin} noValidate>
            {/* Email */}
            <div style={{ marginBottom: 14 }}>
              <label style={FIELD_LABEL_STYLE} htmlFor="email">
                Email
              </label>
              <input
                className={`form-input${emailError ? " error-field" : ""}`}
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                placeholder="you@practice.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setLoginError("");
                  setEmailError("");
                }}
              />
              {emailError && (
                <p style={{ color: "#f87171", fontSize: 12, marginTop: 4 }}>
                  {emailError}
                </p>
              )}
            </div>

            {/* Password */}
            <div style={{ marginBottom: 14 }}>
              <label style={FIELD_LABEL_STYLE} htmlFor="password">
                Password
              </label>
              <input
                className={`form-input${passwordError ? " error-field" : ""}`}
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError("");
                  setLoginError("");
                }}
              />
              {passwordError && (
                <p style={{ color: "#f87171", fontSize: 12, marginTop: 4 }}>
                  {passwordError}
                </p>
              )}
            </div>

            {/* Remember Me — the email address, not the session. See
                REMEMBERED_EMAIL_KEY for why that is all there is to remember. */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 20,
              }}
            >
              <input
                type="checkbox"
                id="remember"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                style={{
                  width: 16,
                  height: 16,
                  accentColor: "#7C3AED",
                  cursor: "pointer",
                }}
              />
              <label
                htmlFor="remember"
                title="Fills your email address in next time. Your password is never kept."
                style={{
                  fontSize: 13,
                  color: "#000000",
                  cursor: "pointer",
                  textTransform: "none",
                  letterSpacing: "normal",
                }}
              >
                Remember my email
              </label>
            </div>

            <button
              className="btn-primary"
              type="submit"
              disabled={submitting}
              style={submitting ? { opacity: 0.6, cursor: "not-allowed" } : undefined}
            >
              {submitting ? "Signing in…" : "Login"}
            </button>
          </form>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              margin: "10px 0 14px",
              color: "rgba(148,163,184,0.3)",
              fontSize: 12,
            }}
          >
            <div
              style={{
                flex: 1,
                height: 1,
                background: "rgba(255,255,255,0.06)",
              }}
            />
            or
            <div
              style={{
                flex: 1,
                height: 1,
                background: "rgba(255,255,255,0.06)",
              }}
            />
          </div>

          {/* Google's own button. Rendered by Google, into its own container,
              so no credential passes through this page — and absent entirely
              when the install has no client id, rather than sitting grey. */}
          <GoogleSignIn
            onSignedIn={(account, token, created) =>
              finishSignIn(
                account,
                token,
                created
                  ? "Welcome — your account has been created. Redirecting…"
                  : "Login successful! Redirecting...",
              )
            }
            onError={setLoginError}
          />

          <div style={{ height: 10 }} />

          <button
            className="btn-secondary"
            onClick={() => navigate("/NewRegistration")}
          >
            <span style={{ color: "#000", textTransform: "none" }}>
              New User?
            </span>{" "}
            <span style={{ textDecoration: "underline" }}>Register Here</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
