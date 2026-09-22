import { useEffect, useRef, useState } from "react";
import {
  cancelJmeterRun,
  getJmeterRun,
  jmeterCapabilities,
  jmeterReportUrl,
  listJmeterRuns,
  startJmeterRun,
} from "../api/jmeter";

/**
 * Performance testing (JMeter), opened from the same toolbar as Reports and
 * CI/CD in TestRunner.jsx.
 *
 * Its own file rather than another function inside TestRunner.jsx: every
 * other engine there is a step-by-step session the client drives one HTTP
 * call at a time, and this one is a "start a batch job, poll it, read its
 * report" flow with none of that shape — folding it into the same component
 * would mean sharing state with a control flow it does not participate in.
 *
 * Deliberately not styled from TestRunner's `S` object for the same reason:
 * it lives in a different file, so it reads the same CSS custom properties
 * (--tr-*) TestRunner's own styles resolve to, rather than importing a
 * thousand-line style sheet to reach a dozen of its values.
 */
const POLL_MS = 2000;

const wrap = {
  position: "fixed",
  inset: 0,
  background: "rgba(2,6,23,0.72)",
  backdropFilter: "blur(3px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  zIndex: 130,
};
const card = {
  width: 640,
  maxWidth: "96vw",
  maxHeight: "88vh",
  background: "var(--tr-bg)",
  border: "1px solid #334155",
  borderRadius: 16,
  boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  textAlign: "left",
  cursor: "default",
};
const head = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "13px 16px",
  borderBottom: "1px solid #1e293b",
  background: "var(--tr-panel)",
  color: "var(--tr-text)",
};
const title = { flex: 1, fontSize: 14.5, fontWeight: 800, letterSpacing: "-0.01em" };
const close = {
  background: "transparent",
  border: "1px solid var(--tr-border-strong)",
  color: "var(--tr-soft)",
  borderRadius: 8,
  width: 26,
  height: 26,
  padding: 0,
  cursor: "pointer",
  flexShrink: 0,
};
const body = {
  padding: 16,
  display: "flex",
  flexDirection: "column",
  gap: 16,
  overflowY: "auto",
  minHeight: 0,
};
const sectionLabel = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--tr-muted)",
};
const hint = { fontSize: 11, lineHeight: 1.45, color: "var(--tr-dim)" };
const field = { display: "flex", flexDirection: "column", gap: 4, minWidth: 0 };
const fieldLabel = { fontSize: 11, fontWeight: 700, color: "var(--tr-text-2)" };
const input = {
  background: "var(--tr-bg)",
  border: "1px solid #334155",
  borderRadius: 7,
  padding: "7px 9px",
  color: "var(--tr-text)",
  fontFamily: "inherit",
  fontSize: 12.5,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};
const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 };
const targetList = { display: "flex", flexDirection: "column", gap: 6 };
const targetRow = { display: "flex", gap: 6, alignItems: "center" };
const methodSelect = { width: 92, flexShrink: 0 };
const removeBtn = {
  background: "transparent",
  border: "1px solid var(--tr-border-strong)",
  color: "var(--tr-soft)",
  borderRadius: 7,
  width: 28,
  height: 28,
  padding: 0,
  cursor: "pointer",
  flexShrink: 0,
  fontSize: 13,
  lineHeight: 1,
};
const btn = {
  border: "none",
  borderRadius: 9,
  padding: "9px 14px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
};
const btnRun = { ...btn, background: "#f59e0b", color: "#1c1400" };
const btnStop = { ...btn, background: "#ef4444", color: "#fff" };
const btnGhost = { ...btn, background: "var(--tr-border)", color: "var(--tr-text-2)", border: "1px solid #334155" };
const addTargetBtn = { ...btnGhost, alignSelf: "flex-start", padding: "6px 12px", fontSize: 12 };
const table = { width: "100%", borderCollapse: "collapse", fontSize: 11.5 };
const th = { textAlign: "left", padding: "6px 8px", color: "var(--tr-muted)", fontWeight: 700, borderBottom: "1px solid var(--tr-border)" };
const td = { padding: "6px 8px", borderBottom: "1px solid var(--tr-border)", color: "var(--tr-text-2)", fontFamily: "ui-monospace, monospace" };

const kpiGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(128px, 1fr))", gap: 10 };
const kpiCard = {
  background: "var(--tr-panel)",
  border: "1px solid var(--tr-border)",
  borderRadius: 10,
  padding: "11px 13px",
  display: "flex",
  flexDirection: "column",
  gap: 3,
};
const kpiLabel = { fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--tr-muted)" };
const kpiValue = { fontSize: 19, fontWeight: 800, lineHeight: 1.15, fontFamily: "ui-monospace, monospace" };
const metaRow = { display: "flex", flexWrap: "wrap", gap: 6, fontSize: 11, color: "var(--tr-text-2)" };
const metaChip = {
  background: "var(--tr-panel)",
  border: "1px solid var(--tr-border)",
  borderRadius: 999,
  padding: "3px 10px",
  fontWeight: 600,
  whiteSpace: "nowrap",
};
const targetLine = {
  fontFamily: "ui-monospace, monospace",
  fontSize: 12,
  color: "var(--tr-text)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

/** "Header: Value" lines, one per header, into the object the API wants. */
function parseHeaders(text) {
  const out = {};
  for (const line of String(text || "").split("\n")) {
    const i = line.indexOf(":");
    if (i <= 0) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim();
    if (k) out[k] = v;
  }
  return out;
}

const STATUS_COLOR = {
  running: "var(--tr-warn)",
  done: "var(--tr-ok)",
  failed: "var(--tr-rec)",
  cancelled: "var(--tr-dim)",
};

const statusBadgeStyle = (status) => ({
  fontSize: 10.5,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  padding: "3px 9px",
  borderRadius: 999,
  color: STATUS_COLOR[status] || "var(--tr-text)",
  background: "var(--tr-panel)",
  border: `1px solid ${STATUS_COLOR[status] || "var(--tr-border)"}`,
  flexShrink: 0,
});

/** "4.2s" under a minute, "1m 12s" past it — matches how the rest of the
 *  runner reports elapsed time (see reportDoc.js's own duration format). */
function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const totalSeconds = ms / 1000;
  if (totalSeconds < 60) return `${totalSeconds.toFixed(1)}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return `${minutes}m ${seconds}s`;
}

function formatClock(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/** The four numbers a reader wants first, before the per-request detail. */
function KpiCards({ overall }) {
  if (!overall) return null;
  return (
    <div style={kpiGrid}>
      <div style={kpiCard}>
        <span style={kpiLabel}>Error rate</span>
        <span style={{ ...kpiValue, color: overall.errors ? "var(--tr-rec)" : "var(--tr-ok)" }}>
          {(overall.errorPct ?? 0).toFixed(1)}%
        </span>
      </div>
      <div style={kpiCard}>
        <span style={kpiLabel}>Avg response</span>
        <span style={kpiValue}>{overall.avgMs} ms</span>
      </div>
      <div style={kpiCard}>
        <span style={kpiLabel}>p95 response</span>
        <span style={kpiValue}>{overall.p95Ms} ms</span>
      </div>
      <div style={kpiCard}>
        <span style={kpiLabel}>Throughput</span>
        <span style={kpiValue}>{overall.throughputPerSec}/s</span>
      </div>
    </div>
  );
}

/** The per-sampler breakdown beneath the KPI cards above — one row per
 *  distinct request in the plan, not the "Overall" figure the cards already
 *  show, so the table is detail rather than a repeat of the summary. */
function SummaryTable({ samplers }) {
  const rows = samplers || [];
  if (!rows.length) return null;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={table}>
        <thead>
          <tr>
            <th style={th}>Sampler</th>
            <th style={th}>Samples</th>
            <th style={th}>Errors</th>
            <th style={th}>Avg ms</th>
            <th style={th}>p90</th>
            <th style={th}>p95</th>
            <th style={th}>p99</th>
            <th style={th}>Req/s</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.label + i}>
              <td style={td}>{r.label}</td>
              <td style={td}>{r.samples}</td>
              <td style={{ ...td, color: r.errors ? "var(--tr-rec)" : td.color }}>
                {r.errors} ({r.errorPct?.toFixed?.(1) ?? 0}%)
              </td>
              <td style={td}>{r.avgMs}</td>
              <td style={td}>{r.p90Ms}</td>
              <td style={td}>{r.p95Ms}</td>
              <td style={td}>{r.p99Ms}</td>
              <td style={td}>{r.throughputPerSec}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PerformanceModal({ onClose }) {
  const [caps, setCaps] = useState(null); // null while loading
  const [plan, setPlan] = useState({
    name: "Load test",
    // Each target gets its own thread group and runs concurrently with the
    // others (see testrunner/jmeter.js) — this is "test several endpoints at
    // once", not a multi-step journey through one of them.
    targets: [{ url: "", method: "GET" }],
    threads: 5,
    rampUpSeconds: 5,
    loops: 10,
    headersText: "",
    body: "",
    username: "",
    password: "",
  });
  const [run, setRun] = useState(null); // the active/last run's state from the server
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState(null);
  const [history, setHistory] = useState([]);
  const pollRef = useRef(null);

  useEffect(() => {
    jmeterCapabilities().then(setCaps);
    listJmeterRuns().then(setHistory).catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Poll while a run is in flight; stop as soon as it settles.
  useEffect(() => {
    if (!run || run.status !== "running") {
      if (pollRef.current) clearInterval(pollRef.current);
      return undefined;
    }
    pollRef.current = setInterval(async () => {
      try {
        const next = await getJmeterRun(run.id);
        setRun(next);
        if (next.status !== "running") {
          clearInterval(pollRef.current);
          listJmeterRuns().then(setHistory).catch(() => {});
        }
      } catch {
        clearInterval(pollRef.current);
      }
    }, POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [run?.id, run?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const setField = (k) => (e) => setPlan((p) => ({ ...p, [k]: e.target.value }));

  const maxTargets = caps?.limits?.maxTargets || 10;
  const running = run?.status === "running";
  const targetsFilled = plan.targets.length > 0 && plan.targets.every((t) => t.url.trim());
  const canStart = caps?.available && !starting && !running && targetsFilled;
  // Shown if any row needs one — one shared body applies to whichever
  // targets are POST/PUT/PATCH, the same way one shared headers block does.
  const hasBody = plan.targets.some((t) => ["POST", "PUT", "PATCH"].includes(t.method));

  const setTarget = (i, field) => (e) =>
    setPlan((p) => ({
      ...p,
      targets: p.targets.map((t, ti) => (ti === i ? { ...t, [field]: e.target.value } : t)),
    }));
  const addTarget = () =>
    setPlan((p) => (p.targets.length >= maxTargets ? p : { ...p, targets: [...p.targets, { url: "", method: "GET" }] }));
  const removeTarget = (i) =>
    setPlan((p) => ({ ...p, targets: p.targets.filter((_, ti) => ti !== i) }));

  async function onRun() {
    setStartError(null);
    setStarting(true);
    try {
      const started = await startJmeterRun({
        name: plan.name,
        targets: plan.targets.map((t) => ({ targetUrl: t.url, method: t.method })),
        threads: Number(plan.threads),
        rampUpSeconds: Number(plan.rampUpSeconds),
        loops: Number(plan.loops),
        headers: parseHeaders(plan.headersText),
        body: hasBody ? plan.body : undefined,
        username: plan.username.trim() || undefined,
        password: plan.password || undefined,
      });
      setRun(started);
    } catch (err) {
      setStartError(err.message);
    } finally {
      setStarting(false);
    }
  }

  async function onStop() {
    if (!run) return;
    await cancelJmeterRun(run.id).catch(() => {});
  }

  return (
    <div style={wrap} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={card} role="dialog" aria-modal="true" aria-label="Performance testing">
        <div style={head}>
          <span style={title}>Performance testing — JMeter</span>
          <button onClick={onClose} style={close} title="Close" aria-label="Close performance testing" autoFocus>
            ✕
          </button>
        </div>

        <div style={body}>
          {caps === null && <div style={hint}>Checking whether this backend can run a load test…</div>}

          {caps && !caps.available && (
            <div style={{ ...hint, color: "var(--tr-warn)" }}>
              Not available on this backend yet: {caps.reason}
            </div>
          )}

          {caps && caps.available && (
            <>
              <div style={sectionLabel}>Load profile</div>
              <div style={hint}>
                Runs every target below as its own thread group, all under load at the same time, each ramping up
                to {plan.threads || 0} concurrent users over {plan.rampUpSeconds || 0}s and running {plan.loops || 0}{" "}
                times. Capped at {caps.limits?.maxThreads} threads, {caps.limits?.maxLoops} loops,{" "}
                {maxTargets} targets and {caps.limits?.runTimeoutSeconds}s total — this is a smoke-level load
                check, not a capacity study.
              </div>

              <div style={field}>
                <label style={fieldLabel}>Target URLs</label>
                <div style={targetList}>
                  {plan.targets.map((t, i) => (
                    <div key={i} style={targetRow}>
                      <select
                        style={{ ...input, ...methodSelect }}
                        value={t.method}
                        onChange={setTarget(i, "method")}
                        disabled={running}
                      >
                        {["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"].map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      <input
                        style={input}
                        placeholder="https://your-app.example/api/checkout"
                        value={t.url}
                        onChange={setTarget(i, "url")}
                        disabled={running}
                      />
                      {plan.targets.length > 1 && (
                        <button
                          style={removeBtn}
                          onClick={() => removeTarget(i)}
                          disabled={running}
                          title="Remove this target"
                          aria-label={`Remove target ${i + 1}`}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  style={{ ...addTargetBtn, opacity: running || plan.targets.length >= maxTargets ? 0.5 : 1 }}
                  onClick={addTarget}
                  disabled={running || plan.targets.length >= maxTargets}
                >
                  + Add another URL
                </button>
              </div>

              <div style={grid}>
                <div style={field}>
                  <label style={fieldLabel}>Threads</label>
                  <input type="number" min={1} max={caps.limits?.maxThreads} style={input} value={plan.threads} onChange={setField("threads")} disabled={running} />
                </div>
                <div style={field}>
                  <label style={fieldLabel}>Ramp-up (s)</label>
                  <input type="number" min={0} max={caps.limits?.maxRampUpSeconds} style={input} value={plan.rampUpSeconds} onChange={setField("rampUpSeconds")} disabled={running} />
                </div>
                <div style={field}>
                  <label style={fieldLabel}>Loops / thread</label>
                  <input type="number" min={1} max={caps.limits?.maxLoops} style={input} value={plan.loops} onChange={setField("loops")} disabled={running} />
                </div>
              </div>

              <div style={field}>
                <label style={fieldLabel}>Headers (optional, one "Name: value" per line, sent with every target)</label>
                <textarea
                  style={{ ...input, minHeight: 50, resize: "vertical", fontFamily: "ui-monospace, monospace" }}
                  value={plan.headersText}
                  onChange={setField("headersText")}
                  disabled={running}
                />
              </div>

              <div style={grid}>
                <div style={field}>
                  <label style={fieldLabel}>Username (optional)</label>
                  <input
                    style={input}
                    autoComplete="off"
                    placeholder="HTTP Basic/Digest auth"
                    value={plan.username}
                    onChange={setField("username")}
                    disabled={running}
                  />
                </div>
                <div style={field}>
                  <label style={fieldLabel}>Password</label>
                  <input
                    type="password"
                    style={input}
                    autoComplete="off"
                    value={plan.password}
                    onChange={setField("password")}
                    disabled={running || !plan.username.trim()}
                  />
                </div>
              </div>
              {plan.username.trim() && (
                <div style={hint}>
                  Sent as HTTP Basic/Digest auth to every target's origin. This authenticates a request the way an
                  API or a reverse proxy would ask for it — it cannot sign into a page that logs in with a form and
                  a session cookie (or, e.g., Gmail's full OAuth flow).
                </div>
              )}

              {hasBody && (
                <div style={field}>
                  <label style={fieldLabel}>Request body</label>
                  <textarea
                    style={{ ...input, minHeight: 60, resize: "vertical", fontFamily: "ui-monospace, monospace" }}
                    value={plan.body}
                    onChange={setField("body")}
                    disabled={running}
                  />
                </div>
              )}

              <div style={{ display: "flex", gap: 10 }}>
                <button style={{ ...btnRun, opacity: canStart ? 1 : 0.5 }} disabled={!canStart} onClick={onRun}>
                  {starting ? "Starting…" : "Run load test"}
                </button>
                {running && (
                  <button style={btnStop} onClick={onStop}>Stop</button>
                )}
              </div>
              {startError && <div style={{ ...hint, color: "var(--tr-rec)" }}>{startError}</div>}

              {run && (
                <>
                  <div style={sectionLabel}>Result</div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={statusBadgeStyle(run.status)}>{run.status}</span>
                    <span style={metaChip}>
                      {(run.targets || []).length} target{(run.targets || []).length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {(run.targets || []).map((t, i) => (
                      <span key={i} style={targetLine} title={t.url}>{t.method} {t.url}</span>
                    ))}
                  </div>
                  <div style={metaRow}>
                    <span style={metaChip}>{run.threads} threads</span>
                    <span style={metaChip}>{run.rampUpSeconds}s ramp-up</span>
                    <span style={metaChip}>{run.loops} loops/thread</span>
                    <span style={metaChip}>started {formatClock(run.startedAt)}</span>
                    {run.finishedAt && (
                      <span style={metaChip}>ran for {formatDuration(run.finishedAt - run.startedAt)}</span>
                    )}
                  </div>
                  {run.error && <div style={{ ...hint, color: "var(--tr-warn)" }}>{run.error}</div>}

                  {run.status === "running" && (
                    <pre style={{ ...input, whiteSpace: "pre-wrap", maxHeight: 140, overflowY: "auto", fontFamily: "ui-monospace, monospace", fontSize: 11 }}>
                      {run.log || "starting jmeter…"}
                    </pre>
                  )}

                  {run.summary && (
                    <>
                      <KpiCards overall={run.summary.overall} />

                      <div style={sectionLabel}>Per-request breakdown</div>
                      <SummaryTable samplers={run.summary.samplers} />

                      <div>
                        <a
                          href={jmeterReportUrl(run.id)}
                          target="_blank"
                          rel="noreferrer"
                          style={{ ...btnGhost, textDecoration: "none", display: "inline-block" }}
                        >
                          Open full JMeter report ↗
                        </a>
                      </div>
                    </>
                  )}
                </>
              )}

              {history.length > 0 && (
                <>
                  <div style={sectionLabel}>Recent runs</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {history.slice(0, 8).map((r) => (
                      <button
                        key={r.id}
                        onClick={() => setRun(r)}
                        style={{
                          ...btnGhost,
                          textAlign: "left",
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 8,
                          padding: "7px 10px",
                        }}
                      >
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {r.name} — {(r.targets || []).map((t) => t.url).join(", ") || "no targets"}
                        </span>
                        <span style={{ color: STATUS_COLOR[r.status] || "var(--tr-text)", fontWeight: 700, flexShrink: 0 }}>
                          {r.status}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
