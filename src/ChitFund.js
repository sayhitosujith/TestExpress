import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

/**
 * ChitFund — Monthly chit fund management page.
 *
 * Lets a user create chit fund groups, add members, and track each month's
 * subscription collection and payout. Everything persists to localStorage
 * (key: "chitFunds"), matching the storage pattern used elsewhere in the app.
 */

const STORAGE_KEY = "chitFunds";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const uid = () =>
  `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

const inr = (n) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const loadFunds = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
};

function ChitFund() {
  const navigate = useNavigate();

  const [funds, setFunds] = useState(loadFunds);
  const [selectedId, setSelectedId] = useState(null);

  // "new group" form
  const [showNew, setShowNew] = useState(false);
  const [gName, setGName] = useState("");
  const [gValue, setGValue] = useState("");
  const [gMonths, setGMonths] = useState("");
  const [gStart, setGStart] = useState(""); // YYYY-MM

  // add-member form
  const [mName, setMName] = useState("");
  const [mPhone, setMPhone] = useState("");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(funds));
  }, [funds]);

  useEffect(() => {
    if (!selectedId && funds.length) setSelectedId(funds[0].id);
  }, [funds, selectedId]);

  const selected = useMemo(
    () => funds.find((f) => f.id === selectedId) || null,
    [funds, selectedId],
  );

  const update = (id, updater) =>
    setFunds((prev) => prev.map((f) => (f.id === id ? updater(f) : f)));

  // ---- group actions ----
  const createGroup = () => {
    const value = Number(gValue);
    const months = Number(gMonths);
    if (!gName.trim() || !value || !months) {
      alert("Please enter a group name, total value and number of months.");
      return;
    }
    const group = {
      id: uid(),
      name: gName.trim(),
      totalValue: value,
      months,
      startMonth: gStart || "",
      members: [],
      // entries[monthIndex] = { winnerId, payout, paid: { [memberId]: true } }
      entries: {},
      createdAt: new Date().toISOString(),
    };
    setFunds((prev) => [group, ...prev]);
    setSelectedId(group.id);
    setGName("");
    setGValue("");
    setGMonths("");
    setGStart("");
    setShowNew(false);
  };

  const deleteGroup = (id) => {
    if (!window.confirm("Delete this chit fund group? This cannot be undone."))
      return;
    setFunds((prev) => prev.filter((f) => f.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const addMember = () => {
    if (!selected) return;
    if (!mName.trim()) return;
    update(selected.id, (f) => ({
      ...f,
      members: [
        ...f.members,
        { id: uid(), name: mName.trim(), phone: mPhone.trim() },
      ],
    }));
    setMName("");
    setMPhone("");
  };

  const removeMember = (memberId) => {
    update(selected.id, (f) => {
      const entries = { ...f.entries };
      Object.keys(entries).forEach((k) => {
        const e = entries[k];
        const paid = { ...(e.paid || {}) };
        delete paid[memberId];
        entries[k] = {
          ...e,
          paid,
          winnerId: e.winnerId === memberId ? "" : e.winnerId,
        };
      });
      return {
        ...f,
        members: f.members.filter((m) => m.id !== memberId),
        entries,
      };
    });
  };

  const monthlyAmount = selected
    ? Math.round(selected.totalValue / selected.months)
    : 0;

  const getEntry = (monthIdx) =>
    (selected && selected.entries[monthIdx]) || {
      winnerId: "",
      payout: "",
      paid: {},
    };

  const togglePaid = (monthIdx, memberId) => {
    update(selected.id, (f) => {
      const e = f.entries[monthIdx] || { winnerId: "", payout: "", paid: {} };
      const paid = { ...(e.paid || {}) };
      paid[memberId] = !paid[memberId];
      return { ...f, entries: { ...f.entries, [monthIdx]: { ...e, paid } } };
    });
  };

  const setWinner = (monthIdx, winnerId) => {
    update(selected.id, (f) => {
      const e = f.entries[monthIdx] || { winnerId: "", payout: "", paid: {} };
      return {
        ...f,
        entries: { ...f.entries, [monthIdx]: { ...e, winnerId } },
      };
    });
  };

  const setPayout = (monthIdx, payout) => {
    update(selected.id, (f) => {
      const e = f.entries[monthIdx] || { winnerId: "", payout: "", paid: {} };
      return {
        ...f,
        entries: { ...f.entries, [monthIdx]: { ...e, payout } },
      };
    });
  };

  // ---- summary numbers for selected group ----
  const summary = useMemo(() => {
    if (!selected) return null;
    const memberCount = selected.members.length;
    let collected = 0;
    let paidOut = 0;
    let paidCount = 0;
    const totalDues = memberCount * selected.months;
    for (let i = 0; i < selected.months; i++) {
      const e = selected.entries[i] || {};
      const paid = e.paid || {};
      selected.members.forEach((m) => {
        if (paid[m.id]) {
          collected += monthlyAmount;
          paidCount += 1;
        }
      });
      if (e.payout) paidOut += Number(e.payout) || 0;
    }
    return {
      memberCount,
      collected,
      paidOut,
      balance: collected - paidOut,
      pending: totalDues - paidCount,
      completion: totalDues ? Math.round((paidCount / totalDues) * 100) : 0,
    };
  }, [selected, monthlyAmount]);

  const monthLabel = (idx) => {
    if (!selected?.startMonth) return `Month ${idx + 1}`;
    const [y, m] = selected.startMonth.split("-").map(Number);
    const d = new Date(y, (m - 1) + idx, 1);
    return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  };

  return (
    <div style={S.page}>
      <style>{CSS}</style>
      <div className="cf-orb cf-orb1" />
      <div className="cf-orb cf-orb2" />

      {/* Header */}
      <div style={S.header}>
        <div>
          <h1 style={S.title}>Chit Fund Manager</h1>
          <p style={S.subtitle}>
            Manage monthly chit fund groups, collections & payouts
          </p>
        </div>
        <button className="cf-btn cf-btn-ghost" onClick={() => navigate(-1)}>
          ← Back
        </button>
      </div>

      <div style={S.layout}>
        {/* Sidebar: groups */}
        <aside style={S.sidebar} className="cf-card">
          <div style={S.sidebarHead}>
            <span style={S.sectionLabel}>Groups</span>
            <button
              className="cf-btn cf-btn-primary cf-btn-sm"
              onClick={() => setShowNew((s) => !s)}
            >
              {showNew ? "Close" : "+ New"}
            </button>
          </div>

          {showNew && (
            <div style={S.newForm}>
              <input
                className="cf-input"
                placeholder="Group name"
                value={gName}
                onChange={(e) => setGName(e.target.value)}
              />
              <input
                className="cf-input"
                type="number"
                placeholder="Total value (₹)"
                value={gValue}
                onChange={(e) => setGValue(e.target.value)}
              />
              <input
                className="cf-input"
                type="number"
                placeholder="No. of months"
                value={gMonths}
                onChange={(e) => setGMonths(e.target.value)}
              />
              <input
                className="cf-input"
                type="month"
                value={gStart}
                onChange={(e) => setGStart(e.target.value)}
              />
              <button
                className="cf-btn cf-btn-primary"
                onClick={createGroup}
                style={{ width: "100%" }}
              >
                Create Group
              </button>
            </div>
          )}

          <div style={S.groupList}>
            {funds.length === 0 && (
              <p style={S.emptyHint}>No groups yet. Create one to start.</p>
            )}
            {funds.map((f) => {
              const active = f.id === selectedId;
              return (
                <div
                  key={f.id}
                  className={`cf-group-item${active ? " active" : ""}`}
                  onClick={() => setSelectedId(f.id)}
                >
                  <div>
                    <div style={S.groupName}>{f.name}</div>
                    <div style={S.groupMeta}>
                      {inr(f.totalValue)} · {f.months}m · {f.members.length}{" "}
                      members
                    </div>
                  </div>
                  <button
                    className="cf-del"
                    title="Delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteGroup(f.id);
                    }}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Main */}
        <main style={{ flex: 1, minWidth: 0 }}>
          {!selected ? (
            <div className="cf-card" style={S.emptyState}>
              <div style={{ fontSize: 48 }}>💰</div>
              <h3 style={{ margin: "12px 0 4px" }}>No group selected</h3>
              <p style={S.emptyHint}>
                Create or select a chit fund group to manage it.
              </p>
            </div>
          ) : (
            <>
              {/* Stats */}
              <div style={S.statsRow}>
                <Stat label="Monthly / member" value={inr(monthlyAmount)} />
                <Stat label="Collected" value={inr(summary.collected)} />
                <Stat label="Paid out" value={inr(summary.paidOut)} />
                <Stat
                  label="Balance in hand"
                  value={inr(summary.balance)}
                  accent
                />
                <Stat label="Pending dues" value={summary.pending} />
                <Stat label="Completion" value={`${summary.completion}%`} />
              </div>

              {/* Members */}
              <div className="cf-card" style={{ marginBottom: 20 }}>
                <span style={S.sectionLabel}>Members</span>
                <div style={S.memberAdd}>
                  <input
                    className="cf-input"
                    placeholder="Member name"
                    value={mName}
                    onChange={(e) => setMName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addMember()}
                  />
                  <input
                    className="cf-input"
                    placeholder="Phone (optional)"
                    value={mPhone}
                    onChange={(e) => setMPhone(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addMember()}
                  />
                  <button className="cf-btn cf-btn-primary" onClick={addMember}>
                    + Add
                  </button>
                </div>
                <div style={S.memberChips}>
                  {selected.members.length === 0 && (
                    <p style={S.emptyHint}>No members yet.</p>
                  )}
                  {selected.members.map((m) => (
                    <span key={m.id} className="cf-chip">
                      {m.name}
                      {m.phone ? ` · ${m.phone}` : ""}
                      <button
                        className="cf-chip-x"
                        onClick={() => removeMember(m.id)}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Monthly tracking */}
              <div className="cf-card">
                <span style={S.sectionLabel}>Monthly Collection & Payout</span>
                {selected.members.length === 0 ? (
                  <p style={S.emptyHint}>Add members to track collections.</p>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table className="cf-table">
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left" }}>Month</th>
                          {selected.members.map((m) => (
                            <th key={m.id}>{m.name}</th>
                          ))}
                          <th>Winner</th>
                          <th>Payout</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: selected.months }).map((_, i) => {
                          const e = getEntry(i);
                          const collectedThis = selected.members.reduce(
                            (sum, m) =>
                              sum + (e.paid?.[m.id] ? monthlyAmount : 0),
                            0,
                          );
                          return (
                            <tr key={i}>
                              <td style={S.monthCell}>
                                <div style={{ fontWeight: 600 }}>
                                  {monthLabel(i)}
                                </div>
                                <div style={S.collectedHint}>
                                  {inr(collectedThis)}
                                </div>
                              </td>
                              {selected.members.map((m) => (
                                <td key={m.id} style={{ textAlign: "center" }}>
                                  <input
                                    type="checkbox"
                                    className="cf-check"
                                    checked={!!e.paid?.[m.id]}
                                    onChange={() => togglePaid(i, m.id)}
                                  />
                                </td>
                              ))}
                              <td>
                                <select
                                  className="cf-input cf-select"
                                  value={e.winnerId || ""}
                                  onChange={(ev) =>
                                    setWinner(i, ev.target.value)
                                  }
                                >
                                  <option value="">—</option>
                                  {selected.members.map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {m.name}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <input
                                  className="cf-input"
                                  type="number"
                                  style={{ width: 100 }}
                                  placeholder="₹"
                                  value={e.payout || ""}
                                  onChange={(ev) =>
                                    setPayout(i, ev.target.value)
                                  }
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div className="cf-card cf-stat">
      <div style={S.statLabel}>{label}</div>
      <div style={{ ...S.statValue, color: accent ? "#34d399" : "#e2e8f0" }}>
        {value}
      </div>
    </div>
  );
}

const S = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(160deg,#0f0d24 0%,#1e1b4b 55%,#2a1a4a 100%)",
    fontFamily: "'Outfit',sans-serif",
    color: "#e2e8f0",
    padding: "28px 32px 60px",
    position: "relative",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
    position: "relative",
    zIndex: 2,
  },
  title: {
    margin: 0,
    fontSize: 30,
    fontWeight: 700,
    background: "linear-gradient(135deg,#7C3AED,#F97316)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  subtitle: { margin: "4px 0 0", color: "#94a3b8", fontSize: 14 },
  layout: { display: "flex", gap: 20, position: "relative", zIndex: 2, alignItems: "flex-start", flexWrap: "wrap" },
  sidebar: { width: 300, flexShrink: 0 },
  sidebarHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionLabel: {
    display: "block",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#a78bfa",
    marginBottom: 12,
  },
  newForm: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 },
  groupList: { display: "flex", flexDirection: "column", gap: 8 },
  groupName: { fontWeight: 600, fontSize: 15 },
  groupMeta: { fontSize: 12, color: "#94a3b8", marginTop: 2 },
  emptyHint: { color: "#64748b", fontSize: 13, margin: 0 },
  emptyState: { textAlign: "center", padding: "60px 20px" },
  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
    gap: 14,
    marginBottom: 20,
  },
  statLabel: {
    fontSize: 12,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statValue: { fontSize: 22, fontWeight: 700, marginTop: 6 },
  memberAdd: {
    display: "flex",
    gap: 8,
    marginBottom: 14,
    flexWrap: "wrap",
  },
  memberChips: { display: "flex", flexWrap: "wrap", gap: 8 },
  monthCell: { textAlign: "left", whiteSpace: "nowrap" },
  collectedHint: { fontSize: 11, color: "#34d399", marginTop: 2 },
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap');
.cf-orb{position:fixed;border-radius:50%;filter:blur(90px);opacity:0.18;pointer-events:none;z-index:0;}
.cf-orb1{width:460px;height:460px;background:#7C3AED;top:-120px;left:-120px;}
.cf-orb2{width:380px;height:380px;background:#F97316;bottom:-100px;right:-80px;}
.cf-card{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:18px;backdrop-filter:blur(6px);}
.cf-stat{padding:16px 18px;}
.cf-input{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:9px;padding:10px 12px;color:#e2e8f0;font-family:'Outfit',sans-serif;font-size:14px;outline:none;transition:border-color .2s,box-shadow .2s;box-sizing:border-box;}
.cf-input:focus{border-color:#7C3AED;box-shadow:0 0 0 3px rgba(124,58,237,0.25);}
.cf-input::placeholder{color:rgba(148,163,184,0.5);}
.cf-select{cursor:pointer;}
.cf-select option{background:#1a1a2e;}
.cf-btn{border:none;border-radius:9px;padding:10px 16px;font-family:'Outfit',sans-serif;font-size:14px;font-weight:600;cursor:pointer;transition:opacity .2s,transform .1s,background .2s;}
.cf-btn:active{transform:scale(0.97);}
.cf-btn-sm{padding:6px 12px;font-size:13px;}
.cf-btn-primary{background:linear-gradient(135deg,#7C3AED 0%,#C026D3 60%,#F97316 100%);color:#fff;}
.cf-btn-primary:hover{opacity:0.9;}
.cf-btn-ghost{background:rgba(255,255,255,0.06);color:#e2e8f0;border:1px solid rgba(255,255,255,0.12);}
.cf-btn-ghost:hover{background:rgba(255,255,255,0.12);}
.cf-group-item{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:12px 14px;border-radius:11px;border:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02);cursor:pointer;transition:background .2s,border-color .2s;}
.cf-group-item:hover{background:rgba(124,58,237,0.12);}
.cf-group-item.active{background:rgba(124,58,237,0.2);border-color:#7C3AED;}
.cf-del{background:transparent;border:none;color:#64748b;cursor:pointer;font-size:13px;padding:4px;border-radius:6px;transition:color .2s,background .2s;}
.cf-del:hover{color:#f87171;background:rgba(248,113,113,0.1);}
.cf-chip{display:inline-flex;align-items:center;gap:6px;background:rgba(124,58,237,0.15);border:1px solid rgba(124,58,237,0.3);color:#ddd6fe;border-radius:999px;padding:6px 12px;font-size:13px;}
.cf-chip-x{background:transparent;border:none;color:#a78bfa;cursor:pointer;font-size:12px;padding:0;line-height:1;}
.cf-chip-x:hover{color:#f87171;}
.cf-table{width:100%;border-collapse:collapse;font-size:14px;}
.cf-table th{padding:10px 8px;text-align:center;color:#a78bfa;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid rgba(255,255,255,0.1);white-space:nowrap;}
.cf-table td{padding:9px 8px;border-bottom:1px solid rgba(255,255,255,0.05);}
.cf-table tbody tr:hover,.cf-table tr:hover{background:rgba(255,255,255,0.02);}
.cf-check{width:18px;height:18px;accent-color:#7C3AED;cursor:pointer;}
`;

export default ChitFund;
