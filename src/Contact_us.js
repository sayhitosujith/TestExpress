import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { MdOutlinePowerSettingsNew } from "react-icons/md";
import AppLogo from "./AppLogo";
import packageJson from "../package.json";
import MitraChat from "./MitraChat";

/* ── Nav ── */
const NAV_ITEMS = [
  { label: "Dashboard",    icon: "🏠", path: "/Welcome" },
  { label: "Doctors",      icon: "👨‍⚕️", path: "/DoctorList" },
  { label: "Receptionist", icon: "📋", path: "/Receptionist" },
  { label: "Patients",     icon: "👤", path: "/PatientPortal" },
  { label: "Appointments", icon: "📅", path: "/BookAppointment" },
  { label: "Billing",      icon: "💳", path: "/BillingDetails" },
  { label: "Settings",     icon: "⚙️", path: "/Settings" },
  { label: "Contact Center", icon: "📞", path: "/Contact_us" },
];

/* ── Static data ── */
const FAQ_DATA = [
  { q: "How do I book an appointment?", a: "Go to the Receptionist page, pick a date on the calendar, choose a doctor and time slot, then fill in patient details." },
  { q: "How do I cancel an appointment?", a: "Click on the appointment date in the calendar to open the day modal. Find your appointment and click Cancel." },
  { q: "Can I reschedule an appointment?", a: "Yes — cancel the existing one, then click Reschedule on the cancelled card to pre-fill patient info and pick a new slot." },
  { q: "What are the clinic working hours?", a: "Monday – Saturday · 9:00 AM – 6:00 PM. Emergency services are available 24 / 7." },
  { q: "How do I view billing details?", a: "Navigate to the Billing section from the sidebar to view all invoices and payment history." },
  { q: "How do I add a new patient?", a: "On any page, open the Mitra chat and say 'Add Patient' — it will walk you through name, phone, and email." },
  { q: "What payment methods do you accept?", a: "Cash, Visa / Mastercard, and online UPI payments are all accepted." },
  { q: "How do I contact my doctor directly?", a: "Visit the Doctors section to find your doctor's profile, availability, and contact details." },
  { q: "Will I receive appointment reminders?", a: "Yes — WhatsApp confirmations are sent automatically when appointments are booked or cancelled." },
  { q: "How do I update my profile?", a: "Go to Settings from the sidebar and update your personal details there." },
];

const CATEGORIES  = ["General Inquiry", "Appointment Support", "Billing Issue", "Technical Problem", "Complaint", "Feedback"];
const PRIORITIES  = ["Low", "Medium", "High", "Urgent"];
const TABS        = ["Dashboard", "New Ticket", "My Tickets", "FAQ", "Contact Channels", "Callback", "Executives", "📞 Calls"];

const FAKE_CALLERS = [
  { name: "Amit Joshi",   number: "+91 98200 11234" },
  { name: "Sneha Reddy",  number: "+91 91234 56789" },
  { name: "Vikram Nair",  number: "+91 80000 33210" },
  { name: "Pooja Menon",  number: "+91 70123 45678" },
  { name: "Ravi Gupta",   number: "+91 99887 76655" },
  { name: "Unknown",      number: "+91 88888 00000" },
];

const DEFAULT_EXECUTIVES = [
  { id: "E1", name: "Priya Sharma",  email: "priya@dutydentist.com",  status: "Available", ticketCount: 0, role: "Senior Agent", accessKey: "PRIYA@2024"  },
  { id: "E2", name: "Rahul Mehta",   email: "rahul@dutydentist.com",  status: "Available", ticketCount: 0, role: "Agent",        accessKey: "RAHUL@2024"  },
  { id: "E3", name: "Anita Verma",   email: "anita@dutydentist.com",  status: "Busy",      ticketCount: 0, role: "Team Lead",    accessKey: "ANITA@2024"  },
  { id: "E4", name: "Karan Patel",   email: "karan@dutydentist.com",  status: "Available", ticketCount: 0, role: "Agent",        accessKey: "KARAN@2024"  },
];

/* Shared utility — also used by CustomerCare.js via localStorage */
function autoAssign() {
  const execs = JSON.parse(localStorage.getItem("supportExecutives") || "null") || DEFAULT_EXECUTIVES;
  const available = execs.filter(e => e.status === "Available");
  if (!available.length) return { assignedTo: "Unassigned", assignedId: null };
  const picked = available.reduce((min, e) => e.ticketCount < min.ticketCount ? e : min, available[0]);
  const updated = execs.map(e => e.id === picked.id ? { ...e, ticketCount: e.ticketCount + 1 } : e);
  localStorage.setItem("supportExecutives", JSON.stringify(updated));
  return { assignedTo: picked.name, assignedId: picked.id };
}

const STATUS_STYLE = {
  "Open":        "bg-blue-50 text-blue-700 border-blue-200",
  "In Progress": "bg-amber-50 text-amber-700 border-amber-200",
  "Resolved":    "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Closed":      "bg-gray-100 text-gray-500 border-gray-200",
};
const PRIORITY_STYLE = {
  Low: "bg-gray-100 text-gray-600", Medium: "bg-blue-50 text-blue-600",
  High: "bg-amber-50 text-amber-700", Urgent: "bg-red-50 text-red-600",
};

function getInitials(name = "") {
  return name.split(" ").filter(Boolean).map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

export default function Contact_us() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("Dashboard");
  const [tickets, setTickets]     = useState(() => {
    try { return JSON.parse(localStorage.getItem("supportTickets") || "[]"); } catch { return []; }
  });
  const [faqSearch, setFaqSearch] = useState("");
  const [openFaq, setOpenFaq]     = useState(null);
  const [callbackForm, setCallbackForm] = useState({ name: "", phone: "", date: "", time: "", reason: "" });
  const [callbackMsg, setCallbackMsg]   = useState("");
  const [callbacks, setCallbacks] = useState(() => {
    try { return JSON.parse(localStorage.getItem("callbackRequests") || "[]"); } catch { return []; }
  });

  const [ticketForm, setTicketForm] = useState({
    name: "", email: "", phone: "", subject: "", category: CATEGORIES[0],
    priority: "Medium", message: "",
  });
  const [ticketErrors, setTicketErrors] = useState({});
  const [ticketSuccess, setTicketSuccess] = useState("");
  const [ticketFilter, setTicketFilter]   = useState("All");

  const [mitraOpen, setMitraOpen] = useState(false);
  const [incomingAlert, setIncomingAlert] = useState(null);
  const [executives, setExecutives] = useState(() => {
    try { return JSON.parse(localStorage.getItem("supportExecutives") || "null") || DEFAULT_EXECUTIVES; } catch { return DEFAULT_EXECUTIVES; }
  });

  /* Executives tab state */
  const [selectedExec,    setSelectedExec]    = useState(null);
  const [showAddExec,     setShowAddExec]      = useState(false);
  const [addExecForm,     setAddExecForm]      = useState({ name: "", email: "", phone: "", role: "Agent", accessKey: "" });
  const [addExecErrors,   setAddExecErrors]    = useState({});
  const [execView,        setExecView]         = useState("cards"); // "cards" | "table" | "workload"
  const [terminatedExecs, setTerminatedExecs]  = useState(() => {
    try { return JSON.parse(localStorage.getItem("terminatedExecs") || "[]"); } catch { return []; }
  });
  const [terminateModal,  setTerminateModal]   = useState(null); // exec object to terminate
  const [terminateReason, setTerminateReason]  = useState("");

  const [execSession, setExecSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem("execSession") || "null"); } catch { return null; }
  });
  const [showExecLogin,  setShowExecLogin]  = useState(false);
  const [execLoginKey,   setExecLoginKey]   = useState("");
  const [execLoginError, setExecLoginError] = useState("");
  const [revealedKeys,   setRevealedKeys]   = useState({});
  const [onlineSessions, setOnlineSessions] = useState(() => {
    try { return JSON.parse(localStorage.getItem("execOnlineSessions") || "{}"); } catch { return {}; }
  });

  const [mandatoryHours, setMandatoryHours] = useState(() => {
    try { return JSON.parse(localStorage.getItem("mandatoryHours") || "{}"); } catch { return {}; }
  });
  const [hoursLogged, setHoursLogged] = useState(() => {
    try { return JSON.parse(localStorage.getItem("hoursLogged") || "{}"); } catch { return {}; }
  });
  const [editingHours, setEditingHours] = useState(null); // exec id being edited
  const [hoursInput,   setHoursInput]   = useState("");

  const [customerSession, setCustomerSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem("customerSession") || "null"); } catch { return null; }
  });

  const customerLogout = () => {
    localStorage.removeItem("customerSession");
    setCustomerSession(null);
  };

  const customerTickets = useMemo(() =>
    customerSession
      ? tickets.filter(t => t.phone === customerSession.mobile || t.email === customerSession.mobile)
      : [],
    [tickets, customerSession]
  );

  const [user] = useState(() => {
    try {
      const u = JSON.parse(localStorage.getItem("loggedInUser"));
      if (u) {
        const name = u.name || `${u.firstName || ""} ${u.lastName || ""}`.trim();
        return { name: name || "User", initials: getInitials(name || "User") };
      }
    } catch {}
    return { name: "User", initials: "U" };
  });

  /* auto-assign unassigned tickets when an executive becomes Available */
  const prevExecStatusRef = React.useRef({});
  useEffect(() => {
    const becameAvailable = executives.some(
      e => e.status === "Available" && prevExecStatusRef.current[e.id] !== "Available"
    );
    executives.forEach(e => { prevExecStatusRef.current[e.id] = e.status; });
    if (becameAvailable) autoAssignUnassigned(tickets, executives);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [executives]);

  /* persist tickets */
  useEffect(() => { localStorage.setItem("supportTickets", JSON.stringify(tickets)); }, [tickets]);
  useEffect(() => { localStorage.setItem("callbackRequests", JSON.stringify(callbacks)); }, [callbacks]);

  /* migrate: ensure every executive has an accessKey */
  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("supportExecutives") || "null");
    if (!stored) return;
    let changed = false;
    const migrated = stored.map(exec => {
      if (!exec.accessKey) {
        changed = true;
        const firstName = exec.name.split(" ")[0].toUpperCase();
        let key = `${firstName}@2024`;
        let suffix = 1;
        let duplicate = stored.some(e => e.id !== exec.id && e.accessKey === key);
        while (duplicate) {
          key = `${firstName}@${2024 + suffix}`;
          suffix++;
          const candidate = key;
          duplicate = stored.some(e => e.id !== exec.id && e.accessKey === candidate);
        }
        return { ...exec, accessKey: key };
      }
      return exec;
    });
    if (changed) {
      localStorage.setItem("supportExecutives", JSON.stringify(migrated));
      setExecutives(migrated);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* listen for updates from other tabs (CustomerCare + Executive_Portal) */
  useEffect(() => {
    const onStorage = (e) => {
      try {
        if (e.key === "supportTickets") {
          const updated = JSON.parse(e.newValue || "[]");
          const prev    = JSON.parse(e.oldValue  || "[]");
          if (updated.length > prev.length) {
            const newest = updated[0];
            setTickets(updated);
            setIncomingAlert(`📩 New message from ${newest.name} (${newest.email}): "${newest.subject}"`);
          }
        }
        if (e.key === "hoursLogged") {
          setHoursLogged(JSON.parse(e.newValue || "{}"));
        }
        if (e.key === "execOnlineSessions") {
          setOnlineSessions(JSON.parse(e.newValue || "{}"));
        }

      } catch {}
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  /* poll execOnlineSessions every 30 s — keeps count accurate in same tab */
  useEffect(() => {
    const id = setInterval(() => {
      try {
        setOnlineSessions(JSON.parse(localStorage.getItem("execOnlineSessions") || "{}"));
      } catch {}
    }, 30000);
    return () => clearInterval(id);
  }, []);

  const filteredFaq = useMemo(() =>
    FAQ_DATA.filter(f => f.q.toLowerCase().includes(faqSearch.toLowerCase()) || f.a.toLowerCase().includes(faqSearch.toLowerCase())),
    [faqSearch]
  );

  const filteredTickets = useMemo(() =>
    ticketFilter === "All" ? tickets : tickets.filter(t => t.status === ticketFilter),
    [tickets, ticketFilter]
  );

  /* derive ticket counts from actual tickets — always accurate */
  const executivesWithCounts = useMemo(() =>
    executives.map(exec => ({
      ...exec,
      ticketCount: tickets.filter(t => t.assignedId === exec.id).length,
    })),
    [executives, tickets]
  );

  const stats = useMemo(() => ({
    total:      tickets.length,
    open:       tickets.filter(t => t.status === "Open").length,
    inProgress: tickets.filter(t => t.status === "In Progress").length,
    resolved:   tickets.filter(t => t.status === "Resolved" || t.status === "Closed").length,
    callbacks:  callbacks.length,
  }), [tickets, callbacks]);

  /* ── Submit ticket ── */
  const submitTicket = () => {
    const e = {};
    if (!ticketForm.name.trim())    e.name    = "Required";
    if (!ticketForm.email.trim())   e.email   = "Required";
    if (!/\S+@\S+\.\S+/.test(ticketForm.email)) e.email = "Invalid email";
    if (!ticketForm.subject.trim()) e.subject = "Required";
    if (!ticketForm.message.trim()) e.message = "Required";
    if (Object.keys(e).length) { setTicketErrors(e); return; }
    setTicketErrors({});

    const { assignedTo, assignedId } = autoAssign();
    setExecutives(JSON.parse(localStorage.getItem("supportExecutives") || "null") || DEFAULT_EXECUTIVES);

    const newTicket = {
      id:       `TKT-${Date.now()}`,
      ...ticketForm,
      assignedTo,
      assignedId,
      status:   "Open",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setTickets(prev => [newTicket, ...prev]);
    setTicketForm({ name: "", email: "", phone: "", subject: "", category: CATEGORIES[0], priority: "Medium", message: "" });
    window.alert(`✅ Ticket submitted!\n\nTicket ID: ${newTicket.id}\nAssigned to: ${assignedTo}\nWe'll respond to ${newTicket.email} within 24 hours.`);
    setTicketSuccess(`Ticket ${newTicket.id} submitted! We'll respond within 24 hours.`);
    setTimeout(() => { setTicketSuccess(""); setActiveTab("My Tickets"); }, 3000);
  };

  /* ── Submit callback ── */
  const submitCallback = () => {
    if (!callbackForm.name.trim() || !callbackForm.phone.trim()) return;
    const cb = { ...callbackForm, id: `CB-${Date.now()}`, status: "Scheduled", createdAt: new Date().toISOString() };
    setCallbacks(prev => [cb, ...prev]);
    setCallbackForm({ name: "", phone: "", date: "", time: "", reason: "" });
    setCallbackMsg("Callback scheduled! Our team will call you at the requested time.");
    setTimeout(() => setCallbackMsg(""), 5000);
  };

  /* ── Resolve ticket ── */
  const updateTicketStatus = (id, status) => {
    setTickets(prev => prev.map(t => t.id === id ? { ...t, status, updatedAt: new Date().toISOString() } : t));
  };

  /* ── Executives helpers ── */
  const saveExecs = (updated) => {
    setExecutives(updated);
    localStorage.setItem("supportExecutives", JSON.stringify(updated));
  };

  const addExecutive = () => {
    const e = {};
    if (!addExecForm.name.trim())  e.name  = "Required";
    if (!addExecForm.email.trim()) e.email = "Required";
    if (!/\S+@\S+\.\S+/.test(addExecForm.email)) e.email = "Invalid email";
    if (!addExecForm.accessKey.trim()) e.accessKey = "Required";
    else if (executives.some(ex => ex.accessKey === addExecForm.accessKey.trim())) e.accessKey = "Key already in use";
    if (Object.keys(e).length) { setAddExecErrors(e); return; }
    setAddExecErrors({});
    const newExec = {
      id: `E${Date.now()}`, ...addExecForm,
      accessKey: addExecForm.accessKey.trim(),
      status: "Available", ticketCount: 0,
    };
    saveExecs([...executives, newExec]);
    setAddExecForm({ name: "", email: "", phone: "", role: "Agent", accessKey: "" });
    setShowAddExec(false);
  };

  const removeExecutive = (id) => {
    if (!window.confirm("Remove this executive? Their tickets will become Unassigned.")) return;
    const updated = executives.filter(e => e.id !== id);
    saveExecs(updated);
    setTickets(prev => prev.map(t =>
      t.assignedId === id ? { ...t, assignedTo: "Unassigned", assignedId: null, updatedAt: new Date().toISOString() } : t
    ));
    if (selectedExec?.id === id) setSelectedExec(null);
  };

  const doReassign = (ticketId, execId) => {
    const exec = executives.find(e => e.id === execId);
    setTickets(prev => prev.map(t =>
      t.id === ticketId
        ? { ...t, assignedTo: exec ? exec.name : "Unassigned", assignedId: exec ? exec.id : null, updatedAt: new Date().toISOString() }
        : t
    ));
  };

  const autoAssignUnassigned = (currentTickets = tickets, currentExecs = executives) => {
    const unassigned = currentTickets.filter(t => !t.assignedId || t.assignedTo === "Unassigned");
    const available  = currentExecs.filter(e => e.status === "Available");
    if (!unassigned.length || !available.length) return;

    // live counts from actual tickets (not stored counter)
    const counts = {};
    available.forEach(e => {
      counts[e.id] = currentTickets.filter(t => t.assignedId === e.id && t.status !== "Resolved" && t.status !== "Closed").length;
    });

    const updated = currentTickets.map(t => {
      if (t.assignedId && t.assignedTo !== "Unassigned") return t;
      const picked = available.reduce((min, e) => counts[e.id] < counts[min.id] ? e : min, available[0]);
      counts[picked.id]++;
      return { ...t, assignedTo: picked.name, assignedId: picked.id, updatedAt: new Date().toISOString() };
    });

    setTickets(updated);
    localStorage.setItem("supportTickets", JSON.stringify(updated));
  };

  const doTerminate = () => {
    if (!terminateModal) return;
    const record = {
      ...terminateModal,
      terminatedAt: new Date().toISOString(),
      reason: terminateReason.trim() || "No reason provided",
      ticketsHeld: tickets.filter(t => t.assignedId === terminateModal.id).length,
    };
    const updated = [...terminatedExecs, record];
    setTerminatedExecs(updated);
    localStorage.setItem("terminatedExecs", JSON.stringify(updated));
    saveExecs(executives.filter(e => e.id !== terminateModal.id));
    setTickets(prev => prev.map(t =>
      t.assignedId === terminateModal.id
        ? { ...t, assignedTo: "Unassigned", assignedId: null, updatedAt: new Date().toISOString() }
        : t
    ));
    if (selectedExec?.id === terminateModal.id) setSelectedExec(null);
    setTerminateModal(null);
    setTerminateReason("");
  };

  /* ══════════════════════════════════════════
     CALLS STATE & LOGIC
  ══════════════════════════════════════════ */
  const [callLog,       setCallLog]       = React.useState(() => {
    try { return JSON.parse(localStorage.getItem("callLog") || "[]"); } catch { return []; }
  });
  const [inboundQueue,  setInboundQueue]  = React.useState([]);
  const [activeCall,    setActiveCall]    = React.useState(null);
  const [callTimer,     setCallTimer]     = React.useState(0);
  const [dialNumber,    setDialNumber]    = React.useState("");
  const [callNote,      setCallNote]      = React.useState("");
  const [callView,      setCallView]      = React.useState("live"); // "live" | "log" | "stats"
  const [callMuted,     setCallMuted]     = React.useState(false);
  const [callOnHold,    setCallOnHold]    = React.useState(false);
  const callTimerRef  = React.useRef(null);
  const inboundSimRef = React.useRef(null);

  React.useEffect(() => {
    localStorage.setItem("callLog", JSON.stringify(callLog));
  }, [callLog]);

  /* Simulate incoming calls every 40–80 s */
  React.useEffect(() => {
    const schedule = () => {
      const delay = 40000 + Math.floor(Math.random() * 40000);
      inboundSimRef.current = setTimeout(() => {
        const caller = FAKE_CALLERS[Math.floor(Math.random() * FAKE_CALLERS.length)];
        setInboundQueue(q => [...q, {
          id: `IC-${Date.now()}`,
          direction: "inbound",
          name: caller.name,
          number: caller.number,
          arrivedAt: new Date().toISOString(),
          waitSecs: 0,
        }]);
        schedule();
      }, delay);
    };
    schedule();
    return () => clearTimeout(inboundSimRef.current);
  }, []);

  /* Active call timer */
  React.useEffect(() => {
    if (activeCall) {
      callTimerRef.current = setInterval(() => setCallTimer(t => t + 1), 1000);
    } else {
      clearInterval(callTimerRef.current);
      setCallTimer(0);
    }
    return () => clearInterval(callTimerRef.current);
  }, [activeCall]);

  const fmtDuration = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const answerCall = (qCall) => {
    if (activeCall) return;
    setInboundQueue(q => q.filter(c => c.id !== qCall.id));
    setActiveCall({ ...qCall, answeredAt: new Date().toISOString() });
    setCallMuted(false);
    setCallOnHold(false);
    setCallNote("");
  };

  const rejectCall = (qCall) => {
    setInboundQueue(q => q.filter(c => c.id !== qCall.id));
    setCallLog(prev => [{
      id: qCall.id, direction: "inbound", name: qCall.name, number: qCall.number,
      outcome: "Missed", duration: 0, note: "",
      assignedTo: "—", startedAt: qCall.arrivedAt, endedAt: new Date().toISOString(),
    }, ...prev]);
  };

  const hangUp = (outcome = "Completed") => {
    if (!activeCall) return;
    const dur = callTimer;
    setCallLog(prev => [{
      id: activeCall.id, direction: activeCall.direction,
      name: activeCall.name, number: activeCall.number,
      outcome, duration: dur, note: callNote,
      assignedTo: executivesWithCounts.find(e => e.status === "Available")?.name || "—",
      startedAt: activeCall.answeredAt || activeCall.arrivedAt,
      endedAt: new Date().toISOString(),
    }, ...prev]);
    setActiveCall(null);
    setCallNote("");
    setCallMuted(false);
    setCallOnHold(false);
  };

  const dialOut = () => {
    if (!dialNumber.trim() || activeCall) return;
    const call = {
      id: `OC-${Date.now()}`, direction: "outbound",
      name: "Customer", number: dialNumber.trim(),
      answeredAt: new Date().toISOString(),
    };
    setActiveCall(call);
    setCallMuted(false);
    setCallOnHold(false);
    setCallNote("");
    setDialNumber("");
  };

  const callStats = React.useMemo(() => {
    const total     = callLog.length;
    const answered  = callLog.filter(c => c.outcome === "Completed").length;
    const missed    = callLog.filter(c => c.outcome === "Missed").length;
    const inbound   = callLog.filter(c => c.direction === "inbound").length;
    const outbound  = callLog.filter(c => c.direction === "outbound").length;
    const avgDur    = answered ? Math.round(callLog.filter(c => c.duration > 0).reduce((a, c) => a + c.duration, 0) / Math.max(answered, 1)) : 0;
    return { total, answered, missed, inbound, outbound, avgDur, answerRate: total ? Math.round((answered / total) * 100) : 0 };
  }, [callLog]);

  return (
    <div className="flex min-h-screen" style={{ background: "#F5F5F5" }}>

      {/* ── Sidebar ── */}
      <aside className="w-64 bg-white fixed left-0 top-0 h-full border-r border-gray-200 flex flex-col z-20 shadow-sm">
        <div className="px-5 pt-6 pb-4 border-b border-gray-100"><AppLogo /></div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map(item => {
            const active = item.path === "/Contact_us";
            return (
              <Link
                key={item.path} to={item.path}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-all duration-150 flex items-center gap-3 text-sm no-underline ${
                  active ? "bg-orange-600 text-white font-semibold shadow-sm" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 font-medium"
                }`}
              >
                <span className="text-base w-5 text-center">{item.icon}</span>{item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-3 py-3 border-t border-gray-100 space-y-1">
          <Link
            to="/Executive_Login"
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-indigo-600 hover:bg-indigo-50 transition-colors font-semibold no-underline"
          >
            🔑 Executive Login
          </Link>
          <button onClick={() => navigate("/Logout")} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 transition-colors font-medium">
            <MdOutlinePowerSettingsNew size={16} /> Sign Out
          </button>
        </div>
        <div className="px-4 py-3 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-orange-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{user.initials}</div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-800 truncate">{user.name}</p>
              <p className="text-xs text-gray-400">v{packageJson.version}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="ml-64 flex-1 flex flex-col min-h-screen">

        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-0.5">Support</p>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Contact Center</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { n: stats.total,      label: "Tickets",     color: "text-gray-800" },
              { n: stats.open,       label: "Open",        color: "text-blue-600" },
              { n: stats.inProgress, label: "In Progress", color: "text-amber-600" },
              { n: stats.resolved,   label: "Resolved",    color: "text-emerald-600" },
            ].map(({ n, label, color }) => (
              <div key={label} className="text-center px-3 py-1 bg-gray-50 rounded-lg border border-gray-200">
                <p className={`text-base font-black ${color}`}>{n}</p>
                <p className="text-xs text-gray-400">{label}</p>
              </div>
            ))}

            {/* Executive Login / Session */}
            {execSession ? (
              <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-1.5">
                <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                  {getInitials(execSession.name)}
                </div>
                <div>
                  <p className="text-xs font-bold text-indigo-700 leading-tight">{execSession.name}</p>
                  <p className="text-xs text-indigo-400">{execSession.role}</p>
                </div>
                <button
                  onClick={() => { setExecSession(null); localStorage.removeItem("execSession"); }}
                  className="ml-1 text-indigo-300 hover:text-indigo-600 text-xs font-bold"
                  title="Sign out"
                >✕</button>
              </div>
            ) : (
              <button
                onClick={() => { setShowExecLogin(true); setExecLoginKey(""); setExecLoginError(""); }}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all"
              >
                🔑 Executive Login
              </button>
            )}
          </div>
        </header>

        {/* Incoming message alert — centred star overlay */}
        {incomingAlert && (
          <>
            <style>{`
              @keyframes alertZoom {
                0%   { transform: translate(-50%, -50%) scale(0.5) rotate(-8deg); opacity: 0; }
                60%  { transform: translate(-50%, -50%) scale(1.06) rotate(2deg);  opacity: 1; }
                100% { transform: translate(-50%, -50%) scale(1)    rotate(0deg);  opacity: 1; }
              }
              @keyframes starSpin {
                0%   { transform: rotate(0deg)   scale(1);    }
                25%  { transform: rotate(20deg)  scale(1.15); }
                50%  { transform: rotate(-10deg) scale(1.05); }
                75%  { transform: rotate(10deg)  scale(1.1);  }
                100% { transform: rotate(0deg)   scale(1);    }
              }
              @keyframes backdropIn {
                from { opacity: 0; }
                to   { opacity: 1; }
              }
              .alert-backdrop {
                animation: backdropIn 0.25s ease both;
              }
              .alert-card {
                animation: alertZoom 0.5s cubic-bezier(0.34,1.56,0.64,1) both;
              }
              .alert-star {
                animation: starSpin 1.2s ease-in-out infinite;
                display: inline-block;
              }
            `}</style>

            {/* Backdrop */}
            <div
              className="alert-backdrop fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
              onClick={() => setIncomingAlert(null)}
            />

            {/* Card */}
            <div className="alert-card fixed z-50 bg-white rounded-3xl shadow-2xl border-4 border-orange-500 w-80 text-center px-7 py-8"
              style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
            >
              {/* Star icon */}
              <div className="flex justify-center mb-4">
                <div className="w-20 h-20 rounded-full bg-orange-500 flex items-center justify-center shadow-lg">
                  <span className="alert-star text-4xl">⭐</span>
                </div>
              </div>

              <p className="text-xs font-bold text-orange-600 uppercase tracking-widest mb-1">New Message</p>
              <p className="text-base font-bold text-gray-800 leading-snug mb-5">{incomingAlert}</p>

              <div className="flex gap-3">
                <button
                  onClick={() => { setActiveTab("My Tickets"); setIncomingAlert(null); }}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm py-2.5 rounded-xl transition-all shadow-sm"
                >View Message</button>
                <button
                  onClick={() => setIncomingAlert(null)}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 font-bold text-lg transition-colors self-center"
                >✕</button>
              </div>
            </div>
          </>
        )}

        {/* Tab bar */}
        <div className="bg-white border-b border-gray-200 px-8">
          <div className="flex gap-0">
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === tab ? "border-orange-600 text-orange-700" : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >{tab}</button>
            ))}
          </div>
        </div>

        <div className="flex-1 p-6">

          {/* ═══════════════ DASHBOARD ═══════════════ */}
          {activeTab === "Dashboard" && (
            <div className="space-y-6">
              {/* Stat cards */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                  { label: "Total Tickets",   value: stats.total,      icon: "🎫", color: "bg-blue-600",    light: "bg-blue-50" },
                  { label: "Open",            value: stats.open,       icon: "📂", color: "bg-amber-500",   light: "bg-amber-50" },
                  { label: "In Progress",     value: stats.inProgress, icon: "⚙️", color: "bg-violet-600",  light: "bg-violet-50" },
                  { label: "Resolved",        value: stats.resolved,   icon: "✅", color: "bg-emerald-600", light: "bg-emerald-50" },
                ].map(({ label, value, icon, color, light }) => (
                  <div key={label} className={`${light} rounded-xl p-5 border border-gray-100`}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{label}</p>
                      <span className="text-lg">{icon}</span>
                    </div>
                    <p className="text-3xl font-black text-gray-900">{value}</p>
                    <div className={`h-1 mt-3 rounded-full ${color} opacity-30`} />
                  </div>
                ))}

                {/* Executives Online card */}
                {(() => {
                  const THREE_MIN = 3 * 60 * 1000;
                  const online = Object.entries(onlineSessions)
                    .filter(([, ts]) => Date.now() - ts < THREE_MIN).length;
                  const total  = executives.length;
                  const nobody = online === 0;
                  return (
                    <div
                      className="bg-indigo-50 rounded-xl p-5 border border-indigo-100 cursor-pointer hover:border-indigo-300 transition-colors"
                      onClick={() => setActiveTab("Executives")}
                      title="Go to Executives"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-bold text-indigo-500 uppercase tracking-wide">Executives Online</p>
                        <span className="text-lg">👥</span>
                      </div>
                      <div className="flex items-end gap-1.5">
                        <p className="text-3xl font-black text-indigo-700">{online}</p>
                        <p className="text-lg font-bold text-indigo-300 mb-0.5">/ {total}</p>
                      </div>
                      <div className="flex items-center gap-1.5 mt-3">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${nobody ? "bg-red-400" : "bg-orange-500 animate-pulse"}`}></span>
                        <p className="text-xs font-semibold text-indigo-400">
                          {nobody ? "No one logged in" : `${total - online} offline`}
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Quick actions */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Quick Actions</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {[
                    { icon: "🎫", label: "New Ticket",     tab: "New Ticket" },
                    { icon: "📋", label: "View Tickets",   tab: "My Tickets" },
                    { icon: "📞", label: "Callback",       tab: "Callback" },
                    { icon: "💬", label: "Channels",       tab: "Contact Channels" },
                    { icon: "❓", label: "FAQ",            tab: "FAQ" },
                    { icon: "🤖", label: "Chat Mitra",     onClick: () => setMitraOpen(true) },
                  ].map(({ icon, label, tab, onClick }) => (
                    <button
                      key={label}
                      onClick={() => tab ? setActiveTab(tab) : onClick && onClick()}
                      className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-gray-200 hover:border-orange-400 hover:bg-orange-50 transition-all group"
                    >
                      <span className="text-2xl">{icon}</span>
                      <span className="text-xs font-semibold text-gray-600 group-hover:text-orange-700">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Recent tickets */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Recent Tickets</p>
                  <button onClick={() => setActiveTab("My Tickets")} className="text-xs text-orange-600 hover:underline font-semibold">View all</button>
                </div>
                {tickets.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl">
                    <p className="text-2xl mb-2">🎫</p>
                    <p className="text-sm font-semibold text-gray-500">No tickets yet</p>
                    <button onClick={() => setActiveTab("New Ticket")} className="mt-2 text-xs text-orange-600 hover:underline font-semibold">Raise your first ticket →</button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tickets.slice(0, 5).map(t => (
                      <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50 hover:border-gray-200 transition-colors">
                        <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-xs flex-shrink-0">
                          {getInitials(t.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-gray-800 truncate">{t.subject}</p>
                          <p className="text-xs text-gray-500">{t.id} · {t.category} {t.assignedTo && <span className="text-orange-600 font-semibold">· 👤 {t.assignedTo}</span>}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${PRIORITY_STYLE[t.priority]}`}>{t.priority}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${STATUS_STYLE[t.status]}`}>{t.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Contact info strip */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { icon: "📞", label: "Phone", value: "+91 94808 60587", sub: "Mon–Sat 9AM–6PM" },
                  { icon: "📧", label: "Email", value: "support@dutydentist.com", sub: "Reply within 24 hrs" },
                  { icon: "💬", label: "WhatsApp", value: "+91 94808 60587", sub: "Instant messaging" },
                ].map(({ icon, label, value, sub }) => (
                  <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-xl flex-shrink-0">{icon}</div>
                    <div>
                      <p className="text-xs text-gray-400 font-medium">{label}</p>
                      <p className="text-sm font-bold text-gray-800">{value}</p>
                      <p className="text-xs text-gray-400">{sub}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Customer Portal section */}
              {!customerSession ? (
                <div className="bg-gradient-to-r from-orange-600 to-emerald-500 rounded-xl p-5 flex items-center justify-between gap-4 flex-wrap shadow-md">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-2xl flex-shrink-0">👤</div>
                    <div>
                      <p className="text-white font-bold text-sm">Customer Portal</p>
                      <p className="text-orange-100 text-xs">Log in to track your support tickets and raise new requests</p>
                    </div>
                  </div>
                  <Link
                    to="/Customer_Login"
                    state={{ returnTo: "/Contact_us" }}
                    className="bg-white text-orange-700 font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-orange-50 transition-colors no-underline flex-shrink-0 shadow-sm"
                  >Sign In as Customer</Link>
                </div>
              ) : (
                <div className="bg-white rounded-xl border-2 border-orange-200 p-5">
                  <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-700 font-bold text-sm">👤</div>
                      <div>
                        <p className="text-sm font-bold text-gray-800">Logged in as Customer</p>
                        <p className="text-xs text-gray-400">📱 {customerSession.mobile}</p>
                      </div>
                    </div>
                    <button onClick={customerLogout} className="text-xs text-red-500 hover:underline font-semibold flex-shrink-0">Sign Out</button>
                  </div>

                  {/* Customer's own tickets */}
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">My Tickets ({customerTickets.length})</p>
                  {customerTickets.length === 0 ? (
                    <div className="text-center py-6 border-2 border-dashed border-gray-100 rounded-xl">
                      <p className="text-2xl mb-1">🎫</p>
                      <p className="text-xs text-gray-400 font-semibold">No tickets yet</p>
                      <button onClick={() => setActiveTab("New Ticket")} className="mt-2 text-xs text-orange-600 hover:underline font-semibold">Raise your first ticket →</button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {customerTickets.slice(0, 4).map(t => (
                        <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-gray-800 truncate">{t.subject}</p>
                            <p className="text-xs text-gray-400">{t.id} · {t.category} {t.assignedTo && <span className="text-orange-600">· 👤 {t.assignedTo}</span>}</p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border flex-shrink-0 ${STATUS_STYLE[t.status]}`}>{t.status}</span>
                        </div>
                      ))}
                      {customerTickets.length > 4 && (
                        <button onClick={() => setActiveTab("My Tickets")} className="text-xs text-orange-600 hover:underline font-semibold w-full text-center pt-1">
                          +{customerTickets.length - 4} more →
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ═══════════════ NEW TICKET ═══════════════ */}
          {activeTab === "New Ticket" && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-orange-600 text-white text-xs font-bold flex items-center justify-center">🎫</div>
                  <div>
                    <p className="text-sm font-bold text-gray-800">Raise a Support Ticket</p>
                    <p className="text-xs text-gray-400">We'll respond within 24 hours</p>
                  </div>
                </div>

                {ticketSuccess && (
                  <div className="mb-4 flex items-start gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-3">
                    <span>✅</span><p className="text-sm font-semibold">{ticketSuccess}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { key: "name",    label: "Full Name",     type: "text",  required: true,  placeholder: "Your full name" },
                    { key: "email",   label: "Email",         type: "email", required: true,  placeholder: "your@email.com" },
                    { key: "phone",   label: "Phone Number",  type: "tel",   required: false, placeholder: "+91 XXXXX XXXXX" },
                    { key: "subject", label: "Subject",       type: "text",  required: true,  placeholder: "Brief summary of your issue" },
                  ].map(({ key, label, type, required, placeholder }) => (
                    <div key={key}>
                      <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">
                        {label} {required && <span className="text-red-500">*</span>}
                      </label>
                      <input
                        type={type} placeholder={placeholder} value={ticketForm[key]}
                        onChange={e => setTicketForm(f => ({ ...f, [key]: e.target.value }))}
                        className={`w-full border-2 rounded-lg px-3.5 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-orange-500 transition-colors ${
                          ticketErrors[key] ? "border-red-400 bg-red-50" : "border-gray-200 hover:border-gray-300"
                        }`}
                      />
                      {ticketErrors[key] && <p className="text-red-500 text-xs mt-1">{ticketErrors[key]}</p>}
                    </div>
                  ))}

                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Category</label>
                    <select
                      value={ticketForm.category}
                      onChange={e => setTicketForm(f => ({ ...f, category: e.target.value }))}
                      className="w-full border-2 border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-orange-500 transition-colors"
                    >
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Priority</label>
                    <div className="flex gap-2 flex-wrap">
                      {PRIORITIES.map(p => (
                        <button
                          key={p}
                          onClick={() => setTicketForm(f => ({ ...f, priority: p }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${
                            ticketForm.priority === p
                              ? "border-orange-600 bg-orange-600 text-white"
                              : `${PRIORITY_STYLE[p]} border-transparent hover:border-gray-300`
                          }`}
                        >{p}</button>
                      ))}
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">
                      Message <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={4} placeholder="Describe your issue in detail..."
                      value={ticketForm.message}
                      onChange={e => setTicketForm(f => ({ ...f, message: e.target.value }))}
                      className={`w-full border-2 rounded-lg px-3.5 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-orange-500 transition-colors resize-none ${
                        ticketErrors.message ? "border-red-400 bg-red-50" : "border-gray-200 hover:border-gray-300"
                      }`}
                    />
                    {ticketErrors.message && <p className="text-red-500 text-xs mt-1">{ticketErrors.message}</p>}
                  </div>
                </div>

                <button
                  onClick={submitTicket}
                  className="mt-5 w-full bg-orange-600 hover:bg-orange-700 active:scale-[0.98] text-white font-bold py-3 rounded-xl text-sm tracking-wide transition-all shadow-sm hover:shadow-md"
                >
                  Submit Ticket
                </button>
              </div>
            </div>
          )}

          {/* ═══════════════ MY TICKETS ═══════════════ */}
          {activeTab === "My Tickets" && (
            <div className="space-y-4">
              {/* Filter */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide mr-2">Filter:</span>
                {["All", "Open", "In Progress", "Resolved", "Closed"].map(f => (
                  <button
                    key={f}
                    onClick={() => setTicketFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      ticketFilter === f
                        ? "bg-orange-600 text-white border-orange-600"
                        : "bg-gray-50 text-gray-600 border-gray-200 hover:border-orange-400"
                    }`}
                  >{f}</button>
                ))}
                <span className="ml-auto text-xs text-gray-400">{filteredTickets.length} ticket(s)</span>
              </div>

              {filteredTickets.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 text-center py-16">
                  <p className="text-4xl mb-3">🎫</p>
                  <p className="text-sm font-semibold text-gray-500">No tickets found</p>
                  <button onClick={() => setActiveTab("New Ticket")} className="mt-2 text-xs text-orange-600 hover:underline font-semibold">Create one →</button>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredTickets.map(t => (
                    <div key={t.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 transition-colors">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-sm flex-shrink-0">
                          {getInitials(t.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div>
                              <p className="font-bold text-gray-900 text-sm">{t.subject}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{t.id} · {t.name} · {t.email}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${PRIORITY_STYLE[t.priority]}`}>{t.priority}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${STATUS_STYLE[t.status]}`}>{t.status}</span>
                            </div>
                          </div>
                          <p className="text-xs text-gray-600 mt-2 line-clamp-2">{t.message}</p>
                          <div className="flex items-center gap-3 mt-3 flex-wrap">
                            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full text-gray-600 font-medium">{t.category}</span>
                            {t.assignedTo && (
                              <span className="text-xs bg-orange-50 border border-orange-200 text-orange-700 font-semibold px-2 py-0.5 rounded-full">👤 {t.assignedTo}</span>
                            )}
                            <span className="text-xs text-gray-400">Created: {new Date(t.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                            {t.status !== "Closed" && t.status !== "Resolved" && (
                              <div className="ml-auto flex gap-2">
                                {t.status === "Open" && (
                                  <button onClick={() => updateTicketStatus(t.id, "In Progress")} className="text-xs text-amber-600 hover:underline font-semibold">Mark In Progress</button>
                                )}
                                {(t.status === "Open" || t.status === "In Progress") && (
                                  <button onClick={() => updateTicketStatus(t.id, "Resolved")} className="text-xs text-emerald-600 hover:underline font-semibold">Mark Resolved</button>
                                )}
                                <button onClick={() => updateTicketStatus(t.id, "Closed")} className="text-xs text-gray-500 hover:underline font-semibold">Close</button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══════════════ FAQ ═══════════════ */}
          {activeTab === "FAQ" && (
            <div className="max-w-2xl mx-auto space-y-4">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <input
                  type="text" placeholder="🔍  Search FAQs..."
                  value={faqSearch} onChange={e => setFaqSearch(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>

              {filteredFaq.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 text-center py-12">
                  <p className="text-3xl mb-2">🔍</p>
                  <p className="text-sm font-semibold text-gray-500">No results for "{faqSearch}"</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {filteredFaq.map((faq, i) => (
                    <div key={i} className="border-b border-gray-100 last:border-0">
                      <button
                        onClick={() => setOpenFaq(openFaq === i ? null : i)}
                        className="w-full text-left px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                      >
                        <p className="text-sm font-semibold text-gray-800 pr-4">{faq.q}</p>
                        <span className={`text-gray-400 text-lg flex-shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`}>›</span>
                      </button>
                      {openFaq === i && (
                        <div className="px-5 pb-4 bg-orange-50 border-t border-orange-100">
                          <p className="text-sm text-gray-700 leading-relaxed pt-3">{faq.a}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 text-center">
                <p className="text-sm font-semibold text-gray-800 mb-1">Didn't find your answer?</p>
                <p className="text-xs text-gray-500 mb-3">Raise a ticket and we'll get back to you within 24 hours.</p>
                <button onClick={() => setActiveTab("New Ticket")} className="bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold px-6 py-2 rounded-xl transition-all">Raise a Ticket</button>
              </div>
            </div>
          )}

          {/* ═══════════════ CONTACT CHANNELS ═══════════════ */}
          {activeTab === "Contact Channels" && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { icon: "📞", title: "Phone Support",    value: "+91 94808 60587",                sub: "Mon–Sat · 9:00 AM – 6:00 PM",         action: "Call Now",         color: "bg-blue-600",   light: "bg-blue-50 border-blue-200",   onClick: () => { window.location.href = "tel:+919480860587"; } },
                  { icon: "💬", title: "WhatsApp",         value: "+91 94808 60587",                sub: "Instant · Usually replies in 1 hr",   action: "Chat on WhatsApp", color: "bg-orange-600",  light: "bg-orange-50 border-orange-200", onClick: () => { window.open("https://wa.me/919480860587", "_blank"); } },
                  { icon: "📧", title: "Email Support",    value: "support@dutydentist.com",        sub: "Response within 24 hours",            action: "Send Email",       color: "bg-violet-600", light: "bg-violet-50 border-violet-200", onClick: () => { window.location.href = "mailto:support@dutydentist.com"; } },
                  { icon: "🌐", title: "HomePage",          value: "www.dutydentist.com",            sub: "Book appointments online",            action: "Visit HomePage",    color: "bg-slate-600",  light: "bg-slate-50 border-slate-200", onClick: () => { window.open("https://www.dutydentist.com", "_blank"); } },
                  { icon: "📍", title: "Visit Us",         value: "#290, Medahalli, Bangalore – 560049", sub: "Walk-in welcome with prior appointment", action: "Get Directions", color: "bg-rose-600", light: "bg-rose-50 border-rose-200", onClick: () => { window.open("https://maps.google.com/?q=Medahalli+Bangalore+560049", "_blank"); } },
                  { icon: "🤖", title: "Chat with Mitra",  value: "AI Receptionist",               sub: "Available 24/7 on every page",        action: "Open Chat",        color: "bg-orange-700",  light: "bg-orange-50 border-orange-200", onClick: () => setMitraOpen(true) },
                ].map(({ icon, title, value, sub, action, color, light, onClick }) => (
                  <div key={title} className={`${light} border rounded-xl p-5`}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 ${color} rounded-full flex items-center justify-center text-xl text-white`}>{icon}</div>
                      <p className="font-bold text-sm text-gray-800">{title}</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 mb-0.5">{value}</p>
                    <p className="text-xs text-gray-500 mb-4">{sub}</p>
                    <button onClick={onClick} className={`w-full ${color} hover:opacity-90 text-white text-xs font-bold py-2 rounded-lg transition-all`}>{action}</button>
                  </div>
                ))}
              </div>

              {/* Business hours */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Business Hours</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { day: "Monday",    hours: "9:00 AM – 6:00 PM" },
                    { day: "Tuesday",   hours: "9:00 AM – 6:00 PM" },
                    { day: "Wednesday", hours: "9:00 AM – 6:00 PM" },
                    { day: "Thursday",  hours: "9:00 AM – 6:00 PM" },
                    { day: "Friday",    hours: "9:00 AM – 6:00 PM" },
                    { day: "Saturday",  hours: "9:00 AM – 2:00 PM" },
                    { day: "Sunday",    hours: "Emergency Only" },
                    { day: "Emergency", hours: "24 / 7" },
                  ].map(({ day, hours }) => (
                    <div key={day} className="text-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <p className="text-xs font-bold text-gray-600">{day}</p>
                      <p className={`text-xs mt-0.5 font-semibold ${hours.includes("Emergency") || hours === "24 / 7" ? "text-orange-600" : "text-gray-700"}`}>{hours}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════ CALLBACK ═══════════════ */}
          {activeTab === "Callback" && (
            <div className="max-w-2xl mx-auto space-y-5">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-orange-600 text-white text-xl flex items-center justify-center">📞</div>
                  <div>
                    <p className="text-sm font-bold text-gray-800">Request a Callback</p>
                    <p className="text-xs text-gray-400">We'll call you at your preferred time</p>
                  </div>
                </div>

                {callbackMsg && (
                  <div className="mb-4 flex items-start gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-3">
                    <span>✅</span><p className="text-sm font-semibold">{callbackMsg}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { key: "name",  label: "Your Name",    type: "text", placeholder: "Full name",        required: true },
                    { key: "phone", label: "Phone Number", type: "tel",  placeholder: "+91 XXXXX XXXXX",  required: true },
                    { key: "date",  label: "Preferred Date", type: "date", placeholder: "",               required: false },
                    { key: "time",  label: "Preferred Time", type: "time", placeholder: "",               required: false },
                  ].map(({ key, label, type, placeholder, required }) => (
                    <div key={key}>
                      <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">
                        {label} {required && <span className="text-red-500">*</span>}
                      </label>
                      <input
                        type={type} placeholder={placeholder} value={callbackForm[key]}
                        onChange={e => setCallbackForm(f => ({ ...f, [key]: e.target.value }))}
                        className="w-full border-2 border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-orange-500 transition-colors"
                      />
                    </div>
                  ))}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">Reason for Call</label>
                    <textarea
                      rows={3} placeholder="Brief description of what you'd like to discuss..."
                      value={callbackForm.reason}
                      onChange={e => setCallbackForm(f => ({ ...f, reason: e.target.value }))}
                      className="w-full border-2 border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-orange-500 transition-colors resize-none"
                    />
                  </div>
                </div>
                <button
                  onClick={submitCallback}
                  disabled={!callbackForm.name.trim() || !callbackForm.phone.trim()}
                  className="mt-5 w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] text-white font-bold py-3 rounded-xl text-sm tracking-wide transition-all shadow-sm hover:shadow-md"
                >
                  Schedule Callback
                </button>
              </div>

              {/* Callback history */}
              {callbacks.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Scheduled Callbacks</p>
                  <div className="space-y-2">
                    {callbacks.map(cb => (
                      <div key={cb.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                        <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-xs flex-shrink-0">
                          {getInitials(cb.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-gray-800">{cb.name}</p>
                          <p className="text-xs text-gray-500">{cb.phone}{cb.date ? ` · ${cb.date}` : ""}{cb.time ? ` at ${cb.time}` : ""}</p>
                          {cb.reason && <p className="text-xs text-gray-400 truncate">{cb.reason}</p>}
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold border bg-blue-50 text-blue-700 border-blue-200 flex-shrink-0">{cb.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══════════════ EXECUTIVES ═══════════════ */}
          {activeTab === "Executives" && (
            <div className="space-y-4">

              {/* Top bar: stats + view toggle + add button */}
              <div className="flex items-center gap-3 flex-wrap">
                {[
                  { label: "Total",              value: executivesWithCounts.length,                                                               color: "text-gray-800",    bg: "bg-white" },
                  { label: "Available",          value: executivesWithCounts.filter(e => e.status === "Available").length,                        color: "text-emerald-600", bg: "bg-emerald-50" },
                  { label: "Busy",               value: executivesWithCounts.filter(e => e.status === "Busy").length,                             color: "text-amber-600",   bg: "bg-amber-50" },
                  { label: "Offline",            value: executivesWithCounts.filter(e => e.status === "Offline").length,                          color: "text-gray-400",    bg: "bg-gray-100" },
                  { label: "Unassigned tickets", value: tickets.filter(t => !t.assignedId || t.assignedTo === "Unassigned").length,               color: "text-red-500",     bg: "bg-red-50" },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} className={`${bg} border border-gray-200 rounded-xl px-4 py-2 text-center min-w-[80px]`}>
                    <p className={`text-xl font-black ${color}`}>{value}</p>
                    <p className="text-xs text-gray-400 font-medium">{label}</p>
                  </div>
                ))}

                {/* View toggle */}
                <div className="flex gap-1 bg-gray-100 rounded-xl p-1 ml-auto">
                  {[
                    { key: "cards",    label: "⊞ Cards" },
                    { key: "table",    label: "☰ Table" },
                    { key: "workload", label: "▦ Workload" },
                  ].map(v => (
                    <button
                      key={v.key}
                      onClick={() => { setExecView(v.key); setSelectedExec(null); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        execView === v.key ? "bg-white text-orange-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
                      }`}
                    >{v.label}</button>
                  ))}
                </div>

                {tickets.some(t => !t.assignedId || t.assignedTo === "Unassigned") && (
                  <button
                    onClick={() => autoAssignUnassigned()}
                    className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-2"
                  >
                    ⚡ Auto-Assign Unassigned
                  </button>
                )}
                <button
                  onClick={() => setShowAddExec(v => !v)}
                  className="bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-2"
                >
                  {showAddExec ? "✕ Cancel" : "+ Add Executive"}
                </button>
              </div>

              {/* Add executive form */}
              {showAddExec && (
                <div className="bg-white border-2 border-orange-200 rounded-xl p-5">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">New Executive</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { key: "name",  label: "Full Name",    type: "text",  placeholder: "Jane Smith",          required: true  },
                      { key: "email", label: "Email",        type: "email", placeholder: "jane@dutydentist.com", required: true  },
                      { key: "phone", label: "Phone",        type: "tel",   placeholder: "+91 XXXXX XXXXX",      required: false },
                    ].map(({ key, label, type, placeholder, required }) => (
                      <div key={key}>
                        <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wide">
                          {label} {required && <span className="text-red-500">*</span>}
                        </label>
                        <input
                          type={type} placeholder={placeholder} value={addExecForm[key]}
                          onChange={e => setAddExecForm(f => ({ ...f, [key]: e.target.value }))}
                          className={`w-full border-2 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500 transition-colors ${addExecErrors[key] ? "border-red-400 bg-red-50" : "border-gray-200"}`}
                        />
                        {addExecErrors[key] && <p className="text-red-500 text-xs mt-1">{addExecErrors[key]}</p>}
                      </div>
                    ))}

                    {/* Access Key field */}
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wide">
                        Access Key <span className="text-red-500">*</span>
                        <span className="ml-1 text-gray-400 font-normal normal-case">(executive login password)</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text" placeholder="e.g. EXEC@2024 or any unique key"
                          value={addExecForm.accessKey}
                          onChange={e => setAddExecForm(f => ({ ...f, accessKey: e.target.value }))}
                          className={`w-full border-2 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-orange-500 transition-colors pr-20 ${addExecErrors.accessKey ? "border-red-400 bg-red-50" : "border-gray-200"}`}
                        />
                        <button type="button"
                          onClick={() => {
                            const key = `EXC-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
                            setAddExecForm(f => ({ ...f, accessKey: key }));
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-indigo-600 font-bold hover:text-indigo-800 bg-indigo-50 px-2 py-1 rounded-md"
                        >Auto</button>
                      </div>
                      {addExecErrors.accessKey && <p className="text-red-500 text-xs mt-1">{addExecErrors.accessKey}</p>}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wide">Role</label>
                      <select
                        value={addExecForm.role}
                        onChange={e => setAddExecForm(f => ({ ...f, role: e.target.value }))}
                        className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
                      >
                        {["Agent", "Senior Agent", "Team Lead", "Supervisor"].map(r => <option key={r}>{r}</option>)}
                      </select>
                    </div>
                  </div>
                  <button
                    onClick={addExecutive}
                    className="mt-4 bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm px-6 py-2.5 rounded-xl transition-all"
                  >Add Executive</button>
                </div>
              )}

              {/* ── MANDATORY HOURS ── */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="text-base">⏰</span>
                    <p className="text-xs font-bold text-gray-700 uppercase tracking-widest">Mandatory Hours Compliance</p>
                  </div>
                  <p className="text-xs text-gray-400">Today's shift progress</p>
                </div>
                <div className="divide-y divide-gray-50">
                  {executivesWithCounts.map(exec => {
                    const required = mandatoryHours[exec.id] ?? 8;
                    const logged   = hoursLogged[exec.id]   ?? 0;
                    const pct      = Math.min(100, Math.round((logged / required) * 100));
                    const isEditing = editingHours === exec.id;
                    const met = logged >= required;
                    return (
                      <div key={exec.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                        {/* Avatar */}
                        <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs flex-shrink-0">
                          {getInitials(exec.name)}
                        </div>
                        {/* Name + role */}
                        <div className="w-36 flex-shrink-0">
                          <p className="text-sm font-bold text-gray-800 truncate">{exec.name}</p>
                          <p className="text-xs text-gray-400">{exec.role || "Agent"}</p>
                        </div>
                        {/* Progress */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-500 font-semibold">{logged}h logged / {required}h required</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${met ? "bg-orange-100 text-orange-700" : "bg-amber-100 text-amber-700"}`}>
                              {met ? "✅ Met" : `${pct}%`}
                            </span>
                          </div>
                          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${met ? "bg-orange-500" : pct >= 60 ? "bg-amber-400" : "bg-red-400"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                        {/* Edit controls */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {isEditing ? (
                            <>
                              <input
                                type="number" min="0" max="24" step="0.5"
                                value={hoursInput}
                                onChange={e => setHoursInput(e.target.value)}
                                placeholder="hrs"
                                className="w-16 border border-indigo-300 rounded-lg px-2 py-1 text-xs font-bold text-center focus:outline-none focus:border-indigo-500"
                              />
                              <button
                                onClick={() => {
                                  const val = parseFloat(hoursInput);
                                  if (!isNaN(val) && val >= 0) {
                                    const updated = { ...hoursLogged, [exec.id]: val };
                                    setHoursLogged(updated);
                                    localStorage.setItem("hoursLogged", JSON.stringify(updated));
                                  }
                                  setEditingHours(null); setHoursInput("");
                                }}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-2.5 py-1 rounded-lg transition-colors"
                              >Save</button>
                              <button
                                onClick={() => { setEditingHours(null); setHoursInput(""); }}
                                className="text-gray-400 hover:text-gray-600 text-xs font-bold px-1.5 py-1"
                              >✕</button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => { setEditingHours(exec.id); setHoursInput(String(logged)); }}
                                className="text-xs text-indigo-500 hover:text-indigo-700 font-semibold border border-indigo-200 px-2.5 py-1 rounded-lg hover:bg-indigo-50 transition-colors"
                                title="Log hours"
                              >✎ Log Hours</button>
                              <button
                                onClick={() => {
                                  const newReq = prompt(`Set mandatory hours for ${exec.name} (current: ${required}h):`, required);
                                  if (newReq !== null && !isNaN(parseFloat(newReq))) {
                                    const updated = { ...mandatoryHours, [exec.id]: parseFloat(newReq) };
                                    setMandatoryHours(updated);
                                    localStorage.setItem("mandatoryHours", JSON.stringify(updated));
                                  }
                                }}
                                className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 px-2.5 py-1 rounded-lg hover:bg-gray-50 transition-colors"
                                title="Set mandatory hours"
                              >⚙ {required}h</button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {executivesWithCounts.length === 0 && (
                    <div className="px-5 py-8 text-center text-sm text-gray-400">No executives to display</div>
                  )}
                </div>
                {/* Summary footer */}
                {executivesWithCounts.length > 0 && (() => {
                  const metCount = executivesWithCounts.filter(e => (hoursLogged[e.id] ?? 0) >= (mandatoryHours[e.id] ?? 8)).length;
                  return (
                    <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center gap-4 text-xs font-semibold text-gray-500">
                      <span className="text-orange-600">✅ {metCount} met target</span>
                      <span className="text-amber-600">⏳ {executivesWithCounts.length - metCount} pending</span>
                      <button
                        onClick={() => {
                          if (window.confirm("Reset all logged hours for today?")) {
                            setHoursLogged({});
                            localStorage.removeItem("hoursLogged");
                          }
                        }}
                        className="ml-auto text-red-400 hover:text-red-600 transition-colors"
                      >↺ Reset All</button>
                    </div>
                  );
                })()}
              </div>

              {/* ── CARDS VIEW ── */}
              {execView === "cards" && <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* Cards list */}
                <div className="lg:col-span-1 space-y-2">
                  {executivesWithCounts.map(exec => {
                    const isSelected = selectedExec?.id === exec.id;
                    const execTickets = tickets.filter(t => t.assignedId === exec.id);
                    const openCount   = execTickets.filter(t => t.status === "Open").length;
                    const resolvedCount = execTickets.filter(t => t.status === "Resolved" || t.status === "Closed").length;
                    return (
                      <div
                        key={exec.id}
                        onClick={() => setSelectedExec(isSelected ? null : exec)}
                        className={`cursor-pointer rounded-xl border-2 p-4 transition-all ${isSelected ? "border-orange-500 bg-orange-50" : "border-gray-200 bg-white hover:border-orange-300"}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-sm flex-shrink-0">
                            {getInitials(exec.name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-gray-800 truncate">{exec.name}</p>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0 ${
                                exec.status === "Available" ? "bg-emerald-100 text-emerald-700"
                                : exec.status === "Busy"   ? "bg-amber-100 text-amber-700"
                                :                            "bg-gray-100 text-gray-500"
                              }`}>{exec.status}</span>
                            </div>
                            <p className="text-xs text-gray-400">{exec.role || "Agent"}</p>
                          </div>
                        </div>
                        <div className="flex gap-3 mt-3 pt-3 border-t border-gray-100">
                          <div className="text-center flex-1">
                            <p className="text-base font-black text-gray-800">{exec.ticketCount}</p>
                            <p className="text-xs text-gray-400">Total</p>
                          </div>
                          <div className="text-center flex-1">
                            <p className="text-base font-black text-blue-600">{openCount}</p>
                            <p className="text-xs text-gray-400">Open</p>
                          </div>
                          <div className="text-center flex-1">
                            <p className="text-base font-black text-emerald-600">{resolvedCount}</p>
                            <p className="text-xs text-gray-400">Resolved</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Unassigned pool */}
                  {tickets.filter(t => !t.assignedId || t.assignedTo === "Unassigned").length > 0 && (
                    <div
                      onClick={() => setSelectedExec("unassigned")}
                      className={`cursor-pointer rounded-xl border-2 p-4 transition-all ${selectedExec === "unassigned" ? "border-red-400 bg-red-50" : "border-dashed border-red-200 bg-white hover:border-red-400"}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-500 text-lg flex-shrink-0">⚠</div>
                        <div>
                          <p className="text-sm font-bold text-red-600">Unassigned Tickets</p>
                          <p className="text-xs text-red-400">{tickets.filter(t => !t.assignedId || t.assignedTo === "Unassigned").length} ticket(s) need an executive</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Detail panel */}
                <div className="lg:col-span-2">
                  {!selectedExec && (
                    <div className="h-full bg-white rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center py-16">
                      <div className="text-center">
                        <p className="text-3xl mb-2">👆</p>
                        <p className="text-sm font-semibold text-gray-400">Select an executive to view details</p>
                      </div>
                    </div>
                  )}

                  {/* Unassigned ticket pool */}
                  {selectedExec === "unassigned" && (
                    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Unassigned Tickets</p>
                      {tickets.filter(t => !t.assignedId || t.assignedTo === "Unassigned").map(t => (
                        <div key={t.id} className="p-3 rounded-xl border border-red-100 bg-red-50">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-gray-800 truncate">{t.subject}</p>
                              <p className="text-xs text-gray-500">{t.id} · {t.name}</p>
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border flex-shrink-0 ${PRIORITY_STYLE[t.priority]}`}>{t.priority}</span>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <label className="text-xs text-gray-500 font-semibold">Assign to:</label>
                            <select
                              defaultValue=""
                              onChange={e => e.target.value && doReassign(t.id, e.target.value)}
                              className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-orange-500"
                            >
                              <option value="" disabled>Choose executive…</option>
                              {executivesWithCounts.filter(e => e.status === "Available").map(e => (
                                <option key={e.id} value={e.id}>{e.name} ({e.ticketCount} tickets)</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Executive detail */}
                  {selectedExec && selectedExec !== "unassigned" && (() => {
                    const exec = executivesWithCounts.find(e => e.id === selectedExec.id);
                    if (!exec) return null;
                    const execTickets = tickets.filter(t => t.assignedId === exec.id);
                    return (
                      <div className="space-y-4">
                        {/* Executive profile header */}
                        <div className="bg-white rounded-xl border border-gray-200 p-5">
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div className="flex items-center gap-4">
                              <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-black text-lg">
                                {getInitials(exec.name)}
                              </div>
                              <div>
                                <p className="text-base font-black text-gray-900">{exec.name}</p>
                                <p className="text-xs text-gray-400">{exec.email}</p>
                                {exec.phone && <p className="text-xs text-gray-400">{exec.phone}</p>}
                                <p className="text-xs font-semibold text-orange-600 mt-0.5">{exec.role || "Agent"}</p>
                                {exec.accessKey && (
                                  <div className="flex items-center gap-1.5 mt-1">
                                    <span className="text-xs text-gray-400">🔑</span>
                                    <span className="text-xs font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                      {revealedKeys[exec.id] ? exec.accessKey : "•".repeat(exec.accessKey.length)}
                                    </span>
                                    <button
                                      onClick={() => setRevealedKeys(r => ({ ...r, [exec.id]: !r[exec.id] }))}
                                      className="text-xs text-indigo-400 hover:text-indigo-600"
                                    >{revealedKeys[exec.id] ? "Hide" : "Show"}</button>
                                    <button
                                      onClick={() => navigator.clipboard.writeText(exec.accessKey)}
                                      className="text-xs text-gray-400 hover:text-gray-600" title="Copy key"
                                    >📋</button>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <select
                                value={exec.status}
                                onChange={e => saveExecs(executives.map(ex => ex.id === exec.id ? { ...ex, status: e.target.value } : ex))}
                                className="text-xs border-2 border-gray-200 rounded-lg px-2 py-1.5 font-semibold focus:outline-none focus:border-orange-500"
                              >
                                <option>Available</option>
                                <option>Busy</option>
                                <option>Offline</option>
                              </select>
                              <button
                                onClick={() => removeExecutive(exec.id)}
                                className="text-xs bg-red-50 text-red-500 hover:bg-red-100 border border-red-200 font-bold px-3 py-1.5 rounded-lg transition-colors"
                              >Remove</button>
                              <button
                                onClick={() => { setTerminateModal(exec); setTerminateReason(""); }}
                                className="text-xs bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-1.5 rounded-lg transition-colors shadow-sm"
                              >🚫 Terminate</button>
                            </div>
                          </div>

                          {/* Mini stats */}
                          <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-100">
                            {[
                              { label: "Total",      value: execTickets.length,                                                      color: "text-gray-800" },
                              { label: "Open",       value: execTickets.filter(t => t.status === "Open").length,                     color: "text-blue-600" },
                              { label: "In Progress",value: execTickets.filter(t => t.status === "In Progress").length,              color: "text-amber-600" },
                              { label: "Resolved",   value: execTickets.filter(t => t.status === "Resolved" || t.status === "Closed").length, color: "text-emerald-600" },
                            ].map(({ label, value, color }) => (
                              <div key={label} className="text-center">
                                <p className={`text-xl font-black ${color}`}>{value}</p>
                                <p className="text-xs text-gray-400">{label}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Assigned tickets */}
                        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Assigned Tickets</p>
                          {execTickets.length === 0 ? (
                            <div className="text-center py-8 border-2 border-dashed border-gray-100 rounded-xl">
                              <p className="text-2xl mb-1">✅</p>
                              <p className="text-sm text-gray-400 font-semibold">No tickets assigned</p>
                            </div>
                          ) : execTickets.map(t => (
                            <div key={t.id} className="p-3 rounded-xl border border-gray-100 bg-gray-50">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-bold text-gray-800 truncate">{t.subject}</p>
                                  <p className="text-xs text-gray-500">{t.id} · {t.name}</p>
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${PRIORITY_STYLE[t.priority]}`}>{t.priority}</span>
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${STATUS_STYLE[t.status]}`}>{t.status}</span>
                                </div>
                              </div>
                              <div className="mt-2 flex items-center gap-2 flex-wrap">
                                {t.status === "Open" && (
                                  <button onClick={() => updateTicketStatus(t.id, "In Progress")} className="text-xs text-amber-600 hover:underline font-semibold">→ In Progress</button>
                                )}
                                {(t.status === "Open" || t.status === "In Progress") && (
                                  <button onClick={() => updateTicketStatus(t.id, "Resolved")} className="text-xs text-emerald-600 hover:underline font-semibold">→ Resolved</button>
                                )}
                                <div className="ml-auto flex items-center gap-1">
                                  <label className="text-xs text-gray-400">Reassign:</label>
                                  <select
                                    value={t.assignedId || ""}
                                    onChange={e => doReassign(t.id, e.target.value)}
                                    className="text-xs border border-gray-200 rounded-lg px-2 py-0.5 focus:outline-none focus:border-orange-500"
                                  >
                                    {executivesWithCounts.map(e => (
                                      <option key={e.id} value={e.id}>{e.name}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>}

              {/* ── TABLE VIEW ── */}
              {execView === "table" && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        {["Executive", "Role", "Status", "Email", "Open", "In Progress", "Resolved", "Total", "Actions"].map(h => (
                          <th key={h} className="text-left text-xs font-bold text-gray-500 uppercase tracking-wide px-4 py-3">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {executivesWithCounts.map(exec => {
                        const ex = tickets.filter(t => t.assignedId === exec.id);
                        return (
                          <tr key={exec.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-700 font-bold text-xs flex items-center justify-center flex-shrink-0">{getInitials(exec.name)}</div>
                                <span className="font-semibold text-gray-800">{exec.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-500 text-xs">{exec.role || "Agent"}</td>
                            <td className="px-4 py-3">
                              <select
                                value={exec.status}
                                onChange={e => saveExecs(executives.map(ex2 => ex2.id === exec.id ? { ...ex2, status: e.target.value } : ex2))}
                                className={`text-xs font-bold border-2 rounded-lg px-2 py-1 focus:outline-none focus:border-orange-500 ${
                                  exec.status === "Available" ? "border-emerald-200 text-emerald-700 bg-emerald-50"
                                  : exec.status === "Busy"   ? "border-amber-200 text-amber-700 bg-amber-50"
                                  :                            "border-gray-200 text-gray-500 bg-gray-100"
                                }`}
                              >
                                <option>Available</option>
                                <option>Busy</option>
                                <option>Offline</option>
                              </select>
                            </td>
                            <td className="px-4 py-3 text-gray-500 text-xs">{exec.email}</td>
                            <td className="px-4 py-3 font-black text-blue-600">{ex.filter(t => t.status === "Open").length}</td>
                            <td className="px-4 py-3 font-black text-amber-600">{ex.filter(t => t.status === "In Progress").length}</td>
                            <td className="px-4 py-3 font-black text-emerald-600">{ex.filter(t => t.status === "Resolved" || t.status === "Closed").length}</td>
                            <td className="px-4 py-3 font-black text-gray-800">{exec.ticketCount}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <button onClick={() => removeExecutive(exec.id)} className="text-xs text-red-400 hover:underline font-semibold">Remove</button>
                                <button onClick={() => { setTerminateModal(exec); setTerminateReason(""); }} className="text-xs bg-red-600 hover:bg-red-700 text-white font-bold px-2.5 py-1 rounded-lg transition-colors">🚫 Terminate</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {executivesWithCounts.length === 0 && (
                    <div className="text-center py-12 text-gray-400 text-sm">No executives yet. Add one above.</div>
                  )}
                </div>
              )}

              {/* ── WORKLOAD VIEW ── */}
              {execView === "workload" && (
                <div className="space-y-3">
                  {/* Legend */}
                  <div className="flex items-center gap-4 flex-wrap text-xs font-semibold">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-400 inline-block" /> Open</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-400 inline-block" /> In Progress</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-400 inline-block" /> Resolved / Closed</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-gray-200 inline-block" /> Capacity remaining</span>
                  </div>

                  {executivesWithCounts.map(exec => {
                    const ex        = tickets.filter(t => t.assignedId === exec.id);
                    const open      = ex.filter(t => t.status === "Open").length;
                    const inProg    = ex.filter(t => t.status === "In Progress").length;
                    const resolved  = ex.filter(t => t.status === "Resolved" || t.status === "Closed").length;
                    const total     = ex.length;
                    const capacity  = Math.max(total, 10);
                    const pct       = (n) => `${Math.round((n / capacity) * 100)}%`;
                    const load      = total === 0 ? "No load" : total <= 3 ? "Light" : total <= 7 ? "Moderate" : "Heavy";
                    const loadColor = total === 0 ? "text-gray-400" : total <= 3 ? "text-emerald-600" : total <= 7 ? "text-amber-600" : "text-red-500";
                    return (
                      <div key={exec.id} className="bg-white rounded-xl border border-gray-200 p-5">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-9 h-9 rounded-full bg-orange-100 text-orange-700 font-bold text-xs flex items-center justify-center flex-shrink-0">{getInitials(exec.name)}</div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold text-gray-800 text-sm">{exec.name}</p>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                                exec.status === "Available" ? "bg-emerald-100 text-emerald-700"
                                : exec.status === "Busy"   ? "bg-amber-100 text-amber-700"
                                :                            "bg-gray-100 text-gray-500"
                              }`}>{exec.status}</span>
                              <span className={`text-xs font-bold ml-auto ${loadColor}`}>{load} · {total} ticket{total !== 1 ? "s" : ""}</span>
                            </div>
                            <p className="text-xs text-gray-400">{exec.role || "Agent"}</p>
                          </div>
                        </div>

                        {/* Stacked progress bar */}
                        <div className="w-full h-5 rounded-full overflow-hidden bg-gray-100 flex">
                          {open    > 0 && <div style={{ width: pct(open) }}    className="bg-blue-400 h-full transition-all" title={`Open: ${open}`} />}
                          {inProg  > 0 && <div style={{ width: pct(inProg) }}  className="bg-amber-400 h-full transition-all" title={`In Progress: ${inProg}`} />}
                          {resolved > 0 && <div style={{ width: pct(resolved) }} className="bg-emerald-400 h-full transition-all" title={`Resolved: ${resolved}`} />}
                        </div>

                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span className="text-blue-600 font-semibold">{open} open</span>
                          <span className="text-amber-600 font-semibold">{inProg} in progress</span>
                          <span className="text-emerald-600 font-semibold">{resolved} resolved</span>
                          <span className="ml-auto">
                            <select
                              value={exec.status}
                              onChange={e => saveExecs(executives.map(ex2 => ex2.id === exec.id ? { ...ex2, status: e.target.value } : ex2))}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-orange-500"
                            >
                              <option>Available</option>
                              <option>Busy</option>
                              <option>Offline</option>
                            </select>
                          </span>
                          <button
                            onClick={() => { setTerminateModal(exec); setTerminateReason(""); }}
                            className="text-xs bg-red-600 hover:bg-red-700 text-white font-bold px-2.5 py-1 rounded-lg transition-colors"
                          >🚫 Terminate</button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Unassigned bar */}
                  {(() => {
                    const unassigned = tickets.filter(t => !t.assignedId || t.assignedTo === "Unassigned").length;
                    if (!unassigned) return null;
                    return (
                      <div className="bg-red-50 border-2 border-dashed border-red-200 rounded-xl p-5">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-bold text-red-600">⚠ Unassigned Pool</p>
                          <span className="text-xs font-black text-red-500">{unassigned} ticket{unassigned !== 1 ? "s" : ""}</span>
                        </div>
                        <div className="w-full h-5 rounded-full bg-red-200 overflow-hidden">
                          <div className="bg-red-400 h-full animate-pulse" style={{ width: "100%" }} />
                        </div>
                        <p className="text-xs text-red-400 mt-2">Switch to Cards view to assign these to an executive.</p>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* ── Terminated Employees Log ── */}
              {terminatedExecs.length > 0 && (
                <div className="bg-white rounded-xl border border-red-200 overflow-hidden">
                  <div className="flex items-center gap-2 px-5 py-3 bg-red-50 border-b border-red-200">
                    <span className="text-base">🚫</span>
                    <p className="text-xs font-bold text-red-600 uppercase tracking-widest">Terminated Excecutives ({terminatedExecs.length})</p>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {terminatedExecs.map((ex, i) => (
                      <div key={i} className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                        <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center text-red-400 font-bold text-xs flex-shrink-0">
                          {getInitials(ex.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-gray-700 line-through">{ex.name}</p>
                            <span className="text-xs bg-red-100 text-red-600 font-semibold px-2 py-0.5 rounded-full border border-red-200">Terminated</span>
                          </div>
                          <p className="text-xs text-gray-400">{ex.role || "Agent"} · {ex.email}</p>
                          <p className="text-xs text-red-500 font-semibold mt-1">📋 Reason: {ex.reason}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            🕐 {new Date(ex.terminatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} at {new Date(ex.terminatedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                            {ex.ticketsHeld > 0 && ` · ⚠ ${ex.ticketsHeld} ticket(s) were unassigned`}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            const updated = terminatedExecs.filter((_, idx) => idx !== i);
                            setTerminatedExecs(updated);
                            localStorage.setItem("terminatedExecs", JSON.stringify(updated));
                          }}
                          className="text-xs text-gray-300 hover:text-gray-500 flex-shrink-0 font-bold"
                          title="Remove from log"
                        >✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* ═══════════════════ CALLS TAB ═══════════════════ */}
          {activeTab === "📞 Calls" && (
            <div className="space-y-5">

              {/* Sub-view switcher */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                  {[["live","🔴 Live"],["log","📋 Log"],["stats","📊 Stats"]].map(([v,label]) => (
                    <button key={v} onClick={() => setCallView(v)}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${callView === v ? "bg-white shadow text-orange-700" : "text-gray-500 hover:text-gray-700"}`}>
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse inline-block"></span>
                  {inboundQueue.length} waiting · {callLog.length} total calls today
                </div>
              </div>

              {/* ── LIVE VIEW ── */}
              {callView === "live" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                  {/* LEFT: Inbound Queue + Dialer */}
                  <div className="space-y-4">

                    {/* Inbound Queue */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-red-50 to-orange-50 border-b border-gray-100">
                        <span className="text-base">📥</span>
                        <p className="text-xs font-bold text-gray-700 uppercase tracking-widest">Inbound Queue</p>
                        {inboundQueue.length > 0 && (
                          <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">{inboundQueue.length}</span>
                        )}
                      </div>
                      {inboundQueue.length === 0 ? (
                        <div className="px-5 py-8 text-center">
                          <p className="text-3xl mb-2">📵</p>
                          <p className="text-sm text-gray-400 font-medium">No incoming calls</p>
                          <p className="text-xs text-gray-300 mt-1">Simulated calls arrive every 40–80 seconds</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-50">
                          {inboundQueue.map((call) => (
                            <div key={call.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-black text-sm flex-shrink-0">
                                {call.name[0]}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-gray-800">{call.name}</p>
                                <p className="text-xs text-gray-400">{call.number}</p>
                                <p className="text-xs text-orange-500 font-semibold mt-0.5">
                                  ⏱ Waiting {Math.floor((Date.now() - call.arrivedAt) / 1000)}s
                                </p>
                              </div>
                              <div className="flex gap-2 flex-shrink-0">
                                <button
                                  onClick={() => answerCall(call)}
                                  disabled={!!activeCall}
                                  className="bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
                                >✆ Answer</button>
                                <button
                                  onClick={() => rejectCall(call.id)}
                                  className="bg-red-100 hover:bg-red-200 text-red-600 text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
                                >✕</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Outbound Dialer */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100">
                        <span className="text-base">📤</span>
                        <p className="text-xs font-bold text-gray-700 uppercase tracking-widest">Outbound Dialer</p>
                      </div>
                      <div className="p-5">
                        {/* Number display */}
                        <div className="bg-gray-900 rounded-xl px-4 py-3 text-center mb-4">
                          <p className="text-white text-xl font-mono tracking-widest min-h-[28px]">
                            {dialNumber || <span className="text-gray-600 text-base">Enter number...</span>}
                          </p>
                        </div>
                        {/* Numpad */}
                        <div className="grid grid-cols-3 gap-2 mb-4">
                          {["1","2","3","4","5","6","7","8","9","*","0","#"].map(k => (
                            <button key={k}
                              onClick={() => setDialNumber(p => p + k)}
                              className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-lg py-3 rounded-xl transition-all active:scale-95">
                              {k}
                            </button>
                          ))}
                        </div>
                        {/* Actions */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => setDialNumber(p => p.slice(0,-1))}
                            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-bold py-2.5 rounded-xl transition-colors">
                            ⌫
                          </button>
                          <button
                            onClick={dialOut}
                            disabled={!dialNumber.trim() || !!activeCall}
                            className="flex-[2] bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold py-2.5 rounded-xl transition-all">
                            📞 Call
                          </button>
                          <button
                            onClick={() => setDialNumber("")}
                            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-500 text-sm font-bold py-2.5 rounded-xl transition-colors">
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT: Active Call Panel */}
                  <div>
                    {activeCall ? (
                      <div className="bg-white rounded-2xl border-2 border-orange-200 shadow-lg overflow-hidden">
                        <div className="bg-gradient-to-r from-orange-600 to-emerald-600 px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white font-black text-lg">
                              {activeCall.name[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-white font-black text-base leading-tight">{activeCall.name}</p>
                              <p className="text-orange-200 text-xs">{activeCall.number}</p>
                              <p className="text-white/80 text-xs mt-0.5">
                                {activeCall.direction === "inbound" ? "📥 Inbound" : "📤 Outbound"}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-white font-mono text-xl font-bold">{fmtDuration(callTimer)}</p>
                              <p className="text-orange-200 text-xs">Connected</p>
                            </div>
                          </div>
                          {(callMuted || callOnHold) && (
                            <div className="flex gap-2 mt-3">
                              {callMuted   && <span className="bg-white/20 text-white text-xs font-bold px-2.5 py-1 rounded-full">🔇 Muted</span>}
                              {callOnHold  && <span className="bg-yellow-400/30 text-white text-xs font-bold px-2.5 py-1 rounded-full">⏸ On Hold</span>}
                            </div>
                          )}
                        </div>

                        <div className="p-5 space-y-4">
                          {/* Controls */}
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => setCallMuted(m => !m)}
                              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all ${callMuted ? "bg-orange-100 text-orange-700 border-2 border-orange-200" : "bg-gray-100 hover:bg-gray-200 text-gray-600"}`}>
                              {callMuted ? "🔇 Unmute" : "🎙 Mute"}
                            </button>
                            <button
                              onClick={() => setCallOnHold(h => !h)}
                              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all ${callOnHold ? "bg-yellow-100 text-yellow-700 border-2 border-yellow-200" : "bg-gray-100 hover:bg-gray-200 text-gray-600"}`}>
                              {callOnHold ? "▶ Resume" : "⏸ Hold"}
                            </button>
                            <button
                              onClick={() => {
                                const to = prompt("Transfer to (executive name or number):");
                                if (to) { window.alert(`📞 Call transferred to ${to}`); hangUp("Transferred"); }
                              }}
                              className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold text-sm transition-all">
                              ↗ Transfer
                            </button>
                            <button
                              onClick={() => hangUp("Completed")}
                              className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm transition-all">
                              📵 Hang Up
                            </button>
                          </div>

                          {/* Notes */}
                          <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Call Notes</label>
                            <textarea
                              rows={4}
                              value={callNote}
                              onChange={e => setCallNote(e.target.value)}
                              placeholder="Type notes during the call..."
                              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:border-orange-400 transition-colors resize-none"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm h-full min-h-64 flex flex-col items-center justify-center gap-3 p-8">
                        <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center text-4xl">📞</div>
                        <p className="text-gray-600 font-bold text-base">No Active Call</p>
                        <p className="text-gray-400 text-sm text-center">Answer an incoming call or dial a number to get started</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── LOG VIEW ── */}
              {callView === "log" && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100">
                    <span>📋</span>
                    <p className="text-xs font-bold text-gray-700 uppercase tracking-widest">Call History</p>
                    <span className="ml-auto text-xs text-gray-400">{callLog.length} records</span>
                  </div>
                  {callLog.length === 0 ? (
                    <div className="px-5 py-12 text-center">
                      <p className="text-3xl mb-2">📭</p>
                      <p className="text-sm text-gray-400">No call records yet</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Direction</th>
                            <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Caller</th>
                            <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Number</th>
                            <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Outcome</th>
                            <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Duration</th>
                            <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Time</th>
                            <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {[...callLog].reverse().map((c) => (
                            <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3">
                                {c.direction === "inbound"
                                  ? <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">📥 In</span>
                                  : <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-0.5 rounded-full">📤 Out</span>
                                }
                              </td>
                              <td className="px-4 py-3 font-semibold text-gray-800">{c.name}</td>
                              <td className="px-4 py-3 text-gray-500 font-mono text-xs">{c.number}</td>
                              <td className="px-4 py-3">
                                {c.outcome === "Completed"   && <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-0.5 rounded-full">✅ Completed</span>}
                                {c.outcome === "Missed"      && <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">❌ Missed</span>}
                                {c.outcome === "Rejected"    && <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-0.5 rounded-full">🚫 Rejected</span>}
                                {c.outcome === "Transferred" && <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">↗ Transferred</span>}
                                {!["Completed","Missed","Rejected","Transferred"].includes(c.outcome) && <span className="text-gray-400 text-xs">{c.outcome}</span>}
                              </td>
                              <td className="px-4 py-3 font-mono text-gray-600 text-xs">{fmtDuration(c.duration || 0)}</td>
                              <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                                {new Date(c.endedAt).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}
                              </td>
                              <td className="px-4 py-3 text-gray-500 text-xs max-w-[150px] truncate" title={c.note}>{c.note || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── STATS VIEW ── */}
              {callView === "stats" && (
                <div className="space-y-5">
                  {/* Top metric cards */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {[
                      { label: "Total Calls",    value: callStats.total,       icon: "📞", color: "blue"   },
                      { label: "Answered",       value: callStats.answered,    icon: "✅", color: "orange"  },
                      { label: "Missed",         value: callStats.missed,      icon: "❌", color: "red"    },
                      { label: "Answer Rate",    value: callStats.answerRate + "%", icon: "📈", color: "emerald" },
                      { label: "Avg Duration",   value: fmtDuration(callStats.avgDur), icon: "⏱", color: "purple" },
                      { label: "Inbound",        value: callStats.inbound,     icon: "📥", color: "indigo" },
                    ].map(({ label, value, icon, color }) => (
                      <div key={label} className={`bg-white rounded-2xl border border-${color}-100 shadow-sm p-4 text-center`}>
                        <p className="text-2xl mb-1">{icon}</p>
                        <p className={`text-2xl font-black text-${color}-600`}>{value}</p>
                        <p className="text-xs text-gray-400 font-semibold mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Inbound vs Outbound breakdown */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Call Direction Breakdown</p>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-xs font-semibold text-gray-600 mb-1">
                          <span>📥 Inbound</span>
                          <span>{callStats.inbound} calls ({callStats.total ? Math.round((callStats.inbound/callStats.total)*100) : 0}%)</span>
                        </div>
                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-400 rounded-full transition-all"
                            style={{ width: callStats.total ? `${(callStats.inbound/callStats.total)*100}%` : "0%" }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs font-semibold text-gray-600 mb-1">
                          <span>📤 Outbound</span>
                          <span>{callStats.outbound} calls ({callStats.total ? Math.round((callStats.outbound/callStats.total)*100) : 0}%)</span>
                        </div>
                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-purple-400 rounded-full transition-all"
                            style={{ width: callStats.total ? `${(callStats.outbound/callStats.total)*100}%` : "0%" }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs font-semibold text-gray-600 mb-1">
                          <span>❌ Missed / Rejected</span>
                          <span>{callStats.missed} calls ({callStats.total ? Math.round((callStats.missed/callStats.total)*100) : 0}%)</span>
                        </div>
                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-red-400 rounded-full transition-all"
                            style={{ width: callStats.total ? `${(callStats.missed/callStats.total)*100}%` : "0%" }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recent activity */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-100">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Recent Activity</p>
                    </div>
                    {callLog.length === 0 ? (
                      <div className="px-5 py-8 text-center text-sm text-gray-400">No calls recorded yet</div>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {[...callLog].reverse().slice(0,8).map(c => (
                          <div key={c.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                            <span className="text-lg">{c.direction === "inbound" ? "📥" : "📤"}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-800">{c.name}</p>
                              <p className="text-xs text-gray-400">{c.number}</p>
                            </div>
                            <div className="text-right">
                              <p className={`text-xs font-bold ${c.outcome === "Completed" ? "text-orange-600" : c.outcome === "Missed" ? "text-red-500" : "text-orange-500"}`}>
                                {c.outcome}
                              </p>
                              <p className="text-xs text-gray-400 font-mono">{fmtDuration(c.duration || 0)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      </main>

      {/* ── Executive Login Modal ── */}
      {showExecLogin && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50" onClick={() => setShowExecLogin(false)} />
          <div className="fixed z-50 bg-white rounded-2xl shadow-2xl border-2 border-indigo-200 w-full max-w-sm p-6"
            style={{ top: "50%", left: "50%", transform: "translate(-50%,-50%)" }}
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-2xl flex-shrink-0">🔑</div>
              <div>
                <p className="font-black text-gray-900 text-base">Executive Login</p>
                <p className="text-xs text-gray-400">Enter your access key to continue</p>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5">Access Key</label>
              <input
                type="password"
                value={execLoginKey}
                onChange={e => { setExecLoginKey(e.target.value); setExecLoginError(""); }}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    const matched = executives.find(ex => ex.accessKey === execLoginKey.trim());
                    if (!matched) { setExecLoginError("Invalid access key. Please try again."); return; }
                    const session = { id: matched.id, name: matched.name, role: matched.role, loginAt: new Date().toISOString() };
                    setExecSession(session);
                    localStorage.setItem("execSession", JSON.stringify(session));
                    setShowExecLogin(false);
                  }
                }}
                placeholder="Enter your access key..."
                className={`w-full border-2 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none transition-colors ${execLoginError ? "border-red-400 bg-red-50" : "border-gray-200 focus:border-indigo-500"}`}
                autoFocus
              />
              {execLoginError && <p className="text-red-500 text-xs mt-1.5 font-semibold">{execLoginError}</p>}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowExecLogin(false)}
                className="flex-1 border-2 border-gray-200 text-gray-600 font-bold text-sm py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
              >Cancel</button>
              <button
                onClick={() => {
                  const matched = executives.find(ex => ex.accessKey === execLoginKey.trim());
                  if (!matched) { setExecLoginError("Invalid access key. Please try again."); return; }
                  const session = { id: matched.id, name: matched.name, role: matched.role, loginAt: new Date().toISOString() };
                  setExecSession(session);
                  localStorage.setItem("execSession", JSON.stringify(session));
                  setShowExecLogin(false);
                }}
                disabled={!execLoginKey.trim()}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm py-2.5 rounded-xl transition-all"
              >Sign In</button>
            </div>
          </div>
        </>
      )}

      {/* ── Termination Confirmation Modal ── */}
      {terminateModal && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50" onClick={() => { setTerminateModal(null); setTerminateReason(""); }} />
          <div className="fixed z-50 bg-white rounded-2xl shadow-2xl border-2 border-red-200 w-full max-w-md p-6"
            style={{ top: "50%", left: "50%", transform: "translate(-50%,-50%)" }}
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-2xl flex-shrink-0">⚠️</div>
              <div>
                <p className="font-black text-gray-900 text-base">Terminate Employee</p>
                <p className="text-xs text-gray-400">This action cannot be undone</p>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-red-200 flex items-center justify-center text-red-700 font-bold text-sm flex-shrink-0">
                  {getInitials(terminateModal.name)}
                </div>
                <div>
                  <p className="font-bold text-gray-800 text-sm">{terminateModal.name}</p>
                  <p className="text-xs text-gray-500">{terminateModal.role || "Agent"} · {terminateModal.email}</p>
                  <p className="text-xs text-red-500 font-semibold mt-0.5">
                    {tickets.filter(t => t.assignedId === terminateModal.id).length} assigned ticket(s) will become Unassigned
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5">
                Reason for Termination <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3} placeholder="e.g. Performance issues, contract ended, restructuring..."
                value={terminateReason}
                onChange={e => setTerminateReason(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-red-400 transition-colors resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setTerminateModal(null); setTerminateReason(""); }}
                className="flex-1 border-2 border-gray-200 text-gray-600 font-bold text-sm py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
              >Cancel</button>
              <button
                onClick={doTerminate}
                disabled={!terminateReason.trim()}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm py-2.5 rounded-xl transition-all"
              >Terminate Employee</button>
            </div>
          </div>
        </>
      )}

      {/* ── Mitra Chat ── */}
      <MitraChat
        openTrigger={mitraOpen}
        initialGreeting="Hi! I'm Mitra 🤖 I can help you raise a support ticket, check FAQs, or connect you to the right channel. What do you need?"
        quickActions={[
          { icon: "🎫", label: "New Ticket",       command: "ticket",    onClick: () => setActiveTab("New Ticket"),        reply: "Opening the ticket form..." },
          { icon: "📋", label: "My Tickets",        command: "my ticket", onClick: () => setActiveTab("My Tickets"),        reply: "Showing your tickets..." },
          { icon: "📞", label: "Callback",          command: "callback",  onClick: () => setActiveTab("Callback"),          reply: "Opening callback scheduler..." },
          { icon: "❓", label: "FAQ",               command: "faq",       onClick: () => setActiveTab("FAQ"),               reply: "Opening FAQ..." },
          { icon: "💬", label: "Channels",          command: "channel",   onClick: () => setActiveTab("Contact Channels"),  reply: "Showing all contact channels..." },
          { icon: "👤", label: "Add Patient",       command: "add patient",
            chatFlow: ({ botReply, setChatStep }) => { botReply("Sure! Enter the patient's full name."); setChatStep("askName"); }
          },
          { icon: "🏠", label: "Dashboard",         command: "dashboard", onClick: () => setActiveTab("Dashboard"),         reply: "Going to dashboard..." },
        ]}
      />

    </div>
  );
}
