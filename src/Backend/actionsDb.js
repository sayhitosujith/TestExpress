// Local SQLite store for all user actions (audit log).
// Uses Node's built-in SQLite (node:sqlite, Node >= 22.5) — no external DB or deps.
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, 'actions.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS action_logs (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    action         TEXT NOT NULL,
    appointment_id TEXT,
    patient_name   TEXT,
    phone          TEXT,
    payload        TEXT,
    created_at     TEXT DEFAULT (datetime('now'))
  );
`);

function logAction({ action, appointmentId, patientName, phone, payload }) {
  const info = db
    .prepare(
      `INSERT INTO action_logs (action, appointment_id, patient_name, phone, payload)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      action,
      appointmentId != null ? String(appointmentId) : null,
      patientName || null,
      phone || null,
      payload ? JSON.stringify(payload) : null,
    );
  return Number(info.lastInsertRowid);
}

function listActions({ limit = 100, action } = {}) {
  const rows = action
    ? db
        .prepare(
          `SELECT * FROM action_logs WHERE action = ? ORDER BY id DESC LIMIT ?`,
        )
        .all(action, limit)
    : db
        .prepare(`SELECT * FROM action_logs ORDER BY id DESC LIMIT ?`)
        .all(limit);

  // Parse the stored JSON payload back into an object for convenience.
  return rows.map((r) => ({
    ...r,
    payload: r.payload ? JSON.parse(r.payload) : null,
  }));
}

// ── HomePage analytics ──────────────────────────────────────────────────────
//
// The landing page writes three action names through the same POST above (see
// src/homePageTracking.js). Reading them back is a different job from reading
// the audit log: nobody wants ten thousand rows, they want the shape of them.
//
// Aggregated in SQL rather than in the route, deliberately. The alternative is
// listActions with a large limit and a reduce in JavaScript, which moves every
// row of a growing table across the wire to produce eight numbers, and quietly
// starts lying the moment the limit is reached.

const HOMEPAGE_VIEW = 'homepage_view';
const HOMEPAGE_CTA = 'homepage_cta';
const HOMEPAGE_SECTION = 'homepage_section';

/** A visit id, dug out of the JSON payload. Used often enough to name once. */
const VISIT = "json_extract(payload, '$.visitId')";

/**
 * Clamps a requested window to a whole number of days.
 *
 * The result is interpolated into a SQLite date modifier, so this is also what
 * keeps a query string out of the SQL: anything that is not a number becomes
 * the default, and the modifier is still bound as a parameter.
 */
const windowDays = (days) => {
  const n = Math.round(Number(days));
  if (!Number.isFinite(n)) return 30;
  return Math.min(365, Math.max(1, n));
};

/**
 * What the landing page did over the last `days` days.
 *
 * Counts are deliberately of two kinds and the difference matters when reading
 * them: `clicks` is every press, `visits` is how many different people produced
 * them. A single visitor pressing one button eleven times is a real thing that
 * happens, and reporting only the first number would make it look like traffic.
 *
 * Timestamps are UTC, because created_at is written with datetime('now').
 *
 * @param {{days?: number}} [options] the window, 1–365 days, default 30.
 * @returns {{days: number, visits: number, ctaClicks: number,
 *   visitsWithCta: number, daily: object[], ctas: object[],
 *   sections: object[]}} the summary.
 */
function homePageSummary({ days } = {}) {
  const span = windowDays(days);
  const since = `-${span} days`;

  const one = (sql, ...params) => db.prepare(sql).get(...params);
  const many = (sql, ...params) => db.prepare(sql).all(...params);

  const visits = one(
    `SELECT COUNT(*) AS n FROM action_logs
      WHERE action = ? AND created_at >= datetime('now', ?)`,
    HOMEPAGE_VIEW,
    since,
  ).n;

  const cta = one(
    `SELECT COUNT(*) AS clicks, COUNT(DISTINCT ${VISIT}) AS visits
       FROM action_logs
      WHERE action = ? AND created_at >= datetime('now', ?)`,
    HOMEPAGE_CTA,
    since,
  );

  const daily = many(
    `SELECT date(created_at) AS day, COUNT(*) AS visits
       FROM action_logs
      WHERE action = ? AND created_at >= datetime('now', ?)
      GROUP BY day
      ORDER BY day`,
    HOMEPAGE_VIEW,
    since,
  );

  // Ranked, because "which button do people actually press" is the question.
  const ctas = many(
    `SELECT json_extract(payload, '$.target') AS target,
            COUNT(*) AS clicks,
            COUNT(DISTINCT ${VISIT}) AS visits
       FROM action_logs
      WHERE action = ? AND created_at >= datetime('now', ?)
      GROUP BY target
      ORDER BY clicks DESC`,
    HOMEPAGE_CTA,
    since,
  );

  // Not ranked: the caller puts these back into page order, which is the only
  // order in which "where do people stop" is a readable answer.
  const sections = many(
    `SELECT json_extract(payload, '$.section') AS section,
            COUNT(DISTINCT ${VISIT}) AS visits
       FROM action_logs
      WHERE action = ? AND created_at >= datetime('now', ?)
      GROUP BY section`,
    HOMEPAGE_SECTION,
    since,
  );

  return {
    days: span,
    visits,
    ctaClicks: cta.clicks,
    visitsWithCta: cta.visits,
    // Spread out of their null-prototype rows so the response serialises as
    // plain objects rather than as whatever node:sqlite handed back.
    daily: daily.map((r) => ({ ...r })),
    ctas: ctas.map((r) => ({ ...r })),
    sections: sections.map((r) => ({ ...r })),
  };
}

module.exports = { db, logAction, listActions, homePageSummary };
