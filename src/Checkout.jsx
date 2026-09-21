import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import TestExpressMark from "./TestExpressMark";
import { useBranding } from "./appBranding";
import { useAuth } from "./context/AuthContext";
import { login as authenticate } from "./api/auth";
import { cancelCheckout, getCheckout, payCheckout, verifyCheckout } from "./api/checkout";
import { addedBy, money } from "./plans";
import { take } from "./pendingSignIn";

/**
 * The payment step between registering and signing in.
 *
 * Two ways it settles, decided by the server:
 *
 *   * **Razorpay**, when the backend has keys. Pay opens Razorpay's own hosted
 *     modal — that is where UPI, the QR code and cards live, and the card
 *     details never touch this page or this app. What comes back is verified
 *     server-side against the key secret before anything is believed.
 *
 *   * **Simulated**, when it does not. No card details are asked for and no
 *     money moves, and the page says so plainly. This exists so the flow works
 *     on an install with no Razorpay account; it is not a form pretending to
 *     take a payment.
 *
 * Everything around both is the same: the plan, the amount, the record of the
 * checkout, and the fact that the account cannot sign in until it settles.
 *
 * The token in the URL is what identifies the checkout, because the account it
 * belongs to cannot sign in yet — see src/api/checkout.js.
 */

const S = {
  page: {
    minHeight: "100vh",
    background: "#0b1120",
    color: "#e2e8f0",
    fontFamily: "'Outfit', system-ui, sans-serif",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "32px 16px",
  },
  brand: { display: "flex", alignItems: "center", gap: 12, marginBottom: 28 },
  wordmark: {
    fontSize: 17,
    fontWeight: 900,
    fontStyle: "italic",
    letterSpacing: "0.06em",
    color: "#34d399",
    lineHeight: 1.1,
  },
  tagline: { fontSize: 11, color: "#64748b" },
  card: {
    width: 460,
    maxWidth: "96vw",
    background: "#16203a",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 16,
    padding: 24,
    boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
  },
  title: { fontSize: 19, fontWeight: 800, margin: "0 0 4px" },
  sub: { fontSize: 12.5, color: "#94a3b8", lineHeight: 1.6, margin: "0 0 18px" },
  row: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
    padding: "12px 0",
    borderTop: "1px solid rgba(255,255,255,0.08)",
  },
  plan: { fontSize: 15, fontWeight: 800 },
  amount: { fontSize: 26, fontWeight: 900, color: "#34d399", lineHeight: 1 },
  per: { fontSize: 12, color: "#64748b", fontWeight: 600 },
  list: { margin: "10px 0 0", padding: 0, listStyle: "none" },
  item: {
    display: "flex",
    gap: 8,
    fontSize: 12,
    color: "#cbd5e1",
    lineHeight: 1.7,
  },
  // A notice that is a fault rather than a caveat.
  noticeBad: {
    background: "rgba(248,113,113,0.12)",
    borderColor: "rgba(248,113,113,0.4)",
    color: "#fca5a5",
  },
  // The one thing on this page that must not be missed.
  notice: {
    marginTop: 18,
    padding: "10px 12px",
    borderRadius: 10,
    background: "rgba(251,191,36,0.1)",
    border: "1px solid rgba(251,191,36,0.35)",
    color: "#fbbf24",
    fontSize: 11.5,
    lineHeight: 1.6,
  },
  actions: { display: "flex", gap: 10, marginTop: 20 },
  pay: {
    flex: 2,
    padding: "12px 16px",
    borderRadius: 12,
    border: "none",
    background: "#34d399",
    color: "#04231a",
    fontSize: 14,
    fontWeight: 800,
    fontFamily: "inherit",
    cursor: "pointer",
  },
  cancel: {
    flex: 1,
    padding: "12px 16px",
    borderRadius: 12,
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.25)",
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: 700,
    fontFamily: "inherit",
    cursor: "pointer",
  },
  err: {
    marginTop: 14,
    padding: "10px 12px",
    borderRadius: 10,
    background: "rgba(248,113,113,0.12)",
    border: "1px solid rgba(248,113,113,0.4)",
    color: "#fca5a5",
    fontSize: 12,
    lineHeight: 1.6,
  },
  ok: {
    marginTop: 14,
    padding: "10px 12px",
    borderRadius: 10,
    background: "rgba(34,197,94,0.12)",
    border: "1px solid rgba(34,197,94,0.4)",
    color: "#6ee7b7",
    fontSize: 12,
    lineHeight: 1.6,
  },
  // The methods Razorpay will offer, as a two-column list. Not buttons: they
  // are not choices this page makes — the modal does — and drawing them as
  // controls would invite pressing one and wondering why nothing happened.
  methods: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
    marginTop: 8,
  },
  // A method the gateway shows but cannot actually take, in test mode.
  methodDead: {
    opacity: 0.55,
    borderStyle: "dashed",
  },
  method: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.03)",
    fontSize: 12,
    color: "#cbd5e1",
    lineHeight: 1.3,
  },
  quiet: { fontSize: 12, color: "#64748b", marginTop: 16, textAlign: "center" },
  link: {
    background: "none",
    border: "none",
    color: "#34d399",
    fontFamily: "inherit",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    textDecoration: "underline",
    padding: 0,
  },
};

const PER = { month: "per month", year: "per year", once: "one-off" };

// Razorpay says "Too many requests" and nothing else, which beside a card form
// reads as "your card was declined". It is neither the card nor the payer: it
// is the gateway throttling this merchant key, and test keys are throttled far
// harder than live ones. Recognised here so the page can say so.
const RATE_LIMITED = /too many requests|rate.?limit|429/i;

const explain = (message) =>
  RATE_LIMITED.test(String(message || ""))
    ? "Razorpay is rate-limiting this account, not refusing your payment — nothing has been charged. " +
      "Wait about a minute and press Pay again. (Test keys are throttled after a few attempts in a row.)"
    : message;

// Razorpay's own checkout script. Loaded when the page opens rather than in
// index.html, because every other page in the app would otherwise pay for a
// third-party script it never uses — and loaded at most once however many times
// this component mounts.
const RAZORPAY_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

const loadRazorpay = () =>
  new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const existing = document.querySelector(`script[src="${RAZORPAY_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(Boolean(window.Razorpay)));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const tag = document.createElement("script");
    tag.src = RAZORPAY_SCRIPT;
    tag.async = true;
    tag.onload = () => resolve(Boolean(window.Razorpay));
    // A blocked or failed script is not a crash: the page says the gateway
    // could not be reached, which is true and actionable, rather than leaving
    // a Pay button that does nothing.
    tag.onerror = () => resolve(false);
    document.body.appendChild(tag);
  });

// What Razorpay's modal offers, named on the page before it opens. Listing them
// is not decoration: "Pay" alone does not tell somebody they can use UPI, and
// the methods available are the reason most people here would choose to.
const METHODS = [
  { id: "upi", label: "UPI", hint: "GPay, PhonePe, Paytm, any UPI app" },
  { id: "qr", label: "QR code", hint: "Scan with any UPI app" },
  { id: "card", label: "Card", hint: "Credit or debit" },
  { id: "netbanking", label: "Netbanking", hint: "All major banks" },
];

// The same list, as it truthfully is on test keys.
//
// Razorpay's sheet draws the identical QR code and UPI app icons whether the
// key is test or live, and on a test key none of them do anything: scanning
// produces no payment, no error and no feedback of any kind — the gateway never
// even records an attempt. Somebody holding a phone cannot discover that from
// the sheet, so the page has to say it, and say what does work instead.
const TEST_METHODS = [
  { id: "upi", label: "UPI", hint: "Type success@razorpay as the UPI ID" },
  { id: "card", label: "Card", hint: "4111 1111 1111 1111, any future expiry, any CVV" },
  { id: "netbanking", label: "Netbanking", hint: "Any bank, then press Success" },
  { id: "qr", label: "QR code", hint: "Does not work on test keys — scanning does nothing" },
];

/**
 * The mark for one payment method.
 *
 * Drawn rather than typed, for the reason the rest of this app draws its icons:
 * the emoji for a card and a QR code are a lottery across platforms, and the
 * ones that do render look nothing like each other. One stroke weight, one
 * grid, currentColor.
 */
function MethodGlyph({ id, size = 16 }) {
  const paths = {
    // A phone with an arrow leaving it: a payment pushed from a handset.
    upi: (
      <>
        <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
        <path d="M9.5 12h5M12.5 9.5 15 12l-2.5 2.5" />
      </>
    ),
    // The three finder squares a QR code is recognised by.
    qr: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <path d="M14 14h3v3h-3zM19.5 14v.01M14 19.5v.01M19.5 19.5v.01" />
      </>
    ),
    card: (
      <>
        <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
        <path d="M2.5 10h19M6 15h3" />
      </>
    ),
    // A building with columns: the universal bank mark.
    netbanking: (
      <>
        <path d="M3 9.5 12 4l9 5.5" />
        <path d="M5 10v8M10 10v8M14 10v8M19 10v8M3.5 21h17" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      {paths[id] || paths.card}
    </svg>
  );
}

export default function Checkout() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const navigate = useNavigate();
  const branding = useBranding();
  const { user, login, updateUser } = useAuth();

  const [checkout, setCheckout] = useState(null);
  // How this checkout can be settled. `configured` false means no Razorpay keys
  // on the backend, and the page falls back to the simulated step.
  const [gateway, setGateway] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null); // what happened, once it has

  useEffect(() => {
    if (!token) {
      setError("This payment link has no token in it. Start again from the plan you chose.");
      return;
    }
    getCheckout(token)
      .then(({ checkout: found, gateway: how }) => {
        setCheckout(found);
        setGateway(how);
      })
      .catch((err) => setError(err.message));
  }, [token]);

  /**
   * Signs the account in and lands it in the recorder.
   *
   * The credentials are the ones typed on the registration form a moment ago,
   * held in memory for this one navigation (see ./pendingSignIn). If they are
   * gone — a reload, a new tab — the payment has still settled and the account
   * is still enabled, so the honest thing is to say so and offer the sign-in
   * page rather than pretend nothing happened.
   */
  const signInAndGo = useCallback(async () => {
    // An upgrade, not a registration: somebody already signed in has just paid
    // to move plan. There is nobody to sign in — what has to happen is that the
    // session learns its new plan, or the recorder goes on refusing the
    // capabilities they have just bought until they sign out and back in.
    if (user && checkout && user.email && user.email.toLowerCase() === checkout.email) {
      updateUser({ payment: checkout.plan });
      navigate("/TestRunner");
      return;
    }

    const held = take();
    if (!held) {
      setDone({ paid: true, signedIn: false });
      return;
    }
    try {
      const { user, token: session } = await authenticate(held.email, held.password);
      login(user, session);
      navigate("/TestRunner");
    } catch (err) {
      // The payment is not in doubt; only the automatic sign-in failed.
      setDone({ paid: true, signedIn: false, why: err.message });
    }
  }, [login, navigate, updateUser, user, checkout]);

  /**
   * The simulated settlement, for an install with no Razorpay keys.
   *
   * The server refuses this outright once keys are present — a route that
   * settles a checkout without paying would be a way to get a paid plan for
   * nothing on an install that takes real money.
   */
  const paySimulated = async () => {
    setBusy(true);
    setError(null);
    try {
      const { checkout: settled } = await payCheckout(token);
      setCheckout(settled);
      await signInAndGo();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  /**
   * The real one: Razorpay's hosted modal, which is where UPI, the QR code and
   * the card form actually live.
   *
   * Nothing about the payment is believed here. The modal's success callback
   * hands back an order id, a payment id and a signature; the server checks
   * that signature against the key secret — which this page has never seen —
   * and only then is the account let in.
   */
  const payWithRazorpay = async () => {
    setBusy(true);
    setError(null);
    const ready = await loadRazorpay();
    if (!ready) {
      setError(
        "Razorpay's checkout could not be loaded. Check the connection, or any extension blocking scripts, and try again.",
      );
      setBusy(false);
      return;
    }
    try {
      const modal = new window.Razorpay({
        key: gateway.keyId,
        order_id: gateway.orderId,
        // Razorpay takes the amount from the order it was given; these are for
        // what the modal shows.
        amount: Math.round(checkout.amount * 100),
        currency: checkout.currency,
        name: branding.name,
        description: `${checkout.plan} plan`,
        prefill: { email: checkout.email },
        notes: { plan: checkout.plan },
        theme: { color: "#34d399" },
        handler: async (response) => {
          try {
            const { checkout: settled } = await verifyCheckout(token, response);
            setCheckout(settled);
            await signInAndGo();
          } catch (err) {
            // The money may well have moved; what failed is the verification.
            // Saying so plainly matters more here than anywhere else on the
            // page, because the two have very different remedies.
            setError(
              err.message +
                " — if you were charged, do not pay again: send the payment id from your receipt to support and the account will be enabled.",
            );
          } finally {
            setBusy(false);
          }
        },
        modal: {
          // Dismissing the modal is not a failure and not a cancellation of the
          // checkout: the row stays pending and Pay can be pressed again.
          ondismiss: () => setBusy(false),
        },
      });
      modal.on("payment.failed", (e) => {
        setError(
          explain((e && e.error && e.error.description) || "The payment did not go through."),
        );
        setBusy(false);
      });
      modal.open();
    } catch (err) {
      setError(explain(err.message));
      setBusy(false);
    }
  };

  // Keys are present on the server.
  const gatewayReady = Boolean(gateway && gateway.configured);
  // ...and this checkout has an order to pay against. Only then can Pay work.
  const live = Boolean(gatewayReady && gateway.orderId);
  // Keys, but no order for this checkout — the gateway was unreachable or
  // refused when it was opened. Neither "simulated" nor payable.
  const stranded = Boolean(gatewayReady && !gateway.orderId && checkout && checkout.status === "pending");
  // Test keys behave differently enough to be worth saying out loud — see
  // TEST_METHODS.
  const testing = live && gateway.mode === "test";
  const pay = () => (live ? payWithRazorpay() : paySimulated());

  const abandon = async () => {
    setBusy(true);
    setError(null);
    try {
      setCheckout(await cancelCheckout(token));
      setDone({ paid: false, signedIn: false });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const shell = (children) => (
    <div style={S.page}>
      <div style={S.brand}>
        <TestExpressMark size={34} />
        <span>
          <span style={{ ...S.wordmark, display: "block" }}>{branding.name}</span>
          <span style={S.tagline}>{branding.tagline}</span>
        </span>
      </div>
      <div style={S.card}>{children}</div>
    </div>
  );

  if (error && !checkout) {
    return shell(
      <>
        <h1 style={S.title}>This payment cannot be opened</h1>
        <p style={S.sub}>{error}</p>
        <button style={S.pay} onClick={() => navigate("/HomePage")}>
          Back to the plans
        </button>
      </>,
    );
  }

  if (!checkout) {
    return shell(
      <>
        <h1 style={S.title}>Reading your checkout…</h1>
        <p style={S.sub}>One moment.</p>
      </>,
    );
  }

  // Settled, either way. Shown as its own state rather than as a message over
  // the Pay button, because there is nothing left to pay and a live-looking
  // button would invite pressing it again.
  if (done || checkout.status !== "pending") {
    const paid = done ? done.paid : checkout.status === "paid";
    return shell(
      <>
        <h1 style={S.title}>{paid ? "Payment recorded" : "Payment cancelled"}</h1>
        {paid ? (
          <>
            <p style={S.sub}>
              <b>{checkout.plan}</b> is now the plan on {checkout.email}, and the account can
              sign in.
            </p>
            {done && done.why && (
              <div style={S.err}>
                The account is ready, but signing you in automatically failed — {done.why}
              </div>
            )}
            <div style={S.ok}>
              Nothing was charged. This step records the plan; there is no payment provider
              behind it.
            </div>
            <div style={S.actions}>
              <button
                style={S.pay}
                onClick={() => navigate(user ? "/TestRunner" : "/my-app")}
              >
                {user ? "Back to the recorder" : "Sign in"}
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={S.sub}>
              The account for <b>{checkout.email}</b> exists on <b>{checkout.plan}</b>, but it
              cannot sign in until the plan is paid for. An administrator can switch sign-in on,
              or you can choose the Free plan instead.
            </p>
            <div style={S.actions}>
              <button style={S.pay} onClick={() => navigate("/HomePage")}>
                Back to the plans
              </button>
            </div>
          </>
        )}
      </>,
    );
  }

  const included = addedBy(checkout.plan);

  return shell(
    <>
      <h1 style={S.title}>Confirm your plan</h1>
      <p style={S.sub}>
        The account for <b>{checkout.email}</b> has been created on{" "}
        <b>{checkout.plan}</b>. It can sign in once this step is settled.
      </p>

      <div style={S.row}>
        <span>
          <span style={{ ...S.plan, display: "block" }}>{checkout.plan}</span>
          <span style={S.per}>{PER[checkout.interval] || "one payment"}</span>
        </span>
        <span style={S.amount}>{money(checkout.amount, checkout.currency)}</span>
      </div>

      {included.length > 0 && (
        <div style={{ paddingTop: 12 }}>
          <span style={S.per}>What this tier adds</span>
          <ul style={S.list}>
            {included.map((c) => (
              <li key={c.id} style={S.item}>
                <span aria-hidden="true" style={{ color: "#34d399" }}>
                  ✓
                </span>
                <span>{c.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* The methods, named before the modal opens. Razorpay's own sheet is
          what renders them — this page never sees a card number or a UPI id —
          but "Pay" on its own does not tell somebody they can scan a QR, which
          for most people here is the reason to press it. */}
      {live && (
        <div style={{ paddingTop: 14 }}>
          <span style={S.per}>{testing ? "Pay by, in test mode" : "Pay by"}</span>
          <div style={S.methods}>
            {(testing ? TEST_METHODS : METHODS).map((m) => {
              // The one that does not work is drawn as not working, rather than
              // sitting in the list looking like the other three.
              const dead = testing && m.id === "qr";
              return (
                <span
                  key={m.id}
                  style={{ ...S.method, ...(dead ? S.methodDead : {}) }}
                  title={m.hint}
                >
                  <span aria-hidden="true" style={{ color: dead ? "#64748b" : "#34d399" }}>
                    <MethodGlyph id={m.id} />
                  </span>
                  <span>
                    <span style={{ display: "block", fontWeight: 700 }}>{m.label}</span>
                    <span style={{ color: "#64748b", fontSize: 10.5 }}>{m.hint}</span>
                  </span>
                </span>
              );
            })}
          </div>

          {testing ? (
            <div style={S.notice}>
              <b>Test mode — no real money moves.</b> Razorpay's window shows a QR code and your
              UPI apps, but on test keys none of them can be paid: scanning does nothing at all,
              with no error to say why. Use <b>success@razorpay</b> as the UPI ID, or the test
              card above, and the payment completes properly. Real payments need live keys
              (rzp_live_) from an activated Razorpay account.
            </div>
          ) : (
            <p style={{ ...S.quiet, textAlign: "left", marginTop: 10 }}>
              Razorpay's secure window opens when you press Pay — the QR code, your UPI app and
              the card form all live there, and no card details reach this site.
            </p>
          )}
        </div>
      )}

      {!live && gateway && gateway.rateLimited && (
        <div style={S.notice}>
          <b>Razorpay is rate-limiting this account.</b> Nothing has been charged and nothing is
          wrong with your details — the gateway is throttling how often this merchant key may
          open a payment. Wait about a minute and reload this page.
        </div>
      )}

      {stranded && (
        <div style={{ ...S.notice, ...S.noticeBad }}>
          <b>The payment gateway could not open an order for this checkout.</b> Razorpay is
          configured, so nothing here can be settled without it. Reload this page to try again —
          if it keeps failing, the keys in src/Backend/.env are being refused, and the backend log
          says why.
        </div>
      )}

      {!live && !stranded && !(gateway && gateway.rateLimited) && (
        <div style={S.notice}>
          <b>Simulated payment.</b> No card details are asked for and no money moves — pressing
          Pay records this plan against the account and lets it sign in. Add
          RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to src/Backend/.env and this step becomes a
          real one, with UPI, QR and cards.
        </div>
      )}

      {error && <div style={S.err}>{error}</div>}

      <div style={S.actions}>
        <button
          style={{ ...S.pay, opacity: busy || stranded ? 0.6 : 1, cursor: stranded ? "not-allowed" : "pointer" }}
          disabled={busy || stranded}
          onClick={pay}
          title={stranded ? "There is no gateway order to pay against — reload the page" : undefined}
        >
          {busy ? "Working…" : `Pay ${money(checkout.amount, checkout.currency)}`}
        </button>
        <button style={{ ...S.cancel, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={abandon}>
          Cancel
        </button>
      </div>

      <p style={S.quiet}>
        Changed your mind about the tier?{" "}
        <button style={S.link} onClick={() => navigate("/HomePage")}>
          Look at the plans again
        </button>
      </p>
    </>,
  );
}
