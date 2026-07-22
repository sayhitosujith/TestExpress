import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MdSmartToy } from "react-icons/md";

export default function MitraChat({ quickActions = [], initialGreeting, openTrigger }) {
  const navigate = useNavigate();
  const [open, setOpen]       = useState(false);

  useEffect(() => { if (openTrigger) setOpen(true); }, [openTrigger]);
  const [messages, setMessages] = useState([
    { sender: "bot", text: initialGreeting || "Hello 👋 How can I help you today?" },
  ]);
  const [input, setInput]       = useState("");
  const [chatStep, setChatStep] = useState(null);
  const [patientData, setPatientData] = useState({ name: "", phone: "", email: "" });
  const [typing, setTyping]     = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const botReply = (text) => {
    setMessages((prev) => [...prev, { sender: "bot", text }]);
    setTyping(false);
  };

  const sendMessage = (override) => {
    const msg = override || input;
    if (!msg.trim()) return;
    if (!override) setInput("");

    setMessages((prev) => [...prev, { sender: "user", text: msg }]);
    const lower = msg.toLowerCase();
    setTyping(true);

    setTimeout(() => {
      // ── Multi-step add-patient flow ──
      if (chatStep === "askName") {
        setPatientData((p) => ({ ...p, name: msg }));
        setChatStep("askPhone");
        return botReply("Got it! Enter the patient's phone number.");
      }
      if (chatStep === "askPhone") {
        setPatientData((p) => ({ ...p, phone: msg }));
        setChatStep("askEmail");
        return botReply("Great! Now enter the patient's email address.");
      }
      if (chatStep === "askEmail") {
        const data = { ...patientData, email: msg };
        setPatientData(data);
        setChatStep(null);
        botReply("Patient added! Opening patient portal...");
        setTimeout(() => navigate("/PatientPortal", { state: data }), 1200);
        return;
      }

      // ── Match quickActions by command keyword ──
      const action = quickActions.find(
        (a) => a.command && lower.includes(a.command.toLowerCase())
      );
      if (action) {
        if (action.chatFlow) return action.chatFlow({ botReply, setChatStep });
        if (action.onClick) {
          action.onClick();
          return botReply(action.reply || `Opening ${action.label}...`);
        }
      }

      // ── Help fallback ──
      if (lower.includes("help") || lower === "?") {
        const list = quickActions.map((a) => `${a.icon} ${a.label}`).join("\n");
        return botReply(`Here's what I can do:\n${list}\n\nJust type or tap a button!`);
      }

      botReply("I'm not sure about that 🤔 Type 'help' to see what I can do!");
    }, 800);
  };

  const triggerAction = (action) => {
    setMessages((prev) => [...prev, { sender: "user", text: action.label }]);
    setTyping(true);
    setTimeout(() => {
      if (action.chatFlow) {
        action.chatFlow({ botReply, setChatStep });
      } else {
        if (action.onClick) action.onClick();
        botReply(action.reply || `Done! ✅`);
      }
    }, 600);
  };

  return (
    <>
      {/* Floating trigger */}
      <div className="fixed bottom-4 right-4 flex items-center gap-3 z-40">
        <span className="bg-white text-orange-600 px-3 py-1.5 rounded-lg shadow text-sm font-semibold border border-orange-300">
          Chat with Mitra
        </span>
        <button
          onClick={() => setOpen((v) => !v)}
          className="bg-gradient-to-br from-orange-600 to-orange-800 text-white p-3.5 rounded-full shadow-lg hover:scale-110 transition-transform"
        >
          <MdSmartToy size={26} />
        </button>
      </div>

      {/* Chat window */}
      {open && (
        <div className="fixed bottom-20 right-4 w-80 bg-white shadow-2xl rounded-2xl flex flex-col overflow-hidden border border-gray-200 z-50">
          {/* Header */}
          <div className="bg-orange-600 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <MdSmartToy size={18} className="text-white" />
              </div>
              <div>
                <p className="text-white text-sm font-bold leading-tight">Mitra</p>
                <p className="text-orange-200 text-xs">AI Receptionist Assistant</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-white/70 hover:text-white text-xl leading-none transition-colors"
            >✕</button>
          </div>

          {/* Messages */}
          <div className="flex-1 p-3 overflow-y-auto max-h-72 space-y-2 bg-gray-50">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`px-3 py-2 rounded-2xl text-sm max-w-[80%] whitespace-pre-line shadow-sm ${
                  msg.sender === "user"
                    ? "bg-orange-600 text-white rounded-br-sm"
                    : "bg-white text-gray-800 border border-gray-100 rounded-bl-sm"
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {typing && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-100 px-3 py-2 rounded-2xl rounded-bl-sm text-sm text-gray-400 shadow-sm italic">
                  Mitra is typing...
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Quick actions */}
          {quickActions.length > 0 && (
            <div className="p-2 flex flex-wrap gap-1.5 border-t border-gray-100 bg-white">
              {quickActions.map((action, i) => (
                <button
                  key={i}
                  onClick={() => triggerAction(action)}
                  className="text-xs bg-gray-50 border border-gray-200 px-2.5 py-1.5 rounded-lg hover:bg-orange-50 hover:border-orange-300 hover:text-orange-700 transition-colors font-medium"
                >
                  {action.icon} {action.label}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="flex border-t border-gray-200 bg-white">
            <input
              type="text"
              placeholder="Type a message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
              className="flex-1 px-3 py-2.5 text-sm outline-none bg-transparent"
            />
            <button
              onClick={() => sendMessage()}
              className="bg-orange-600 hover:bg-orange-700 text-white px-4 text-sm font-semibold transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}
