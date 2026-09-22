const express = require('express');
const cors = require('cors');
// By absolute path, not from the working directory. Started from the repo
// root -- which is what "node src/Backend/index.js" does -- a bare config()
// finds no .env, and the server then boots perfectly happily with no
// DATABASE_URL: /health answers 200 while every database route answers 501.
// That failure reads as a broken database rather than as a server started
// from the wrong folder. Same reasoning as scripts/hash-passwords.js.
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

// Imported for the startup checks below, so a missing signing key — or a Sheets
// key file that was never copied onto this machine — is reported once at boot
// rather than found out when a restart signs everybody out, or when someone
// notices the sheet has not changed in a fortnight.
const fs = require('fs');
const path = require('path');
const sessions = require('./sessions');

const usersRouter = require('./routes/users');
const authRouter = require('./routes/auth');
const adminRouter = require('./routes/admin');
const plansRouter = require('./routes/plans');
const checkoutRouter = require('./routes/checkout');
const paymentsRouter = require('./routes/payments');
const corporateRouter = require('./routes/corporate');
const otpRouter = require('./routes/otp');
const notifyRouter = require('./routes/notify');
const actionsRouter = require('./routes/actions');
const homePageAnalyticsRouter = require('./routes/homePageAnalytics');
const appointmentsRouter = require('./routes/appointments');
const patientsRouter = require('./routes/patients');
const testrunnerRouter = require('./routes/testrunner');
const mobileRouter = require('./routes/mobile');
const jmeterRouter = require('./routes/jmeter');
const sheetsRouter = require('./routes/sheets');
const registrationsRouter = require('./routes/registrations');
const doctorsRouter = require('./routes/doctors');
const appointmentsOnlineRouter = require('./routes/appointmentsOnline');
const appointmentHistoryRouter = require('./routes/appointmentHistory');
const patientsOnlineRouter = require('./routes/patientsOnline');
const testRunnerOnlineRouter = require('./routes/testRunnerOnline');
const qaseRouter = require('./routes/qase');
const settingsRouter = require('./routes/settings');
const contactRouter = require('./routes/contact');

const app = express();

app.use(cors());

// Razorpay's webhook, mounted before the JSON parser and with a raw one of its
// own. The signature is over the exact bytes Razorpay sent: parsing them to an
// object and re-serialising reorders keys and the signature stops matching, so
// this route must see the body untouched. Everything else keeps express.json.
app.use(
  '/api/checkout/webhook',
  express.raw({ type: 'application/json', limit: '1mb' }),
  require('./routes/checkoutWebhook'),
);

// Raised limit: patient profiles can embed base64 x-ray images.
app.use(express.json({ limit: '25mb' }));

app.get('/health', (req, res) => res.json({ ok: true }));

// Sign-in, verified server-side against a bcrypt hash. Replaces the plaintext
// comparison App.js used to do against localStorage, which was both readable in
// devtools and skippable by editing it. Answers 501 with setup steps when there
// is no DATABASE_URL, because without one there is nothing to verify against.
// A successful sign-in also issues the session token /api/admin below requires.
app.use('/api/auth', authRouter);
// Account administration for the Super Admin page: role changes, password
// resets and deletions against the stored records rather than one browser's
// localStorage. Behind a Super Admin session -- see routes/admin.js.
app.use('/api/admin', adminRouter);
// The plan catalogue. Its own router rather than part of admin: the read has to
// answer on an install with no database, which adminRouter's requireConfig
// refuses — see routes/plans.js.
app.use('/api/plans', plansRouter);
// The payment step between registering and signing in. Public and guarded by a
// token rather than a session, because the account it belongs to cannot sign in
// yet — see routes/checkout.js.
app.use('/api/checkout', checkoutRouter);
// The ledger behind those checkouts. Its own router because it is Super Admin
// only, where the checkout routes are deliberately public — see routes/payments.
app.use('/api/payments', paymentsRouter);
// What the Corporate plan buys. Guarded by the plan as well as the session —
// see requirePlan.js on why the browser's own check is not a control.
app.use('/api/corporate', corporateRouter);
app.use('/api/users', usersRouter);
app.use('/api/otp', otpRouter);
app.use('/api/notify', notifyRouter);
app.use('/api/actions', actionsRouter);
// The same rows, read back as totals for the Super Admin panel. Behind a Super
// Admin token, unlike the log itself -- see routes/homePageAnalytics.js.
app.use('/api/homepage-analytics', homePageAnalyticsRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('/api/patients', patientsRouter);
// Real-browser test engine. Answers 501 with install instructions if Playwright
// is absent, so the rest of the API is unaffected either way.
app.use('/api/testrunner', testrunnerRouter);
// Native-mobile test engine (Appium). Answers `available: false` with the setup
// step that is missing — server, adb, device — rather than failing the request,
// so the recorder can offer or hide the engine on its own.
app.use('/api/mobile', mobileRouter);
// Load-testing engine (JMeter). Super Admin only and answers `available:
// false` with install steps when Java/JMeter is missing — see routes/jmeter.js
// for why this one is gated where the other two engines are not.
app.use('/api/jmeter', jmeterRouter);
// Google Sheets datastore. Answers 501 with setup steps when unconfigured, so
// the rest of the API is unaffected until credentials are in place.
app.use('/api/sheets', sheetsRouter);
// Online Postgres store for the NewRegistration screen. Answers 501 with setup
// steps when DATABASE_URL is absent, so the rest of the API is unaffected until
// a connection string is in place.
app.use('/api/online/registrations', registrationsRouter);
app.use('/api/online/doctors', doctorsRouter);
// Offsite mirror of the appointments the screens keep in localStorage. The local
// SQLite copy at /api/appointments above is unchanged.
app.use('/api/online/appointments', appointmentsOnlineRouter);
app.use('/api/online/appointment-history', appointmentHistoryRouter);
app.use('/api/online/patients', patientsOnlineRouter);
// The recorder's own data — tests, the Project > Suite tree, schedules and data
// sets — which until now lived only in this browser's localStorage. Same 501
// behaviour as the collections above when DATABASE_URL is absent, so the
// recorder keeps working entirely locally until a database is configured.
app.use('/api/online/testrunner', testRunnerOnlineRouter);
// User story -> test cases -> Qase. Holds both the Anthropic key and the Qase
// token, neither of which can live in the bundle. Answers 501 with setup steps
// per credential, so half a configuration still gets you the half that works.
app.use('/api/qase', qaseRouter);
// App-wide branding -- the logo, name and sub text every screen wears. The read
// is deliberately open, because the sign-in screen renders the branding before
// anyone has a session; the write needs a Super Admin. See routes/settings.js.
app.use('/api/settings', settingsRouter);
app.use('/api/contact', contactRouter);

// Anything handed to next(err) ends up here, as JSON.
//
// Express's own error handler answers with an HTML page, and an HTML page has
// no `error` field for src/api/apiError.js to read -- so every such failure
// reached the screen as a bare "... (HTTP 500)", naming neither the cause nor a
// fix, while the real error was visible only in this console.
//
// It is reachable in ordinary use, not just in theory: `authenticate` reads the
// account from the database on every request and reports a failed read with
// next(err), so an unreachable or suspended database turned every /api/admin
// call into that anonymous 500. Confirmed by pointing DATABASE_URL at a dead
// host: GET /api/admin/accounts answered 500 text/html, and the Super Admin
// page showed "Could not load accounts (HTTP 500)".
//
// The message is passed through rather than hidden, matching what every route
// in this API already does with its own catch blocks. Mounted last, and with
// four arguments, which is what marks it as an error handler.
app.use((err, req, res, next) => {
  console.error(`[api] ${req.method} ${req.originalUrl} failed:`, err);
  // A failure part-way through a response cannot be turned into a JSON body;
  // Express's handler is the only thing that can still close the connection.
  if (res.headersSent) {
    next(err);
    return;
  }
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

const PORT = process.env.PORT || 5000;

// Said once, at startup, rather than left to be discovered when everyone is
// signed out by a restart. Not fatal: refusing to authenticate anybody because
// an environment variable is missing turns a deployment slip into an outage, so
// sessions.js falls back to a per-process key and this explains the consequence.
if (sessions.ephemeralSecret) {
  console.warn(
    '\n[auth] AUTH_SECRET is not set, so session tokens are signed with a key\n' +
    '       generated at startup. Sign-in works, but every token is invalidated\n' +
    '       by a restart and two instances will reject each other\'s tokens.\n' +
    '       Set one in src/Backend/.env to keep sessions across restarts:\n\n' +
    '         AUTH_SECRET=' + require('crypto').randomBytes(32).toString('hex') + '\n'
  );
}

// The other half-configured state worth saying out loud, and for the same
// reason: silence here is indistinguishable from working.
//
// A .env that names GOOGLE_SERVICE_ACCOUNT_KEY_FILE but has no such file on disk
// is the usual shape of it — the variable gets committed, the key does not, and
// the next machine to clone the repo has a sheet sync that answers 501 to every
// call. Nothing crashes, nothing is logged, and the collections quietly stop
// mirroring; the gap is normally found much later, by noticing the sheet has not
// changed in a fortnight. Deliberately not fatal, because everything except the
// sync works perfectly well without it.
{
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const keyInline = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;
  // Resolved exactly as sheetsDb.credentials() resolves it — against that
  // module's directory, not the cwd — so this reports on the same file the
  // sync will actually look for.
  const keyPath =
    keyFile && (path.isAbsolute(keyFile) ? keyFile : path.join(__dirname, keyFile));
  const missing = [];
  if (!sheetId) missing.push('GOOGLE_SHEET_ID is not set');
  if (!keyInline && !keyFile) missing.push('neither GOOGLE_SERVICE_ACCOUNT_KEY nor _KEY_FILE is set');
  else if (keyPath && !fs.existsSync(keyPath)) missing.push(`the key file is missing: ${keyPath}`);

  // Only when something is half-done. An install that has deliberately not set
  // any of it up does not need telling on every boot.
  if (missing.length && (sheetId || keyInline || keyFile)) {
    console.warn(
      '\n[sheets] Google Sheets sync is NOT active:\n' +
        missing.map((m) => `       - ${m}\n`).join('') +
        '       /api/sheets answers 501 and no collection is mirroring.\n' +
        '       Fix: share the sheet with your service account, then save its\n' +
        '       JSON key to the path above (or paste it into\n' +
        '       GOOGLE_SERVICE_ACCOUNT_KEY as one line).\n',
    );
  }
}

const server = app.listen(PORT, () => {
  // Node binds the IPv4 and IPv6 stacks separately, and when only one of them
  // collides it still invokes this callback -- with server.address() null -- one
  // tick before emitting the error. Deferring the success line past that tick lets
  // a failed bind exit below instead of printing a false "running" message.
  setImmediate(() => {
    if (server.listening) {
      console.log(`Backend running on http://localhost:${PORT}`);
      const razorpay = require('./razorpay');
      if (!razorpay.isConfigured()) {
        console.log(
          '[payments] Razorpay is not configured — /Checkout falls back to the simulated step.',
        );
      } else if (razorpay.mode() === 'live') {
        console.log(
          '[payments] Razorpay is LIVE. Real money will move.' +
            (razorpay.webhooksConfigured()
              ? ''
              : '\n           No RAZORPAY_WEBHOOK_SECRET: a payer who closes the tab before the' +
                '\n           browser confirms will be charged and left unable to sign in.'),
        );
      } else {
        console.log('[payments] Razorpay is in TEST mode — no real money moves.');
      }
    }
  });
});

// Without this handler a port collision surfaces only as an unhandled EADDRINUSE
// stack trace, which is easy to miss inside a `concurrently` pane -- the backend
// half of `npm run dev` just goes quiet while the frontend keeps running. The
// usual cause is a backend orphaned by an earlier dev run still holding the port,
// so name that cause and the commands that resolve it.
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `\nCannot start: port ${PORT} is already in use.\n` +
      `A backend from an earlier "npm run dev" is probably still holding it.\n\n` +
      `  Find the owner:  netstat -ano | findstr :${PORT}\n` +
      `  Stop it (PS):    Stop-Process -Id <pid> -Force\n\n` +
      `Or set PORT in src/Backend/.env to run on a different port.\n`
    );
  } else if (err.code === 'EACCES') {
    console.error(
      `\nCannot start: not permitted to bind port ${PORT}.\n` +
      `Set PORT in src/Backend/.env to a port above 1023.\n`
    );
  } else {
    console.error('\nCannot start: the server failed to bind.\n', err);
  }
  process.exit(1);
});
