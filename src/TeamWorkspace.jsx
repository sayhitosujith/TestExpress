import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getActivity, getLibrary, getLibraryTest, getTeam } from "./api/corporate";

/**
 * What a Corporate account sees that an individual one does not: the people on
 * its seats, what they have recorded, and what they have been doing.
 *
 * Its own view rather than more sections in User Settings, and the reason is
 * what it is for. Settings is where you change your own preferences; this is
 * where you look at other people's work — a different question, asked at a
 * different time, and one that wants room for a list rather than a row.
 *
 * The library is read-only on purpose. A recording lives in the browser that
 * made it, which is where it is edited and replayed; showing a colleague's test
 * as if it could be changed here would be a second source of truth for the same
 * test. What it offers instead is a copy, and a copy is a new recording with
 * its own id and its own owner.
 */

const TABS = [
  { id: "library", label: "Tests" },
  { id: "people", label: "People" },
  { id: "activity", label: "Activity" },
];

export default function TeamWorkspace({ user, onImport, onClose }) {
  const [tab, setTab] = useState("library");
  const [library, setLibrary] = useState(null);
  const [members, setMembers] = useState(null);
  const [activity, setActivity] = useState(null);
  const [error, setError] = useState(null);
  const [importing, setImporting] = useState(null);
  const [query, setQuery] = useState("");

  const load = useCallback(() => {
    setError(null);
    getLibrary()
      .then(setLibrary)
      .catch((err) => {
        setLibrary({ tests: [], configured: true });
        setError(err.message);
      });
    getTeam().then(setMembers).catch(() => setMembers([]));
    getActivity({ limit: 60 })
      .then((d) => setActivity(d.activity))
      .catch(() => setActivity([]));
  }, []);

  useEffect(load, [load]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const mine = String(user?.email || "").toLowerCase();

  const tests = useMemo(() => {
    const all = (library && library.tests) || [];
    const q = query.trim().toLowerCase();
    return all
      .filter(
        (t) =>
          !q ||
          String(t.name).toLowerCase().includes(q) ||
          String(t.owner?.email || "").toLowerCase().includes(q) ||
          (t.tags || []).some((tag) => String(tag).toLowerCase().includes(q)),
      )
      // Colleagues' tests first: your own are already in the rail behind this
      // panel, so they are the least useful rows here.
      .sort((a, b) => {
        const am = String(a.owner?.email || "").toLowerCase() === mine ? 1 : 0;
        const bm = String(b.owner?.email || "").toLowerCase() === mine ? 1 : 0;
        return am - bm || String(a.name).localeCompare(String(b.name));
      });
  }, [library, query, mine]);

  const take = async (row) => {
    setImporting(row.id);
    setError(null);
    try {
      const full = await getLibraryTest(row.id);
      onImport(full);
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(null);
    }
  };

  return (
    <div style={S.backdrop} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={S.card} role="dialog" aria-modal="true" aria-label="Team">
        <div style={S.head}>
          <span style={S.badge}>CORPORATE</span>
          <span style={S.title}>Team</span>
          <span style={S.sub}>
            {members === null ? "…" : members.length + " seat" + (members.length === 1 ? "" : "s")}
          </span>
          <span style={{ flex: 1 }} />
          <button style={S.close} onClick={onClose} aria-label="Close team">
            ✕
          </button>
        </div>

        <div style={S.tabs}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-pressed={tab === t.id}
              style={{ ...S.tab, ...(tab === t.id ? S.tabOn : {}) }}
            >
              {t.label}
            </button>
          ))}
          {tab === "library" && (
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, owner or tag"
              style={S.search}
              aria-label="Search the team's tests"
            />
          )}
        </div>

        <div style={S.body}>
          {error && <div style={S.err}>{error}</div>}

          {tab === "library" && (
            <>
              {library && library.configured === false ? (
                <div style={S.note}>
                  No online database is configured, so there is no shared copy of anybody's
                  recordings to read. Set DATABASE_URL in src/Backend/.env and the recorder's own
                  sync fills this in.
                </div>
              ) : library === null ? (
                <div style={S.quiet}>Reading…</div>
              ) : !tests.length ? (
                <div style={S.quiet}>
                  {query.trim()
                    ? "Nothing matches."
                    : "Nobody on the team has a recording in the shared copy yet."}
                </div>
              ) : (
                tests.map((t) => {
                  const own = String(t.owner?.email || "").toLowerCase() === mine;
                  return (
                    <div key={t.id} style={S.row}>
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={S.name}>{t.name}</span>
                        <span style={S.meta}>
                          {t.steps} step{t.steps === 1 ? "" : "s"} · {t.engine === "mobile" ? "Android" : "Web"}
                          {" · "}
                          {own ? "you" : t.owner?.name || t.owner?.email || "unknown"}
                          {(t.tags || []).length ? " · " + t.tags.map((x) => "@" + x).join(" ") : ""}
                        </span>
                      </span>
                      {/* Your own tests are already in the rail behind this
                          panel — offering to copy one would make a duplicate
                          nobody asked for. */}
                      {!own && (
                        <button
                          style={S.take}
                          disabled={importing === t.id}
                          onClick={() => take(t)}
                          title={"Copy this into your own workspace as a new test"}
                        >
                          {importing === t.id ? "Copying…" : "Copy to mine"}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </>
          )}

          {tab === "people" && (
            <>
              <div style={S.note}>
                Seats are managed in User Settings → Team. This is who currently holds one.
              </div>
              {members === null ? (
                <div style={S.quiet}>Reading…</div>
              ) : !members.length ? (
                <div style={S.quiet}>No seats filled yet.</div>
              ) : (
                members.map((m) => (
                  <div key={m.memberEmail} style={S.row}>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={S.name}>{m.name || m.memberEmail}</span>
                      <span style={S.meta}>
                        {m.name ? m.memberEmail + " · " : ""}
                        {!m.registered
                          ? "invited — not registered yet"
                          : m.canSignIn
                            ? "on " + (m.plan || "no plan")
                            : "sign-in switched off"}
                      </span>
                    </span>
                    <span style={S.count}>
                      {library
                        ? (library.tests || []).filter(
                            (t) =>
                              String(t.owner?.email || "").toLowerCase() === m.memberEmail,
                          ).length + " tests"
                        : ""}
                    </span>
                  </div>
                ))
              )}
            </>
          )}

          {tab === "activity" && (
            <>
              {activity === null ? (
                <div style={S.quiet}>Reading…</div>
              ) : !activity.length ? (
                <div style={S.quiet}>Nothing recorded for this team yet.</div>
              ) : (
                activity.map((a) => (
                  <div key={a.id} style={S.logRow}>
                    <span style={S.when}>{new Date(a.created_at + "Z").toLocaleString()}</span>
                    <span style={S.what}>{a.action}</span>
                    <span style={S.who}>
                      {(a.payload && (a.payload.email || a.payload.patientName)) || ""}
                    </span>
                  </div>
                ))
              )}
            </>
          )}
        </div>

        <div style={S.foot}>
          <span style={S.quiet}>
            Copied tests are yours: a new recording, with its own id, that you can edit and replay.
            The original stays with whoever made it.
          </span>
          <button style={S.done} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

const mono = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

const S = {
  backdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 130,
    background: "rgba(2,6,23,0.72)",
    backdropFilter: "blur(3px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  card: {
    width: 720,
    maxWidth: "96vw",
    maxHeight: "88vh",
    background: "var(--tr-bg)",
    border: "1px solid var(--tr-border-strong)",
    borderRadius: 16,
    boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    fontFamily: "'Outfit', system-ui, sans-serif",
    color: "var(--tr-text)",
  },
  head: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "13px 16px",
    borderBottom: "1px solid var(--tr-border)",
    background: "var(--tr-panel)",
  },
  // The one visual difference that says which kind of account this is.
  badge: {
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: "0.08em",
    color: "#a5b4fc",
    background: "rgba(129,140,248,0.16)",
    border: "1px solid rgba(129,140,248,0.4)",
    borderRadius: 999,
    padding: "2px 8px",
  },
  title: { fontSize: 14.5, fontWeight: 800 },
  sub: { fontSize: 11.5, color: "var(--tr-dim)" },
  close: {
    background: "transparent",
    border: "1px solid var(--tr-border-strong)",
    color: "var(--tr-soft)",
    borderRadius: 8,
    width: 26,
    height: 26,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  tabs: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 16px",
    borderBottom: "1px solid var(--tr-border)",
  },
  tab: {
    background: "transparent",
    border: "1px solid transparent",
    borderRadius: 8,
    padding: "5px 10px",
    color: "var(--tr-dim)",
    fontFamily: "inherit",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  tabOn: { background: "var(--tr-panel-2)", color: "var(--tr-text)", borderColor: "var(--tr-border-strong)" },
  search: {
    marginLeft: "auto",
    width: 220,
    background: "var(--tr-bg)",
    border: "1px solid var(--tr-border-strong)",
    borderRadius: 8,
    padding: "5px 9px",
    color: "var(--tr-text)",
    fontFamily: "inherit",
    fontSize: 12,
    outline: "none",
  },
  body: { flex: 1, overflowY: "auto", padding: "10px 16px", minHeight: 0 },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "9px 0",
    borderBottom: "1px solid var(--tr-border)",
  },
  name: { display: "block", fontSize: 13, fontWeight: 700 },
  meta: { display: "block", fontSize: 11, color: "var(--tr-dim)", marginTop: 2 },
  count: { fontSize: 11, color: "var(--tr-muted)", flexShrink: 0 },
  take: {
    background: "var(--tr-accent-bg-2)",
    border: "1px solid var(--tr-accent-line)",
    color: "var(--tr-accent)",
    borderRadius: 8,
    padding: "5px 10px",
    fontSize: 11.5,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    flexShrink: 0,
  },
  logRow: { display: "flex", gap: 10, padding: "4px 0", fontSize: 11.5 },
  when: { fontFamily: mono, color: "var(--tr-muted)", flexShrink: 0 },
  what: { color: "var(--tr-text-2)", fontWeight: 600 },
  who: { color: "var(--tr-dim)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  quiet: { fontSize: 12, color: "var(--tr-dim)", padding: "10px 0" },
  note: {
    fontSize: 11.5,
    color: "var(--tr-dim)",
    lineHeight: 1.6,
    padding: "8px 10px",
    borderRadius: 8,
    background: "var(--tr-panel-2)",
    marginBottom: 8,
  },
  err: {
    fontSize: 11.5,
    color: "var(--tr-rec)",
    padding: "8px 10px",
    borderRadius: 8,
    background: "rgba(248,113,113,0.1)",
    border: "1px solid rgba(248,113,113,0.35)",
    marginBottom: 8,
  },
  foot: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 16px",
    borderTop: "1px solid var(--tr-border)",
    background: "var(--tr-panel)",
  },
  done: {
    background: "var(--tr-border)",
    border: "1px solid var(--tr-border-strong)",
    color: "var(--tr-text-2)",
    borderRadius: 9,
    padding: "7px 14px",
    fontSize: 12.5,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    flexShrink: 0,
  },
};
