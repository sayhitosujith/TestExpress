import { useState } from "react";
import { useNavigate } from "react-router-dom";
import TestExpressMark from "./TestExpressMark";
import { useBranding } from "./appBranding";
import { sendContactMessage } from "./api/contact";

const EMPTY_FORM = { name: "", email: "", subject: "", message: "" };
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The public Contact Us page.
 *
 * Styled to match the public HomePage rather than the signed-in TestRunner
 * shell -- a visitor reaching this from the marketing site should never feel
 * like they have wandered into the product. Deliberately its own small header
 * rather than HomePage's, which is wired to that page's own scroll-spy and
 * click tracking; reusing it here would mean carrying that state across for a
 * two-link nav bar.
 */
function ContactUs() {
  const branding = useBranding();
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error
  const [errorMessage, setErrorMessage] = useState("");

  const setField = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setFieldErrors((errs) => ({ ...errs, [field]: "" }));
    setStatus("idle");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (status === "sending") return;

    const errs = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (!EMAIL_PATTERN.test(form.email.trim())) errs.email = "Enter a valid email";
    if (!form.message.trim()) errs.message = "Message is required";
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      return;
    }

    setStatus("sending");
    setErrorMessage("");
    try {
      await sendContactMessage(form);
      setStatus("sent");
      setForm(EMPTY_FORM);
    } catch (err) {
      setStatus("error");
      setErrorMessage(err.message);
    }
  };

  return (
    <div className="hp min-h-screen bg-[#0b1120]">
      <style>{`
        .hp button:focus-visible,
        .hp a:focus-visible,
        .hp input:focus-visible,
        .hp textarea:focus-visible {
          outline: 2px solid #34d399;
          outline-offset: 3px;
          border-radius: 10px;
        }
        .section-pill {
          display: inline-block;
          padding: 6px 16px;
          border-radius: 999px;
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #6ee7b7;
          background: rgba(16,185,129,0.14);
          border: 1px solid rgba(16,185,129,0.32);
          margin-bottom: 12px;
        }
        .contact-input {
          width: 100%;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 10px;
          padding: 12px 14px;
          color: #f1f5f9;
          font-size: 14px;
          transition: border-color 0.15s ease, background 0.15s ease;
        }
        .contact-input::placeholder { color: #64748b; }
        .contact-input:focus { border-color: #34d399; background: rgba(255,255,255,0.08); }
        .contact-input.has-error { border-color: #f87171; }
      `}</style>

      {/* ── Nav ──────────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-[#0b1120]/90 backdrop-blur-md border-b border-white/10">
        <div className="max-w-5xl mx-auto px-5 md:px-9 h-20 flex items-center justify-between">
          <button
            onClick={() => navigate("/HomePage")}
            className="flex items-center gap-3"
            aria-label={`${branding.name} home`}
          >
            <TestExpressMark size={34} />
            <span className="text-left leading-none">
              <span className="block font-black italic tracking-[0.06em] text-[#34d399] text-lg">
                {branding.name}
              </span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748b] mt-1">
                {branding.tagline}
              </span>
            </span>
          </button>
          <button
            onClick={() => navigate("/HomePage")}
            className="text-sm font-medium text-[#cbd5e1] hover:text-[#6ee7b7] transition-colors duration-200"
          >
            ← Back to Home
          </button>
        </div>
      </nav>

      {/* ── Content ──────────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-5 md:px-9 pt-36 pb-24">
        <div className="max-w-xl">
          <span className="section-pill">GET IN TOUCH</span>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white leading-tight">
            Contact us
          </h1>
          <p className="mt-4 text-[#94a3b8] text-base leading-relaxed">
            Questions, feedback, or something not working the way you expect —
            send us a message and we'll get back to you.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="mt-10 max-w-xl bg-white/[0.03] border border-white/10 rounded-2xl p-6 md:p-8 space-y-5"
        >
          {status === "sent" && (
            <div className="rounded-lg border border-[#34d399]/30 bg-[#34d399]/10 text-[#6ee7b7] text-sm font-medium px-4 py-3">
              Thanks — your message has been sent. We'll be in touch with in 24 hours. you will also receive a copy of your message in your inbox.
            </div>
          )}
          {status === "error" && (
            <div className="rounded-lg border border-red-400/30 bg-red-400/10 text-red-300 text-sm font-medium px-4 py-3">
              {errorMessage}
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-xs font-semibold uppercase tracking-wide text-[#94a3b8] mb-2">
              Name
            </label>
            <input
              id="name"
              className={`contact-input${fieldErrors.name ? " has-error" : ""}`}
              placeholder="Your name"
              value={form.name}
              onChange={setField("name")}
            />
            {fieldErrors.name && <p className="mt-1.5 text-xs text-red-400">{fieldErrors.name}</p>}
          </div>

          <div>
            <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wide text-[#94a3b8] mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              className={`contact-input${fieldErrors.email ? " has-error" : ""}`}
              placeholder="you@example.com"
              value={form.email}
              onChange={setField("email")}
            />
            {fieldErrors.email && <p className="mt-1.5 text-xs text-red-400">{fieldErrors.email}</p>}
          </div>

          <div>
            <label htmlFor="subject" className="block text-xs font-semibold uppercase tracking-wide text-[#94a3b8] mb-2">
              Subject <span className="normal-case font-normal text-[#64748b]">(optional)</span>
            </label>
            <input
              id="subject"
              className="contact-input"
              placeholder="What's this about?"
              value={form.subject}
              onChange={setField("subject")}
            />
          </div>

          <div>
            <label htmlFor="message" className="block text-xs font-semibold uppercase tracking-wide text-[#94a3b8] mb-2">
              Message
            </label>
            <textarea
              id="message"
              rows={5}
              className={`contact-input resize-none${fieldErrors.message ? " has-error" : ""}`}
              placeholder="How can we help?"
              value={form.message}
              onChange={setField("message")}
            />
            {fieldErrors.message && <p className="mt-1.5 text-xs text-red-400">{fieldErrors.message}</p>}
          </div>

          <button
            type="submit"
            disabled={status === "sending"}
            className="w-full rounded-xl bg-[#34d399] text-[#04231a] font-bold text-sm uppercase tracking-wide py-3.5 transition-opacity hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {status === "sending" ? "Sending…" : "Send message"}
          </button>
        </form>
      </main>

      <footer className="border-t border-white/10 text-center py-6 text-xs text-[#64748b]">
        © {new Date().getFullYear()} {branding.name}. All rights reserved.
      </footer>
    </div>
  );
}

export default ContactUs;
