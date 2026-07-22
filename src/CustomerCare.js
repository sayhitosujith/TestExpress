import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import logo from "./assets/Toothx_Logo_trimmed.png";
import { MdMenu, MdClose, MdSupportAgent, MdCall, MdMailOutline } from "react-icons/md";
import {
  FaFacebookF, FaInstagram, FaTwitter, FaLinkedinIn, FaYoutube,
  FaChevronUp, FaHeadset, FaClock, FaMapMarkerAlt,
} from "react-icons/fa";

const INQUIRY_TYPES = ["General Inquiry", "Product Support", "Billing", "Appointment Help", "Technical Issue"];

function CustomerCare() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: "", lastName: "", email: "", phone: "", message: "",
    inquiryType: "General Inquiry",
  });
  const [errors, setErrors]           = useState({});
  const [success, setSuccess]         = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [ticketId, setTicketId]       = useState("");

  const [scrolled, setScrolled]               = useState(false);
  const [showCallPopup, setShowCallPopup]     = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen]   = useState(false);
  const [showFloatingCTA, setShowFloatingCTA] = useState(false);

  const menuItems = [
    { name: "Home",          path: "/HomePage" },
    { name: "Gallery",       path: "/gallery" },
    { name: "Support",       path: "/CustomerCare" },
    { name: "What we Treat", path: "/WhatWeTreatPage" },
  ];

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 72);
      setShowFloatingCTA(y > 300);
    };
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen]);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setErrors((prev) => ({ ...prev, [e.target.name]: "" }));
  };

  const validate = () => {
    const errs = {};
    if (!formData.firstName.trim()) errs.firstName = "First name is required";
    if (!formData.lastName.trim())  errs.lastName  = "Last name is required";
    if (!formData.email.trim())     errs.email     = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(formData.email)) errs.email = "Enter a valid email";
    if (!formData.message.trim())   errs.message   = "Message is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const assignExecutive = () => {
    const DEFAULT_EXECS = [
      { id: "E1", name: "Priya Sharma", status: "Available", ticketCount: 0 },
      { id: "E2", name: "Rahul Mehta",  status: "Available", ticketCount: 0 },
      { id: "E3", name: "Anita Verma",  status: "Busy",      ticketCount: 0 },
      { id: "E4", name: "Karan Patel",  status: "Available", ticketCount: 0 },
    ];
    const execs     = JSON.parse(localStorage.getItem("supportExecutives") || "null") || DEFAULT_EXECS;
    const available = execs.filter((e) => e.status === "Available");
    if (!available.length) return { assignedTo: "Unassigned", assignedId: null };
    const picked  = available.reduce((min, e) => e.ticketCount < min.ticketCount ? e : min, available[0]);
    const updated = execs.map((e) => e.id === picked.id ? { ...e, ticketCount: e.ticketCount + 1 } : e);
    localStorage.setItem("supportExecutives", JSON.stringify(updated));
    return { assignedTo: picked.name, assignedId: picked.id };
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);

    setTimeout(() => {
      const { assignedTo, assignedId } = assignExecutive();
      const id = `TKT-${Date.now()}`;
      const newTicket = {
        id, name: `${formData.firstName} ${formData.lastName}`.trim(),
        email: formData.email, phone: formData.phone,
        subject: formData.inquiryType, category: formData.inquiryType,
        priority: "Medium", message: formData.message,
        assignedTo, assignedId, status: "Open",
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      const existing = JSON.parse(localStorage.getItem("supportTickets") || "[]");
      localStorage.setItem("supportTickets", JSON.stringify([newTicket, ...existing]));

      setTicketId(id);
      setSuccess(true);
      setSubmitting(false);
      setFormData({ firstName: "", lastName: "", email: "", phone: "", message: "", inquiryType: "General Inquiry" });
      window.scrollTo({ top: 0, behavior: "smooth" });
      setTimeout(() => setSuccess(false), 6000);
    }, 800);
  };

  const contactCards = [
    { icon: <FaHeadset size={20} />,      title: "24/7 Support",  desc: "+91 94808 60587",          bg: "#fff7ed", color: "#ea580c", action: () => setShowCallPopup(true) },
    { icon: <MdMailOutline size={20} />,  title: "Email Us",      desc: "support@dutydentist.com",  bg: "#f0f9ff", color: "#0891b2", action: () => (window.location.href = "mailto:support@dutydentist.com") },
    { icon: <FaMapMarkerAlt size={20} />, title: "Head Office",   desc: "WTC, Bangalore, India",    bg: "#faf5ff", color: "#7c3aed", action: null },
    { icon: <FaClock size={20} />,        title: "Working Hours", desc: "Mon–Sat, 9 AM – 8 PM",     bg: "#f0fdf4", color: "#16a34a", action: null },
  ];

  return (
    <div className="min-h-screen bg-white">
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(22px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        .fu  { animation: fadeUp 0.55s ease both; }
        .fu2 { animation: fadeUp 0.55s 0.1s ease both; }
        .fu3 { animation: fadeUp 0.55s 0.2s ease both; }
        .fi  { animation: fadeIn 0.4s ease both; }
        .section-pill {
          display:inline-block; padding:5px 14px; border-radius:999px;
          font-size:0.7rem; font-weight:700; letter-spacing:0.12em;
          text-transform:uppercase; color:#c2410c;
          background:#fff7ed; border:1px solid #fed7aa; margin-bottom:10px;
        }
        .field-input {
          width:100%; border:1.5px solid #e7e5e4; border-radius:12px;
          padding:11px 14px; font-size:0.875rem; color:#1c1917;
          background:#fff; outline:none; transition:border-color 0.2s, box-shadow 0.2s;
        }
        .field-input:focus { border-color:#ea580c; box-shadow:0 0 0 3px rgba(234,88,12,0.1); }
        .field-input.err   { border-color:#ef4444; }
        .field-input::placeholder { color:#a8a29e; }
      `}</style>

      {/* ── Sticky Nav ─────────────────────────────────── */}
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? "bg-white shadow-md border-b border-stone-100" : "bg-white/80 backdrop-blur-md border-b border-stone-100/50"}`}>
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <img src={logo} alt="ToothX" className="h-8 w-auto cursor-pointer" onClick={() => navigate("/HomePage")} />

          <div className="hidden md:flex items-center gap-6">
            {menuItems.map((item) => (
              <button key={item.name} onClick={() => navigate(item.path)}
                className={`text-sm font-medium transition-colors duration-200 ${item.path === "/CustomerCare" ? "text-orange-600 border-b-2 border-orange-500 pb-0.5" : "text-stone-700 hover:text-orange-600"}`}>
                {item.name}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => (window.location.href = "mailto:support@dutydentist.com")}
              className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-orange-600 transition-colors">
              <MdMailOutline size={16} /><span>Email</span>
            </button>
            <button onClick={() => navigate("/Customer_home")}
              className="bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm">
              Book Now
            </button>
            <button onClick={() => setMobileMenuOpen(true)} aria-label="Open menu"
              className="md:hidden p-2 rounded-lg text-stone-700 hover:bg-stone-100 transition-colors">
              <MdMenu size={24} />
            </button>
          </div>
        </div>
      </nav>

      {/* ── Mobile Drawer ───────────────────────────────── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute top-0 right-0 h-full w-72 bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
              <img src={logo} alt="ToothX" className="h-7 w-auto" />
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-lg text-stone-500 hover:bg-stone-100"><MdClose size={22} /></button>
            </div>
            <nav className="flex-1 overflow-y-auto py-4 px-4 space-y-1">
              {menuItems.map((item) => (
                <button key={item.name} onClick={() => { setMobileMenuOpen(false); navigate(item.path); }}
                  className="w-full text-left px-4 py-3 rounded-xl text-stone-700 hover:bg-orange-50 hover:text-orange-700 font-medium text-sm transition-colors">
                  {item.name}
                </button>
              ))}
            </nav>
            <div className="p-4 border-t border-stone-100">
              <button onClick={() => { setMobileMenuOpen(false); navigate("/Customer_home"); }}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm"
                style={{ background: "linear-gradient(135deg, #ea580c, #c2410c)" }}>
                Book Appointment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Call Popup ──────────────────────────────────── */}
      {showCallPopup && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 w-80 text-center shadow-2xl relative">
            <button onClick={() => setShowCallPopup(false)} className="absolute top-3 right-4 w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors text-lg">✕</button>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "#fff7ed" }}>
              <MdSupportAgent size={32} style={{ color: "#ea580c" }} />
            </div>
            <h2 className="text-lg font-bold mb-1 text-stone-900">24×7 Support</h2>
            <p className="text-stone-500 text-sm mb-3">We're always here to help you</p>
            <p className="text-stone-700 font-bold text-base mb-4">+91 94808 60587</p>
            <button onClick={() => (window.location.href = "tel:+919480860587")}
              className="w-full text-white py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
              style={{ background: "linear-gradient(135deg, #ea580c, #c2410c)" }}>
              <MdCall className="inline mr-2" size={16} />Call Now
            </button>
          </div>
        </div>
      )}

      {/* ── Success Banner ──────────────────────────────── */}
      {success && (
        <div className="fi fixed top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-orange-100 p-5 flex gap-4 items-start">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#f0fdf4" }}>
              <span className="text-xl">✅</span>
            </div>
            <div className="flex-1">
              <p className="font-bold text-stone-900 text-sm">Message sent successfully!</p>
              <p className="text-stone-500 text-xs mt-0.5">Ticket <span className="font-semibold text-orange-600">{ticketId}</span> created. We'll respond within 24 hours.</p>
            </div>
            <button onClick={() => setSuccess(false)} className="text-stone-400 hover:text-stone-700 transition-colors mt-0.5">
              <MdClose size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── Hero ────────────────────────────────────────── */}
      <section className="relative overflow-hidden" style={{ paddingTop: "64px", background: "linear-gradient(135deg, #fff7ed 0%, #ffffff 60%, #f0f9ff 100%)" }}>
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(254,215,170,0.45) 0%, transparent 70%)" }} />
        <div className="max-w-3xl mx-auto px-6 py-16 text-center">
          <div className="fu"><span className="section-pill">We're Here to Help</span></div>
          <h1 className="fu2 font-black text-stone-900 tracking-tight mb-4" style={{ fontSize: "clamp(2rem,5vw,3rem)" }}>
            Customer{" "}
            <span className="text-orange-600 relative inline-block">
              Support
              <svg className="absolute -bottom-1 left-0 w-full overflow-visible" viewBox="0 0 200 8" preserveAspectRatio="none" style={{ height: "6px" }}>
                <path d="M2,5 Q50,1 100,5 Q150,9 198,3" stroke="#fed7aa" strokeWidth="3" fill="none" strokeLinecap="round" />
              </svg>
            </span>
          </h1>
          <p className="fu3 text-stone-500 text-base md:text-lg max-w-lg mx-auto leading-relaxed">
            Whether it's a question about our services, a billing issue, or appointment help — our team responds within 24 hours.
          </p>
        </div>
      </section>

      {/* ── Contact Info Cards ──────────────────────────── */}
      <section className="py-10 px-4 bg-white border-t border-stone-100">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
          {contactCards.map(({ icon, title, desc, bg, color, action }) => (
            <div key={title}
              onClick={action || undefined}
              className={`flex flex-col items-center text-center p-5 rounded-2xl border border-stone-100 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${action ? "cursor-pointer" : ""}`}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: bg, color }}>
                {icon}
              </div>
              <p className="text-xs font-bold text-stone-700 mb-1">{title}</p>
              <p className="text-xs text-stone-500 leading-snug">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Main Content ────────────────────────────────── */}
      <section className="py-14 px-4" style={{ background: "#f8fafb" }}>
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">

          {/* Left — image + FAQ */}
          <div>
            <div className="relative rounded-3xl overflow-hidden shadow-xl mb-8">
              <img
                src="https://thumbs.dreamstime.com/b/closeup-beautiful-business-customer-service-woman-smiling-30207893.jpg"
                alt="Customer service"
                className="w-full object-cover"
                style={{ maxHeight: "400px" }}
              />
              <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(15,23,42,0.55) 0%, transparent 55%)" }} />
              <div className="absolute bottom-5 left-5 right-5">
                <p className="text-white font-bold text-lg leading-tight">Dedicated to your dental journey</p>
                <p className="text-white/70 text-sm mt-1">Real support from real people.</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-6">
              <h3 className="font-bold text-stone-900 text-base mb-4">Common Questions</h3>
              <div className="space-y-1">
                {[
                  "How do I reschedule my appointment?",
                  "What insurance plans do you accept?",
                  "How do I access my treatment records?",
                  "Can I get a second opinion online?",
                ].map((q) => (
                  <div key={q} className="flex items-center gap-3 py-2.5 border-b border-stone-50 last:border-0">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-orange-700" style={{ background: "#fff7ed" }}>?</div>
                    <p className="text-sm text-stone-600">{q}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right — Form */}
          <div className="bg-white rounded-3xl shadow-sm border border-stone-100 overflow-hidden">
            <div className="px-8 py-6" style={{ background: "linear-gradient(135deg, #ea580c, #c2410c)" }}>
              <h2 className="text-white font-black text-xl">Send Us a Message</h2>
              <p className="text-white/70 text-sm mt-1">We'll get back to you within 24 hours</p>
            </div>

            <div className="px-8 py-8 flex flex-col gap-6">
              {/* Inquiry type pills */}
              <div>
                <label className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-3">Inquiry Type</label>
                <div className="flex flex-wrap gap-2">
                  {INQUIRY_TYPES.map((type) => (
                    <button key={type} type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, inquiryType: type }))}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                        formData.inquiryType === type
                          ? "bg-orange-600 text-white shadow-sm"
                          : "bg-stone-100 text-stone-600 hover:bg-orange-50 hover:text-orange-700"
                      }`}>
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                {/* Name row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-stone-700 mb-1.5">First Name</label>
                    <input name="firstName" value={formData.firstName} onChange={handleChange}
                      placeholder="John"
                      className={`field-input ${errors.firstName ? "err" : ""}`} />
                    {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-stone-700 mb-1.5">Last Name</label>
                    <input name="lastName" value={formData.lastName} onChange={handleChange}
                      placeholder="Smith"
                      className={`field-input ${errors.lastName ? "err" : ""}`} />
                    {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>}
                  </div>
                </div>

                {/* Email + Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-stone-700 mb-1.5">Email Address</label>
                    <input name="email" type="email" value={formData.email} onChange={handleChange}
                      placeholder="john@example.com"
                      className={`field-input ${errors.email ? "err" : ""}`} />
                    {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-stone-700 mb-1.5">
                      Phone <span className="text-stone-400 font-normal">(optional)</span>
                    </label>
                    <input name="phone" type="tel" value={formData.phone} onChange={handleChange}
                      placeholder="+91 98765 43210"
                      className="field-input" />
                  </div>
                </div>

                {/* Message */}
                <div>
                  <label className="block text-sm font-semibold text-stone-700 mb-1.5">Your Message</label>
                  <textarea name="message" rows={5} value={formData.message} onChange={handleChange}
                    placeholder="Describe your query in detail…"
                    className={`field-input resize-none ${errors.message ? "err" : ""}`} />
                  {errors.message && <p className="text-red-500 text-xs mt-1">{errors.message}</p>}
                </div>

                {/* Submit */}
                <button type="submit" disabled={submitting}
                  className="w-full py-3.5 rounded-2xl text-white font-bold text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg, #ea580c, #c2410c)", boxShadow: "0 8px 24px rgba(234,88,12,0.28)" }}>
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Sending…
                    </>
                  ) : "Send Message →"}
                </button>

                <p className="text-center text-xs text-stone-400">
                  By submitting, you agree to our{" "}
                  <span className="text-orange-600 cursor-pointer hover:underline">Privacy Policy</span>.
                  We respond within 24 hours.
                </p>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer className="text-slate-300/80 pb-20 md:pb-0" style={{ background: "linear-gradient(135deg, #57534e 0%, #78716c 55%, #c2410c 100%)" }}>
        <div className="max-w-7xl mx-auto px-8 py-14 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10">
          <div>
            <img src={logo} alt="ToothX" className="w-24 mb-4 opacity-90" />
            <p className="text-sm leading-relaxed text-slate-400">Trusted dental care with modern technology and expert dentists. Your smile is our priority.</p>
            <div className="flex gap-2.5 mt-5">
              {[
                { Icon: FaFacebookF,  href: "https://facebook.com" },
                { Icon: FaInstagram,  href: "https://instagram.com" },
                { Icon: FaTwitter,    href: "https://twitter.com" },
                { Icon: FaLinkedinIn, href: "https://linkedin.com" },
                { Icon: FaYoutube,    href: "https://youtube.com" },
              ].map(({ Icon, href }, i) => (
                <a key={i} href={href} target="_blank" rel="noopener noreferrer"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-orange-600 transition-all duration-200"
                  style={{ background: "rgba(255,255,255,0.07)" }}>
                  <Icon size={13} />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-white/90 text-xs font-semibold uppercase tracking-[0.15em] mb-5">Company</h3>
            <ul className="space-y-3 text-sm">
              {[{ label: "Home", href: "/HomePage" }, { label: "Gallery", href: "/gallery" }, { label: "About Us", href: "/about" }, { label: "Blog", href: "/blog" }].map(({ label, href }) => (
                <li key={label}><a href={href} className="text-slate-400 hover:text-white transition-colors">{label}</a></li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-white/90 text-xs font-semibold uppercase tracking-[0.15em] mb-5">Treatments</h3>
            <ul className="space-y-3 text-sm">
              {["Dental Implants", "Root Canal", "Braces", "Teeth Whitening"].map((t) => (
                <li key={t} className="text-slate-400 hover:text-white cursor-pointer transition-colors">{t}</li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-white/90 text-xs font-semibold uppercase tracking-[0.15em] mb-5">Contact</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2 text-slate-400"><span className="mt-px">📍</span><span>Head Office — WTC, Bangalore, India</span></li>
              <li className="flex items-center gap-2 text-slate-400"><span>📞</span><span>HR — +91 86188 60059</span></li>
              <li className="flex items-center gap-2 text-slate-400"><span>✉</span>
                <a href="mailto:supportblr@dutydentist.com" className="hover:text-white transition-colors">supportblr@dutydentist.com</a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 text-center py-5 text-xs text-slate-500">
          © {new Date().getFullYear()} ToothX. All rights reserved.
          <div className="mt-2 flex items-center justify-center gap-2 text-slate-400">
            <span>Made in India</span>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600" width="32" height="21" role="img" aria-label="Indian flag" style={{ borderRadius: 2, boxShadow: "0 0 0 1px rgba(255,255,255,0.15)" }}>
              <rect width="900" height="200" fill="#FF9933"/>
              <rect y="200" width="900" height="200" fill="#FFFFFF"/>
              <rect y="400" width="900" height="200" fill="#138808"/>
              <circle cx="450" cy="300" r="90" fill="none" stroke="#000080" strokeWidth="8"/>
              <circle cx="450" cy="300" r="10" fill="#000080"/>
              {Array.from({ length: 24 }).map((_, i) => {
                const angle = (i * 15 * Math.PI) / 180;
                return (<line key={i} x1={450 + 10 * Math.cos(angle)} y1={300 + 10 * Math.sin(angle)} x2={450 + 90 * Math.cos(angle)} y2={300 + 90 * Math.sin(angle)} stroke="#000080" strokeWidth="4"/>);
              })}
            </svg>
          </div>
        </div>
      </footer>

      {/* ── Floating Booking Bar (mobile) ───────────────── */}
      <div className={`md:hidden fixed bottom-0 inset-x-0 z-40 transition-all duration-300 ${showFloatingCTA ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"}`}
        style={{ background: "#0f172a", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => setShowCallPopup(true)}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-600 text-slate-300 font-semibold text-sm hover:border-orange-500 hover:text-orange-400 transition-colors">
            <MdCall size={16} /> Call Us
          </button>
          <button onClick={() => navigate("/Customer_home")}
            className="flex-[2] py-3 rounded-xl text-white font-bold text-sm hover:opacity-90 transition-opacity"
            style={{ background: "linear-gradient(135deg, #ea580c, #c2410c)" }}>
            Book Appointment →
          </button>
        </div>
        <div style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
      </div>

      {/* ── Back to Top ─────────────────────────────────── */}
      <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Back to top"
        className={`fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${showFloatingCTA ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"}`}
        style={{ background: "#ea580c" }}>
        <FaChevronUp size={14} className="text-white" />
      </button>
    </div>
  );
}

export default CustomerCare;
