// The Qase CSV export — the route into Qase that needs no API token.
//
// Lives beside ./spec.js for the same reason: it is a pure function from the
// generated case shape to a text file, so it is reviewable and testable from
// Node without a browser or a running backend.
//
// FORMAT CAVEAT: Qase publishes the *behaviour* of its importer (a numbered
// line per step, one row per case, steps_actions/steps_results/steps_data as
// the step columns) but not the authoritative header list, and its V2 encoding
// is documented only as "specially encoded" with no spec. So this writes the V1
// shape — numbered lines, one row per case — which is the half that is
// specified. Choose "Qase.io" as the format in Qase's import dialog.
//
// If a header below is wrong for your account, export one existing case from
// the project as CSV and match its header row: that file is the ground truth,
// and only this array has to change.

const COLUMNS = [
  "id",
  "title",
  "description",
  "preconditions",
  "postconditions",
  "severity",
  "priority",
  "behavior",
  "tags",
  "suite",
  "steps_actions",
  "steps_results",
  "steps_data",
];

// RFC 4180: quote everything, double any embedded quote. Unconditional quoting
// rather than quote-when-needed — every field here can contain a comma or a
// newline, and a rule with no exceptions cannot be applied inconsistently.
const cell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

// The step columns are three parallel numbered lists: line N of steps_actions
// pairs with line N of steps_results and steps_data. A step with no expected
// result still gets its numbered line, or every later pairing shifts by one.
const numbered = (steps, field) =>
  (steps || []).map((s, i) => `${i + 1}. ${(s && s[field]) || ""}`).join("\n");

/**
 * Renders reviewed cases as Qase-importable CSV text.
 *
 * @param {Array} cases  generated cases, in the shape storyToCases.js returns
 * @param {string} suiteTitle  the suite column for every row; "" leaves them at the project root
 * @returns {string} CSV text, ready to download
 */
export function toQaseCsv(cases, suiteTitle = "") {
  const rows = (cases || []).map((c) =>
    [
      "", // id — blank means "create new" rather than "update case 4711"
      c.title || "",
      c.description || "",
      c.preconditions || "",
      c.postconditions || "",
      c.severity || "",
      c.priority || "",
      c.behavior || "",
      (c.tags || []).join(","),
      suiteTitle,
      numbered(c.steps, "action"),
      numbered(c.steps, "expected_result"),
      numbered(c.steps, "data"),
    ]
      .map(cell)
      .join(","),
  );

  // \r\n, and a BOM: Excel is the usual next stop for one of these files, and
  // without the BOM it reads UTF-8 as the local codepage and mangles anything
  // non-ASCII.
  return `﻿${[COLUMNS.map(cell).join(","), ...rows].join("\r\n")}\r\n`;
}

/** A filename derived from the story, so a folder of exports stays readable. */
export function csvFileName(storyTitle) {
  const slug =
    String(storyTitle || "test-cases")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "test-cases";
  return `qase-${slug}.csv`;
}

export { COLUMNS as QASE_CSV_COLUMNS };
