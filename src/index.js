import React from 'react';
import ReactDOM from 'react-dom/client';
import axios from 'axios';
import './index.css';
import './i18n'; // initialize localization (English + Kannada)
import App from './App';
import reportWebVitals from './reportWebVitals';
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
} from "react-router-dom";
import NewRegistration from './NewRegistration';
// The payment step between registering and signing in. Public for the reason
// the registration form is: the account it belongs to cannot sign in yet.
import Checkout from './Checkout';
import Profile from './Profile';
import HomePage from './HomePage';
import ContactUs from './ContactUs';
import { SettingsProvider } from "./context/SettingsContext";
import { AuthProvider } from './context/AuthContext';
import { TreatmentsProvider } from './context/TreatmentsContext';
import AuthRoute from './AuthRoute';
// RoleRoute is no longer mounted here: /SuperAdmin was its only user and that
// page now asks for credentials itself rather than redirecting a visitor away.
// The component is left in the tree because it is the right tool the next time a
// screen wants to bounce the wrong role somewhere else, which is a different
// choice from asking on the spot -- not because anything still calls it.
// Sends the session token on every request and reacts to it being refused.
import { installAuthInterceptors } from './api/authToken';
import SuperAdmin from './SuperAdmin';
import TestRunner from './TestRunner';
import Healer from './Healer';
import { startSheetsSync } from './sheetsSync';
import { startDbSync, hydrateMissing } from './dbSync';
// Deletes plaintext passwords left in this browser by builds that compared them
// client-side. Runs before anything reads registeredUsers.
import { scrubStoredPasswords } from './scrubStoredPasswords';
// Moves this browser's stored users from the old `practice` field to
// `payment`. Must run before dbSync, or the first sync pushes the old shape
// back and undoes the database migration.
import { migrateStoredPayment } from './migrateStoredPayment';
// The plan catalogue, which decides what every account may do. Cached in this
// browser and refreshed from the database at boot — see ./plans.
import { refreshPlans } from './plans';
import { initGA, trackPageView } from './analytics';

import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

// When the app is opened through a localtunnel HTTPS URL (e.g. for phone
// testing), localtunnel shows a reminder page and can intercept XHR calls.
// This header tells it to skip that so API requests pass straight through.
axios.defaults.headers.common['bypass-tunnel-reminder'] = 'true';

// Every protected endpoint wants the session token, and every screen wants the
// same thing to happen when the server says the session is over. Installed here,
// once, before the first request can be made: doing it per api module would be
// six copies of the header and six opinions about 401.
//
// A 401 means the token is gone or stale, so the local session is a lie. It is
// cleared and the app returns to login rather than leaving someone looking at a
// page whose every action fails. Not a react-router navigate: this runs outside
// the router, and assign() gets the reload that clears any state read at mount.
installAuthInterceptors(axios, () => {
  try {
    localStorage.removeItem('user');
    localStorage.removeItem('loggedInUser');
    localStorage.removeItem('isLoggedIn');
  } catch (e) {
    // Nothing to clear is not a failure.
  }
  if (window.location.pathname !== '/my-app') window.location.assign('/my-app');
});

const publicPaths = [
  "/NewRegistration",
  // Public of necessity, not by oversight: this page is reached immediately
  // after registering, when sign-in for that account is still switched off
  // because the plan has not been paid for. Guarding it with AuthRoute would
  // make the step unreachable by exactly the people it exists for. It carries
  // its own credential — the checkout token in its URL.
  "/Checkout",
  "/my-app",
  "/HomePage",
  "/Contact",
];

const wrap = (path, el) => (publicPaths.includes(path) ? el : <AuthRoute>{el}</AuthRoute>);

const router = createBrowserRouter([
  {
    // The public landing page is the entry point, so bare "/" lands there
    // rather than on a no-match blank screen.
    path: "/",
    element: <Navigate to="/HomePage" replace />,
  },
  {
    path: "/my-app",
    element: wrap("/my-app", <App />),
  },
  {
    path: "/NewRegistration",
    element: wrap("/NewRegistration", <NewRegistration />),
  },
  {
    path: "/HomePage",
    element: wrap("/HomePage", <HomePage />),
  },
  {
    path: "/Contact",
    element: wrap("/Contact", <ContactUs />),
  },
  {
    path: "/Checkout",
    element: wrap("/Checkout", <Checkout />),
  },
  {
    path: "/Profile",
    element: wrap("/Profile", <Profile />),
  },
  {
    // Unwrapped on purpose, and it is not an omission: this page guards itself.
    //
    // The two guards that used to sit here could only redirect -- an anonymous
    // visitor to the main login screen, a signed-in Receptionist to /HomePage.
    // The first meant the interrupted destination had to be carried across a
    // navigation and handed back, and the second dropped someone on a page that
    // never said why. SuperAdmin now renders its own sign-in form instead, so
    // the credentials are asked for where they are needed and the answer is
    // immediate. Wrapping it again would put a redirect in front of that form
    // and nobody would ever see it.
    //
    // What makes this safe is not either arrangement: /api/admin establishes the
    // caller's role from a signed token before it answers, so the page decides
    // what to draw and the server decides what may be done.
    path: "/SuperAdmin",
    element: <SuperAdmin />,
  },
  {
    path: "/TestRunner",
    element: <TestRunner />,
  },
  {
    // Anything left over from a removed page or a stale bookmark goes back to
    // login instead of rendering nothing.
    path: "*",
    element: <Navigate to="/my-app" replace />,
  },
]);

// One subscription covers every route: the router's own history changes are
// the one place a client-side navigation is visible, so this is what makes an
// in-app page change show up in Google Analytics at all -- gtag.js's built-in
// page_view only ever fires once, on this script's first load.
initGA();
trackPageView(window.location.pathname);
router.subscribe((state) => trackPageView(state.location.pathname));

const root = ReactDOM.createRoot(document.getElementById('root'));

// Whichever store is configured has to reach localStorage before the first
// render: pages read their state in useState initializers, so anything that
// lands later is ignored until a reload.
//
// One budget covers the whole of loadBootData below, not each attempt, so the
// fallback leg cannot double the wait. On timeout the app opens on whatever
// localStorage already holds and the background loop syncs when it can.
const SYNC_BOOT_TIMEOUT_MS = 6000;

const renderApp = () =>
  root.render(
    <React.StrictMode>
    <Healer>
      <SettingsProvider>
        <AuthProvider>
          <TreatmentsProvider>
            <RouterProvider router={router} />
          </TreatmentsProvider>
        </AuthProvider>
      </SettingsProvider>
    </Healer>
    </React.StrictMode>,
  );

const withDeadline = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve({ timedOut: true }), ms)),
  ]);

/**
 * Gets localStorage populated before the first render, from whichever store is
 * actually configured.
 *
 * The sheet is preferred when it is set up, because it is the source of truth
 * the sync engine writes back to. When it is not — no service-account key, no
 * spreadsheet id — the online database is the only copy left, and falling back
 * to it is what stops a fresh browser opening on an empty app while Postgres
 * holds every record. Both legs share one deadline: a slow or unreachable store
 * must delay startup, never prevent it.
 */
async function loadBootData() {
  const deadline = Date.now() + SYNC_BOOT_TIMEOUT_MS;
  let sheets = null;
  try {
    sheets = await withDeadline(startSheetsSync(), SYNC_BOOT_TIMEOUT_MS);
  } catch (err) {
    console.warn("[sheetsSync] startup failed:", err.message);
  }
  if (sheets && sheets.active) return;

  const remaining = deadline - Date.now();
  if (remaining <= 0) return;
  try {
    const loaded = await withDeadline(hydrateMissing(), remaining);
    if (Array.isArray(loaded) && loaded.length) {
      console.info("[dbSync] hydrated from database:", loaded);
    }
  } catch (err) {
    console.warn("[dbSync] hydrate failed:", err.message);
  }
}

// Before any boot data is read or pushed: a plaintext password must not be
// mirrored to the database or left where devtools can read it.
const scrubbed = scrubStoredPasswords();
if (scrubbed) console.info(`[auth] removed plaintext passwords from ${scrubbed} stored user(s)`);

// Before loadBootData and before startDbSync, for the reason in that file:
// a record still carrying `practice` would be pushed over a migrated row.
const repaid = migrateStoredPayment();
if (repaid) console.info(`[payment] migrated ${repaid} stored user(s) from practice to payment`);

loadBootData().finally(renderApp);

// Started after the app is on screen, not raced with it: pushing to the database
// is a background mirror of localStorage, so it must never hold up first paint.
startDbSync().catch((err) => console.warn("[dbSync] startup failed:", err.message));

// Same reasoning: the cached catalogue — or, on a first visit, the one that
// ships with the app — is already in force, so this only replaces it with the
// database's answer. Nothing waits on it, and it cannot fail the page.
refreshPlans();

reportWebVitals();
