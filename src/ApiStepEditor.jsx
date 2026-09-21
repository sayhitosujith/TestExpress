// Authoring panel for a recorded REST step.
//
// Its own file rather than another section of TestRunner.jsx, which is already
// past twelve thousand lines: this panel has its own state shape, its own
// validation and no dependency on the recorder beyond the step it is handed, so
// there is nothing to gain by putting it there and a great deal to lose.
//
// Every list the controls offer — methods, assertion sources, operators — comes
// from ./testrunner/apiStep rather than being spelled out again here. That is
// deliberate and it is the point: an operator this panel offered but the
// evaluator did not implement would let someone author a check that silently
// never fails, and the only way to make that impossible is for both to read one
// list.

import { useMemo } from "react";
import {
  ASSERT_TYPES,
  BODYLESS,
  METHODS,
  OPS,
  describeAssert,
  isSecretHeader,
  normalize,
  parseHeaders,
} from "./testrunner/apiStep";

// Operators that compare against nothing — the value box is hidden for them, so
// a check reading "is present  [        ]" cannot suggest a field nobody uses.
const VALUELESS = ["exists", "empty"];

// Which operators make sense for which source. Offering `is less than` on a raw
// body, or a regex on a response time, produces a check whose result is
// meaningless rather than wrong — worse, because it still goes green.
const OPS_FOR = {
  status: ["eq", "ne", "lt", "gt"],
  responseTime: ["lt", "gt"],
  bodyContains: ["contains", "matches", "eq", "empty"],
  header: ["eq", "ne", "contains", "matches", "exists"],
  jsonPath: ["eq", "ne", "contains", "matches", "exists", "empty", "lt", "gt"],
};

const S = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    background: "var(--tr-panel, rgba(255,255,255,0.03))",
    border: "1px solid var(--tr-line, rgba(128,128,128,0.25))",
    fontSize: 13,
  },
  row: { display: "flex", gap: 8, alignItems: "center" },
  label: {
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    opacity: 0.7,
    marginBottom: 4,
  },
  input: {
    flex: 1,
    minWidth: 0,
    padding: "6px 8px",
    borderRadius: 6,
    border: "1px solid var(--tr-line, rgba(128,128,128,0.3))",
    background: "var(--tr-field, rgba(0,0,0,0.18))",
    color: "inherit",
    font: "inherit",
  },
  area: {
    width: "100%",
    boxSizing: "border-box",
    minHeight: 64,
    padding: "6px 8px",
    borderRadius: 6,
    border: "1px solid var(--tr-line, rgba(128,128,128,0.3))",
    background: "var(--tr-field, rgba(0,0,0,0.18))",
    color: "inherit",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 12,
    resize: "vertical",
  },
  select: {
    padding: "6px 8px",
    borderRadius: 6,
    border: "1px solid var(--tr-line, rgba(128,128,128,0.3))",
    background: "var(--tr-field, rgba(0,0,0,0.18))",
    color: "inherit",
    font: "inherit",
  },
  btn: {
    padding: "4px 10px",
    borderRadius: 6,
    border: "1px solid var(--tr-line, rgba(128,128,128,0.3))",
    background: "transparent",
    color: "inherit",
    cursor: "pointer",
    font: "inherit",
  },
  chip: {
    padding: "2px 6px",
    borderRadius: 5,
    fontSize: 11,
    background: "color-mix(in srgb, var(--tr-warn, #c90) 22%, transparent)",
  },
  note: { fontSize: 11, opacity: 0.65, lineHeight: 1.45 },
};

/**
 * Edit one API step.
 *
 * Controlled: every change produces a whole normalised step through `onChange`,
 * so the recorder's array stays the single copy of the recording and this panel
 * holds no state that could drift from it.
 *
 * @param {object} props
 * @param {object} props.step the step being edited
 * @param {function(object): void} props.onChange called with the updated step
 * @param {object} [props.lastRun] the `api` result from the most recent run of
 *   this step, when there has been one — status, timings and per-check verdicts
 * @returns {JSX.Element}
 */
export default function ApiStepEditor({ step, onChange, lastRun }) {
  const s = useMemo(() => normalize(step), [step]);

  // Every edit rebuilds the step through normalize, so an impossible
  // combination cannot be reached by editing — switching a POST to a GET drops
  // the body here rather than leaving it to surprise someone at run time.
  const patch = (fields) => onChange(normalize(Object.assign({}, s, fields)));

  const patchList = (key, i, fields) =>
    patch({
      [key]: s[key].map((item, n) => (n === i ? Object.assign({}, item, fields) : item)),
    });

  const removeAt = (key, i) => patch({ [key]: s[key].filter((_, n) => n !== i) });

  const headers = parseHeaders(s.headersText);
  const hasSecret = headers.some((h) => isSecretHeader(h.key));
  const bodyless = BODYLESS.indexOf(s.method) !== -1;

  return (
    <div style={S.wrap}>
      <div>
        <div style={S.label}>Request</div>
        <div style={S.row}>
          <select
            style={S.select}
            value={s.method}
            onChange={(e) => patch({ method: e.target.value })}
            aria-label="HTTP method"
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <input
            style={S.input}
            value={s.url}
            onChange={(e) => patch({ url: e.target.value })}
            placeholder="/api/plans  or  https://host/path"
            aria-label="URL"
            spellCheck={false}
          />
        </div>
      </div>

      <div>
        <div style={S.label}>Headers</div>
        <textarea
          style={Object.assign({}, S.area, { minHeight: 52 })}
          value={s.headersText}
          onChange={(e) => patch({ headersText: e.target.value })}
          placeholder={"Content-Type: application/json\nAuthorization: Bearer {{token}}"}
          spellCheck={false}
        />
        {hasSecret ? (
          <div style={S.note}>
            <span style={S.chip}>masked</span> A credential header is never shown in the report
            or written into an exported spec as a literal — keep its value in a secret data-set
            entry and refer to it as <code>{"{{name}}"}</code>.
          </div>
        ) : null}
      </div>

      {bodyless ? null : (
        <div>
          <div style={S.label}>Body</div>
          <textarea
            style={S.area}
            value={s.body}
            onChange={(e) => patch({ body: e.target.value })}
            placeholder={'{"email": "{{email}}"}'}
            spellCheck={false}
          />
          <div style={S.note}>
            Sent exactly as typed. <code>{"{{refs}}"}</code> resolve from the active data set and
            from anything an earlier step extracted.
          </div>
        </div>
      )}

      <div>
        <div style={S.label}>Checks</div>
        {s.asserts.length === 0 ? (
          <div style={S.note}>
            No checks — this step passes as long as the call completes. Add a status check to
            make it a test.
          </div>
        ) : null}
        {s.asserts.map((a, i) => {
          const type = ASSERT_TYPES.find((t) => t.id === a.type);
          const allowed = OPS_FOR[a.type] || [];
          return (
            <div key={i} style={Object.assign({}, S.row, { marginBottom: 6, flexWrap: "wrap" })}>
              <select
                style={S.select}
                value={a.type}
                onChange={(e) => {
                  // The operator may not survive the new source, so fall back to
                  // its first legal one rather than leaving a pairing the
                  // evaluator would refuse to score.
                  const next = e.target.value;
                  const ops = OPS_FOR[next] || [];
                  patchList("asserts", i, {
                    type: next,
                    op: ops.indexOf(a.op) === -1 ? ops[0] : a.op,
                  });
                }}
                aria-label="What to check"
              >
                {ASSERT_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
              {type && type.needsPath ? (
                <input
                  style={Object.assign({}, S.input, { flex: "1 1 140px" })}
                  value={a.path || ""}
                  onChange={(e) => patchList("asserts", i, { path: e.target.value })}
                  placeholder={a.type === "header" ? "content-type" : "data.items[0].id"}
                  aria-label="Path"
                  spellCheck={false}
                />
              ) : null}
              <select
                style={S.select}
                value={a.op}
                onChange={(e) => patchList("asserts", i, { op: e.target.value })}
                aria-label="Comparison"
              >
                {OPS.filter((o) => allowed.indexOf(o.id) !== -1).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              {VALUELESS.indexOf(a.op) === -1 ? (
                <input
                  style={Object.assign({}, S.input, { flex: "1 1 120px" })}
                  value={a.expected == null ? "" : a.expected}
                  onChange={(e) => patchList("asserts", i, { expected: e.target.value })}
                  placeholder="expected"
                  aria-label="Expected value"
                  spellCheck={false}
                />
              ) : null}
              <button style={S.btn} onClick={() => removeAt("asserts", i)} title="Remove check">
                ×
              </button>
            </div>
          );
        })}
        <button
          style={S.btn}
          onClick={() =>
            patch({
              asserts: s.asserts.concat([{ type: "status", op: "eq", expected: 200 }]),
            })
          }
        >
          + check
        </button>
      </div>

      <div>
        <div style={S.label}>Extract</div>
        <div style={S.note}>
          Names a value from the response so later steps can use it as{" "}
          <code>{"{{name}}"}</code> — how a token from a sign-in call reaches the calls after it.
        </div>
        {s.extract.map((e, i) => (
          <div key={i} style={Object.assign({}, S.row, { marginTop: 6, flexWrap: "wrap" })}>
            <input
              style={Object.assign({}, S.input, { flex: "1 1 110px" })}
              value={e.name || ""}
              onChange={(ev) => patchList("extract", i, { name: ev.target.value })}
              placeholder="token"
              aria-label="Variable name"
              spellCheck={false}
            />
            <select
              style={S.select}
              value={e.from || "json"}
              onChange={(ev) => patchList("extract", i, { from: ev.target.value })}
              aria-label="Source"
            >
              <option value="json">JSON field</option>
              <option value="header">header</option>
              <option value="status">status</option>
              <option value="body">raw body</option>
            </select>
            {e.from === "status" || e.from === "body" ? null : (
              <input
                style={Object.assign({}, S.input, { flex: "1 1 140px" })}
                value={e.path || ""}
                onChange={(ev) => patchList("extract", i, { path: ev.target.value })}
                placeholder={e.from === "header" ? "set-cookie" : "token"}
                aria-label="Path"
                spellCheck={false}
              />
            )}
            <button style={S.btn} onClick={() => removeAt("extract", i)} title="Remove">
              ×
            </button>
          </div>
        ))}
        <button
          style={Object.assign({}, S.btn, { marginTop: 6 })}
          onClick={() => patch({ extract: s.extract.concat([{ name: "", from: "json", path: "" }]) })}
        >
          + extract
        </button>
      </div>

      {lastRun ? (
        <div>
          <div style={S.label}>Last response</div>
          <div style={S.note}>
            {lastRun.status} {lastRun.statusText} · {lastRun.ms}ms
          </div>
          {(lastRun.results || []).map((r, i) => (
            <div key={i} style={Object.assign({}, S.note, { color: r.ok ? "var(--tr-ok)" : "var(--tr-bad)" })}>
              {r.ok ? "✓" : "✗"} {r.ok ? r.text : r.detail}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** The checks on a step, as sentences — used where the panel is not open. */
export function summariseChecks(step) {
  return normalize(step).asserts.map(describeAssert);
}
