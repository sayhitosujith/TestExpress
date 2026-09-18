// Razorpay, as much of it as this app needs: create an order, and check that a
// payment really settled it.
//
// Written against the REST API with fetch and node:crypto rather than pulling
// in the SDK. Two calls and one HMAC do not justify a dependency, and the
// signature check is the security-critical line — it is better read in full
// here than trusted to a wrapper.
//
// **The secret never leaves this process.** The browser is given the key id
// only, which is public by design; the secret authenticates order creation and
// is the HMAC key that proves a payment is genuine. A checkout that trusted the
// browser's word for "payment succeeded" would be a checkout anyone could
// settle from the console, which is exactly what verify() exists to prevent.
const crypto = require('crypto');

const API = 'https://api.razorpay.com/v1';

const keyId = () => process.env.RAZORPAY_KEY_ID || '';
const keySecret = () => process.env.RAZORPAY_KEY_SECRET || '';

/**
 * Whether Razorpay is set up on this install.
 *
 * Checked everywhere rather than assumed, because the app has to work without
 * it: a missing key means the checkout falls back to the simulated step instead
 * of failing, so a developer with no Razorpay account can still run the flow.
 */
const isConfigured = () => Boolean(keyId() && keySecret());

/** Test keys are prefixed rzp_test_; live ones rzp_live_. Worth surfacing. */
const mode = () => (keyId().startsWith('rzp_live') ? 'live' : 'test');

const auth = () =>
  'Basic ' + Buffer.from(`${keyId()}:${keySecret()}`).toString('base64');

/**
 * Creates an order.
 *
 * Razorpay works in the currency's minor unit, so ₹2,499 is 249900 paise. The
 * conversion happens here, once — a rounding error spread across two call sites
 * is how a customer ends up charged ₹14.99.
 *
 * @param {{amount: number, currency: string, receipt: string, notes: object}} spec
 *   the amount in major units (rupees), as the plan catalogue stores it.
 * @returns {Promise<object>} the order, including its id.
 */
async function createOrder({ amount, currency = 'INR', receipt, notes }) {
  if (!isConfigured()) throw new Error('Razorpay is not configured');
  const res = await fetch(`${API}/orders`, {
    method: 'POST',
    headers: { Authorization: auth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: Math.round(Number(amount) * 100),
      currency,
      // Razorpay caps this at 40 characters and rejects anything longer, which
      // a checkout token comfortably is.
      receipt: String(receipt || '').slice(0, 40),
      notes: notes || {},
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(
      (body && body.error && body.error.description) || `Razorpay refused the order (${res.status})`,
    );
    // 429 is Razorpay throttling this key, not a refusal of the payment — a
    // distinction worth carrying, because the two have opposite remedies:
    // one is "wait a moment and try again", the other is "something is wrong
    // with the request". Test keys are throttled far harder than live ones.
    err.rateLimited = res.status === 429;
    err.status = res.status;
    throw err;
  }
  return body;
}

/**
 * Whether a webhook really came from Razorpay.
 *
 * The browser telling us a payment succeeded is one route; this is the other,
 * and on a live account it is the more important one. A payer can close the tab
 * between paying and the success callback firing — the money has moved and the
 * account would stay locked out, which is the worst failure this flow has. The
 * webhook arrives server-to-server and does not care what the browser did.
 *
 * Signed with the webhook secret, which is a different secret from the API key
 * and is set separately in the dashboard. The whole payload is the message, so
 * it must be the raw body: parsing and re-serialising JSON reorders keys and
 * the signature stops matching.
 *
 * @param {Buffer|string} rawBody exactly the bytes Razorpay POSTed.
 * @param {string} signature the X-Razorpay-Signature header.
 * @returns {boolean}
 */
function verifyWebhook(rawBody, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
  if (!secret || !signature || !rawBody) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(String(signature), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Whether webhooks are set up. Without one, a closed tab loses a payment. */
const webhooksConfigured = () => Boolean(process.env.RAZORPAY_WEBHOOK_SECRET);

/**
 * Whether a payment genuinely settled an order.
 *
 * This is the whole of the trust model. Razorpay signs `order_id|payment_id`
 * with the key secret; anyone who can produce that HMAC has the secret, and the
 * secret is only ever on this server. Without this check, the browser's
 * "payment succeeded" callback would be the only evidence — and that callback
 * is a function anybody can call.
 *
 * Compared with timingSafeEqual rather than `===`: a string comparison that
 * returns early leaks, byte by byte, how much of a guess was right.
 *
 * @param {{orderId: string, paymentId: string, signature: string}} claim what
 *   the browser says happened.
 * @returns {boolean} whether Razorpay signed it.
 */
function verify({ orderId, paymentId, signature }) {
  if (!isConfigured() || !orderId || !paymentId || !signature) return false;
  const expected = crypto
    .createHmac('sha256', keySecret())
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(String(signature), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * What the payment page needs to open the checkout modal.
 *
 * The key id and nothing else — see the note at the top about the secret.
 */
const publicConfig = () => ({ configured: isConfigured(), keyId: keyId(), mode: mode() });

module.exports = {
  isConfigured,
  mode,
  createOrder,
  verify,
  verifyWebhook,
  webhooksConfigured,
  publicConfig,
};
