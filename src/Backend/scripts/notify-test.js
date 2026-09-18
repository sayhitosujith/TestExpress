// Fire a test notification without booking an appointment.
// Usage: npm run notify:test -- <mobile> [sms|whatsapp|both]
// Requires the backend to be running (npm run dev / npm run server).

const [, , mobile, channel] = process.argv;

if (!mobile) {
  console.error('Usage: npm run notify:test -- <mobile> [sms|whatsapp|both]');
  process.exit(1);
}

const base = process.env.API_URL || 'http://localhost:5000';

fetch(`${base}/api/notify/test`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ mobile, ...(channel ? { channel } : {}) }),
})
  .then(async (r) => {
    const data = await r.json().catch(() => ({}));
    console.log(`HTTP ${r.status}`);
    console.log(JSON.stringify(data, null, 2));
    process.exit(r.ok ? 0 : 1);
  })
  .catch((e) => {
    console.error('Request failed:', e.message);
    console.error('Is the backend running? Start it with: npm run dev (or npm run server)');
    process.exit(1);
  });
