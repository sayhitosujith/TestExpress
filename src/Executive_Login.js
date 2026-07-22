import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "./assets/Toothx_Logo.png";

const DEFAULT_EXECUTIVES = [
  { id: "E1", name: "Priya Sharma",  role: "Senior Agent", accessKey: "PRIYA@2024"  },
  { id: "E2", name: "Rahul Mehta",   role: "Agent",        accessKey: "RAHUL@2024"  },
  { id: "E3", name: "Anita Verma",   role: "Team Lead",    accessKey: "ANITA@2024"  },
  { id: "E4", name: "Karan Patel",   role: "Agent",        accessKey: "KARAN@2024"  },
];

export default function ExecutiveLogin() {
  const navigate = useNavigate();
  const [key,     setKey]     = useState("");
  const [show,    setShow]    = useState(false);
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    const trimmed = key.trim();
    if (!trimmed) { setError("Please enter your access key."); return; }

    const execs = JSON.parse(localStorage.getItem("supportExecutives") || "null") || DEFAULT_EXECUTIVES;
    const matched = execs.find(e => e.accessKey === trimmed);

    if (!matched) {
      setError("Invalid access key. Please check and try again.");
      return;
    }

    setLoading(true);
    const session = {
      id: matched.id,
      name: matched.name,
      role: matched.role,
      loginAt: new Date().toISOString(),
    };
    localStorage.setItem("execSession", JSON.stringify(session));

    // wipe any stale heartbeat for this exec left from a previous crashed session
    const beats = JSON.parse(localStorage.getItem("execOnlineSessions") || "{}");
    delete beats[matched.id];
    localStorage.setItem("execOnlineSessions", JSON.stringify(beats));

    setTimeout(() => navigate("/Executive_Portal"), 800);
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Outfit', sans-serif",
      position: "relative",
      overflow: "hidden",
    }}>
      <style>{`
        @keyframes floatOrb {
          0%, 100% { transform: translate(0,0) scale(1); }
          50% { transform: translate(20px, 30px) scale(1.05); }
        }
        .exec-orb1 {
          position: fixed; width: 500px; height: 500px; border-radius: 50%;
          background: #6366f1; filter: blur(120px); opacity: 0.15;
          top: -150px; left: -150px; animation: floatOrb 9s infinite ease-in-out;
        }
        .exec-orb2 {
          position: fixed; width: 400px; height: 400px; border-radius: 50%;
          background: #818cf8; filter: blur(100px); opacity: 0.12;
          bottom: -100px; right: -100px; animation: floatOrb 11s infinite ease-in-out reverse;
        }
        @keyframes slideUp {
          from { transform: translateY(30px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        .card-enter { animation: slideUp 0.4s ease-out; }
        .key-input:focus { outline: none; border-color: #818cf8; box-shadow: 0 0 0 3px rgba(129,140,248,0.2); }
      `}</style>

      <div className="exec-orb1" />
      <div className="exec-orb2" />

      <div className="card-enter" style={{
        background: "white",
        borderRadius: 24,
        boxShadow: "0 40px 80px rgba(0,0,0,0.4)",
        width: "100%",
        maxWidth: 420,
        overflow: "hidden",
        position: "relative",
        zIndex: 10,
        margin: "0 16px",
      }}>
        {/* Top accent bar */}
        <div style={{
          background: "linear-gradient(135deg, #4338ca, #6366f1)",
          padding: "32px 32px 28px",
          color: "white",
          textAlign: "center",
        }}>
          <img src={logo} alt="logo" style={{ width: 120, marginBottom: 16, filter: "brightness(0) invert(1)" }} />
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "rgba(255,255,255,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 26, margin: "0 auto 12px",
          }}>🔑</div>
          <p style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Executive Portal</p>
          <p style={{ fontSize: 13, opacity: 0.7, marginTop: 6 }}>Sign in with your access key</p>
        </div>

        {/* Form */}
        <div style={{ padding: "32px" }}>
          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: "block", fontSize: 11, fontWeight: 700,
              color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8,
            }}>
              Access Key
            </label>
            <div style={{ position: "relative" }}>
              <input
                className="key-input"
                type={show ? "text" : "password"}
                value={key}
                onChange={e => { setKey(e.target.value); setError(""); }}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                placeholder="Enter your access key..."
                autoFocus
                style={{
                  width: "100%",
                  border: error ? "2px solid #f87171" : "2px solid #e5e7eb",
                  borderRadius: 12,
                  padding: "12px 48px 12px 16px",
                  fontSize: 14,
                  fontFamily: "monospace",
                  color: "#1f2937",
                  background: error ? "#fef2f2" : "#f9fafb",
                  boxSizing: "border-box",
                  transition: "border-color 0.2s",
                }}
              />
              <button
                type="button"
                onClick={() => setShow(s => !s)}
                style={{
                  position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: 16, color: "#9ca3af",
                }}
              >{show ? "🙈" : "👁"}</button>
            </div>
            {error && (
              <p style={{ color: "#ef4444", fontSize: 12, marginTop: 6, fontWeight: 600 }}>
                ⚠ {error}
              </p>
            )}
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              width: "100%",
              background: loading ? "#a5b4fc" : "linear-gradient(135deg, #4338ca, #6366f1)",
              color: "white",
              border: "none",
              borderRadius: 12,
              padding: "13px 0",
              fontSize: 15,
              fontWeight: 800,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              letterSpacing: "0.02em",
            }}
          >
            {loading ? "Signing in..." : "Sign In →"}
          </button>

          <p style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: "#9ca3af" }}>
            Access key is set by your manager in the{" "}
            <span style={{ color: "#4338ca", fontWeight: 600 }}>Executives</span> tab
          </p>
        </div>
      </div>
    </div>
  );
}
