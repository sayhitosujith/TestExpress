const express = require('express');
const router = express.Router();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
// Default country code prepended to a bare local mobile number (E.164 requires it).
const defaultCountryCode = process.env.OTP_DEFAULT_COUNTRY_CODE || '+91';

// Twilio requires the account SID to start with "AC". Only build the client when
// the creds look real — otherwise the constructor throws and crashes the server,
// and we want the routes to return a clean "not configured" error instead.
let client = null;
if (accountSid && accountSid.startsWith('AC') && authToken && verifyServiceSid) {
  try {
    client = require('twilio')(accountSid, authToken);
  } catch (err) {
    console.error('Twilio init failed:', err.message);
  }
}

// Turn a raw mobile input into an E.164 number Twilio accepts.
function toE164(mobile) {
  const trimmed = String(mobile || '').trim();
  if (trimmed.startsWith('+')) return trimmed.replace(/\s/g, '');
  const digits = trimmed.replace(/\D/g, '');
  return `${defaultCountryCode}${digits}`;
}

function ensureConfigured(res) {
  if (!client || !verifyServiceSid) {
    res.status(500).json({
      error:
        'OTP service not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_VERIFY_SERVICE_SID in the backend .env.',
    });
    return false;
  }
  return true;
}

// POST /api/otp/send  { mobile }
router.post('/send', async (req, res) => {
  const { mobile } = req.body;
  if (!mobile) return res.status(400).json({ error: 'mobile is required' });
  if (!ensureConfigured(res)) return;

  try {
    const to = toE164(mobile);
    const verification = await client.verify.v2
      .services(verifyServiceSid)
      .verifications.create({ to, channel: 'sms' });

    res.json({ status: verification.status, to });
  } catch (err) {
    console.error('OTP send failed:', err.status, err.code, err.message);
    res.status(502).json({
      error: err.message || 'Failed to send OTP. Please try again.',
      code: err.code,
    });
  }
});

// POST /api/otp/verify  { mobile, code }
router.post('/verify', async (req, res) => {
  const { mobile, code } = req.body;
  if (!mobile || !code)
    return res.status(400).json({ error: 'mobile and code are required' });
  if (!ensureConfigured(res)) return;

  try {
    const to = toE164(mobile);
    const check = await client.verify.v2
      .services(verifyServiceSid)
      .verificationChecks.create({ to, code });

    if (check.status === 'approved') {
      return res.json({ verified: true });
    }
    return res.status(400).json({ verified: false, error: 'Invalid or expired OTP' });
  } catch (err) {
    // Twilio returns 404 on a code that expired / was never sent.
    console.error('OTP verify failed:', err.message);
    res.status(400).json({ verified: false, error: 'Invalid or expired OTP' });
  }
});

module.exports = router;
