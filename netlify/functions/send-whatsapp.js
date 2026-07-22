exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  const from       = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";

  if (!accountSid || !authToken) {
    console.warn("Twilio credentials not configured — skipping WhatsApp notification");
    return { statusCode: 200, body: JSON.stringify({ skipped: true }) };
  }

  let to, message;
  try {
    ({ to, message } = JSON.parse(event.body || "{}"));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON body" }) };
  }

  if (!to || !message) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing 'to' or 'message'" }) };
  }

  const toWhatsApp = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  const params = new URLSearchParams({ From: from, To: toWhatsApp, Body: message });

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      console.error("Twilio error:", data.message);
      return { statusCode: res.status, body: JSON.stringify({ error: data.message }) };
    }
    return { statusCode: 200, body: JSON.stringify({ sid: data.sid }) };
  } catch (err) {
    console.error("send-whatsapp error:", err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
