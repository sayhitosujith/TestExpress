import React, { useState, useEffect, useMemo } from "react";
import { useTreatments } from "./context/TreatmentsContext";
import {
  FaFacebookF,
  FaInstagram,
  FaTwitter,
  FaLinkedinIn,
  FaYoutube,
  FaChevronUp,
} from "react-icons/fa";
import { MdSupportAgent, MdMenu, MdClose, MdAdd, MdCall, MdMailOutline } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import logo from "./assets/Toothx_Logo_trimmed.png";

const treatItems = [
  { src: "https://clovecontent.s3.ap-south-1.amazonaws.com/All/2019/02/RCT.gif", label: "Root Canal Treatment", path: "/RootCanalTreatment" },
  { src: "https://clovecontent.s3.ap-south-1.amazonaws.com/All/2019/02/Crowns.gif", label: "Dental Crowns", path: "/services/dental-crowns" },
  { src: "https://clovecontent.s3.ap-south-1.amazonaws.com/All/2019/02/Dental-Fillings-1-1.gif", label: "Laser Dentistry", path: "/services/laser-dentistry" },
  { src: "https://clovecontent.s3.ap-south-1.amazonaws.com/All/2025/06/Invisible-Braces-1.gif", label: "Invisible Braces", path: "/services/invisible-braces" },
  { src: "https://clovecontent.s3.ap-south-1.amazonaws.com/All/2019/02/Dental-Fillings-1-1.gif", label: "Dental Fillings", path: "/services/dental-fillings" },
  { src: "https://clovecontent.s3.ap-south-1.amazonaws.com/All/2019/02/Wisdom-Tooth-1.gif", label: "Wisdom Tooth Removal", path: "/services/wisdom-tooth" },
  { src: "https://clovecontent.s3.ap-south-1.amazonaws.com/All/2017/05/Braces-2.gif", label: "Dental Braces", path: "/services/dental-braces" },
  { src: "https://clovecontent.s3.ap-south-1.amazonaws.com/All/2019/02/Dental-Implants.gif", label: "Dental Implants", path: "/services/dental-implants" },
  { src: "https://clovecontent.s3.ap-south-1.amazonaws.com/All/2019/02/Dentures.gif", label: "Dentures", path: "/services/dentures" },
  { src: "https://clovecontent.s3.ap-south-1.amazonaws.com/All/2019/02/Kids-Dentistery.gif", label: "Kids Dentistry", path: "/services/kids-dentistry" },
  { src: "https://clovecontent.s3.ap-south-1.amazonaws.com/All/2019/02/Mouth-ulcers-1-2.gif", label: "Mouth Ulcers", path: "/services/mouth-ulcers" },
  { src: "https://clovecontent.s3.ap-south-1.amazonaws.com/All/2017/05/Gum-Treatment.gif", label: "Gum Treatment", path: "/services/gum-treatment" },
];

const consultationServices = [
  { icon: "🦷", title: "Dental Consultation", desc: "Speak to a dentist by video or in-person for any dental concern." },
  { icon: "💊", title: "Prescription Advice", desc: "Get new or repeat dental prescriptions sent directly to your pharmacy." },
  { icon: "📋", title: "Dental Certificates", desc: "Request dental letters or certificates quickly." },
  { icon: "🔬", title: "Referrals and Reports", desc: "Arrange scans, tests, or discuss your dental reports." },
  { icon: "😁", title: "Oral Health & Hygiene", desc: "Get advice on brushing, flossing, and dental care." },
  { icon: "📅", title: "Follow-up Appointment", desc: "Continue care or speak with the same dentist again." },
];

const menuItems = [
  { name: "Home", path: "/HomePage" },
  { name: "Gallery", path: "/gallery" },
  { name: "Contact Center", path: "/ContactCenter" },
  { name: "About Us", external: "https://www.myherveybaydental.com.au/about-us/" },
  { name: "Support", path: "/CustomerCare" },
  { name: "What we Treat", path: "/WhatWeTreatPage" },
];

const WhatWeTreatPage = () => {
  const navigate = useNavigate();

  // Prices come from the shared treatments catalog, keyed by treatment name,
  // so any catalog price change (e.g. Wisdom Tooth Removal) shows here too.
  const { treatments } = useTreatments();
  const priceByName = useMemo(() => {
    const map = {};
    treatments.forEach((t) => {
      map[(t.name || "").trim().toLowerCase()] = t.price;
    });
    return map;
  }, [treatments]);
  const [scrolled, setScrolled] = useState(false);
  const [showCallPopup, setShowCallPopup] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showFloatingCTA, setShowFloatingCTA] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 72);
      setShowFloatingCTA(y > 480);
    };
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => e.isIntersecting && e.target.classList.add("sv")),
      { threshold: 0.1 }
    );
    document.querySelectorAll(".sr, .sr-l, .sr-r").forEach((el) =>
      observer.observe(el)
    );
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <style>{`
        .sr   { opacity: 0; transform: translateY(38px);  transition: opacity 0.7s ease, transform 0.7s ease; }
        .sr-l { opacity: 0; transform: translateX(-38px); transition: opacity 0.7s ease, transform 0.7s ease; }
        .sr-r { opacity: 0; transform: translateX(38px);  transition: opacity 0.7s ease, transform 0.7s ease; }
        .sr.sv, .sr-l.sv, .sr-r.sv { opacity: 1; transform: none; }
        .d1 { transition-delay: 0.08s; }
        .d2 { transition-delay: 0.16s; }
        .d3 { transition-delay: 0.24s; }
        .d4 { transition-delay: 0.32s; }
        .d5 { transition-delay: 0.40s; }
        .d6 { transition-delay: 0.48s; }
        .section-pill {
          display: inline-block;
          padding: 6px 16px;
          border-radius: 999px;
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #c2410c;
          background: #fff7ed;
          border: 1px solid #fed7aa;
          margin-bottom: 12px;
        }
      `}</style>

      {/* ── Sticky Nav ───────────────────────────────────────── */}
      <nav
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-white shadow-md border-b border-stone-100"
            : "bg-white/80 backdrop-blur-md border-b border-stone-100/50"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <img src={logo} alt="ToothX" className="h-8 w-auto" />

          <div className="hidden md:flex items-center gap-6">
            {menuItems.map((item) => (
              <button
                key={item.name}
                onClick={() =>
                  item.external
                    ? window.open(item.external, "_blank")
                    : navigate(item.path)
                }
                className={`text-sm font-medium transition-colors duration-200 ${
                  item.name === "What we Treat"
                    ? "text-orange-600 font-semibold"
                    : "text-stone-700 hover:text-orange-600"
                }`}
              >
                {item.name}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCallPopup(true)}
              className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-orange-600 transition-colors"
            >
              <MdCall size={16} />
              <span>Call Us</span>
            </button>
            <button
              onClick={() => (window.location.href = "mailto:support@dutydentist.com")}
              className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-orange-600 transition-colors"
            >
              <MdMailOutline size={16} />
              <span>Email</span>
            </button>
            <button
              onClick={() => navigate("/Customer_home")}
              className="bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm"
            >
              Book Now
            </button>
            <button
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
              className="md:hidden p-2 rounded-lg text-stone-700 hover:bg-stone-100 transition-colors"
            >
              <MdMenu size={24} />
            </button>
          </div>
        </div>
      </nav>

      {/* ── Mobile Drawer ────────────────────────────────────── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute top-0 right-0 h-full w-72 bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
              <img src={logo} alt="ToothX" className="h-7 w-auto" />
              <button
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
                className="p-2 rounded-lg text-stone-500 hover:bg-stone-100 transition-colors"
              >
                <MdClose size={22} />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-4 px-4 space-y-1">
              {menuItems.map((item) => (
                <button
                  key={item.name}
                  onClick={() => {
                    setMobileMenuOpen(false);
                    item.external
                      ? window.open(item.external, "_blank")
                      : navigate(item.path);
                  }}
                  className="w-full text-left px-4 py-3 rounded-xl text-stone-700 hover:bg-orange-50 hover:text-orange-700 font-medium text-sm transition-colors"
                >
                  {item.name}
                </button>
              ))}
            </nav>
            <div className="p-4 border-t border-stone-100 space-y-2">
              <button
                onClick={() => { setMobileMenuOpen(false); setShowCallPopup(true); }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-orange-200 text-orange-700 font-semibold text-sm hover:bg-orange-50 transition-colors"
              >
                <MdCall size={16} /> Call Us
              </button>
              <button
                onClick={() => { setMobileMenuOpen(false); navigate("/Customer_home"); }}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition-opacity"
                style={{ background: "linear-gradient(135deg, #ea580c, #c2410c)" }}
              >
                Book Appointment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Call Popup ───────────────────────────────────────── */}
      {showCallPopup && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 w-80 text-center shadow-2xl relative">
            <button
              onClick={() => setShowCallPopup(false)}
              aria-label="Close"
              className="absolute top-3 right-4 w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors text-lg"
            >
              ✕
            </button>
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: "#fff7ed" }}
            >
              <MdSupportAgent size={32} style={{ color: "#ea580c" }} />
            </div>
            <h2 className="text-lg font-bold mb-1 text-stone-900">24×7 Support</h2>
            <p className="text-stone-500 text-sm mb-3">We're always here to help you</p>
            <p className="text-stone-700 font-bold text-base mb-4">+91 94808 60587</p>
            <button
              onClick={() => (window.location.href = "tel:+919480860587")}
              className="w-full text-white py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
              style={{ background: "linear-gradient(135deg, #ea580c, #c2410c)" }}
            >
              <MdCall className="inline mr-2" size={16} />
              Call Now
            </button>
          </div>
        </div>
      )}

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative bg-white overflow-hidden" style={{ paddingTop: "64px" }}>
        <div
          className="absolute -top-40 -right-40 w-[520px] h-[520px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(254,215,170,0.55) 0%, transparent 68%)" }}
        />
        <div
          className="absolute -bottom-24 -left-24 w-[380px] h-[380px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(219,234,254,0.5) 0%, transparent 68%)" }}
        />

        <div className="max-w-7xl mx-auto px-6 md:px-12 py-14 md:py-20 text-center">
          <span className="section-pill">Our Treatments</span>
          <h1
            className="font-black text-stone-900 leading-tight tracking-tight mb-4"
            style={{ fontSize: "clamp(2rem, 5vw, 3.2rem)" }}
          >
            What We <span className="text-orange-600">Treat</span>
          </h1>
          <p className="text-stone-500 text-base md:text-lg leading-relaxed mb-8 max-w-xl mx-auto">
            We help with a wide range of dental concerns — from routine checkups to advanced treatments.
          </p>
          <button
            onClick={() => navigate("/Customer_home")}
            className="inline-flex items-center gap-2 text-white font-bold px-7 py-3.5 rounded-2xl text-sm transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              background: "linear-gradient(135deg, #ea580c 0%, #c2410c 100%)",
              boxShadow: "0 8px 28px rgba(234,88,12,0.32)",
            }}
          >
            <MdAdd size={20} />
            Book Appointment
          </button>
        </div>
        <div className="h-px w-full bg-gradient-to-r from-transparent via-stone-200 to-transparent" />
      </section>

      {/* ── Treat Items Grid ─────────────────────────────────── */}
      <section className="py-20 px-4 border-t border-stone-100" style={{ background: "#f8fafb" }}>
        <div className="max-w-5xl mx-auto">
          <div className="sr text-center mb-14">
            <span className="section-pill">Dental Services</span>
            <h2 className="text-3xl md:text-4xl font-black text-stone-900 tracking-tight mb-3">
              Our Treatments
            </h2>
            <p className="text-stone-500 max-w-md mx-auto text-sm leading-relaxed">
              Complete dental care designed to keep your smile healthy, confident, and bright.
            </p>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-5 md:gap-6">
            {treatItems.map((item, index) => (
              <button
                key={index}
                onClick={() => navigate(item.path || "/Customer_home")}
                className={`sr d${(index % 6) + 1} group flex flex-col items-center gap-2.5 focus:outline-none`}
              >
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl overflow-hidden border-2 border-stone-100 bg-white group-hover:border-orange-400 group-hover:-translate-y-2 group-hover:shadow-xl transition-all duration-300">
                  <img
                    src={item.src}
                    alt={item.label}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="text-center text-xs font-semibold text-stone-700 group-hover:text-orange-600 transition-colors leading-tight">
                  {item.label}
                </p>
                {priceByName[item.label.trim().toLowerCase()] ? (
                  <p className="text-center text-[11px] font-bold text-orange-600 leading-tight">
                    £{priceByName[item.label.trim().toLowerCase()]}
                  </p>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Services Section ─────────────────────────────────── */}
      <section className="py-20 px-4 bg-white border-t border-stone-100">
        <div className="max-w-5xl mx-auto">
          <div className="sr text-center mb-14">
            <span className="section-pill">How We Help</span>
            <h2 className="text-3xl md:text-4xl font-black text-stone-900 tracking-tight mb-3">
              Our Services
            </h2>
            <p className="text-stone-500 max-w-md mx-auto text-sm leading-relaxed">
              Comprehensive dental support tailored to your needs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {consultationServices.map((service, index) => (
              <div
                key={index}
                className={`sr d${(index % 3) + 1} bg-white rounded-2xl shadow-sm border border-stone-100 p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300`}
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-4"
                  style={{ background: "#fff7ed" }}
                >
                  {service.icon}
                </div>
                <h3 className="text-base font-bold mb-2 text-stone-900">{service.title}</h3>
                <p className="text-sm text-stone-500 leading-relaxed">{service.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ───────────────────────────────────────── */}
      <section
        className="py-16 px-6"
        style={{ background: "linear-gradient(135deg, #ea580c 0%, #c2410c 100%)" }}
      >
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-black text-white mb-4">
            Ready to Book Your Appointment?
          </h2>
          <p className="text-orange-100 text-sm md:text-base mb-8">
            Get expert dental care from the comfort of your home. Connect with top dentists today.
          </p>
          <button
            onClick={() => navigate("/Customer_home")}
            className="inline-flex items-center gap-2 bg-white text-orange-600 font-bold px-8 py-4 rounded-2xl text-sm hover:bg-orange-50 transition-all duration-200 hover:scale-105 shadow-lg"
          >
            <MdAdd size={20} />
            Book Appointment Now
          </button>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer
        className="text-slate-300/80 pb-24 md:pb-0"
        style={{ background: "linear-gradient(135deg, #57534e 0%, #78716c 55%, #c2410c 100%)" }}
      >
        <div className="max-w-7xl mx-auto px-8 py-14 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10">
          <div>
            <img src={logo} alt="ToothX" className="w-24 mb-4 opacity-90" />
            <p className="text-sm leading-relaxed text-slate-400">
              Trusted dental care with modern technology and expert dentists.
              Your smile is our priority.
            </p>
            <div className="flex gap-2.5 mt-5">
              {[
                { Icon: FaFacebookF, href: "https://facebook.com" },
                { Icon: FaInstagram, href: "https://instagram.com" },
                { Icon: FaTwitter, href: "https://twitter.com" },
                { Icon: FaLinkedinIn, href: "https://linkedin.com" },
                { Icon: FaYoutube, href: "https://youtube.com" },
              ].map(({ Icon, href }, i) => (
                <a
                  key={i}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-orange-600 transition-all duration-200"
                  style={{ background: "rgba(255,255,255,0.07)" }}
                >
                  <Icon size={13} />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-white/90 text-xs font-semibold uppercase tracking-[0.15em] mb-5">Company</h3>
            <ul className="space-y-3 text-sm">
              {[
                { label: "Home", href: "/HomePage" },
                { label: "About Us", href: "/about" },
                { label: "Careers", href: "/careers" },
                { label: "Blog", href: "/blog" },
              ].map(({ label, href }) => (
                <li key={label}>
                  <a href={href} className="text-slate-400 hover:text-white transition-colors">{label}</a>
                </li>
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
              <li className="flex items-start gap-2 text-slate-400">
                <span className="mt-px">📍</span>
                <span>Head Office — WTC, Bangalore, India</span>
              </li>
              <li className="flex items-center gap-2 text-slate-400">
                <span>📞</span>
                <span>HR — +91 86188 60059</span>
              </li>
              <li className="flex items-center gap-2 text-slate-400">
                <span>✉</span>
                <a href="mailto:supportblr@dutydentist.com" className="hover:text-white transition-colors">
                  supportblr@dutydentist.com
                </a>
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

      {/* ── Floating Booking Bar (mobile) ────────────────────── */}
      <div
        className={`md:hidden fixed bottom-0 inset-x-0 z-40 transition-all duration-300 ${
          showFloatingCTA ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
        }`}
        style={{ background: "#0f172a", borderTop: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => setShowCallPopup(true)}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-600 text-slate-300 font-semibold text-sm hover:border-orange-500 hover:text-orange-400 transition-colors"
          >
            <MdCall size={16} /> Call Us
          </button>
          <button
            onClick={() => navigate("/Customer_home")}
            className="flex-[2] py-3 rounded-xl text-white font-bold text-sm hover:opacity-90 transition-opacity"
            style={{ background: "linear-gradient(135deg, #ea580c, #c2410c)" }}
          >
            Book Appointment →
          </button>
        </div>
        <div style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
      </div>

      {/* ── Back to Top ──────────────────────────────────────── */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Back to top"
        className={`fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${
          showFloatingCTA ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        }`}
        style={{ background: "#ea580c" }}
      >
        <FaChevronUp size={14} className="text-white" />
      </button>
    </div>
  );
};

export default WhatWeTreatPage;
