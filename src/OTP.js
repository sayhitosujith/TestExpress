import "./App.css";
import React, { useState, useRef, useEffect } from "react";
import OtpInput from "react-otp-input";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import logo from "./assets/Toothx_Logo.png";

function OTP() {
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  // Draggable Card
  const cardRef = useRef(null);
  const drag = useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
    dx: 0,
    dy: 0,
  });

  const startDrag = (e) => {
    if (e.target.closest("input, button, a")) return;
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

  useEffect(() => {
    return () => {
      document.removeEventListener("mousemove", onDrag);
      document.removeEventListener("mouseup", stopDrag);
    };
  }, []);

  const handleVerify = () => {
    if (otp.length !== 4) {
      setError("Enter complete OTP");
      return;
    }

    if (otp === "1111") {
      setError("");
      setSuccess("OTP Verified Successfully ✅");

      setTimeout(() => {
        const mobileFromState = location?.state?.mobile || localStorage.getItem('lastMobile') || '';
        const userObj = { mobile: mobileFromState };
        login(userObj);
        localStorage.setItem("customerSession", JSON.stringify({ mobile: mobileFromState, loginAt: new Date().toISOString() }));
        const returnTo = location?.state?.returnTo || "/Customer_home";
        navigate(returnTo);
      }, 2000);
    } else {
      setSuccess("");
      setError("Please enter valid OTP");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(135deg, #0f172a 0%, #1e1b4b 40%, #312e81 100%)",
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
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(8px)",
        }}
      />

      {/* Floating Orbs */}
      <div className="orb1" />
      <div className="orb2" />

      <style>{`
        @keyframes floatOrb {
          0%, 100% { transform: translate(0,0); }
          50% { transform: translate(30px,30px); }
        }
        .orb1 {
          position: fixed;
          width: 400px;
          height: 400px;
          border-radius: 50%;
          background: #7C3AED;
          filter: blur(100px);
          opacity: 0.2;
          top: -100px;
          left: -100px;
          animation: floatOrb 8s infinite ease-in-out;
        }
        .orb2 {
          position: fixed;
          width: 350px;
          height: 350px;
          border-radius: 50%;
          background: #F97316;
          filter: blur(100px);
          opacity: 0.2;
          bottom: -100px;
          right: -100px;
          animation: floatOrb 8s infinite ease-in-out;
        }
        .otp-card {
          display: flex;
          width: 900px;
          max-width: 95vw;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 40px 80px rgba(0,0,0,0.6);
          position: relative;
          z-index: 10;
        }
        .left-panel {
          flex: 1;
          background: linear-gradient(160deg,#1e1b4b,#4c1d95);
          padding: 40px;
          color: white;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .right-panel {
          width: 380px;
          background: white;
          padding: 40px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .btn-primary {
          width: 100%;
          padding: 12px;
          border-radius: 10px;
          border: none;
          background: linear-gradient(135deg,#7C3AED,#F97316);
          color: white;
          font-weight: bold;
          cursor: pointer;
        }
      `}</style>

      <div ref={cardRef} className="otp-card" onMouseDown={startDrag}>
        {/* LEFT SIDE */}
        <div className="left-panel">
          <img src={logo} alt="logo" style={{ width: 140 }} />

          <div style={{ fontSize: 26, fontWeight: 600 }}>
            Secure OTP
            <br />
            <span style={{ color: "#F97316" }}>verification process</span>
          </div>

          <div style={{ opacity: 0.6, fontSize: 12 }}>
            Enter the code sent to your mobile
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="right-panel">
          <h2 style={{ fontSize: 24, fontWeight: 700, color: "#f77e02" }}>
            Verify OTP
          </h2>

          <p style={{ fontSize: 14, color: "#666", marginBottom: 20 }}>
            Please enter the 4-digit code sent to your phone
          </p>

          <div style={{ display: "flex", justifyContent: "center" }}>
            <OtpInput
              value={otp}
              onChange={setOtp}
              numInputs={4}
              renderSeparator={<span style={{ margin: "0 8px" }}>-</span>}
              renderInput={(props) => (
                <input
                  {...props}
                  style={{
                    width: "50px",
                    height: "50px",
                    fontSize: "20px",
                    textAlign: "center",
                    borderRadius: "10px",
                    border: "1px solid #ddd",
                  }}
                />
              )}
            />
          </div>

          {error && (
            <p style={{ color: "red", marginTop: 10, textAlign: "center" }}>
              {error}
            </p>
          )}

          {success && (
            <p style={{ color: "#f77e02", marginTop: 10, textAlign: "center" }}>
              {success}
            </p>
          )}

          <button
            className="btn-primary"
            style={{ marginTop: 20 }}
            onClick={handleVerify}
          >
            Verify OTP
          </button>

          <p style={{ textAlign: "center", marginTop: 20 }}>
            Didn’t receive code?{" "}
            <span style={{ color: "red", fontWeight: "bold", cursor: "pointer" }}>
              Resend
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default OTP;
