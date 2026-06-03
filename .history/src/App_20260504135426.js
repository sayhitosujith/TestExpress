import "./App.css";
import React, { useState, useRef } from "react";
import RCB from "./assets/D-logo.jpg";
import logo from "./assets/Toothx_Logo.png";
import { useNavigate } from "react-router-dom";

function App() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [practice, setPractice] = useState("");
  const [remember, setRemember] = useState(false);

  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [practiceError, setPracticeError] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginSuccess, setLoginSuccess] = useState("");

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
    if (["INPUT", "SELECT", "BUTTON", "LABEL"].includes(e.target.tagName))
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

  // ---- LOGIN ---- //
  const handleLogin = () => {
    setEmailError("");
    setPasswordError("");
    setPracticeError("");
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

    if (!practice) {
      setPracticeError("Please select a practice");
      valid = false;
    }

    if (!valid) return;

    const storedUsers = JSON.parse(
      localStorage.getItem("registeredUsers") || "[]",
    );
    const existingUser = storedUsers.find((u) => u.email === email);

    if (!existingUser) {
      setLoginError("User not registered");
      return;
    }

    if (existingUser.password !== password) {
      setPasswordError("Invalid credentials");
      return;
    }

    setLoginSuccess("Login successful! Redirecting...");

    localStorage.setItem(
      "user",
      JSON.stringify({
        name: existingUser.name || email,
        email: existingUser.email,
        role: existingUser.role || "CUSTOMER",
        practiceName: practice,
      }),
    );

    setTimeout(() => navigate("/Welcome"), 2000);
  };

  return (
    <div
      style={{
        backgroundImage: `url(${RCB})`,
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
          background: #F97316; filter: blur(80px); opacity: 0.15;
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
          background: linear-gradient(160deg, #1e1b4b 0%, #312e81 40%, #4c1d95 100%);
          display: flex; flex-direction: column; justify-content: space-between;
          padding: 40px; position: relative; overflow: hidden;
        }
        .panel-left::before {
          content: ''; position: absolute; inset: 0;
          background-image:
            radial-gradient(circle at 20% 80%, rgba(249,115,22,0.2) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(124,58,237,0.3) 0%, transparent 50%);
        }
        .topo {
          position: absolute; inset: 0; opacity: 0.06;
          background-image: repeating-radial-gradient(
            circle at 60% 40%,
            transparent 0px, transparent 28px,
            rgba(255,255,255,0.8) 28px, rgba(255,255,255,0.8) 30px
          );
        }
        .panel-right {
          width: 380px; background: #ffffff;
          padding: 44px 40px; display: flex; flex-direction: column; justify-content: center;
        }
        .form-input {
          width: 100%; background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1); border-radius: 10px;
          padding: 12px 16px; color: #e2e8f0;
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
        .form-input::placeholder { color: rgba(148,163,184,0.4); }
        .form-select {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2394a3b8' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 14px center; cursor: pointer;
        }
        .form-select option { background: #1a1a2e; }
        .btn-primary {
          width: 100%; border: none; border-radius: 10px; padding: 13px;
          font-family: 'Outfit', sans-serif; font-size: 15px; font-weight: 700;
          letter-spacing: 1px; text-transform: uppercase; cursor: pointer;
          background: linear-gradient(135deg, #7C3AED 0%, #C026D3 50%, #F97316 100%);
          color: white; transition: opacity 0.2s, transform 0.1s;
        }
        .btn-primary:hover { opacity: 0.9; }
        .btn-primary:active { transform: scale(0.98); }
        .btn-secondary {
          width: 100%; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 13px;
          font-family: 'Outfit', sans-serif; font-size: 15px; font-weight: 700;
          letter-spacing: 1px; text-transform: uppercase; cursor: pointer;
          background: rgba(255,255,255,0.05); color: #f77e02;
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
                src={logo}
                alt="ToothX"
                style={{ height: 100, objectFit: "contain" }}
              />
            </div>

            {/* Tagline */}
            <div
              style={{
                color: "rgba(255,255,255,0.9)",
                fontSize: 28,
                fontWeight: 600,
                lineHeight: 1.3,
                letterSpacing: "-0.5px",
              }}
            >
              Modern dental care,
              <br />
              <span
                style={{
                  background: "linear-gradient(135deg,#7C3AED,#F97316)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                reimagined
              </span>{" "}
              for
              <br />
              your practice.
            </div>

            <div
              style={{
                color: "rgba(255,255,255,0.3)",
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: 3,
                textTransform: "uppercase",
              }}
            >
              A Dental Practice Portal
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
                color: "#f77e02",
                letterSpacing: "-0.5px",
              }}
            >
              Welcome Back!
            </div>
            <div style={{ color: "#1c6906", fontSize: 14, marginTop: 6 }}>
              Sign in to your ToothX portal
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

          {/* Email */}
          <div style={{ marginBottom: 14 }}>
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.5px",
                color: "#94a3b8",
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              Email
            </label>
            <input
              className={`form-input${emailError ? " error-field" : ""}`}
              type="email"
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
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.5px",
                color: "#94a3b8",
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              Password
            </label>
            <input
              className={`form-input${passwordError ? " error-field" : ""}`}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setPasswordError("");
              }}
            />
            {passwordError && (
              <p style={{ color: "#f87171", fontSize: 12, marginTop: 4 }}>
                {passwordError}
              </p>
            )}
          </div>

          {/* Practice */}
          <div style={{ marginBottom: 14 }}>
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.5px",
                color: "#94a3b8",
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              Practice
            </label>
            <select
              className={`form-input form-select${practiceError ? " error-field" : ""}`}
              value={practice}
              onChange={(e) => {
                setPractice(e.target.value);
                setPracticeError("");
              }}
            >
              <option value="">Select Practice</option>
              <option value="Hervey Bay Dental">Hervey Bay Dental</option>
              <option value="Sunshine Coast Dental">
                Sunshine Coast Dental
              </option>
              <option value="Brisbane Dental Clinic">
                Brisbane Dental Clinic
              </option>
            </select>
            {practiceError && (
              <p style={{ color: "#f87171", fontSize: 12, marginTop: 4 }}>
                {practiceError}
              </p>
            )}
          </div>

          {/* Remember Me */}
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
              style={{
                fontSize: 13,
                color: "#94a3b8",
                cursor: "pointer",
                textTransform: "none",
                letterSpacing: "normal",
              }}
            >
              Remember Me
            </label>
          </div>

          <button className="btn-primary" onClick={handleLogin}>
            Login
          </button>

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

          <button
            className="btn-secondary"
            onClick={() => navigate("/NewRegistration")}
          >
            <span style={{ color: '#000', textTransform: 'none' }}>New User?</span>{' '}
            <span style={{ textDecoration: 'underline' }}>Register Here</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;