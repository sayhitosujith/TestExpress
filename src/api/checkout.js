import axios from "axios";
import { apiMessage } from "./apiError";

const API_BASE = process.env.REACT_APP_API_URL || "";
const CHECKOUT = `${API_BASE}/api/checkout`;

// The payment step between registering and signing in.
//
// No session is sent with any of these, and that is deliberate rather than an
// oversight: the account being paid for cannot sign in yet — sign-in is
// switched off until the checkout settles — so the token returned by `open` is
// what identifies the browser that just registered. Treat it like a one-time
// credential: it is in the URL of the payment page and nowhere else.
//
// Nothing here takes money. See src/Backend/routes/checkout.js.

/**
 * Opens a checkout for an account and a plan.
 *
 * The amount is decided by the server from the plan catalogue, not sent from
 * here — a price the browser could name is a price the browser could set to
 * zero.
 *
 * @param {{email: string, plan: string}} spec
 * @returns {Promise<{checkout: object, gateway: object}>} the checkout and, when
 *   Razorpay is configured, the key id and order id its modal needs. `gateway`
 *   always comes back — `configured: false` is the answer on an install with no
 *   keys, and the page falls back to the simulated step rather than breaking.
 */
export async function openCheckout({ email, plan }) {
  try {
    const { data } = await axios.post(CHECKOUT, { email, plan });
    return data;
  } catch (err) {
    throw new Error(apiMessage(err, "Could not start the payment step"));
  }
}

/**
 * Settles a checkout with what Razorpay handed back.
 *
 * The three fields go to the server unexamined and are believed only if the
 * signature checks out there — the key secret that signs them never reaches the
 * browser, which is what stops this call being something anyone could fake.
 *
 * @param {string} token the checkout's token.
 * @param {object} response Razorpay's success payload.
 * @returns {Promise<{checkout: object, signInEnabled: boolean}>}
 */
export async function verifyCheckout(token, response) {
  try {
    const { data } = await axios.post(`${CHECKOUT}/${token}/verify`, response);
    return data;
  } catch (err) {
    throw new Error(apiMessage(err, "The payment could not be verified"));
  }
}

/**
 * The checkout for a token.
 *
 * What makes the payment page survive a refresh, and what stops a settled
 * checkout being presented as if it were still payable.
 *
 * @param {string} token
 * @returns {Promise<{checkout: object, gateway: object}>} the same pair
 *   `openCheckout` answers with, so a reloaded page can pay without having
 *   remembered anything.
 */
export async function getCheckout(token) {
  try {
    const { data } = await axios.get(`${CHECKOUT}/${token}`);
    return data;
  } catch (err) {
    throw new Error(apiMessage(err, "Could not read this checkout"));
  }
}

/**
 * Settles a checkout as paid.
 *
 * This is the call a real provider's verified callback would replace. On the
 * server it switches sign-in on for the account named in the checkout, which is
 * the only thing that does.
 *
 * @param {string} token
 * @returns {Promise<{checkout: object, signInEnabled: boolean}>}
 */
export async function payCheckout(token) {
  try {
    const { data } = await axios.post(`${CHECKOUT}/${token}/pay`);
    return data;
  } catch (err) {
    throw new Error(apiMessage(err, "The payment could not be completed"));
  }
}

/**
 * Abandons a checkout. The account stays created, on its chosen plan, and
 * unable to sign in until it is paid for.
 *
 * @param {string} token
 * @returns {Promise<object>} the settled checkout.
 */
export async function cancelCheckout(token) {
  try {
    const { data } = await axios.post(`${CHECKOUT}/${token}/cancel`);
    return data.checkout;
  } catch (err) {
    throw new Error(apiMessage(err, "Could not cancel this checkout"));
  }
}
