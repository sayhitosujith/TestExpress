const express = require('express');
const router = express.Router();

const defaultCountryCode = process.env.OTP_DEFAULT_COUNTRY_CODE || '+91';

/* ---------------- PROVIDER SELECTION ----------------
 * SMS_PROVIDER = "msg91" | "twilio"
 * Defaults to msg91 when an MSG91 auth key is present (best India delivery),
 * otherwise falls back to twilio.
 */
const provider = (
  process.env.SMS_PROVIDER ||
  (process.env.MSG91_AUTHKEY ? 'msg91' : 'twilio')
).toLowerCase();

/* ---------------- CHANNEL SELECTION ----------------
 * NOTIFY_CHANNEL = "sms" (default) | "whatsapp" | "both"
 * WhatsApp is delivered via Twilio (whatsapp:<from> -> whatsapp:<to>).
 */
const notifyChannel = (process.env.NOTIFY_CHANNEL || 'sms').toLowerCase();

/* ---------------- TWILIO ---------------- */
const twilioSid = process.env.TWILIO_ACCOUNT_SID;
const twilioToken = process.env.TWILIO_AUTH_TOKEN;
const twilioFrom = process.env.TWILIO_PHONE_NUMBER;
// WhatsApp sender, e.g. "whatsapp:+14155238886" (Twilio Sandbox number on trial).
const twilioWhatsAppFrom = process.env.TWILIO_WHATSAPP_FROM;
let twilioClient = null;
if (twilioSid && twilioSid.startsWith('AC') && twilioToken) {
  try {
    twilioClient = require('twilio')(twilioSid, twilioToken);
  } catch (err) {
    console.error('Twilio init failed:', err.message);
  }
}

/* ---------------- MSG91 ---------------- */
const msg91AuthKey = process.env.MSG91_AUTHKEY;
const msg91TemplateId = process.env.MSG91_TEMPLATE_ID; // DLT template for scheduling
const msg91TemplateIdRescheduled =
  process.env.MSG91_TEMPLATE_ID_RESCHEDULED || msg91TemplateId; // DLT template for reschedule
const msg91TemplateIdCancelled =
  process.env.MSG91_TEMPLATE_ID_CANCELLED || msg91TemplateId; // DLT template for cancellation
const msg91SenderId = process.env.MSG91_SENDER_ID; // 6-char DLT header (optional if in template)

// E.164 with leading "+" (Twilio wants this).
function toE164(mobile) {
  const trimmed = String(mobile || '').trim();
  if (trimmed.startsWith('+')) return trimmed.replace(/\s/g, '');
  const digits = trimmed.replace(/\D/g, '');
  return `${defaultCountryCode}${digits}`;
}

// Digits only with country code, no "+" (MSG91 wants this, e.g. 919480860587).
function toMsg91Mobile(mobile) {
  return toE164(mobile).replace(/^\+/, '');
}

async function sendViaTwilio({ mobile, body }) {
  if (!twilioClient || !twilioFrom) {
    const e = new Error(
      'Twilio sender not configured. Set TWILIO_PHONE_NUMBER in the backend .env.',
    );
    e.configError = true;
    throw e;
  }
  const msg = await twilioClient.messages.create({
    to: toE164(mobile),
    from: twilioFrom,
    body,
  });
  return { channel: 'sms', sid: msg.sid, status: msg.status };
}

async function sendViaWhatsApp({ mobile, body }) {
  if (!twilioClient || !twilioWhatsAppFrom) {
    const e = new Error(
      'WhatsApp sender not configured. Set TWILIO_WHATSAPP_FROM in the backend .env.',
    );
    e.configError = true;
    throw e;
  }
  const from = twilioWhatsAppFrom.startsWith('whatsapp:')
    ? twilioWhatsAppFrom
    : `whatsapp:${twilioWhatsAppFrom}`;
  const msg = await twilioClient.messages.create({
    to: `whatsapp:${toE164(mobile)}`,
    from,
    body,
  });
  return { channel: 'whatsapp', sid: msg.sid, status: msg.status };
}

async function sendViaMsg91({ mobile, vars, templateId }) {
  if (!msg91AuthKey || !templateId) {
    const e = new Error(
      'MSG91 not configured. Set MSG91_AUTHKEY and MSG91_TEMPLATE_ID in the backend .env.',
    );
    e.configError = true;
    throw e;
  }
  // MSG91 v5 Flow API. The variable keys (date/time/name) must match the
  // placeholders in your DLT-approved template.
  const recipient = { mobiles: toMsg91Mobile(mobile), ...vars };
  const payload = {
    template_id: templateId,
    recipients: [recipient],
  };
  if (msg91SenderId) payload.sender = msg91SenderId;

  const resp = await fetch('https://control.msg91.com/api/v5/flow/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      authkey: msg91AuthKey,
    },
    body: JSON.stringify(payload),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || data.type === 'error') {
    throw new Error(data.message || `MSG91 request failed (HTTP ${resp.status})`);
  }
  return { channel: 'sms', provider: 'msg91', ...data };
}

// Send one SMS via the configured provider (msg91 or twilio).
function sendSms({ mobile, body, vars, templateId }) {
  return provider === 'msg91'
    ? sendViaMsg91({ mobile, vars, templateId })
    : sendViaTwilio({ mobile, body });
}

// POST /api/notify/appointment  { mobile, date, time, name, event }
// event: "scheduled" (default) | "rescheduled" | "cancelled"
router.post('/appointment', async (req, res) => {
  const { mobile, date, time, name, event } = req.body;
  if (!mobile || !date) {
    return res.status(400).json({ error: 'mobile and date are required' });
  }

  const ev = String(event || 'scheduled').toLowerCase();
  const greeting = name ? `Hi ${name}, ` : '';
  const when = time ? `${date} at ${time}` : date;

  let body;
  if (ev === 'cancelled') {
    body = `${greeting}your appointment on ${when} has been cancelled. — Toothx`;
  } else if (ev === 'rescheduled') {
    body = `${greeting}your appointment has been rescheduled to ${when}. — Toothx`;
  } else {
    body = `${greeting}your appointment has been scheduled on ${when}. — Toothx`;
  }

  const vars = { date, time: time || '', name: name || '' };
  let templateId = msg91TemplateId;
  if (ev === 'cancelled') templateId = msg91TemplateIdCancelled;
  else if (ev === 'rescheduled') templateId = msg91TemplateIdRescheduled;

  const channels =
    notifyChannel === 'both' ? ['sms', 'whatsapp'] : [notifyChannel];

  const sent = [];
  const failed = [];
  for (const ch of channels) {
    try {
      if (ch === 'whatsapp') {
        sent.push(await sendViaWhatsApp({ mobile, body }));
      } else {
        sent.push(await sendSms({ mobile, body, vars, templateId }));
      }
    } catch (err) {
      console.error(`Appointment notify failed (${ch}, ${ev}):`, err.message);
      failed.push({ channel: ch, error: err.message });
    }
  }

  if (sent.length === 0) {
    // Nothing delivered — surface a config error (500) if that's the cause.
    const isConfig = failed.every((f) => /not configured/i.test(f.error));
    return res.status(isConfig ? 500 : 502).json({
      error: failed.map((f) => `${f.channel}: ${f.error}`).join('; '),
      failed,
    });
  }

  res.json({ provider, event: ev, sent, failed });
});

// POST /api/notify/test  { mobile, channel? }
// Fires a test notification without booking. channel overrides NOTIFY_CHANNEL
// for this call: "sms" | "whatsapp" | "both".
router.post('/test', async (req, res) => {
  const { mobile, channel } = req.body;
  if (!mobile) return res.status(400).json({ error: 'mobile is required' });

  const ch = String(channel || notifyChannel).toLowerCase();
  const channels = ch === 'both' ? ['sms', 'whatsapp'] : [ch];
  const body = 'Test message from Toothx — your notifications are working. ✅';
  const vars = { date: 'TEST', time: '', name: '' };

  const sent = [];
  const failed = [];
  for (const c of channels) {
    try {
      if (c === 'whatsapp') {
        sent.push(await sendViaWhatsApp({ mobile, body }));
      } else {
        sent.push(await sendSms({ mobile, body, vars, templateId: msg91TemplateId }));
      }
    } catch (err) {
      console.error(`Test notify failed (${c}):`, err.message);
      failed.push({ channel: c, error: err.message });
    }
  }

  res.status(sent.length ? 200 : 502).json({ provider, sent, failed });
});

module.exports = router;
