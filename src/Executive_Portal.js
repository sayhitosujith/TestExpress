import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import AppLogo from "./AppLogo";

const STATUS_STYLE = {
  Open:        "bg-blue-50 text-blue-700 border-blue-200",
  "In Progress":"bg-amber-50 text-amber-700 border-amber-100",
  Resolved:    "bg-emerald-50 text-emerald-700 border-emerald-100",
  Closed:      "bg-gray-100 text-gray-500 border-gray-200",
};
const PRIORITY_STYLE = {
  Low:      "bg-gray-50 text-gray-500 border-gray-200",
  Medium:   "bg-blue-50 text-blue-600 border-blue-100",
  High:     "bg-orange-50 text-orange-600 border-orange-100",
  Critical: "bg-red-50 text-red-600 border-red-200",
};

const TABS = ["🏠 Dashboard", "🎫 My Tickets", "📞 Calls", "💬 Chats", "⏰ Hours", "🎁 Incentives"];

/* Default incentive policy — an admin can override this by writing an
   "incentivePolicy" object to localStorage (same shape). Amounts are per unit. */
const DEFAULT_INCENTIVE_POLICY = {
  enabled:           true,  // feature flag — Team Lead can turn incentives off
  currency:          "₹",
  perResolvedTicket: 25,   // per resolved/closed ticket
  perAnsweredCall:   10,   // per answered call
  perChatHandled:    15,   // per chat accepted/closed
  answerRateTarget:  80,   // % — hit this to earn the bonus
  answerRateBonus:   200,
  hoursMetBonus:     150,  // for meeting today's mandatory hours
  tiers: [
    { label: "Bronze",   min: 0,    bonus: 0   },
    { label: "Silver",   min: 1000, bonus: 100 },
    { label: "Gold",     min: 2500, bonus: 300 },
    { label: "Platinum", min: 5000, bonus: 750 },
  ],
};

const FAKE_CALLERS = [
  { name: "Amit Joshi",   number: "+91 98200 11234" },
  { name: "Sneha Reddy",  number: "+91 91234 56789" },
  { name: "Vikram Nair",  number: "+91 80000 33210" },
  { name: "Pooja Menon",  number: "+91 70123 45678" },
  { name: "Ravi Gupta",   number: "+91 99887 76655" },
  { name: "Unknown",      number: "+91 88888 00000" },
];

const FAKE_CHATTERS = [
  { name: "Meera Iyer",    phone: "+91 90000 11111", msg: "Hi, I need help with my appointment." },
  { name: "Suresh Kumar",  phone: "+91 81234 56789", msg: "Can someone assist me with billing?" },
  { name: "Divya Nair",    phone: "+91 97000 22222", msg: "I have a question about my prescription." },
  { name: "Arjun Reddy",   phone: "+91 88900 33333", msg: "Need to reschedule my appointment ASAP." },
  { name: "Priya Pillai",  phone: "+91 76500 44444", msg: "Hello, is anyone available?" },
];

function fmtDuration(secs) {
  if (!secs) return "0:00";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getInitials(name = "") {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

export default function ExecutivePortal() {
  const navigate  = useNavigate();
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem("execSession") || "null"); } catch { return null; }
  });

  // Redirect to login if no session
  useEffect(() => {
    if (!session) navigate("/Executive_Login");
  }, [session, navigate]);

  const [activeTab, setActiveTab] = useState("🏠 Dashboard");
  const [hoursMetDismissed, setHoursMetDismissed] = useState(false); // exec chose to extend shift

  // ── Tickets ──
  const [tickets, setTickets] = useState(() => {
    try { return JSON.parse(localStorage.getItem("supportTickets") || "[]"); } catch { return []; }
  });
  useEffect(() => {
    const sync = () => {
      try { setTickets(JSON.parse(localStorage.getItem("supportTickets") || "[]")); } catch {}
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const myTickets = useMemo(() =>
    tickets.filter(t => t.assignedId === session?.id), [tickets, session]);

  const myStats = useMemo(() => ({
    total:      myTickets.length,
    open:       myTickets.filter(t => t.status === "Open").length,
    inProgress: myTickets.filter(t => t.status === "In Progress").length,
    resolved:   myTickets.filter(t => t.status === "Resolved" || t.status === "Closed").length,
  }), [myTickets]);

  const updateTicketStatus = (ticketId, newStatus) => {
    const all = JSON.parse(localStorage.getItem("supportTickets") || "[]");
    const updated = all.map(t =>
      t.id === ticketId ? { ...t, status: newStatus, updatedAt: new Date().toISOString() } : t
    );
    localStorage.setItem("supportTickets", JSON.stringify(updated));
    setTickets(updated);
  };

  // ── Calls ──
  const [callLog,      setCallLog]      = useState(() => {
    try { return JSON.parse(localStorage.getItem("callLog") || "[]"); } catch { return []; }
  });
  const [inboundQueue, setInboundQueue] = useState([]);
  const [activeCall,   setActiveCall]   = useState(null);
  const [callTimer,    setCallTimer]    = useState(0);
  const [dialNumber,   setDialNumber]   = useState("");
  const [callNote,     setCallNote]     = useState("");
  const [callMuted,    setCallMuted]    = useState(false);
  const [callOnHold,   setCallOnHold]   = useState(false);
  const [callView,     setCallView]     = useState("live");
  const callTimerRef  = useRef(null);
  const inboundSimRef = useRef(null);
  const chatSimRef    = useRef(null);

  // Persist call log
  useEffect(() => {
    localStorage.setItem("callLog", JSON.stringify(callLog));
  }, [callLog]);

  // Inbound call simulator
  useEffect(() => {
    const schedule = () => {
      const delay = 40000 + Math.random() * 40000;
      inboundSimRef.current = setTimeout(() => {
        const caller = FAKE_CALLERS[Math.floor(Math.random() * FAKE_CALLERS.length)];
        setInboundQueue(q => [...q, { ...caller, id: `CALL-${Date.now()}`, arrivedAt: Date.now() }]);
        schedule();
      }, delay);
    };
    schedule();
    return () => clearTimeout(inboundSimRef.current);
  }, []);

  // Inbound chat simulator — seeds one immediately, then every 60–120 s
  useEffect(() => {
    // seed one chat on mount if none are waiting
    const existing = JSON.parse(localStorage.getItem("liveChatSessions") || "{}");
    const hasWaiting = Object.values(existing).some(s => s.status === "waiting");
    if (!hasWaiting) {
      const visitor = FAKE_CHATTERS[0];
      const id = `chat_seed_${Date.now()}`;
      existing[id] = {
        id, customerName: visitor.name, customerPhone: visitor.phone,
        messages: [{ id: Date.now(), sender: "customer", senderName: visitor.name, text: visitor.msg, ts: Date.now() }],
        execId: null, execName: null, status: "waiting", startedAt: Date.now(),
      };
      localStorage.setItem("liveChatSessions", JSON.stringify(existing));
      setChatSessions({ ...existing });
    }

    const schedule = () => {
      const delay = 60000 + Math.random() * 60000;
      chatSimRef.current = setTimeout(() => {
        const visitor = FAKE_CHATTERS[Math.floor(Math.random() * FAKE_CHATTERS.length)];
        const id      = `chat_sim_${Date.now()}`;
        const session = {
          id,
          customerName:  visitor.name,
          customerPhone: visitor.phone,
          messages:      [{ id: Date.now(), sender: "customer", senderName: visitor.name, text: visitor.msg, ts: Date.now() }],
          execId:   null,
          execName: null,
          status:   "waiting",
          startedAt: Date.now(),
        };
        const all = JSON.parse(localStorage.getItem("liveChatSessions") || "{}");
        // only add if no existing waiting session from this visitor
        const alreadyWaiting = Object.values(all).some(s => s.customerPhone === visitor.phone && s.status === "waiting");
        if (!alreadyWaiting) {
          all[id] = session;
          localStorage.setItem("liveChatSessions", JSON.stringify(all));
          setChatSessions({ ...all });
        }
        schedule();
      }, delay);
    };
    schedule();
    return () => clearTimeout(chatSimRef.current);
  }, []);

  // Receive calls transferred/assigned by the Team Lead (shared "assignedCalls" queue)
  useEffect(() => {
    if (!session) return;
    const pull = () => {
      let list;
      try { list = JSON.parse(localStorage.getItem("assignedCalls") || "[]"); } catch { return; }
      if (!Array.isArray(list) || !list.length) return;
      const mine = list.filter(c => c.assignedToId === session.id);
      if (!mine.length) return;
      // claim them: remove mine from the shared queue
      localStorage.setItem("assignedCalls", JSON.stringify(list.filter(c => c.assignedToId !== session.id)));
      setInboundQueue(q => {
        const seen = new Set(q.map(c => c.id));
        const add = mine.filter(c => !seen.has(c.id)).map(c => ({
          id: c.id, name: c.name, number: c.number, arrivedAt: Date.now(), transferredBy: c.fromLead,
        }));
        return add.length ? [...q, ...add] : q;
      });
    };
    pull();
    const iv = setInterval(pull, 3000);
    const onStorage = (e) => { if (e.key === "assignedCalls") pull(); };
    window.addEventListener("storage", onStorage);
    return () => { clearInterval(iv); window.removeEventListener("storage", onStorage); };
  }, [session]);

  // Call timer
  useEffect(() => {
    if (activeCall) {
      callTimerRef.current = setInterval(() => setCallTimer(t => t + 1), 1000);
    } else {
      clearInterval(callTimerRef.current);
      setCallTimer(0);
    }
    return () => clearInterval(callTimerRef.current);
  }, [activeCall]);

  const publishActiveCall = (call) => {
    if (!session) return;
    const beats = JSON.parse(localStorage.getItem("execActiveCalls") || "{}");
    beats[session.id] = {
      execId: session.id, execName: session.name,
      callId: call.id, name: call.name, number: call.number,
      direction: call.direction, startedAt: call.startedAt ?? Date.now(),
    };
    localStorage.setItem("execActiveCalls", JSON.stringify(beats));
  };

  const clearActiveCall = () => {
    if (!session) return;
    const beats = JSON.parse(localStorage.getItem("execActiveCalls") || "{}");
    delete beats[session.id];
    localStorage.setItem("execActiveCalls", JSON.stringify(beats));
  };

  const answerCall = (call) => {
    setInboundQueue(q => q.filter(c => c.id !== call.id));
    const resolved = { ...call, direction: "inbound", startedAt: Date.now() };
    setActiveCall(resolved);
    publishActiveCall(resolved);
    setCallNote("");
  };

  const rejectCall = (id) => {
    const call = inboundQueue.find(c => c.id === id);
    if (call) {
      setCallLog(prev => [...prev, { ...call, direction: "inbound", outcome: "Missed", duration: 0, note: "", endedAt: new Date().toISOString() }]);
    }
    setInboundQueue(q => q.filter(c => c.id !== id));
  };

  const hangUp = (outcome = "Completed") => {
    if (!activeCall) return;
    setCallLog(prev => [...prev, { ...activeCall, outcome, duration: callTimer, note: callNote, endedAt: new Date().toISOString() }]);
    clearActiveCall();
    setActiveCall(null);
    setCallMuted(false);
    setCallOnHold(false);
    setCallNote("");
  };

  const dialOut = () => {
    if (!dialNumber.trim() || activeCall) return;
    const call = { name: "Outbound", number: dialNumber.trim(), direction: "outbound", id: `OUT-${Date.now()}`, startedAt: Date.now() };
    setActiveCall(call);
    publishActiveCall(call);
    setDialNumber("");
    setCallNote("");
  };

  const callStats = useMemo(() => {
    const total    = callLog.length;
    const answered = callLog.filter(c => c.outcome === "Completed" || c.outcome === "Transferred").length;
    const missed   = callLog.filter(c => c.outcome === "Missed" || c.outcome === "Rejected").length;
    const inbound  = callLog.filter(c => c.direction === "inbound").length;
    const outbound = callLog.filter(c => c.direction === "outbound").length;
    const durations = callLog.filter(c => c.duration > 0).map(c => c.duration);
    const avgDur   = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
    return { total, answered, missed, inbound, outbound, avgDur, answerRate: total ? Math.round((answered / total) * 100) : 0 };
  }, [callLog]);

  // ── Live Chat ──
  const [chatSessions,  setChatSessions]  = useState(() => {
    try { return JSON.parse(localStorage.getItem("liveChatSessions") || "{}"); } catch { return {}; }
  });
  const [activeChatId,  setActiveChatId]  = useState(null);
  const [chatReply,     setChatReply]     = useState("");
  const execChatEndRef = useRef(null);

  useEffect(() => {
    const id = setInterval(() => {
      try { setChatSessions(JSON.parse(localStorage.getItem("liveChatSessions") || "{}")); } catch {}
    }, 2000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "liveChatSessions") {
        try { setChatSessions(JSON.parse(e.newValue || "{}")); } catch {}
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    execChatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatSessions, activeChatId]);

  const acceptChat = (chatId) => {
    const all = JSON.parse(localStorage.getItem("liveChatSessions") || "{}");
    if (!all[chatId]) return;
    all[chatId] = { ...all[chatId], execId: session.id, execName: session.name, status: "active" };
    localStorage.setItem("liveChatSessions", JSON.stringify(all));
    setChatSessions({ ...all });
    setActiveChatId(chatId);
  };

  const sendExecMsg = () => {
    if (!chatReply.trim() || !activeChatId) return;
    const all = JSON.parse(localStorage.getItem("liveChatSessions") || "{}");
    if (!all[activeChatId]) return;
    const msg = { id: Date.now(), sender: "exec", senderName: session.name, text: chatReply.trim(), ts: Date.now() };
    all[activeChatId] = { ...all[activeChatId], messages: [...all[activeChatId].messages, msg] };
    localStorage.setItem("liveChatSessions", JSON.stringify(all));
    setChatSessions({ ...all });
    setChatReply("");
  };

  const closeExecChat = (chatId) => {
    const all = JSON.parse(localStorage.getItem("liveChatSessions") || "{}");
    if (all[chatId]) { all[chatId] = { ...all[chatId], status: "closed" }; }
    localStorage.setItem("liveChatSessions", JSON.stringify(all));
    setChatSessions({ ...all });
    if (activeChatId === chatId) setActiveChatId(null);
  };

  const pendingChats = Object.values(chatSessions).filter(s => s.status === "waiting").length;
  const myChats      = Object.values(chatSessions).filter(s => s.execId === session?.id && s.status === "active");

  // ── Mandatory Hours (auto-tracked) ──
  const [mandatoryHours] = useState(() => {
    try { return JSON.parse(localStorage.getItem("mandatoryHours") || "{}"); } catch { return {}; }
  });
  const mountTimeMs    = useRef(Date.now());
  const baseHoursRef   = useRef((() => {
    try { return JSON.parse(localStorage.getItem("hoursLogged") || "{}")?.[session?.id] ?? 0; } catch { return 0; }
  })());
  const [liveLogged, setLiveLogged] = useState(baseHoursRef.current);

  // Tick every 60 s — updates hours + heartbeat so admin knows this exec is online
  useEffect(() => {
    if (!session) return;
    const tick = () => {
      const elapsed = (Date.now() - mountTimeMs.current) / 3600000;
      const total   = parseFloat((baseHoursRef.current + elapsed).toFixed(3));
      setLiveLogged(total);
      const stored  = JSON.parse(localStorage.getItem("hoursLogged") || "{}");
      localStorage.setItem("hoursLogged", JSON.stringify({ ...stored, [session.id]: total }));
      // heartbeat — stamp current timestamp so Contact Center knows we're online
      const beats = JSON.parse(localStorage.getItem("execOnlineSessions") || "{}");
      beats[session.id] = Date.now();
      localStorage.setItem("execOnlineSessions", JSON.stringify(beats));
    };
    tick(); // immediate on mount
    const id = setInterval(tick, 60000);
    return () => {
      clearInterval(id);
      // mark offline on unmount / logout
      const beats = JSON.parse(localStorage.getItem("execOnlineSessions") || "{}");
      delete beats[session.id];
      localStorage.setItem("execOnlineSessions", JSON.stringify(beats));
      // clear any active call so Team Lead barge-in panel disappears
      const activeCalls = JSON.parse(localStorage.getItem("execActiveCalls") || "{}");
      delete activeCalls[session.id];
      localStorage.setItem("execActiveCalls", JSON.stringify(activeCalls));
    };
  }, [session]);

  const myRequired = mandatoryHours[session?.id] ?? 8;
  const myLogged   = parseFloat(liveLogged.toFixed(2));
  const myPct      = Math.min(100, Math.round((myLogged / myRequired) * 100));
  const myMet      = myLogged >= myRequired;
  const sessionMins = Math.floor((Date.now() - mountTimeMs.current) / 60000);

  // ── Executive profile from localStorage ──
  const execInfo = useMemo(() => {
    const execs = JSON.parse(localStorage.getItem("supportExecutives") || "null") || [];
    return execs.find(e => e.id === session?.id) || session;
  }, [session]);

  // ── Incentives ──
  const chatsHandled = useMemo(() =>
    Object.values(chatSessions).filter(s =>
      s.execId === session?.id && (s.status === "active" || s.status === "closed")
    ).length,
  [chatSessions, session]);

  const readIncentivePolicy = () => {
    try {
      const stored = JSON.parse(localStorage.getItem("incentivePolicy") || "null");
      if (!stored) return DEFAULT_INCENTIVE_POLICY;
      return {
        ...DEFAULT_INCENTIVE_POLICY,
        ...stored,
        tiers: Array.isArray(stored.tiers) && stored.tiers.length ? stored.tiers : DEFAULT_INCENTIVE_POLICY.tiers,
      };
    } catch { return DEFAULT_INCENTIVE_POLICY; }
  };
  const [incentivePolicy, setIncentivePolicy] = useState(readIncentivePolicy);

  // Refresh when the Team Lead updates the policy (cross-tab storage event)
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "incentivePolicy") setIncentivePolicy(readIncentivePolicy());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const incentive = useMemo(() => {
    const p = incentivePolicy;
    const ticketEarn = myStats.resolved     * p.perResolvedTicket;
    const callEarn   = callStats.answered    * p.perAnsweredCall;
    const chatEarn   = chatsHandled          * p.perChatHandled;
    const rateMet    = callStats.total > 0 && callStats.answerRate >= p.answerRateTarget;
    const rateBonus  = rateMet ? p.answerRateBonus : 0;
    const hoursBonus = myMet ? p.hoursMetBonus : 0;
    const base       = ticketEarn + callEarn + chatEarn + rateBonus + hoursBonus;

    const tiers = [...p.tiers].sort((a, b) => a.min - b.min);
    let currentTier = tiers[0];
    for (const t of tiers) if (base >= t.min) currentTier = t;
    const nextTier  = tiers.find(t => t.min > base) || null;
    const tierBonus = currentTier?.bonus || 0;
    const total     = base + tierBonus;

    const progressToNext = nextTier
      ? Math.min(100, Math.round(((base - currentTier.min) / (nextTier.min - currentTier.min)) * 100))
      : 100;

    return { ticketEarn, callEarn, chatEarn, rateMet, rateBonus, hoursBonus, base, currentTier, nextTier, tierBonus, total, progressToNext };
  }, [incentivePolicy, myStats.resolved, callStats.answered, callStats.answerRate, callStats.total, chatsHandled, myMet]);

  const cur = incentivePolicy.currency;
  const incentivesEnabled = incentivePolicy.enabled !== false;
  const visibleTabs = TABS.filter(t => t !== "🎁 Incentives" || incentivesEnabled);

  // If incentives get disabled while the exec is on that tab, fall back to Dashboard
  useEffect(() => {
    if (!incentivesEnabled && activeTab === "🎁 Incentives") setActiveTab("🏠 Dashboard");
  }, [incentivesEnabled, activeTab]);

  const signOut = () => {
    // remove heartbeat + any active call so the Team Lead's counts drop immediately
    const beats = JSON.parse(localStorage.getItem("execOnlineSessions") || "{}");
    delete beats[session.id];
    localStorage.setItem("execOnlineSessions", JSON.stringify(beats));
    const activeCalls = JSON.parse(localStorage.getItem("execActiveCalls") || "{}");
    delete activeCalls[session.id];
    localStorage.setItem("execActiveCalls", JSON.stringify(activeCalls));
    localStorage.removeItem("execSession");
    navigate("/Executive_Login");
  };

  if (!session) return null;

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-indigo-50/40" style={{ fontFamily: "'Outfit', sans-serif" }}>

      {/* ── Sidebar ── */}
      <aside className="w-64 fixed left-0 top-0 h-full flex flex-col z-20 bg-white/80 backdrop-blur-xl border-r border-slate-200/70 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
        <div className="px-5 pt-6 pb-4 border-b border-slate-100"><AppLogo /></div>

        {/* Executive badge */}
        <div className="mx-3 mt-4 mb-2 rounded-2xl p-3 flex items-center gap-3 bg-gradient-to-br from-indigo-600 to-violet-600 shadow-lg shadow-indigo-600/20">
          <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white font-black text-sm flex-shrink-0 ring-2 ring-white/30">
            {getInitials(session.name)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate">{session.name}</p>
            <p className="text-xs text-indigo-100 font-medium">{session.role}</p>
            <span className="inline-flex items-center gap-1 mt-1 text-[10px] bg-white/20 text-white font-bold px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 bg-emerald-300 rounded-full animate-pulse"></span> Online
            </span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-1">
          {visibleTabs.map(tab => {
            const badge = tab === "💬 Chats" ? pendingChats : 0;
            const active = activeTab === tab;
            return (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`group w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-2 text-sm ${
                  active
                    ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/25 font-bold"
                    : "text-slate-600 hover:bg-slate-100 font-medium"
                }`}
              >
                <span className="flex-1">{tab}</span>
                {badge > 0 && (
                  <span className="bg-rose-500 text-white text-xs font-black px-1.5 py-0.5 rounded-full leading-none animate-pulse">{badge}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Incoming call indicator in sidebar */}
        {inboundQueue.length > 0 && (
          <div className="mx-3 mb-2 bg-rose-50 border border-rose-200 rounded-2xl p-3 animate-pulse">
            <p className="text-xs font-bold text-rose-600">📞 {inboundQueue.length} Incoming Call{inboundQueue.length > 1 ? "s" : ""}!</p>
            <button onClick={() => setActiveTab("📞 Calls")}
              className="mt-2 w-full bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold py-2 rounded-xl transition-colors">
              Answer Now
            </button>
          </div>
        )}

        {/* Incoming chat indicator in sidebar */}
        {pendingChats > 0 && (
          <div className="mx-3 mb-3 bg-sky-50 border border-sky-200 rounded-2xl p-3">
            <p className="text-xs font-bold text-sky-700">💬 {pendingChats} Chat{pendingChats > 1 ? "s" : ""} Waiting</p>
            <button onClick={() => setActiveTab("💬 Chats")}
              className="mt-2 w-full bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold py-2 rounded-xl transition-colors">
              Open Chats
            </button>
          </div>
        )}

        <div className="px-3 py-3 border-t border-slate-100">
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-rose-500 hover:bg-rose-50 transition-colors font-semibold"
          >🚪 Sign Out</button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="ml-64 flex-1 flex flex-col min-h-screen">

        {/* Header */}
        <header className="bg-white/70 backdrop-blur-xl border-b border-slate-200/70 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
          <div>
            <p className="text-[11px] text-indigo-500 uppercase tracking-[0.2em] font-bold mb-0.5">Executive Portal</p>
            <h1 className="text-xl font-bold text-slate-900">Welcome back, {session.name.split(" ")[0]} 👋</h1>
          </div>
          <div className="flex items-center gap-3">
            {activeCall && (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1.5">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                <span className="text-xs font-bold text-emerald-700">On Call · {fmtDuration(callTimer)}</span>
              </div>
            )}
            <div className="flex gap-2">
              {[
                { label: "Total",    value: myStats.total,      color: "text-slate-800" },
                { label: "Open",     value: myStats.open,       color: "text-sky-600" },
                { label: "Resolved", value: myStats.resolved,   color: "text-emerald-600" },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center px-3.5 py-1.5 bg-white rounded-xl border border-slate-200 shadow-sm">
                  <p className={`text-base font-black ${color}`}>{value}</p>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 p-6 space-y-5">

          {/* ══ LIVE ALERTS (highlighted, shown on every tab) ══ */}
          {(inboundQueue.length > 0 || pendingChats > 0) && (
            <div className="space-y-3">
              {inboundQueue.length > 0 && (
                <div
                  style={{ background: "linear-gradient(90deg, #f43f5e 0%, #e11d48 100%)", boxShadow: "0 10px 25px -5px rgba(225,29,72,0.4)" }}
                  className="flex items-center gap-4 rounded-2xl px-5 py-4 text-white">
                  <span className="flex items-center justify-center w-11 h-11 rounded-xl flex-shrink-0" style={{ background: "rgba(255,255,255,0.2)" }}>
                    <span className="text-2xl animate-bounce">📞</span>
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-extrabold text-base leading-tight" style={{ color: "#fff" }}>
                      {inboundQueue.length} incoming call{inboundQueue.length > 1 ? "s" : ""} waiting
                    </p>
                    <p className="text-sm truncate" style={{ color: "rgba(255,255,255,0.85)" }}>
                      {inboundQueue.slice(0, 3).map(c => c.name).join(", ")}{inboundQueue.length > 3 ? "…" : ""}
                    </p>
                  </div>
                  {activeTab !== "📞 Calls" && (
                    <button onClick={() => setActiveTab("📞 Calls")}
                      style={{ background: "#fff", color: "#e11d48" }}
                      className="text-sm font-bold px-4 py-2 rounded-xl shadow hover:shadow-md transition-all flex-shrink-0">
                      Answer Now →
                    </button>
                  )}
                </div>
              )}
              {pendingChats > 0 && (
                <div
                  style={{ background: "linear-gradient(90deg, #0ea5e9 0%, #4f46e5 100%)", boxShadow: "0 10px 25px -5px rgba(79,70,229,0.4)" }}
                  className="flex items-center gap-4 rounded-2xl px-5 py-4 text-white">
                  <span className="flex items-center justify-center w-11 h-11 rounded-xl flex-shrink-0" style={{ background: "rgba(255,255,255,0.2)" }}>
                    <span className="text-2xl animate-bounce">💬</span>
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-extrabold text-base leading-tight" style={{ color: "#fff" }}>
                      {pendingChats} chat{pendingChats > 1 ? "s" : ""} waiting for a response
                    </p>
                    <p className="text-sm" style={{ color: "rgba(255,255,255,0.85)" }}>A customer needs assistance.</p>
                  </div>
                  {activeTab !== "💬 Chats" && (
                    <button onClick={() => setActiveTab("💬 Chats")}
                      style={{ background: "#fff", color: "#4f46e5" }}
                      className="text-sm font-bold px-4 py-2 rounded-xl shadow hover:shadow-md transition-all flex-shrink-0">
                      Open Chats →
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ══ DASHBOARD ══ */}
          {activeTab === "🏠 Dashboard" && (
            <div className="space-y-5">

              {/* Stat cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "My Tickets",   value: myStats.total,      icon: "🎫", bar: "from-sky-500 to-blue-600",       ring: "bg-sky-50 text-sky-600"    },
                  { label: "Open",         value: myStats.open,       icon: "📂", bar: "from-amber-400 to-orange-500",   ring: "bg-amber-50 text-amber-600" },
                  { label: "In Progress",  value: myStats.inProgress, icon: "⚙️", bar: "from-violet-500 to-indigo-600",  ring: "bg-violet-50 text-violet-600"},
                  { label: "Resolved",     value: myStats.resolved,   icon: "✅", bar: "from-emerald-400 to-teal-600",   ring: "bg-emerald-50 text-emerald-600"},
                ].map(({ label, value, icon, bar, ring }) => (
                  <div key={label} className="group bg-white rounded-2xl p-5 border border-slate-200/70 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">{label}</p>
                      <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg ${ring}`}>{icon}</span>
                    </div>
                    <p className="text-3xl font-black text-slate-900">{value}</p>
                    <div className={`h-1.5 mt-3 rounded-full bg-gradient-to-r ${bar}`} />
                  </div>
                ))}
              </div>

              {/* Hours progress */}
              <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-bold text-slate-700">⏰ Today's Mandatory Hours</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse inline-block"></span>
                      <span className="text-xs text-slate-500 font-medium">Auto-tracking · session {sessionMins}m</span>
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${myMet ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {myMet ? "✅ Target Met" : `${myPct}% — ${Math.max(0, myRequired - myLogged).toFixed(2)}h left`}
                  </span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden mb-2">
                  <div className={`h-full rounded-full transition-all ${myMet ? "bg-gradient-to-r from-emerald-400 to-teal-500" : myPct >= 60 ? "bg-gradient-to-r from-amber-400 to-orange-500" : "bg-gradient-to-r from-rose-400 to-red-500"}`}
                    style={{ width: `${myPct}%` }} />
                </div>
                <p className="text-xs text-slate-400">
                  {myLogged}h logged of {myRequired}h required
                  {myMet && myLogged > myRequired && (
                    <span className="ml-1 font-semibold text-emerald-600">· +{(myLogged - myRequired).toFixed(2)}h overtime</span>
                  )}
                </p>

                {/* Target-met actions */}
                {myMet && !hoursMetDismissed && (
                  <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex flex-wrap items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-emerald-700">🎉 You've completed today's mandatory hours!</p>
                      <p className="text-xs text-emerald-600 mt-0.5">Sign out now, or extend your shift to keep working and earning incentives.</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => setHoursMetDismissed(true)}
                        className="text-sm font-bold px-4 py-2 rounded-xl border border-emerald-300 text-emerald-700 bg-white hover:bg-emerald-100 transition-colors">
                        ⏱ Extend Shift
                      </button>
                      <button
                        onClick={signOut}
                        style={{ background: "linear-gradient(90deg,#10b981,#0d9488)", color: "#fff" }}
                        className="text-sm font-bold px-4 py-2 rounded-xl shadow hover:shadow-md transition-all">
                        🚪 Log Out
                      </button>
                    </div>
                  </div>
                )}

                {/* Extended-shift indicator */}
                {myMet && hoursMetDismissed && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold text-amber-700">⏱ Shift extended — you're now in overtime. 💪</p>
                    <button
                      onClick={signOut}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg text-emerald-700 bg-white border border-emerald-300 hover:bg-emerald-50 transition-colors flex-shrink-0">
                      🚪 Log Out
                    </button>
                  </div>
                )}
              </div>

              {/* Recent tickets */}
              <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-bold text-slate-700">🎫 Recently Assigned Tickets</p>
                  <button onClick={() => setActiveTab("🎫 My Tickets")} className="text-xs text-indigo-600 hover:text-indigo-700 hover:underline font-semibold">View all →</button>
                </div>
                {myTickets.length === 0 ? (
                  <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-2xl">
                    <p className="text-3xl mb-2">🎉</p>
                    <p className="text-sm text-slate-400 font-semibold">No tickets assigned yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {myTickets.slice(0, 5).map(t => (
                      <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-white hover:border-indigo-200 hover:shadow-sm transition-all">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-slate-800 truncate">{t.subject}</p>
                          <p className="text-xs text-slate-400">{t.id} · {t.name} · {t.category}</p>
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

              {/* Call summary */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Total Calls",  value: callStats.total,       icon: "📞", color: "text-sky-600" },
                  { label: "Answer Rate",  value: callStats.answerRate + "%", icon: "📈", color: "text-emerald-600" },
                  { label: "Avg Duration", value: fmtDuration(callStats.avgDur), icon: "⏱", color: "text-violet-600" },
                ].map(({ label, value, icon, color }) => (
                  <div key={label} className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5 text-center hover:shadow-md transition-all">
                    <p className="text-2xl mb-1">{icon}</p>
                    <p className={`text-2xl font-black ${color}`}>{value}</p>
                    <p className="text-xs text-slate-400 font-semibold mt-1">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══ MY TICKETS ══ */}
          {activeTab === "🎫 My Tickets" && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">My Assigned Tickets ({myTickets.length})</p>
                </div>
                {myTickets.length === 0 ? (
                  <div className="py-16 text-center">
                    <p className="text-4xl mb-3">🎉</p>
                    <p className="text-sm font-bold text-slate-500">No tickets assigned to you</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {myTickets.map(t => (
                      <div key={t.id} className="p-5 hover:bg-slate-50/70 transition-colors">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-xs font-mono text-slate-400">{t.id}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${PRIORITY_STYLE[t.priority]}`}>{t.priority}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${STATUS_STYLE[t.status]}`}>{t.status}</span>
                            </div>
                            <p className="text-sm font-bold text-slate-800 mb-0.5">{t.subject}</p>
                            <p className="text-xs text-slate-500">{t.name} · {t.email}</p>
                            {t.message && <p className="text-xs text-slate-400 mt-1.5 bg-slate-50 rounded-lg p-2 border border-slate-100">{t.message}</p>}
                            <p className="text-xs text-slate-300 mt-2">
                              Created {new Date(t.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} at {new Date(t.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                          <div className="flex-shrink-0">
                            <label className="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wide">Update Status</label>
                            <select
                              value={t.status}
                              onChange={e => updateTicketStatus(t.id, e.target.value)}
                              className="border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:border-indigo-400 cursor-pointer bg-white"
                            >
                              <option>Open</option>
                              <option>In Progress</option>
                              <option>Resolved</option>
                              <option>Closed</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ CALLS ══ */}
          {activeTab === "📞 Calls" && (
            <div className="space-y-5">
              {/* Sub-view switcher */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex gap-1 bg-slate-200/60 rounded-xl p-1">
                  {[["live","🔴 Live"],["log","📋 Log"],["stats","📊 Stats"]].map(([v,label]) => (
                    <button key={v} onClick={() => setCallView(v)}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${callView === v ? "bg-white shadow-sm text-indigo-700" : "text-slate-500 hover:text-slate-700"}`}>
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
                  {inboundQueue.length} waiting · {callLog.length} total calls
                </div>
              </div>

              {/* LIVE */}
              {callView === "live" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div className="space-y-4">
                    {/* Inbound queue */}
                    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
                      <div className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-rose-50 to-white border-b border-slate-100">
                        <span>📥</span>
                        <p className="text-xs font-bold text-slate-700 uppercase tracking-widest">Inbound Queue</p>
                        {inboundQueue.length > 0 && <span className="ml-auto bg-rose-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">{inboundQueue.length}</span>}
                      </div>
                      {inboundQueue.length === 0 ? (
                        <div className="py-10 text-center">
                          <p className="text-3xl mb-2">📵</p>
                          <p className="text-sm text-slate-400 font-medium">No incoming calls</p>
                        </div>
                      ) : inboundQueue.map(call => (
                        <div key={call.id} className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-50 hover:bg-slate-50 transition-colors">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-400 to-orange-500 flex items-center justify-center text-white font-black text-sm flex-shrink-0 shadow-sm">{call.name[0]}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-800">{call.name}</p>
                            <p className="text-xs text-slate-400">{call.number}</p>
                            {call.transferredBy && (
                              <span className="inline-block mt-0.5 text-[10px] font-bold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full">↗ Assigned by {call.transferredBy}</span>
                            )}
                            <p className="text-xs text-rose-500 font-semibold">⏱ Waiting {Math.floor((Date.now() - call.arrivedAt) / 1000)}s</p>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => answerCall(call)} disabled={!!activeCall}
                              className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm">✆ Answer</button>
                            <button onClick={() => rejectCall(call.id)}
                              className="bg-rose-100 hover:bg-rose-200 text-rose-600 text-xs font-bold px-3 py-1.5 rounded-lg">✕</button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Outbound dialer */}
                    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
                      <div className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-sky-50 to-white border-b border-slate-100">
                        <span>📤</span>
                        <p className="text-xs font-bold text-slate-700 uppercase tracking-widest">Outbound Dialer</p>
                      </div>
                      <div className="p-5">
                        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl px-4 py-3.5 text-center mb-4 shadow-inner">
                          <p className="text-white text-xl font-mono tracking-widest min-h-[28px]">
                            {dialNumber || <span className="text-slate-500 text-base">Enter number...</span>}
                          </p>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mb-4">
                          {["1","2","3","4","5","6","7","8","9","*","0","#"].map(k => (
                            <button key={k} onClick={() => setDialNumber(p => p + k)}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-lg py-3 rounded-xl transition-all active:scale-95">{k}</button>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setDialNumber(p => p.slice(0,-1))} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-bold py-2.5 rounded-xl">⌫</button>
                          <button onClick={dialOut} disabled={!dialNumber.trim() || !!activeCall}
                            className="flex-[2] bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-40 text-white text-sm font-bold py-2.5 rounded-xl shadow-sm">📞 Call</button>
                          <button onClick={() => setDialNumber("")} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-500 text-sm font-bold py-2.5 rounded-xl">✕</button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Active call panel */}
                  <div>
                    {activeCall ? (
                      <div className="bg-white rounded-2xl border border-emerald-200 shadow-lg shadow-emerald-500/10 overflow-hidden">
                        <div className="bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700 px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white font-black text-lg ring-2 ring-white/30">{activeCall.name[0]}</div>
                            <div className="flex-1">
                              <p className="text-white font-black text-base">{activeCall.name}</p>
                              <p className="text-emerald-100 text-xs">{activeCall.number}</p>
                              <p className="text-white/80 text-xs">{activeCall.direction === "inbound" ? "📥 Inbound" : "📤 Outbound"}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-white font-mono text-xl font-bold">{fmtDuration(callTimer)}</p>
                              <p className="text-emerald-100 text-xs">Connected</p>
                            </div>
                          </div>
                          {(callMuted || callOnHold) && (
                            <div className="flex gap-2 mt-3">
                              {callMuted  && <span className="bg-white/20 text-white text-xs font-bold px-2.5 py-1 rounded-full">🔇 Muted</span>}
                              {callOnHold && <span className="bg-amber-300/30 text-white text-xs font-bold px-2.5 py-1 rounded-full">⏸ On Hold</span>}
                            </div>
                          )}
                        </div>
                        <div className="p-5 space-y-4">
                          <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => setCallMuted(m => !m)}
                              className={`py-2.5 rounded-xl font-bold text-sm transition-all ${callMuted ? "bg-indigo-100 text-indigo-700 border-2 border-indigo-200" : "bg-slate-100 hover:bg-slate-200 text-slate-600"}`}>
                              {callMuted ? "🔇 Unmute" : "🎙 Mute"}
                            </button>
                            <button onClick={() => setCallOnHold(h => !h)}
                              className={`py-2.5 rounded-xl font-bold text-sm transition-all ${callOnHold ? "bg-amber-100 text-amber-700 border-2 border-amber-200" : "bg-slate-100 hover:bg-slate-200 text-slate-600"}`}>
                              {callOnHold ? "▶ Resume" : "⏸ Hold"}
                            </button>
                            <button onClick={() => { const to = prompt("Transfer to:"); if (to) { window.alert(`Transferred to ${to}`); hangUp("Transferred"); } }}
                              className="py-2.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-600 font-bold text-sm transition-all">↗ Transfer</button>
                            <button onClick={() => hangUp("Completed")}
                              className="py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white font-bold text-sm transition-all shadow-sm">📵 Hang Up</button>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Call Notes</label>
                            <textarea rows={4} value={callNote} onChange={e => setCallNote(e.target.value)}
                              placeholder="Type notes during the call..."
                              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:border-emerald-400 resize-none" />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm h-full min-h-64 flex flex-col items-center justify-center gap-3 p-8">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-4xl">📞</div>
                        <p className="text-slate-600 font-bold">No Active Call</p>
                        <p className="text-slate-400 text-sm text-center">Answer an incoming call or dial out</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* LOG */}
              {callView === "log" && (
                <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
                  <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100 bg-slate-50/50">
                    <span>📋</span>
                    <p className="text-xs font-bold text-slate-700 uppercase tracking-widest">Call History</p>
                    <span className="ml-auto text-xs text-slate-400">{callLog.length} records</span>
                  </div>
                  {callLog.length === 0 ? (
                    <div className="py-12 text-center"><p className="text-3xl mb-2">📭</p><p className="text-sm text-slate-400">No call records yet</p></div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="bg-slate-50 border-b border-slate-100">
                          {["Dir","Caller","Number","Outcome","Duration","Time","Notes"].map(h => (
                            <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">{h}</th>
                          ))}
                        </tr></thead>
                        <tbody className="divide-y divide-slate-50">
                          {[...callLog].reverse().map(c => (
                            <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-3">
                                {c.direction === "inbound"
                                  ? <span className="bg-sky-100 text-sky-700 text-xs font-bold px-2 py-0.5 rounded-full">📥 In</span>
                                  : <span className="bg-violet-100 text-violet-700 text-xs font-bold px-2 py-0.5 rounded-full">📤 Out</span>}
                              </td>
                              <td className="px-4 py-3 font-semibold text-slate-800">{c.name}</td>
                              <td className="px-4 py-3 text-slate-500 font-mono text-xs">{c.number}</td>
                              <td className="px-4 py-3">
                                {c.outcome === "Completed"   && <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">✅ Completed</span>}
                                {c.outcome === "Missed"      && <span className="bg-rose-100 text-rose-700 text-xs font-bold px-2 py-0.5 rounded-full">❌ Missed</span>}
                                {c.outcome === "Rejected"    && <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">🚫 Rejected</span>}
                                {c.outcome === "Transferred" && <span className="bg-sky-100 text-sky-700 text-xs font-bold px-2 py-0.5 rounded-full">↗ Transferred</span>}
                              </td>
                              <td className="px-4 py-3 font-mono text-slate-600 text-xs">{fmtDuration(c.duration || 0)}</td>
                              <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{new Date(c.endedAt).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}</td>
                              <td className="px-4 py-3 text-slate-500 text-xs max-w-[150px] truncate" title={c.note}>{c.note || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* STATS */}
              {callView === "stats" && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {[
                      { label: "Total",       value: callStats.total,               icon: "📞", text: "text-sky-600",     bar: "from-sky-400 to-blue-600"    },
                      { label: "Answered",    value: callStats.answered,            icon: "✅", text: "text-emerald-600", bar: "from-emerald-400 to-teal-600"},
                      { label: "Missed",      value: callStats.missed,              icon: "❌", text: "text-rose-600",    bar: "from-rose-400 to-red-600"    },
                      { label: "Answer Rate", value: callStats.answerRate + "%",    icon: "📈", text: "text-teal-600",    bar: "from-teal-400 to-emerald-600"},
                      { label: "Avg Duration",value: fmtDuration(callStats.avgDur), icon: "⏱", text: "text-violet-600",  bar: "from-violet-400 to-indigo-600"},
                      { label: "Inbound",     value: callStats.inbound,             icon: "📥", text: "text-indigo-600",  bar: "from-indigo-400 to-blue-600" },
                    ].map(({ label, value, icon, text, bar }) => (
                      <div key={label} className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-4 text-center hover:shadow-md transition-all overflow-hidden">
                        <p className="text-2xl mb-1">{icon}</p>
                        <p className={`text-2xl font-black ${text}`}>{value}</p>
                        <p className="text-xs text-slate-400 font-semibold mt-0.5">{label}</p>
                        <div className={`h-1 mt-2.5 -mx-4 -mb-4 bg-gradient-to-r ${bar}`} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ CHATS ══ */}
          {activeTab === "💬 Chats" && (() => {
            const allSessions   = Object.values(chatSessions);
            const waitingList   = allSessions.filter(s => s.status === "waiting");
            const activeList    = allSessions.filter(s => s.execId === session.id && s.status === "active");
            const closedList    = allSessions.filter(s => s.execId === session.id && s.status === "closed");
            const currentChat   = activeChatId ? chatSessions[activeChatId] : null;
            const fmtTs = ts => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

            return (
              <div className="flex gap-5" style={{ height: "78vh" }}>

                {/* Left: chat list */}
                <div className="w-72 flex-shrink-0 flex flex-col gap-2 overflow-y-auto pr-1">

                  {/* Waiting */}
                  {waitingList.length > 0 && (
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50/50 border border-amber-200 rounded-2xl p-3 space-y-2">
                      <p className="text-xs font-black text-amber-700 uppercase tracking-wide">⏳ Waiting ({waitingList.length})</p>
                      {waitingList.map(s => (
                        <div key={s.id} className="bg-white rounded-xl border border-amber-200 p-3 shadow-sm">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div>
                              <p className="text-sm font-bold text-slate-800">{s.customerName}</p>
                              <p className="text-xs text-slate-400">{s.customerPhone}</p>
                            </div>
                            <span className="text-xs text-amber-600 font-semibold flex-shrink-0">
                              {Math.floor((Date.now() - s.startedAt) / 60000)}m ago
                            </span>
                          </div>
                          <button
                            onClick={() => acceptChat(s.id)}
                            className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-bold py-2 rounded-lg transition-all shadow-sm"
                          >Accept Chat</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* My active chats */}
                  {activeList.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-black text-slate-500 uppercase tracking-wide px-1">💬 My Active</p>
                      {activeList.map(s => {
                        const lastMsg = s.messages[s.messages.length - 1];
                        const unread  = s.messages.filter(m => m.sender === "customer").length;
                        return (
                          <button key={s.id}
                            onClick={() => setActiveChatId(s.id)}
                            className={`w-full text-left rounded-xl border-2 p-3 transition-all ${activeChatId === s.id ? "border-indigo-500 bg-indigo-50 shadow-sm" : "border-slate-200 bg-white hover:border-indigo-300"}`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-sm font-bold text-slate-800">{s.customerName}</p>
                              {unread > 0 && <span className="bg-rose-500 text-white text-xs font-black px-1.5 py-0.5 rounded-full">{unread}</span>}
                            </div>
                            <p className="text-xs text-slate-400 truncate">{lastMsg ? lastMsg.text : "No messages yet"}</p>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Closed */}
                  {closedList.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-black text-slate-400 uppercase tracking-wide px-1">✓ Closed</p>
                      {closedList.slice(0, 5).map(s => (
                        <button key={s.id}
                          onClick={() => setActiveChatId(s.id)}
                          className={`w-full text-left rounded-xl border-2 p-3 transition-all opacity-70 hover:opacity-100 ${activeChatId === s.id ? "border-slate-400 bg-slate-50" : "border-slate-200 bg-white"}`}
                        >
                          <p className="text-sm font-bold text-slate-700">{s.customerName}</p>
                          <p className="text-xs text-slate-400">{s.messages.length} messages</p>
                        </button>
                      ))}
                    </div>
                  )}

                  {waitingList.length === 0 && activeList.length === 0 && closedList.length === 0 && (
                    <div className="flex-1 flex flex-col items-center justify-center py-16 text-center gap-3">
                      <p className="text-3xl">💬</p>
                      <p className="text-sm font-semibold text-slate-400">No chats yet</p>
                      <p className="text-xs text-slate-300">Customers will appear here when they start a chat</p>
                    </div>
                  )}
                </div>

                {/* Right: chat window */}
                <div className="flex-1 flex flex-col min-w-0">
                  {!currentChat ? (
                    <div className="flex-1 bg-white rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center">
                      <div className="text-center">
                        <p className="text-3xl mb-2">💬</p>
                        <p className="text-sm font-semibold text-slate-400">Select a chat to view</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
                      {/* Chat header */}
                      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 flex-shrink-0">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                            {getInitials(currentChat.customerName)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-800">{currentChat.customerName}</p>
                            <p className="text-xs text-slate-400">{currentChat.customerPhone} · {currentChat.status === "active" ? "🟢 Active" : "⛔ Closed"}</p>
                          </div>
                        </div>
                        {currentChat.status === "active" && (
                          <button onClick={() => closeExecChat(activeChatId)}
                            className="text-xs bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold px-3 py-1.5 rounded-lg transition-colors"
                          >End Chat</button>
                        )}
                      </div>

                      {/* Messages */}
                      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                        {currentChat.messages.length === 0 && (
                          <div className="text-center py-8">
                            <p className="text-2xl mb-2">👋</p>
                            <p className="text-sm text-slate-400">No messages yet. Say hello!</p>
                          </div>
                        )}
                        {currentChat.messages.map(m => {
                          const isExec = m.sender === "exec";
                          return (
                            <div key={m.id} className={`flex ${isExec ? "justify-end" : "justify-start"}`}>
                              <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                                isExec ? "bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-br-sm" : "bg-white text-slate-800 border border-slate-200 rounded-bl-sm"
                              }`}>
                                {!isExec && <p className="text-xs font-bold text-indigo-600 mb-1">{m.senderName}</p>}
                                <p>{m.text}</p>
                                <p className={`text-xs mt-1 ${isExec ? "text-indigo-200" : "text-slate-400"}`}>{fmtTs(m.ts)}</p>
                              </div>
                            </div>
                          );
                        })}
                        <div ref={execChatEndRef} />
                      </div>

                      {/* Input */}
                      {currentChat.status === "active" ? (
                        <div className="border-t border-slate-100 p-3 flex gap-2 flex-shrink-0">
                          <input
                            type="text"
                            value={chatReply}
                            onChange={e => setChatReply(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && sendExecMsg()}
                            placeholder="Type a reply…"
                            className="flex-1 border-2 border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                          />
                          <button
                            onClick={sendExecMsg}
                            disabled={!chatReply.trim()}
                            className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:opacity-40 text-white font-bold px-4 py-2 rounded-xl transition-all shadow-sm"
                          >➤</button>
                        </div>
                      ) : (
                        <div className="border-t border-slate-100 p-3 text-center text-xs text-slate-400 font-semibold">
                          This chat has ended
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ══ HOURS ══ */}
          {activeTab === "⏰ Hours" && (
            <div className="max-w-lg space-y-5">
              <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
                <div className="px-5 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 flex items-center justify-between">
                  <p className="text-xs font-bold text-white uppercase tracking-widest">My Mandatory Hours — Today</p>
                  <div className="flex items-center gap-1.5 text-xs text-indigo-100 font-semibold">
                    <span className="w-2 h-2 bg-emerald-300 rounded-full animate-pulse inline-block"></span>
                    Auto-tracking
                  </div>
                </div>
                <div className="p-6 space-y-5">
                  {/* Big progress circle */}
                  <div className="flex flex-col items-center gap-3">
                    <div style={{ position: "relative", width: 160, height: 160 }}>
                      <svg width="160" height="160" viewBox="0 0 160 160">
                        <circle cx="80" cy="80" r="68" fill="none" stroke="#f1f5f9" strokeWidth="14" />
                        <circle cx="80" cy="80" r="68" fill="none"
                          stroke={myMet ? "#10b981" : myPct >= 60 ? "#f59e0b" : "#f43f5e"}
                          strokeWidth="14"
                          strokeLinecap="round"
                          strokeDasharray={`${2 * Math.PI * 68}`}
                          strokeDashoffset={`${2 * Math.PI * 68 * (1 - myPct / 100)}`}
                          transform="rotate(-90 80 80)"
                          style={{ transition: "stroke-dashoffset 1s ease" }}
                        />
                      </svg>
                      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                        <p className="text-3xl font-black text-slate-900">{myPct}%</p>
                        <p className="text-xs text-slate-400 font-semibold">{myLogged}h / {myRequired}h</p>
                      </div>
                    </div>
                    <p className={`text-sm font-bold ${myMet ? "text-emerald-600" : "text-amber-600"}`}>
                      {myMet ? "🎉 You've met today's target!" : `${Math.max(0, myRequired - myLogged).toFixed(2)}h remaining`}
                    </p>
                    <p className="text-xs text-slate-400">
                      Session active for <span className="font-bold text-slate-600">{sessionMins}m</span> · updates every minute
                    </p>
                  </div>

                  {/* Target-met actions */}
                  {myMet && !hoursMetDismissed && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex flex-wrap items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-emerald-700">🎉 Target complete!</p>
                        <p className="text-xs text-emerald-600 mt-0.5">Sign out now, or extend your shift to keep earning incentives.</p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => setHoursMetDismissed(true)}
                          className="text-sm font-bold px-4 py-2 rounded-xl border border-emerald-300 text-emerald-700 bg-white hover:bg-emerald-100 transition-colors">
                          ⏱ Extend Shift
                        </button>
                        <button
                          onClick={signOut}
                          style={{ background: "linear-gradient(90deg,#10b981,#0d9488)", color: "#fff" }}
                          className="text-sm font-bold px-4 py-2 rounded-xl shadow hover:shadow-md transition-all">
                          🚪 Log Out
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Extended-shift indicator */}
                  {myMet && hoursMetDismissed && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold text-amber-700">
                        ⏱ Shift extended — {myLogged > myRequired ? `+${(myLogged - myRequired).toFixed(2)}h overtime 💪` : "you're in overtime 💪"}
                      </p>
                      <button
                        onClick={signOut}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg text-emerald-700 bg-white border border-emerald-300 hover:bg-emerald-50 transition-colors flex-shrink-0">
                        🚪 Log Out
                      </button>
                    </div>
                  )}

                  {/* Info */}
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Shift Details</p>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Mandatory Hours</span>
                        <span className="font-bold text-slate-800">{myRequired}h / day</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Hours Logged</span>
                        <span className="font-bold text-indigo-700">{myLogged}h</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Session start</span>
                        <span className="font-bold text-slate-800">{new Date(session.loginAt).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Status</span>
                        <span className={`font-bold ${myMet ? "text-emerald-600" : "text-amber-600"}`}>{myMet ? "Complete ✅" : "Pending ⏳"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Role</span>
                        <span className="font-bold text-slate-800">{execInfo?.role || session.role}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ INCENTIVES ══ */}
          {activeTab === "🎁 Incentives" && (
            <div className="space-y-5">

              {/* Earnings hero */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 shadow-lg shadow-indigo-600/20 p-6 text-white">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
                <div className="relative flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-100">Estimated Incentive · Today</p>
                    <p className="text-5xl font-black mt-2">{cur}{incentive.total.toLocaleString("en-IN")}</p>
                    <div className="flex items-center gap-2 mt-3">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-white/20 px-3 py-1 rounded-full">
                        🏅 {incentive.currentTier?.label} Tier
                      </span>
                      {incentive.tierBonus > 0 && (
                        <span className="text-xs font-semibold text-indigo-100">includes {cur}{incentive.tierBonus} tier bonus</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right min-w-[180px]">
                    {incentive.nextTier ? (
                      <>
                        <p className="text-xs text-indigo-100 font-semibold mb-1.5">
                          {cur}{Math.max(0, incentive.nextTier.min - incentive.base).toLocaleString("en-IN")} to {incentive.nextTier.label}
                        </p>
                        <div className="h-2.5 w-full bg-white/20 rounded-full overflow-hidden">
                          <div className="h-full bg-white rounded-full transition-all" style={{ width: `${incentive.progressToNext}%` }} />
                        </div>
                      </>
                    ) : (
                      <p className="text-xs font-bold text-white">🎉 Top tier reached!</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Earnings breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: "Resolved Tickets", icon: "🎫", count: myStats.resolved,     rate: incentivePolicy.perResolvedTicket, earned: incentive.ticketEarn, ring: "bg-sky-50 text-sky-600",       bar: "from-sky-400 to-blue-600" },
                  { label: "Answered Calls",   icon: "📞", count: callStats.answered,    rate: incentivePolicy.perAnsweredCall,   earned: incentive.callEarn,   ring: "bg-emerald-50 text-emerald-600", bar: "from-emerald-400 to-teal-600" },
                  { label: "Chats Handled",    icon: "💬", count: chatsHandled,          rate: incentivePolicy.perChatHandled,    earned: incentive.chatEarn,   ring: "bg-violet-50 text-violet-600",  bar: "from-violet-400 to-indigo-600" },
                ].map(({ label, icon, count, rate, earned, ring, bar }) => (
                  <div key={label} className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5 hover:shadow-md transition-all overflow-hidden">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">{label}</p>
                      <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg ${ring}`}>{icon}</span>
                    </div>
                    <p className="text-3xl font-black text-slate-900">{cur}{earned.toLocaleString("en-IN")}</p>
                    <p className="text-xs text-slate-400 mt-1">{count} × {cur}{rate} each</p>
                    <div className={`h-1.5 mt-3 rounded-full bg-gradient-to-r ${bar}`} />
                  </div>
                ))}
              </div>

              {/* Bonuses */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Answer-rate bonus */}
                <div className={`rounded-2xl border shadow-sm p-5 transition-all ${incentive.rateMet ? "bg-emerald-50 border-emerald-200" : "bg-white border-slate-200/70"}`}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-bold text-slate-700">📈 Answer-Rate Bonus</p>
                    <span className={`text-xs font-black px-2.5 py-1 rounded-full ${incentive.rateMet ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500"}`}>
                      {incentive.rateMet ? `+${cur}${incentivePolicy.answerRateBonus}` : "Locked"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Hit a <span className="font-bold">{incentivePolicy.answerRateTarget}%</span> answer rate to earn this.
                    You're at <span className={`font-bold ${incentive.rateMet ? "text-emerald-600" : "text-amber-600"}`}>{callStats.answerRate}%</span>
                    {callStats.total === 0 && " (no calls yet)"}.
                  </p>
                </div>

                {/* Hours bonus */}
                <div className={`rounded-2xl border shadow-sm p-5 transition-all ${myMet ? "bg-emerald-50 border-emerald-200" : "bg-white border-slate-200/70"}`}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-bold text-slate-700">⏰ Mandatory-Hours Bonus</p>
                    <span className={`text-xs font-black px-2.5 py-1 rounded-full ${myMet ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500"}`}>
                      {myMet ? `+${cur}${incentivePolicy.hoursMetBonus}` : "Locked"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Complete your <span className="font-bold">{myRequired}h</span> daily target to earn this.
                    Logged so far: <span className={`font-bold ${myMet ? "text-emerald-600" : "text-amber-600"}`}>{myLogged}h</span>.
                  </p>
                </div>
              </div>

              {/* Policy reference */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Rate card */}
                <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">💡 How Incentives Are Earned</p>
                  </div>
                  <div className="p-5 space-y-2 text-sm">
                    {[
                      ["Per resolved ticket", `${cur}${incentivePolicy.perResolvedTicket}`],
                      ["Per answered call",   `${cur}${incentivePolicy.perAnsweredCall}`],
                      ["Per chat handled",    `${cur}${incentivePolicy.perChatHandled}`],
                      [`Answer rate ≥ ${incentivePolicy.answerRateTarget}%`, `+${cur}${incentivePolicy.answerRateBonus}`],
                      ["Mandatory hours met", `+${cur}${incentivePolicy.hoursMetBonus}`],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between border-b border-slate-50 last:border-0 pb-2 last:pb-0">
                        <span className="text-slate-500">{k}</span>
                        <span className="font-bold text-slate-800">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tier card */}
                <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">🏅 Reward Tiers</p>
                  </div>
                  <div className="p-3 space-y-1.5">
                    {[...incentivePolicy.tiers].sort((a, b) => a.min - b.min).map(t => {
                      const isCurrent = incentive.currentTier?.label === t.label;
                      return (
                        <div key={t.label}
                          className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${
                            isCurrent ? "border-indigo-300 bg-indigo-50" : "border-transparent hover:bg-slate-50"
                          }`}>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-800">{t.label}</span>
                            {isCurrent && <span className="text-[10px] font-black bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">CURRENT</span>}
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-slate-400">from {cur}{t.min.toLocaleString("en-IN")}</p>
                            <p className="text-sm font-bold text-emerald-600">{t.bonus > 0 ? `+${cur}${t.bonus} bonus` : "—"}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-400 text-center">
                Estimates update live from your activity. Final payouts are confirmed by your team lead.
              </p>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
