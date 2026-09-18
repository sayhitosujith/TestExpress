import axios from "axios";
import { apiMessage } from "./apiError";

const API_BASE = process.env.REACT_APP_API_URL || "";
const PAYMENTS = `${API_BASE}/api/payments`;

/**
 * Every checkout, with the totals worth reading at a glance.
 *
 * Super Admin only — the checkout endpoints themselves are public because a
 * payer cannot sign in yet, but reading everybody's payments is the opposite
 * question. See src/Backend/routes/payments.js.
 *
 * @param {{limit?: number}} [options]
 * @returns {Promise<{payments: object[], summary: object, gateway: object}>}
 */
export async function getPayments({ limit } = {}) {
  try {
    const { data } = await axios.get(PAYMENTS, { params: { limit } });
    return data;
  } catch (err) {
    throw new Error(apiMessage(err, "Could not load payments"));
  }
}
