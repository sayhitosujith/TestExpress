// Google Sheets as the shared datastore.
//
// Each localStorage collection gets one tab; each record is one row; the first
// row is the header. Column order is taken from the header that is already in
// the sheet, so a human can reorder or add columns without breaking reads.
//
// Two Sheets limits drive the design:
//   * 50,000 characters per cell. Values longer than that are split across
//     numbered continuation columns (`steps`, `steps~2`, `steps~3`, …) and
//     rejoined on read, so a long recording still round-trips intact.
//   * 10,000,000 cells per spreadsheet. Nothing here approaches it once the
//     base64 media is kept out (see mediaDb.js).
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const CELL_LIMIT = 50000;
// Leaves headroom under the hard cap; a value that lands exactly on a boundary
// is far more likely to surface as a confusing API error than a clean split.
const CHUNK = 45000;
const CONT = '~'; // continuation-column marker: `steps~2` continues `steps`

// Every synced collection, and the localStorage key it mirrors. Adding a
// collection is a one-line change here — nothing else in the sync path names
// them individually.
const TABS = {
  recordedTests: { key: 'testrunner.recordedTests', idField: 'id' },
  testProjects: { key: 'testrunner.projects', idField: 'id' },
  appointments: { key: 'appointments', idField: 'id' },
  appointmentHistory: { key: 'appointmentHistory', idField: 'id' },
  doctors: { key: 'doctors', idField: 'license' },
  patients: { key: 'allProfiles', idField: 'phone' },
  users: { key: 'registeredUsers', idField: 'phoneNumber' },
};

/**
 * Reads service-account credentials from the environment.
 *
 * A relative key path is resolved against this directory rather than the
 * process's cwd: the server is started both as `npm run server` from the repo
 * root and as `node index.js` from here, and those give different cwds — a path
 * that worked one way would fail the other.
 */
function credentials() {
  const inline = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const file = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;
  if (inline) return { credentials: JSON.parse(inline), scopes: SCOPES };
  if (file) {
    return {
      keyFile: path.isAbsolute(file) ? file : path.join(__dirname, file),
      scopes: SCOPES,
    };
  }
  return null;
}

/**
 * True when the backend has everything it needs to talk to the sheet. Routes
 * check this and answer 501 rather than 500, so an unconfigured install reports
 * "not set up" instead of looking broken.
 */
function isConfigured() {
  if (!process.env.GOOGLE_SHEET_ID) return false;
  const cred = credentials();
  if (!cred) return false;
  // A keyFile named in .env but not actually on disk is the common half-done
  // state. Treating it as configured turns the next call into an ENOENT from
  // deep inside googleapis; treating it as unconfigured returns the setup steps,
  // which is what someone in that state needs to read.
  if (cred.keyFile && !fs.existsSync(cred.keyFile)) return false;
  return true;
}

let client = null;
function api() {
  if (!isConfigured()) {
    throw new Error(
      'Google Sheets is not configured. Set GOOGLE_SHEET_ID and ' +
        'GOOGLE_SERVICE_ACCOUNT_KEY_FILE (or _KEY) in src/Backend/.env.',
    );
  }
  if (!client) {
    client = google.sheets({
      version: 'v4',
      auth: new google.auth.GoogleAuth(credentials()),
    });
  }
  return client;
}

const sheetId = () => process.env.GOOGLE_SHEET_ID;

/** Creates the tab if the spreadsheet doesn't have it yet. */
async function ensureTab(tab) {
  const sheets = api();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId() });
  const exists = meta.data.sheets.some((s) => s.properties.title === tab);
  if (exists) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId(),
    requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] },
  });
}

// ---- cell splitting ------------------------------------------------------

/** Splits an over-long value into [head, ...continuations]. */
function splitValue(value) {
  const s = String(value ?? '');
  if (s.length <= CELL_LIMIT) return [s];
  const parts = [];
  for (let i = 0; i < s.length; i += CHUNK) parts.push(s.slice(i, i + CHUNK));
  return parts;
}

/**
 * Builds the header for a set of records: every field they use, with extra
 * continuation columns wherever a value needs more than one cell.
 */
function buildHeader(records) {
  const fields = [];
  const widths = {};
  records.forEach((rec) => {
    Object.keys(rec).forEach((f) => {
      if (!fields.includes(f)) fields.push(f);
      const width = splitValue(serialize(rec[f])).length;
      widths[f] = Math.max(widths[f] || 1, width);
    });
  });
  const header = [];
  fields.forEach((f) => {
    for (let i = 1; i <= widths[f]; i++) {
      header.push(i === 1 ? f : `${f}${CONT}${i}`);
    }
  });
  return header;
}

const serialize = (v) =>
  v === null || v === undefined
    ? ''
    : typeof v === 'object'
      ? JSON.stringify(v)
      : String(v);

/** Best-effort inverse of serialize: JSON when it parses, raw text otherwise. */
function deserialize(text) {
  if (text === '') return '';
  const first = text[0];
  if (first === '{' || first === '[') {
    try {
      return JSON.parse(text);
    } catch {
      return text; // a plain string that happens to start with a brace
    }
  }
  return text;
}

// ---- read / write --------------------------------------------------------

/**
 * Returns every record in a tab as an array of objects, rejoining any values
 * that were split across continuation columns. An absent or empty tab reads as
 * [] rather than throwing — a collection nobody has written yet is not an error.
 */
async function readTab(tab) {
  const sheets = api();
  let rows;
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId(),
      range: `${tab}!A1:ZZZ`,
    });
    rows = res.data.values || [];
  } catch (err) {
    if (/Unable to parse range|not found/i.test(err.message)) return [];
    throw err;
  }
  if (rows.length < 2) return [];

  const header = rows[0];
  return rows.slice(1).map((row) => {
    const joined = {};
    header.forEach((col, i) => {
      const [field] = col.split(CONT);
      joined[field] = (joined[field] || '') + (row[i] || '');
    });
    const rec = {};
    Object.entries(joined).forEach(([f, text]) => {
      if (f) rec[f] = deserialize(text);
    });
    return rec;
  });
}

/**
 * Replaces a tab's contents with `records`. A full rewrite rather than a
 * per-row patch: the client always holds the whole collection anyway, and one
 * write costs one API call instead of one per changed row — which matters
 * against the 60-writes-per-minute quota.
 */
async function writeTab(tab, records) {
  const sheets = api();
  await ensureTab(tab);

  const list = Array.isArray(records) ? records : [];
  const header = buildHeader(list);
  const values = [header];

  list.forEach((rec) => {
    const row = [];
    // Walk the header, not the record, so a value's chunks land in the columns
    // reserved for that field even when other records are shorter.
    let field = null;
    let chunks = [];
    header.forEach((col) => {
      const [name, part] = col.split(CONT);
      if (name !== field) {
        field = name;
        chunks = splitValue(serialize(rec[name]));
      }
      row.push(chunks[part ? Number(part) - 1 : 0] ?? '');
    });
    values.push(row);
  });

  // Clear first: a shorter collection must not leave the old tail behind.
  await sheets.spreadsheets.values.clear({
    spreadsheetId: sheetId(),
    range: `${tab}!A1:ZZZ`,
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId(),
    range: `${tab}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values },
  });
  return list.length;
}

module.exports = { TABS, isConfigured, readTab, writeTab, ensureTab };
