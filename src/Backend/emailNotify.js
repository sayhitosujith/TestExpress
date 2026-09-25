// Email notifications via Resend's HTTPS API.
//
// Not SMTP: Render's outbound network blocks every SMTP port regardless of
// target or IP version (465 timed out; 587 then failed with ENETUNREACH on
// an IPv6 route that does not exist here; 587 forced over IPv4 timed out
// too) -- confirmed by trying all three from this exact deployment. HTTPS on
// 443 is not blocked, so an email API is the fix, not another SMTP variant.
//
// Same "optional provider" contract as routes/notify.js's SMS providers:
// unconfigured means silently skipped, not a thrown error, so a fresh install
// with no RESEND_API_KEY set still accepts contact-form submissions.
const fs = require('fs');
const path = require('path');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_API_URL = 'https://api.resend.com/emails';
// The shared, unverified sending address every new Resend account gets.
// Resend accepts mail from it addressed ONLY to the account's own verified
// email -- fine for confirming sending works at all, not for real visitors
// or admin-created accounts. Switching to a real domain later is an env var
// change here, not a code change: verify it with Resend, then set
// RESEND_FROM_EMAIL to an address on it.
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
// Where notifications land. No GMAIL_USER to fall back to any more, so this
// has to be set explicitly for sendContactNotification to have anywhere to go.
const contactNotifyEmail = process.env.CONTACT_NOTIFY_EMAIL;
// Where the access-key email's link points. Defaults to the deployed
// frontend rather than localhost, so an email sent from a Render backend
// still links somewhere the recipient can actually reach. The origin only --
// see signInUrl in sendAccountAccessKey for the page it is joined with.
const APP_ORIGIN = (process.env.APP_URL || 'https://testexpress-qa.netlify.app').replace(/\/+$/, '');

function isConfigured() {
  return Boolean(RESEND_API_KEY && contactNotifyEmail);
}

/**
 * Checks the Resend API key without sending anything.
 *
 * `isConfigured()` only means the env vars were non-empty -- it says
 * nothing about whether Resend actually accepts the key. This is what
 * surfaces a revoked or mistyped one, since every send path here only logs
 * its real failure server-side and answers the caller as if nothing went
 * wrong.
 *
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
async function verifyConnection() {
  if (!RESEND_API_KEY) return { ok: false, reason: 'not configured' };
  try {
    const res = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
    });
    if (res.ok) return { ok: true };
    const body = await res.json().catch(() => ({}));
    return { ok: false, reason: body.message || `Resend responded ${res.status}` };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

/**
 * Sends one email through Resend's HTTPS API.
 *
 * The one place the {from, to, replyTo, subject, text, html, attachments}
 * shape every send function below builds gets translated into Resend's
 * request body -- so a second provider, or a move back to SMTP once Render's
 * block is confirmed lifted, is a change to this one function.
 *
 * @returns {Promise<{sent: boolean, reason?: string}>}
 */
async function sendViaResend({ from, to, replyTo, subject, text, html, attachments }) {
  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(to) ? to : [to],
        reply_to: replyTo,
        subject,
        text,
        html,
        attachments: attachments && attachments.length ? attachments : undefined,
      }),
    });
    if (res.ok) return { sent: true };
    const body = await res.json().catch(() => ({}));
    return { sent: false, reason: body.message || `Resend responded ${res.status}` };
  } catch (err) {
    return { sent: false, reason: err.message };
  }
}

// ---- shared HTML template ------------------------------------------------
// One card, reused by all three emails below, so "professional" is a property
// of this file rather than something each send function tries to reproduce.
// Inline styles throughout -- Gmail, Outlook and most mobile mail clients
// strip <style> blocks, so anything not inline simply would not render.

const BRAND_NAME = 'TestExpress';
// The same green the app draws itself in everywhere else (Tailwind's
// green-600), so the email reads as the same product rather than a generic
// notification.
const BRAND_COLOR = '#16a34a';

// Sent as an attachment rather than a hosted URL -- attachments render in
// every mail client with images enabled, whereas a remote <img src> is exactly
// the kind of thing Gmail/Outlook block by default until the recipient
// clicks "show images". Read once at startup rather than per send.
//
// `content_id` is Resend's documented equivalent of nodemailer's `cid`, for
// referencing an attachment inline via `<img src="cid:...">` instead of it
// only showing up as a downloadable file. Not independently verified
// against a real delivered email at the time this was written -- check that
// the logo actually renders inline the first time a test email arrives,
// rather than as a bare attachment or a broken image icon.
const LOGO_CID = 'testexpress-logo';
let logoAttachment = null;
try {
  const logoBuffer = fs.readFileSync(path.join(__dirname, 'assets', 'email-logo.png'));
  logoAttachment = {
    filename: 'testexpress-logo.png',
    content: logoBuffer.toString('base64'),
    content_id: LOGO_CID,
  };
} catch (err) {
  console.warn('[emailNotify] could not read the email logo asset:', err.message);
}

/**
 * Escapes text bound for HTML.
 *
 * Every value this file puts in an email body is something a visitor typed
 * into the public Contact Us form -- unescaped, a message containing
 * `<img src=x onerror=...>` would run in whichever mail client renders it.
 */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escaped text with line breaks turned into `<br>`, for a multi-line message. */
function escapeHtmlMultiline(value) {
  return escapeHtml(value).replace(/\n/g, '<br>');
}

/**
 * Wraps a fragment of already-safe HTML in the branded card every outgoing
 * email shares: a green header bearing the wordmark, the body, a sign-off
 * signature, and a muted footer note.
 *
 * @param {{heading: string, bodyHtml: string, footerNote?: string, signOff?: boolean}} fields
 *   `signOff` is on by default -- every email here is either addressed to a
 *   visitor or is itself the reply an admin wrote, and both read as correspondence
 *   from the team. The one exception is the internal new-submission notice,
 *   which is a forwarded message rather than one, and passes `signOff: false`.
 * @returns {string} a full HTML document.
 */
function renderEmail({ heading, bodyHtml, footerNote, signOff = true }) {
  const signature = signOff
    ? `<p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #f3f4f6;color:#374151;">
         Best regards,<br>
         <strong>The ${BRAND_NAME} Team</strong>
       </p>
       <img src="cid:${LOGO_CID}" alt="${BRAND_NAME}" width="160" style="margin-top:16px;display:block;border:0;">`
    : '';
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background-color:#f3f4f6;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
            <tr>
              <td style="background-color:${BRAND_COLOR};padding:20px 32px;">
                <span style="font-size:18px;font-weight:800;font-style:italic;letter-spacing:0.06em;color:#ffffff;">${BRAND_NAME}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 16px;font-size:18px;line-height:1.4;font-weight:700;color:#111827;">${heading}</h1>
                <div style="font-size:14px;line-height:1.6;color:#374151;">${bodyHtml}${signature}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;background-color:#f9fafb;border-top:1px solid #e5e7eb;">
                <p style="margin:0;font-size:12px;line-height:1.5;color:#9ca3af;">${footerNote || `This is an automated message from ${BRAND_NAME}.`}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** The plain-text sign-off, appended to every customer-facing text body. */
const TEXT_SIGN_OFF = `\n\nBest regards,\nThe ${BRAND_NAME} Team`;

/**
 * Notifies CONTACT_NOTIFY_EMAIL of a new Contact Us submission.
 *
 * Never throws -- a delivery failure must not turn into a 500 for a visitor
 * whose message was already saved to the database. Callers just fire this
 * and log what comes back.
 *
 * @param {{name: string, email: string, subject?: string, message: string}} fields
 * @returns {Promise<{sent: boolean, reason?: string}>}
 */
async function sendContactNotification({ name, email, subject, message }) {
  if (!isConfigured()) {
    return { sent: false, reason: 'not configured' };
  }
  try {
    const result = await sendViaResend({
      from: `${BRAND_NAME} Contact Form <${RESEND_FROM_EMAIL}>`,
      to: contactNotifyEmail,
      replyTo: email,
      subject: `[Contact form] ${subject && subject.trim() ? subject.trim() : 'New message'}`,
      text: `From: ${name} <${email}>\n\n${message}`,
      html: renderEmail({
        heading: 'New Contact Us submission',
        bodyHtml:
          `<p style="margin:0 0 12px;"><strong>${escapeHtml(name)}</strong> ` +
          `&lt;<a href="mailto:${escapeHtml(email)}" style="color:${BRAND_COLOR};text-decoration:none;">${escapeHtml(email)}</a>&gt; wrote:</p>` +
          `<div style="margin:0;padding:16px;background-color:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">` +
          `${escapeHtmlMultiline(message)}</div>`,
        footerNote: 'Reply to this email to answer them directly, or use the Contact messages panel in Super Admin.',
        signOff: false,
      }),
    });
    return result;
  } catch (err) {
    return { sent: false, reason: err.message };
  }
}

/**
 * Acknowledges a Contact Us submission to whoever just sent it.
 *
 * Fired once, right after the submission is saved -- not a substitute for an
 * admin's actual reply (sendContactReply), just the immediate "we got it" a
 * visitor expects instead of silence. Never throws, same contract as the
 * other two: an unsent acknowledgement must not turn into a 500 for someone
 * whose message was already saved.
 *
 * @param {{name: string, email: string, subject?: string}} fields
 * @returns {Promise<{sent: boolean, reason?: string}>}
 */
async function sendContactAutoReply({ name, email, subject }) {
  if (!isConfigured()) {
    return { sent: false, reason: 'not configured' };
  }
  try {
    const result = await sendViaResend({
      from: `${BRAND_NAME} <${RESEND_FROM_EMAIL}>`,
      to: email,
      replyTo: contactNotifyEmail,
      subject: `Re: ${subject && subject.trim() ? subject.trim() : `Your message to ${BRAND_NAME}`}`,
      text:
        `Hi ${name},\n\n` +
        `Thanks for contacting ${BRAND_NAME}. One of our team members will get back to you within 24 hours.` +
        TEXT_SIGN_OFF,
      html: renderEmail({
        heading: "We've received your message",
        bodyHtml:
          `<p style="margin:0 0 12px;">Hi ${escapeHtml(name)},</p>` +
          `<p style="margin:0;">Thanks for contacting ${BRAND_NAME}. One of our team members will get back ` +
          `to you within <strong>24 hours</strong>.</p>`,
        footerNote: `This is an automated acknowledgement from ${BRAND_NAME} — no need to reply to it.`,
      }),
      attachments: logoAttachment ? [logoAttachment] : [],
    });
    return result;
  } catch (err) {
    return { sent: false, reason: err.message };
  }
}

/**
 * Emails an admin's reply back to whoever submitted a Contact Us message.
 *
 * Never throws, same contract as sendContactNotification -- the caller
 * decides what an unsent reply means (here, the route refuses to record a
 * reply that never actually reached the person it was meant for).
 *
 * @param {{to: string, name: string, subject?: string, originalMessage: string, reply: string}} fields
 * @returns {Promise<{sent: boolean, reason?: string}>}
 */
async function sendContactReply({ to, name, subject, originalMessage, reply }) {
  if (!isConfigured()) {
    return { sent: false, reason: 'not configured' };
  }
  try {
    const result = await sendViaResend({
      from: `${BRAND_NAME} Support <${RESEND_FROM_EMAIL}>`,
      to,
      replyTo: contactNotifyEmail,
      subject: `Re: ${subject && subject.trim() ? subject.trim() : `Your message to ${BRAND_NAME}`}`,
      text:
        `Hi ${name},\n\n${reply}` +
        TEXT_SIGN_OFF +
        `\n\n---\nYour original message:\n${originalMessage}`,
      html: renderEmail({
        heading: `Reply from ${BRAND_NAME} Support`,
        bodyHtml:
          `<p style="margin:0 0 12px;">Hi ${escapeHtml(name)},</p>` +
          `<p style="margin:0 0 20px;">${escapeHtmlMultiline(reply)}</p>` +
          `<div style="padding:14px 16px;background-color:#f9fafb;border-left:3px solid #d1d5db;border-radius:4px;">` +
          `<p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:#6b7280;">Your original message</p>` +
          `<p style="margin:0;font-size:13px;color:#6b7280;">${escapeHtmlMultiline(originalMessage)}</p>` +
          `</div>`,
        footerNote: `Reply to this email to keep the conversation with ${BRAND_NAME} Support going.`,
      }),
      attachments: logoAttachment ? [logoAttachment] : [],
    });
    return result;
  } catch (err) {
    return { sent: false, reason: err.message };
  }
}

/** `accessKeyExpiresAt` as something a recipient can read without doing math. */
function formatExpiry(accessKeyExpiresAt) {
  return (
    new Date(accessKeyExpiresAt).toLocaleString('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC',
    }) + ' UTC'
  );
}

/**
 * Emails a freshly created (or reset) account its temporary access key.
 *
 * Sent instead of an administrator having to invent a password and relay it
 * out of band -- see accessKeys.js for what the key actually is and how long
 * it lasts. Never throws, same contract as the other sends here: a delivery
 * failure is the caller's to report, not this function's to escalate.
 *
 * @param {{name: string, email: string, phoneNumber?: string, payment?: string,
 *   role?: string, canSignIn: boolean, accessKey: string, accessKeyExpiresAt: string}} fields
 * @returns {Promise<{sent: boolean, reason?: string}>}
 */
async function sendAccountAccessKey({
  name,
  email,
  phoneNumber,
  payment,
  role,
  canSignIn,
  accessKey,
  accessKeyExpiresAt,
}) {
  if (!isConfigured()) {
    return { sent: false, reason: 'not configured' };
  }
  const expiry = formatExpiry(accessKeyExpiresAt);
  // Carries the credentials themselves rather than pointing at a bare sign-in
  // page -- clicking is what verifies the key, not the first step of a form
  // to retype it into. The destination page (VerifyAccessKey.jsx) checks the
  // key, then requires a real password before it signs anyone in with it.
  const signInUrl =
    `${APP_ORIGIN}/verify-access-key?` +
    new URLSearchParams({ email, key: accessKey }).toString();
  const rows = [
    ['Account', `${name} (${email})`],
    ['Phone', phoneNumber || '—'],
    ['Payment', payment || '—'],
    ['Role', role || '—'],
    ['Can sign in', canSignIn ? 'Yes' : 'No'],
  ];
  try {
    const result = await sendViaResend({
      from: `${BRAND_NAME} <${RESEND_FROM_EMAIL}>`,
      to: email,
      replyTo: contactNotifyEmail,
      subject: `Your ${BRAND_NAME} account is ready`,
      text:
        `Hi ${name},\n\n` +
        `An administrator created a ${BRAND_NAME} account for you.\n\n` +
        rows.map(([label, value]) => `${label}: ${value}`).join('\n') +
        `\nAccess key: ${accessKey}\n` +
        `Valid for: 72 hours (until ${expiry})\n\n` +
        `Set up your account here: ${signInUrl}\n` +
        `That link checks the access key and asks you to choose your own ` +
        `password -- it stops working after it expires, so ask an ` +
        `administrator to send a new one if that happens first.` +
        TEXT_SIGN_OFF,
      html: renderEmail({
        heading: `Hi ${escapeHtml(name)}, your account is ready`,
        bodyHtml:
          `<p style="margin:0 0 16px;">An administrator created a ${BRAND_NAME} account for you. ` +
          `Click below to verify your access key and choose your own password.</p>` +
          `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border-collapse:collapse;">` +
          rows
            .map(
              ([label, value]) =>
                `<tr><td style="padding:6px 12px 6px 0;color:#6b7280;font-size:13px;white-space:nowrap;">${escapeHtml(label)}</td>` +
                `<td style="padding:6px 0;color:#111827;font-size:13px;font-weight:600;">${escapeHtml(value)}</td></tr>`,
            )
            .join('') +
          `</table>` +
          `<div style="padding:14px 16px;background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin:0 0 12px;">` +
          `<p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:#15803d;">Access key</p>` +
          `<p style="margin:0;font-size:18px;font-weight:700;letter-spacing:0.04em;color:#111827;font-family:monospace;">${escapeHtml(accessKey)}</p>` +
          `</div>` +
          `<div style="text-align:center;margin:0 0 16px;">` +
          `<a href="${signInUrl}" style="display:inline-block;padding:10px 24px;background-color:${BRAND_COLOR};color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:8px;">Sign in to ${BRAND_NAME}</a>` +
          `</div>` +
          `<p style="margin:0;font-size:13px;color:#6b7280;">Valid for 72 hours, until <strong>${expiry}</strong>. ` +
          `It stops working after that -- ask an administrator to send a new one if you have not set your password by then.</p>`,
        footerNote: `This is an automated message from ${BRAND_NAME}.`,
      }),
      attachments: logoAttachment ? [logoAttachment] : [],
    });
    return result;
  } catch (err) {
    return { sent: false, reason: err.message };
  }
}

/**
 * Emails an account whose paid-plan billing cycle just lapsed: sign-in is
 * now blocked, and this is the fresh checkout link that lifts it. Sent at
 * the moment of lapse rather than as advance warning -- see planCycles.js
 * for why. Never throws, same contract as the other sends here.
 *
 * @param {{name: string, email: string, plan: string, checkoutToken: string}} fields
 * @returns {Promise<{sent: boolean, reason?: string}>}
 */
async function sendPlanRenewal({ name, email, plan, checkoutToken }) {
  if (!isConfigured()) {
    return { sent: false, reason: 'not configured' };
  }
  try {
    const checkoutUrl = `${APP_ORIGIN}/Checkout?${new URLSearchParams({ token: checkoutToken })}`;
    const result = await sendViaResend({
      from: `${BRAND_NAME} <${RESEND_FROM_EMAIL}>`,
      to: email,
      replyTo: contactNotifyEmail,
      subject: `Your ${BRAND_NAME} ${plan} plan needs renewing`,
      text:
        `Hi ${name},\n\n` +
        `Your ${plan} billing cycle has ended, so sign-in is switched off until it is renewed. ` +
        `This does not happen automatically -- pay again here to switch it back on:\n\n` +
        `${checkoutUrl}\n\n` +
        `Nothing about your account or its data has changed; this is only about payment.` +
        TEXT_SIGN_OFF,
      html: renderEmail({
        heading: `Hi ${escapeHtml(name)}, your ${escapeHtml(plan)} plan needs renewing`,
        bodyHtml:
          `<p style="margin:0 0 16px;">Your <strong>${escapeHtml(plan)}</strong> billing cycle has ended, ` +
          `so sign-in is switched off until it is renewed. This does not happen automatically.</p>` +
          `<div style="text-align:center;margin:0 0 16px;">` +
          `<a href="${checkoutUrl}" style="display:inline-block;padding:10px 24px;background-color:${BRAND_COLOR};color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:8px;">Renew ${escapeHtml(plan)}</a>` +
          `</div>` +
          `<p style="margin:0;font-size:13px;color:#6b7280;">Nothing about your account or its data has changed -- this is only about payment.</p>`,
        footerNote: `This is an automated message from ${BRAND_NAME}.`,
      }),
      attachments: logoAttachment ? [logoAttachment] : [],
    });
    return result;
  } catch (err) {
    return { sent: false, reason: err.message };
  }
}

module.exports = {
  sendContactNotification,
  sendContactAutoReply,
  sendContactReply,
  sendAccountAccessKey,
  sendPlanRenewal,
  isConfigured,
  verifyConnection,
};
