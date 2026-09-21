import axios from "axios";

const API_BASE = process.env.REACT_APP_API_URL || "";

/** Collections the backend can sync, and whether credentials are in place. */
export async function getSheetsStatus() {
  const { data } = await axios.get(`${API_BASE}/api/sheets`);
  return data;
}

/** Reads a whole collection out of the spreadsheet. */
export async function pullTab(tab) {
  const { data } = await axios.get(`${API_BASE}/api/sheets/${tab}`);
  return Array.isArray(data) ? data : [];
}

/** Replaces a whole collection in the spreadsheet. */
export async function pushTab(tab, records) {
  const { data } = await axios.put(`${API_BASE}/api/sheets/${tab}`, records);
  return data;
}
