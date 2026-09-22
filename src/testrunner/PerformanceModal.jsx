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
const table = { width: "100%", borderCollapse: "collapse", fontSize: 11.5 };
const th = { textAlign: "left", padding: "6px 8px", color: "var(--tr-muted)", fontWeight: 700, borderBottom: "1px solid var(--tr-border)" };
const td = { padding: "6px 8px", borderBottom: "1px solid var(--tr-border)", color: "var(--tr-text-2)", fontFamily: "ui-monospace, monospace" };

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

function SummaryTable({ overall, samplers }) {
  const rows = [overall, ...(samplers || [])].filter(Boolean);
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
              <td style={{ ...td, fontWeight: i === 0 ? 800 : 400, color: i === 0 ? "var(--tr-text)" : td.color }}>
                {i === 0 ? "Overall" : r.label}
              </td>
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
    targetUrl: "",
    method: "GET",
    threads: 5,
    rampUpSeconds: 5,
    loops: 10,
    headersText: "",
    body: "",
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

  const canStart = caps?.available && !starting && (!run || run.status !== "running");
  const hasBody = ["POST", "PUT", "PATCH"].includes(plan.method);

  async function onRun() {
    setStartError(null);
    setStarting(true);
    try {
      const started = await startJmeterRun({
        name: plan.name,
        targetUrl: plan.targetUrl,
        method: plan.method,
        threads: Number(plan.threads),
        rampUpSeconds: Number(plan.rampUpSeconds),
        loops: Number(plan.loops),
        headers: parseHeaders(plan.headersText),
        body: hasBody ? plan.body : undefined,
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
                Sends {plan.method} requests at the target below, ramping up to {plan.threads || 0} concurrent
                users over {plan.rampUpSeconds || 0}s, each running {plan.loops || 0} times. Capped at{" "}
                {caps.limits?.maxThreads} threads, {caps.limits?.maxLoops} loops and{" "}
                {caps.limits?.runTimeoutSeconds}s total — this is a smoke-level load check, not a capacity study.
              </div>

              <div style={field}>
                <label style={fieldLabel}>Target URL</label>
                <input
                  style={input}
                  placeholder="https://your-app.example/api/checkout"
                  value={plan.targetUrl}
                  onChange={setField("targetUrl")}
                  disabled={run?.status === "running"}
                />
              </div>

              <div style={grid}>
                <div style={field}>
                  <label style={fieldLabel}>Method</label>
                  <select style={input} value={plan.method} onChange={setField("method")} disabled={run?.status === "running"}>
                    {["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"].map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div style={field}>
                  <label style={fieldLabel}>Threads</label>
                  <input type="number" min={1} max={caps.limits?.maxThreads} style={input} value={plan.threads} onChange={setField("threads")} disabled={run?.status === "running"} />
                </div>
                <div style={field}>
                  <label style={fieldLabel}>Ramp-up (s)</label>
                  <input type="number" min={0} max={caps.limits?.maxRampUpSeconds} style={input} value={plan.rampUpSeconds} onChange={setField("rampUpSeconds")} disabled={run?.status === "running"} />
                </div>
                <div style={field}>
                  <label style={fieldLabel}>Loops / thread</label>
                  <input type="number" min={1} max={caps.limits?.maxLoops} style={input} value={plan.loops} onChange={setField("loops")} disabled={run?.status === "running"} />
                </div>
              </div>

              <div style={field}>
                <label style={fieldLabel}>Headers (optional, one "Name: value" per line)</label>
                <textarea
                  style={{ ...input, minHeight: 50, resize: "vertical", fontFamily: "ui-monospace, monospace" }}
                  value={plan.headersText}
                  onChange={setField("headersText")}
                  disabled={run?.status === "running"}
                />
              </div>

              {hasBody && (
                <div style={field}>
                  <label style={fieldLabel}>Request body</label>
                  <textarea
                    style={{ ...input, minHeight: 60, resize: "vertical", fontFamily: "ui-monospace, monospace" }}
                    value={plan.body}
                    onChange={setField("body")}
                    disabled={run?.status === "running"}
                  />
                </div>
              )}

              <div style={{ display: "flex", gap: 10 }}>
                <button style={{ ...btnRun, opacity: canStart ? 1 : 0.5 }} disabled={!canStart} onClick={onRun}>
                  {starting ? "Starting…" : "Run load test"}
                </button>
                {run?.status === "running" && (
                  <button style={btnStop} onClick={onStop}>Stop</button>
                )}
              </div>
              {startError && <div style={{ ...hint, color: "var(--tr-rec)" }}>{startError}</div>}

              {run && (
                <>
                  <div style={sectionLabel}>Result</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                    <span style={{ fontWeight: 800, color: STATUS_COLOR[run.status] || "var(--tr-text)" }}>
                      {run.status}
                    </span>
                    {run.error && <span style={hint}>{run.error}</span>}
                  </div>

                  {run.status === "running" && (
                    <pre style={{ ...input, whiteSpace: "pre-wrap", maxHeight: 140, overflowY: "auto", fontFamily: "ui-monospace, monospace", fontSize: 11 }}>
                      {run.log || "starting jmeter…"}
                    </pre>
                  )}

                  {run.summary && (
                    <>
                      <SummaryTable overall={run.summary.overall} samplers={run.summary.samplers} />
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
                          {r.name} — {r.targetUrl}
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
