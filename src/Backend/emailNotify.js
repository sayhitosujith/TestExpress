// Email notifications via Gmail SMTP.
//
// Same "optional provider" contract as routes/notify.js's SMS providers:
// unconfigured means silently skipped, not a thrown error, so a fresh install
// with no GMAIL_APP_PASSWORD set still accepts contact-form submissions.
const nodemailer = require('nodemailer');

const gmailUser = process.env.GMAIL_USER;
const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;
// Where notifications land. Defaults to the inbox that owns the Gmail
// account itself, so setting only GMAIL_USER/GMAIL_APP_PASSWORD is enough.
const contactNotifyEmail = process.env.CONTACT_NOTIFY_EMAIL || gmailUser;

let transporter = null;
if (gmailUser && gmailAppPassword) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmailUser, pass: gmailAppPassword },
  });
}

function isConfigured() {
  return Boolean(transporter && contactNotifyEmail);
}

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
    await transporter.sendMail({
      from: `TestExpress Contact Form <${gmailUser}>`,
      to: contactNotifyEmail,
      replyTo: email,
      subject: `[Contact form] ${subject && subject.trim() ? subject.trim() : 'New message'}`,
      text: `From: ${name} <${email}>\n\n${message}`,
    });
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: err.message };
  }
}

module.exports = { sendContactNotification, isConfigured };
