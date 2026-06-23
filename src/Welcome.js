import "./App.css";
import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Typography, Breadcrumbs, Button } from "@material-tailwind/react";

import {
  MdOutlineEditNote,
  MdOutlineSettings,
  MdOutlinePowerSettingsNew,
} from "react-icons/md";
import { VscChevronDown } from "react-icons/vsc";
import { RiAdminFill } from "react-icons/ri";
import { CiUser } from "react-icons/ci";
import { TbBrandGoogleAnalytics, TbDental } from "react-icons/tb";
import { FaUsers, FaFileInvoiceDollar } from "react-icons/fa6";
import { IoSettingsOutline } from "react-icons/io5";
import { RiRobot3Line } from "react-icons/ri";
import logo from "./assets/Toothx_Logo-removebg-preview.png";
import { IoChatbubbleEllipsesOutline } from "react-icons/io5";

/* ====================== BANNER TIMING ====================== */
const now = new Date();
const startDate = new Date("2025-04-05T08:00:00");
const endDate = new Date("2026-04-08T23:59:59");
const isBannerActive = now >= startDate && now <= endDate;

/* ====================== SERVICES ====================== */
const services = [
  {
    label: "SUPER ADMIN",
    icon: <IoSettingsOutline size={35} />,
    link: "/SuperAdmin",
  },
  {
    label: "DENTIST PORTAL",
    icon: <RiAdminFill size={35} />,
    link: "/DoctorList",
  },
  {
    label: "PATIENTS ONBOARDING",
    icon: <CiUser size={35} />,
    link: "/PatientPortal",
  },
  {
    label: "CUSTOMER PORTAL",
    icon: <CiUser size={35} />,
    link: "/Customer_Login",
  },
  {
    label: "ANALYTICS",
    icon: <TbBrandGoogleAnalytics size={35} />,
    link: "/Admin_Analytics",
  },
  {
    label: "CUSTOMER SUPPORT",
    icon: <FaUsers size={35} />,
    link: "/CustomerCare",
  },
  {
    label: "PATIENT PROFILES",
    icon: <FaFileInvoiceDollar size={35} />,
    link: "/Profile",
  },
  {
    label: "SETTINGS",
    icon: <IoSettingsOutline size={35} />,
    link: "/Settings",
  },
  {
    label: "APPOINTMENT HISTORY",
    icon: <IoSettingsOutline size={35} />,
    link: "/AppointmentHistory",
  },
  {
    label: "BOOK APPOINTMENT",
    icon: <IoSettingsOutline size={35} />,
    link: "/MyCart",
  },
  {
    label: "SUBSCRIPTIONS",
    icon: <RiAdminFill size={35} />,
    link: "/Subscriptions",
  },
];

export default function Welcome() {
  const navigate = useNavigate();
  const storedUser = JSON.parse(localStorage.getItem("user"));

  /* ====================== STATES ====================== */

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
  const [typing, setTyping] = useState(true);

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

  const userName =
    storedUser?.name && !storedUser.name.includes("@")
      ? storedUser.name
      : emailToName(storedUser?.email || storedUser?.name);

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
    <div className="p-6 md:p-10 min-h-screen relative bg-gradient-to-r from-yellow-600 via-orange-700 to-orange-700">
      {" "}
      {/* LOGO */}
      <img src={logo} alt="logo" className="absolute top-4 left-4 w-40" />
      {/* ================= BREADCRUMBS ================= */}
      <Breadcrumbs className="mt-20 mb-6">
        <button
          onClick={() => navigate("/HomePage")}
          className="text-orange-600"
        >
          Home
        </button>
        <span>Welcome</span>
      </Breadcrumbs>
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

          <VscChevronDown
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
        <Typography variant="h3" className="text-white font-bold">
          Welcome to {selectedPracticeCity} - {user.name}
        </Typography>

        <Typography className="text-orange-100 text-sm mt-2">
          Access your provisioned services below.
        </Typography>
      </div>
      <hr className="mb-6" />
      {/* ================= SERVICE GRID ================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6">
        {services.map((tile, i) => (
          <Button
            key={i}
            onClick={() => navigate(tile.link)}
            className="flex flex-col items-center py-6 bg-white/90 backdrop-blur-md text-black border border-white/20 shadow-lg hover:scale-105 transition duration-300"
          >
            {tile.icon}
            <span className="pt-2 font-bold text-sm text-center">
              {tile.label}
            </span>
          </Button>
        ))}
      </div>
      {/* ================= CHAT BUTTON ================= */}
      <div className="fixed bottom-4 right-4 flex items-center gap-3">
        <span className="bg-white text-red-500 px-3 py-2 rounded-lg shadow font-semibold text-sm border border-red-500">
          Chat with Mitra
        </span>

        <button
          onClick={() => setChatOpen(!chatOpen)}
          className="relative bg-gradient-to-r from-orange-600 to-orange-900 text-white p-4 rounded-full shadow-lg hover:scale-110 transition duration-300"
        >
          <RiRobot3Line size={32} />

          <span className="absolute -top-1 -right-1 bg-yellow-400 text-black text-xs px-1 rounded-full">
            18
          </span>
        </button>
      </div>
      {/* ================= CHAT WINDOW ================= */}
      {chatOpen && (
        <div className="fixed bottom-20 right-4 w-80 bg-white shadow-xl rounded-xl flex flex-col overflow-hidden border border-gray-200">
          {/* Header */}
          <div className="bg-red-500 text-white p-3 font-semibold flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span>ToothX Support</span>
              <IoChatbubbleEllipsesOutline size={30} />
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
                      ? "bg-red-500 text-white"
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
              className="bg-red-500 text-white px-4 hover:bg-red-600 transition"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
