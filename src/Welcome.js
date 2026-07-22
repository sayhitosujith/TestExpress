import "./App.css";
import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Typography, Breadcrumbs, Button } from "@material-tailwind/react";
import clinicBg from "./assets/DentalWallpaper.png";

import {
  MdOutlineEditNote,
  MdOutlineSettings,
  MdOutlinePowerSettingsNew,
  MdOutlineCalendarMonth,
  MdOutlineEventNote,
  MdOutlineManageAccounts,
  MdOutlineCardMembership,
  MdOutlineAccountCircle,
  MdOutlineAssignmentInd,
  MdSmartToy,
  MdOutlineAnalytics,
  MdOutlineMedicalServices,
  MdOutlineChatBubble,
  MdExpandMore,
  MdPersonOutline,
  MdGroup,
  MdOutlineSavings,
} from "react-icons/md";
import logo from "./assets/Toothx_Logo_trimmed.png";

/* ====================== BANNER TIMING ====================== */
const now = new Date();
const startDate = new Date("2025-04-05T08:00:00");
const endDate = new Date("2026-04-08T23:59:59");
const isBannerActive = now >= startDate && now <= endDate;

/* ====================== SERVICES ====================== */
const services = [
  {
    label: "RECEPTIONIST",
    icon: <MdOutlineAssignmentInd size={36} />,
    link: "/Receptionist",
  },
  {
    label: "EXECUTIVE LOGIN",
    icon: <span style={{ fontSize: 34 }}>🔑</span>,
    link: "/Executive_Login",
  },
  {
    label: "SUPER ADMIN",
    icon: <MdOutlineSettings size={36} />,
    link: "/SuperAdmin",
  },
  {
    label: "DENTIST PORTAL",
    icon: <MdOutlineMedicalServices size={36} />,
    link: "/DoctorList",
  },
  {
    label: "PATIENTS ONBOARDING",
    icon: <MdPersonOutline size={36} />,
    link: "/PatientPortal",
  },
  {
    label: "CONTACT CENTER",
    icon: <MdOutlineAccountCircle size={36} />,
    link: "/ContactCenter",
  },
  {
    label: "ANALYTICS",
    icon: <MdOutlineAnalytics size={36} />,
    link: "/Admin_Analytics",
  },
  {
    label: "CUSTOMER SUPPORT",
    icon: <MdGroup size={36} />,
    link: "/CustomerCare",
  },
  {
    label: "PATIENT PROFILES",
    icon: <MdOutlineManageAccounts size={36} />,
    link: "/Profile",
  },
  {
    label: "SETTINGS",
    icon: <MdOutlineSettings size={36} />,
    link: "/Settings",
  },
  {
    label: "APPOINTMENT HISTORY",
    icon: <MdOutlineCalendarMonth size={36} />,
    link: "/AppointmentHistory",
  },
  {
    label: "BOOK APPOINTMENT",
    icon: <MdOutlineEventNote size={36} />,
    link: "/MyCart",
  },
  {
    label: "SUBSCRIPTIONS",
    icon: <MdOutlineCardMembership size={36} />,
    link: "/Subscriptions",
  },
  {
    label: "CHIT FUND",
    icon: <MdOutlineSavings size={36} />,
    link: "/ChitFund",
  },
];

export default function Welcome() {
  const navigate = useNavigate();
  const storedUser = JSON.parse(localStorage.getItem("user"));

  /* ====================== STATES ====================== */

  const [ctxMenu, setCtxMenu] = useState(null); // { x, y, tile }

  useEffect(() => {
    const close = () => setCtxMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close);
    return () => { window.removeEventListener("click", close); window.removeEventListener("scroll", close); };
  }, []);

  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState([
    { sender: "bot", text: "Hello 👋 How can I help you today?" },
  ]);
  const [input, setInput] = useState("");

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(null);

  const selectedPracticeCity =
    storedUser?.practiceName || "Hervy Bay Dental Clinic";

  /* ====================== CHAT FUNCTION ====================== */
  const chatEndRef = useRef(null);

  const [chatStep, setChatStep] = useState(null);

  const [patientData, setPatientData] = useState({
    name: "",
    phone: "",
    email: "",
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  const [typing, setTyping] = useState(false);

  const sendMessage = () => {
    if (!input.trim()) return;

    const userMessage = { sender: "user", text: input };
    setMessages((prev) => [...prev, userMessage]);

    const userText = input.toLowerCase();

    setInput("");
    setTyping(true);

    setTimeout(() => {
      let reply = "I'm here to help 😊";

      /* ================= PATIENT CHAT FLOW ================= */

      if (chatStep === "askName") {
        setPatientData((prev) => ({ ...prev, name: input }));
        reply = "Please enter patient's phone number";
        setChatStep("askPhone");
      } else if (chatStep === "askPhone") {
        setPatientData((prev) => ({ ...prev, phone: input }));
        reply = "Please enter patient's email";
        setChatStep("askEmail");
      } else if (chatStep === "askEmail") {
        const finalData = { ...patientData, email: input };

        setPatientData(finalData);

        reply = "Patient added successfully. Opening patient portal...";

        setTimeout(() => {
          navigate("/PatientPortal", { state: finalData });
        }, 1200);

        setChatStep(null);
      } else if (userText.includes("add patient")) {
        /* ================= COMMANDS ================= */
        reply = "Sure 👍 Please enter patient's name";
        setChatStep("askName");
      } else if (
        userText.includes("appointment") ||
        userText.includes("book")
      ) {
        reply = "Opening appointment booking...";
        navigate("/MyCart");
      } else if (userText.includes("doctor")) {
        reply = "Opening doctor portal...";
        navigate("/DoctorList");
      } else if (userText.includes("support")) {
        reply = "Opening support page...";
        navigate("/CustomerCare");
      } else {
        reply =
          "You can ask me:\n• Add Patient\n• Book Appointment\n• Find Doctor\n• Support";
      }

      setMessages((prev) => [...prev, { sender: "bot", text: reply }]);
      setTyping(false);
    }, 800);
  };
  /* ====================== USER NAME ====================== */

  const emailToName = (email) => {
    if (!email) return "User";
    const namePart = email.split("@")[0];

    return namePart
      .split(/[._-]/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  };

  const userName = (() => {
    if (!storedUser) return "User";
    const full = `${storedUser.firstName || ""} ${storedUser.lastName || ""}`.trim();
    if (full) return full;
    if (storedUser.name && !storedUser.name.includes("@")) return storedUser.name;
    if (storedUser.email || (storedUser.name && storedUser.name.includes("@")))
      return emailToName(storedUser.email || storedUser.name);
    if (storedUser.mobile) return storedUser.mobile;
    return "User";
  })();

  const user = {
    name: userName.split(" ")[0].toUpperCase(), // first name in uppercase
    initials: userName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase(), // initials in uppercase
  };

  const toggleDialog = () => setOpen(!open);
  const handleSubmit = () => navigate("/Logout");

  return (
    <div className="p-6 md:p-10 min-h-screen relative overflow-hidden">
      <div
        className="fixed inset-0"
        style={{
          backgroundImage: `url(${clinicBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          zIndex: 0,
        }}
      />
      <div
        className="fixed inset-0"
        style={{ background: "linear-gradient(160deg, rgba(255,247,237,0.94) 0%, rgba(254,215,170,0.88) 45%, rgba(255,251,235,0.94) 100%)", zIndex: 0 }}
      />
      <div className="flex flex-col min-h-screen" style={{ position: "relative", zIndex: 1 }}>
      {/* LOGO */}
      <img src={logo} alt="logo" className="w-40 mb-4" />
 
      {/* ================= PROFILE ================= */}
      <div className="absolute top-4 right-4">
        <button
          onClick={() => setShowProfileMenu(!showProfileMenu)}
          className="flex items-center gap-2 bg-orange-50 px-4 py-2 rounded-full"
        >
          <div className="w-10 h-10 rounded-full bg-orange-700 text-white flex items-center justify-center">
            {user.initials}
          </div>

          {user.name}

          <MdExpandMore
            className={`${showProfileMenu ? "rotate-180" : ""}`}
          />
        </button>

        {showProfileMenu && (
          <div className="absolute right-0 mt-2 bg-white shadow rounded-xl w-48">
            <button
              onClick={() => navigate("/NewRegistration")}
              className="flex items-center gap-2 w-full px-4 py-3 hover:bg-orange-50"
            >
              <MdOutlineEditNote /> Edit Profile
            </button>

            <button
              onClick={() => navigate("/Settings")}
              className="flex items-center gap-2 w-full px-4 py-3 hover:bg-orange-50"
            >
              <MdOutlineSettings /> Settings
            </button>

            <button
              onClick={() => navigate("/Logout")}
              className="flex items-center gap-2 w-full px-4 py-3 text-red-600 hover:bg-red-50"
            >
              <MdOutlinePowerSettingsNew /> Logout
            </button>
          </div>
        )}
      </div>
      {/* ================= HEADER ================= */}
      <div className="text-center mb-10">
        <Typography variant="h3" className="font-bold" style={{ color: "#ea580c" }}>
          Welcome to {selectedPracticeCity} - {user.name}
        </Typography>

        <Typography className="text-orange-600 text-sm mt-2">
          Access your provisioned services below.
        </Typography>
      </div>
      <hr className="mb-6" />
      {/* ================= SERVICE GRID ================= */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
        {services.map((tile, i) => (
          <Button
            key={i}
            onClick={() => navigate(tile.link)}
            onContextMenu={(e) => {
              e.preventDefault();
              setCtxMenu({ x: e.clientX, y: e.clientY, tile });
            }}
            className="flex flex-col items-center justify-center py-6 min-h-[110px] bg-white/90 backdrop-blur-md text-black border-2 border-orange-500 shadow-lg hover:scale-105 transition duration-300"
          >
            <span className="text-orange-500">{tile.icon}</span>
            <span className="pt-2 font-bold text-xs text-center">
              {tile.label}
            </span>
          </Button>
        ))}
      </div>

      {/* ================= RIGHT-CLICK CONTEXT MENU ================= */}
      {ctxMenu && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: "fixed",
            top: Math.min(ctxMenu.y, window.innerHeight - 180),
            left: Math.min(ctxMenu.x, window.innerWidth - 210),
            zIndex: 9999,
            minWidth: 200,
            background: "white",
            borderRadius: 12,
            boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
            border: "1px solid #e5e7eb",
            overflow: "hidden",
            fontFamily: "'Outfit', sans-serif",
          }}
        >
          {/* Header */}
          <div style={{ padding: "8px 14px 6px", borderBottom: "1px solid #f3f4f6", background: "#f9fafb" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
              {ctxMenu.tile.label}
            </p>
          </div>

          {/* Open */}
          <button
            onClick={() => { navigate(ctxMenu.tile.link); setCtxMenu(null); }}
            style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"9px 14px", background:"none", border:"none", cursor:"pointer", fontSize:13, fontWeight:600, color:"#374151", textAlign:"left" }}
            onMouseEnter={e => e.currentTarget.style.background="#f0f9ff"}
            onMouseLeave={e => e.currentTarget.style.background="none"}
          >
            <span style={{ width:18, textAlign:"center" }}>↗</span> Open
          </button>

          {/* Open in New Tab — uses <a> so browser never blocks it */}
          <a
            href={ctxMenu.tile.link}
            target="_blank"
            rel="noreferrer"
            onClick={() => setCtxMenu(null)}
            style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"9px 14px", background:"none", border:"none", cursor:"pointer", fontSize:13, fontWeight:600, color:"#374151", textDecoration:"none" }}
            onMouseEnter={e => e.currentTarget.style.background="#f0f9ff"}
            onMouseLeave={e => e.currentTarget.style.background="none"}
          >
            <span style={{ width:18, textAlign:"center" }}>🪟</span> Open in New Tab
          </a>

          {/* Copy Link */}
          <button
            onClick={() => { navigator.clipboard.writeText(window.location.origin + ctxMenu.tile.link); setCtxMenu(null); }}
            style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"9px 14px", background:"none", border:"none", cursor:"pointer", fontSize:13, fontWeight:600, color:"#374151", textAlign:"left" }}
            onMouseEnter={e => e.currentTarget.style.background="#f0f9ff"}
            onMouseLeave={e => e.currentTarget.style.background="none"}
          >
            <span style={{ width:18, textAlign:"center" }}>📋</span> Copy Link
          </button>
        </div>
      )}

      {/* ================= CHAT BUTTON ================= */}
      <div className="fixed bottom-4 right-4 flex items-center gap-3">
        <span className="bg-white text-red-500 px-3 py-2 rounded-lg shadow font-semibold text-sm border border-red-500">
          Chat with Mitra
        </span>

        <button
          onClick={() => setChatOpen(!chatOpen)}
          className="relative bg-gradient-to-r from-orange-600 to-orange-900 text-white p-4 rounded-full shadow-lg hover:scale-110 transition duration-300"
        >
          <MdSmartToy size={32} />
        </button>
      </div>
      {/* ================= CHAT WINDOW ================= */}
      {chatOpen && (
        <div className="fixed bottom-20 right-4 w-80 bg-white shadow-xl rounded-xl flex flex-col overflow-hidden border border-gray-200">
          {/* Header */}
          <div className="bg-orange-600 text-white p-3 font-semibold flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span>Chat with Mitra</span>
              <MdOutlineChatBubble size={30} />
            </div>

            <button
              type="button"
              onClick={() => setChatOpen(false)}
              className="text-white text-lg"
            >
              ✕
            </button>
          </div>
          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto max-h-80 space-y-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${
                  msg.sender === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`px-3 py-2 rounded-xl text-sm max-w-[75%] ${
                    msg.sender === "user"
                      ? "bg-orange-600 text-white"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {typing && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-500 px-3 py-2 rounded-xl text-sm">
                  Mitra is typing...
                </div>
              </div>
            )}

            <div ref={chatEndRef}></div>
          </div>

          <div className="p-2 flex flex-wrap gap-2 border-t bg-gray-50">
            <button
              onClick={() => navigate("/MyCart")}
              className="text-xs bg-white border px-2 py-1 rounded hover:bg-gray-100"
            >
              📅 Book Appointment
            </button>

            <button
              onClick={() => navigate("/DoctorList")}
              className="text-xs bg-white border px-2 py-1 rounded hover:bg-gray-100"
            >
              👨‍⚕️ Find Doctor
            </button>

            <button
              onClick={() => {
                setMessages((prev) => [
                  ...prev,
                  { sender: "bot", text: "Please enter patient's name" },
                ]);
                setChatStep("askName");
              }}
              className="text-xs bg-white border px-2 py-1 rounded hover:bg-gray-100"
            >
              👤 Add Patient
            </button>

            <button
              onClick={() => navigate("/CustomerCare")}
              className="text-xs bg-white border px-2 py-1 rounded hover:bg-gray-100"
            >
              📞 Support
            </button>
          </div>

          {/* Input Area */}
          <div className="flex border-t border-gray-200">
            <input
              type="text"
              placeholder="Type a message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && input.trim()) {
                  sendMessage();
                }
              }}
              className="flex-1 px-3 py-2 text-sm outline-none"
            />

            <button
              type="button"
              onClick={sendMessage}
              className="bg-orange-600 text-white px-4 hover:bg-orange-700 transition"
            >
              Send
            </button>
          </div>
        </div>
      )}

      {/* ================= FOOTER ================= */}
      <footer className="mt-auto mb-16 pt-6 border-t border-orange-200 text-center text-lg text-gray-600">
        <a
          href="/HomePage"
          onClick={(e) => { e.preventDefault(); navigate("/HomePage"); }}
          className="text-orange-600 font-semibold text-xl hover:underline"
        >
          www.toothx.com
        </a>
        <p className="mt-2 text-sm text-gray-500">
          © {new Date().getFullYear()} ToothX. All rights reserved.
        </p>
      </footer>
      </div>
    </div>
  );
}
