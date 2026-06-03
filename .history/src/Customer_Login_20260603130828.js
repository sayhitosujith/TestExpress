import "./App.css";
import React, { useState, useRef } from "react";
import { Carousel } from "@material-tailwind/react";
import { IoMdFingerPrint } from "react-icons/io";
import logo from "./assets/Toothx_Logo.png";
import { Link, useNavigate } from "react-router-dom";

function Customer_Login() {
  const [mobile, setMobile] = useState("");
  const navigate = useNavigate();

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
        .login-card {
  display: flex;
  width: 880px;
  max-width: 95vw;
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 30px 80px rgba(0,0,0,0.5);
  position: relative;
  z-index: 10;
  backdrop-filter: blur(12px);
}

/* LEFT PANEL */
.left-panel {
  flex: 1;
  background: linear-gradient(160deg,#1e1b4b,#4c1d95);
  padding: 50px 40px;
  color: white;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.left-title {
  font-size: 28px;
  font-weight: 600;
  line-height: 1.4;
}

.left-highlight {
  color: #F97316;
}

/* RIGHT PANEL */
.right-panel {
  width: 380px;
  background: rgba(255,255,255,0.95);
  padding: 40px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  border-left: 1px solid rgba(0,0,0,0.05);
}

/* INPUT */
.input {
  width: 100%;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 14px;
  font-size: 15px;
  transition: all 0.2s ease;
}

.input:focus {
  border-color: #7C3AED;
  box-shadow: 0 0 0 3px rgba(124,58,237,0.15);
}

/* BUTTON */
.btn-primary {
  width: 100%;
  padding: 14px;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg,#7C3AED,#F97316);
  color: white;
  font-weight: 600;
  font-size: 15px;
  cursor: pointer;
  transition: all 0.25s ease;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px rgba(124,58,237,0.4);
}

/* FINGERPRINT */
.fingerprint {
  font-size: 55px;
  cursor: pointer;
  opacity: 0.8;
  transition: 0.2s;
}

.fingerprint:hover {
  transform: scale(1.1);
  opacity: 1;
}

/* MOBILE */
@media (max-width: 768px) {
  .login-card {
    flex-direction: column;
    border-radius: 16px;
  }

  .left-panel {
    padding: 25px;
    text-align: center;
  }

  .right-panel {
    width: 100%;
    padding: 25px;
  }
}
      `}</style>

      <div ref={cardRef} className="login-card" onMouseDown={startDrag}>
        {/* LEFT SIDE */}
        <div className="left-panel">
          <img src={logo} alt="logo" style={{ width: 200 }} />

          <div style={{ fontSize: 26, fontWeight: 600 }}>
            Fast, secure access
            <br />
            <span style={{ color: "#F97316" }}>to your dental care</span>
          </div>

          <div style={{ opacity: 0.6, fontSize: 12 }}>
            OTP Based Authentication
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="right-panel">
          <h2 style={{ fontSize: 24, fontWeight: 700, color: "#f77e02" }}>
            Welcome to Toothx
          </h2>
          <p style={{ fontSize: 14, color: "#666", marginBottom: 20 }}>
             one-stop solution for all your dental care needs. Please login to continue.
          </p>

          <input
            className="input"
            placeholder="Enter Mobile Number"
            value={mobile}
            maxLength={10}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, "");
              if (value.length <= 10) setMobile(value);
            }}
          />

          <button
            className="btn-primary"
            style={{ marginTop: 20 }}
            onClick={() => navigate("/OTP", { state: { mobile } })}
          >
            Get OTP
          </button>

          {/* Fingerprint */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              marginTop: 25,
            }}
          >
            <IoMdFingerPrint style={{ fontSize: 60, cursor: "pointer" }} />
          </div>

          <p style={{ textAlign: "center", marginTop: 10, color: "#f77e02" }}>
            Quick & secure login
          </p>

          {/* <p style={{ textAlign: "center", marginTop: 20 }}>
            Don't have an account?{" "}
            <Link to="/register" style={{ color: "red", fontWeight: "bold" }}>
              Register
            </Link>
          </p> */}
        </div>
      </div>
    </div>
  );
}

export default Customer_Login;
