import "./App.css";
import adritaImage from "./assets/Adrita.png";
import rajeshImage from "./assets/Rajesh.png";
import RoyImage from "./assets/Roy.png";
import ManishImage from "./assets/Manish.png";
import appbanner from "./assets/2-1.png";
import Banner_wallpaper from "./assets/DentalWallpaper.png";
import logo from "./assets/Toothx_Logo_trimmed.png";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { useState, useEffect, useRef } from "react";

import {
  FaFacebookF,
  FaInstagram,
  FaTwitter,
  FaLinkedinIn,
  FaYoutube,
  FaQuoteLeft,
  FaChevronUp,
  FaChevronLeft,
  FaChevronRight,
  FaApple,
  FaGooglePlay,
} from "react-icons/fa";

import { MdSupportAgent, MdMenu, MdClose, MdAdd, MdCall, MdMailOutline } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import Slider from "react-slick";
import { useTreatments } from "./context/TreatmentsContext";

// Fallback shown when a treatment image fails to load (broken/blocked URL)
const FALLBACK_IMG =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128' viewBox='0 0 128 128'>
      <rect width='128' height='128' rx='16' fill='#fff7ed'/>
      <text x='50%' y='50%' font-size='56' text-anchor='middle' dominant-baseline='central'>🦷</text>
    </svg>`
  );

const handleImgError = (e) => {
  if (e.target.src !== FALLBACK_IMG) e.target.src = FALLBACK_IMG;
};

/* Animated count-up for stat numbers — animates from 0 to the target
   the first time it scrolls into view. Falls back to static text for
   non-numeric values like "24/7". */
function CountUp({ value, trigger }) {
  const ref = useRef(null);
  const match = String(value).match(/^([\d,]+(?:\.\d+)?)([+%★]?)$/);
  const [display, setDisplay] = useState(match ? "0" + (match[2] || "") : value);

  useEffect(() => {
    if (!match) { setDisplay(value); return; }
    const suffix   = match[2] || "";
    const target   = parseFloat(match[1].replace(/,/g, ""));
    const decimals = (match[1].split(".")[1] || "").length;
    const el = ref.current;
    if (!el) return;

    let done = false;
    const run = () => {
      const duration = 1600;
      const t0 = performance.now();
      const tick = (now) => {
        const p = Math.min(1, (now - t0) / duration);
        const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
        const cur = target * eased;
        setDisplay((decimals ? cur.toFixed(decimals) : Math.round(cur).toLocaleString("en-US")) + suffix);
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting && !done) { done = true; run(); io.disconnect(); }
      });
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [value, trigger]); // eslint-disable-line react-hooks/exhaustive-deps

  return <span ref={ref}>{display}</span>;
}

function Welcome() {
  const navigate = useNavigate();
  const { treatments, refreshTreatments } = useTreatments();

  // Auto-refresh page data every 10 seconds (background — no reload/flicker)
  const [refreshTick, setRefreshTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      refreshTreatments?.();
      setRefreshTick((t) => t + 1); // re-trigger the number count-up animations
    }, 10000);
    return () => clearInterval(id);
  }, [refreshTreatments]);
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

  // Scroll-triggered reveal using IntersectionObserver
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

  const menuItems = [
    { name: "Home", path: "/HomePage" },
    { name: "Gallery", path: "/gallery" },
    { name: "Support", path: "/CustomerCare" },
    { name: "What we Treat", path: "/WhatWeTreatPage" },
  ];

  const servicePathMap = {
    "Root Canal Treatment": "/RootCanalTreatment",
    "Dental Crowns": "/services/dental-crowns",
    "Laser Dentistry": "/services/laser-dentistry",
    "Invisible Braces": "/services/invisible-braces",
    "Dental Fillings": "/services/dental-fillings",
    "Wisdom Tooth Removal": "/services/wisdom-tooth",
    "Dental Braces": "/services/dental-braces",
    "Dental Implants": "/services/dental-implants",
    Dentures: "/services/dentures",
    "Kids Dentistry": "/services/kids-dentistry",
    "Mouth Ulcers": "/services/mouth-ulcers",
    "Gum Treatment": "/services/gum-treatment",
  };

  const services = treatments
    .filter((t) => t.published)
    .map((t) => ({ src: t.src, label: t.name, isNew: t.isNew, price: t.price }));

  const doctors = [
    { name: "Dr. Manish Kaushik", img: ManishImage, specialty: "Oral Surgery Specialist", experience: "13 Years" },
    { name: "Dr. Supriya Kumar Roy", img: RoyImage, specialty: "Senior Consultant Oral and Maxillofacial Surgeon", experience: "41 Years" },
    { name: "Brigadier Dr. Rajesh Madan", img: rajeshImage, specialty: "Prosthodontist Expert", experience: "47 Years" },
    { name: "Dr. Adrita Nag", img: adritaImage, specialty: "Oral Medicine and Radiologist", experience: "23 Years" },
  ];

  const reviews = [
    { name: "Danny Brook", review: "Booking was super easy and the consultation was smooth. The doctor explained everything clearly. Highly recommend ToothX!", rating: 5 },
    { name: "Paul Johnson", review: "I got a same-day consultation and quick relief from tooth pain. Excellent service and very professional doctors.", rating: 5 },
    { name: "James Smith", review: "The platform is very user-friendly and the doctors are extremely knowledgeable. Will definitely use again.", rating: 5 },
    { name: "Amit Patel", review: "Quick appointment, clear diagnosis, and effective treatment. Saved me a lot of time and stress.", rating: 5 },
    { name: "Sneha Reddy", review: "Very polite doctors and smooth online consultation experience. Highly satisfied with the service.", rating: 5 },
    { name: "Karthik Iyer", review: "Best online dental service I've used. Great for busy professionals like me.", rating: 5 },
    { name: "Neha Gupta", review: "Fast response, detailed guidance, and friendly support team. Truly impressive!", rating: 5 },
    { name: "Rohit Mehra", review: "Got immediate help during an emergency. Doctors were calm, patient, and professional.", rating: 5 },
  ];

  const avatarPalette = ["#EA580C","#7C3AED","#0E7490","#16A34A","#DC2626","#2563EB","#BE185D","#0F766E"];

  const partnerLogos = [
    "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTYQ-Exq-bRTBdMI9hToshO-uY-K5CyQ6iZHg&s",
    "https://i.pinimg.com/originals/b1/fe/43/b1fe43b1d5c1305009c9d8c8b7cd517a.jpg",
    "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS4cL6Hc7Agl9y0-9A6opnjYV2_PiYLBqazBw&s",
    "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSBwaJHo04qp9RYN3lX-ZOo9h-3XnALv7W3IA&s",
    "https://marketplace.canva.com/EAE-iqmczr4/1/0/1600w/canva-orange-and-purple-minimalist-dental-clinic-logo-py32dplr4L8.jpg",
    "https://narayandental.com/wp-content/uploads/2022/02/logo.png",
  ];

  const PrevArrow = ({ onClick }) => (
    <button
      onClick={onClick}
      className="absolute -left-6 top-1/2 -translate-y-1/2 z-20 bg-orange-600 text-white w-10 h-10 rounded-full shadow-lg hover:bg-orange-700 transition flex items-center justify-center"
    >
      <FaChevronLeft size={14} />
    </button>
  );

  const NextArrow = ({ onClick }) => (
    <button
      onClick={onClick}
      className="absolute -right-6 top-1/2 -translate-y-1/2 z-20 bg-orange-600 text-white w-10 h-10 rounded-full shadow-lg hover:bg-orange-700 transition flex items-center justify-center"
    >
      <FaChevronRight size={14} />
    </button>
  );

  const doctorSliderSettings = {
    dots: false,
    infinite: true,
    speed: 500,
    slidesToShow: 3,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 3000,
    prevArrow: <PrevArrow />,
    nextArrow: <NextArrow />,
    responsive: [
      { breakpoint: 1024, settings: { slidesToShow: 2 } },
      { breakpoint: 640, settings: { slidesToShow: 1 } },
    ],
  };

  return (
    <div className="min-h-screen bg-white">

      {/* ── Animations ───────────────────────────────────────── */}
      <style>{`
        /* Hero entrance */
        @keyframes heroFadeUp {
          from { opacity: 0; transform: translateY(32px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes heroFadeRight {
          from { opacity: 0; transform: translateX(44px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes floatUD {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-12px); }
        }
        @keyframes pulseDot {
          0%, 100% { box-shadow: 0 0 0 0 rgba(234,88,12,0.5); }
          60%       { box-shadow: 0 0 0 7px rgba(234,88,12,0); }
        }
        /* Hero classes */
        .ha1 { animation: heroFadeUp 0.65s ease both; }
        .ha2 { animation: heroFadeUp 0.65s 0.12s ease both; }
        .ha3 { animation: heroFadeUp 0.65s 0.24s ease both; }
        .ha4 { animation: heroFadeUp 0.65s 0.36s ease both; }
        .ha5 { animation: heroFadeUp 0.65s 0.48s ease both; }
        .hi  { animation: heroFadeRight 0.8s 0.22s ease both; }
        .fc1 { animation: floatUD 3.6s ease-in-out infinite; }
        .fc2 { animation: floatUD 3.6s 1.2s ease-in-out infinite; }
        .fc3 { animation: floatUD 4.2s 0.7s ease-in-out infinite; }
        .pulse-badge { animation: pulseDot 2s ease-in-out infinite; }
        /* Scroll reveal */
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
        /* Section heading accent */
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
          <img src={logo} alt="ToothX" className="h-9 w-auto" />

          <div className="hidden md:flex items-center gap-6">
            {menuItems.map((item) => (
              <button
                key={item.name}
                onClick={() =>
                  item.external
                    ? window.open(item.external, "_blank")
                    : navigate(item.path)
                }
                className="text-sm font-medium text-stone-700 hover:text-orange-600 transition-colors duration-200"
              >
                {item.name}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => (window.location.href = "mailto:support@dutydentist.com")}
              className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-orange-600 transition-colors"
            >
              <MdMailOutline size={16} />
              <span>Email</span>
            </button>
            <button
              onClick={() => navigate("/Customer_Login")}
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
              <img src={logo} alt="ToothX" className="h-8 w-auto" />
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
                onClick={() => { setMobileMenuOpen(false); navigate("/Customer_Login"); }}
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
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "#fff7ed" }}>
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

      {/* ── Hero — White Split Layout ─────────────────────────── */}
      <section className="relative bg-white overflow-hidden" style={{ paddingTop: "64px" }}>
        {/* Background blobs */}
        <div className="absolute -top-40 -right-40 w-[520px] h-[520px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(254,215,170,0.55) 0%, transparent 68%)" }} />
        <div className="absolute -bottom-24 -left-24 w-[380px] h-[380px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(219,234,254,0.5) 0%, transparent 68%)" }} />
        <div className="absolute top-24 left-1/3 w-2 h-2 rounded-full bg-orange-300 opacity-50 fc1" />
        <div className="absolute bottom-24 right-1/4 w-3 h-3 rounded-full bg-orange-200 opacity-60 fc2" />

        <div className="max-w-7xl mx-auto px-6 md:px-12 py-14 md:py-20">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">

            {/* Left — Text */}
            <div className="flex-1 text-center lg:text-left">
              <div className="ha1 inline-flex items-center gap-2.5 bg-orange-50 border border-orange-100 text-orange-700 text-xs font-bold px-4 py-2.5 rounded-full mb-6 shadow-sm">
                <span className="pulse-badge w-2 h-2 bg-orange-500 rounded-full inline-block" />
                Online Consultations Available — 24 / 7
              </div>

              <h1 className="ha2 font-black text-stone-900 leading-[1.08] tracking-tight mb-5"
                style={{ fontSize: "clamp(2.4rem, 5vw, 3.6rem)" }}>
                Your Personal
                <br />
                <span className="relative inline-block text-orange-600">
                  Dentist Online
                  <svg className="absolute -bottom-1.5 left-0 w-full overflow-visible" viewBox="0 0 320 10"
                    preserveAspectRatio="none" style={{ height: "7px" }}>
                    <path d="M4,7 Q80,1 160,6 Q240,11 316,4"
                      stroke="#fed7aa" strokeWidth="3" fill="none" strokeLinecap="round" />
                  </svg>
                </span>
              </h1>

              <p className="ha3 text-stone-500 text-base md:text-lg leading-relaxed mb-8 max-w-xl mx-auto lg:mx-0">
                <i>Struggling with dental issues? Get expert advice and treatment from the comfort of your home.
                Connect with top dentists for quick and effective care.</i>
              </p>

              <div className="ha4 flex flex-wrap items-center justify-center lg:justify-start gap-4 mb-10">
                <button
                  onClick={() => navigate("/Customer_Login")}
                  className="flex items-center gap-2 text-white font-bold px-7 py-3.5 rounded-2xl text-sm transition-all duration-200 hover:scale-105 active:scale-95"
                  style={{ background: "linear-gradient(135deg, #ea580c 0%, #c2410c 100%)", boxShadow: "0 8px 28px rgba(234,88,12,0.32)" }}
                >
                  <MdAdd size={20} />
                  Book Appointment
                </button>
                <button
                  onClick={() => setShowCallPopup(true)}
                  className="flex items-center gap-2 font-bold px-7 py-3.5 rounded-2xl text-sm border-2 border-stone-200 text-stone-700 bg-white hover:border-orange-400 hover:text-orange-600 hover:shadow-md transition-all duration-200"
                >
                  <MdCall size={16} />
                  Call Us Free
                </button>
              </div>

              <div className="ha5 flex flex-wrap items-center justify-center lg:justify-start gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <div className="flex gap-0.5">
                    {Array(5).fill(0).map((_, i) => (
                      <span key={i} className="text-amber-400 text-base">★</span>
                    ))}
                  </div>
                  <span className="text-stone-700 font-semibold"><CountUp value="4.9" trigger={refreshTick} /></span>
                </div>
                <span className="w-px h-4 bg-stone-200" />
                <span className="text-stone-500"><CountUp value="2,000+" trigger={refreshTick} /> patients</span>
                <span className="w-px h-4 bg-stone-200" />
                <span className="text-stone-500"><CountUp value="50+" trigger={refreshTick} /> doctors</span>
                <span className="w-px h-4 bg-stone-200" />
                <span className="inline-flex items-center gap-1 text-orange-600 font-semibold">
                  <span className="text-base">🔒</span> Verified Clinic
                </span>
              </div>
            </div>

            {/* Right — Image */}
            <div className="hi flex-1 relative w-full max-w-[600px] mx-auto lg:mx-0">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl" style={{ aspectRatio: "4/3" }}>
                <img src={Banner_wallpaper} alt="Modern dental clinic" className="w-full h-full object-cover" />
                <div className="absolute inset-0"
                  style={{ background: "linear-gradient(160deg, transparent 50%, rgba(0,0,0,0.18) 100%)" }} />
              </div>

              {/* Floating cards */}
              <div className="fc1 absolute -top-5 -left-5 bg-white rounded-2xl px-4 py-3 shadow-xl border border-stone-100 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: "#fff7ed" }}>🦷</div>
                <div>
                  <div className="text-xl font-black text-stone-900 leading-none"><CountUp value="50+" trigger={refreshTick} /></div>
                  <div className="text-xs text-stone-400 mt-0.5">Expert Doctors</div>
                </div>
              </div>

              <div className="fc2 absolute -bottom-5 -right-5 bg-white rounded-2xl px-4 py-3 shadow-xl border border-stone-100 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: "#fffbeb" }}>⭐</div>
                <div>
                  <div className="text-xl font-black text-stone-900 leading-none"><CountUp value="4.9★" trigger={refreshTick} /></div>
                  <div className="text-xs text-stone-400 mt-0.5">Patient Rating</div>
                </div>
              </div>

              <div className="fc3 hidden lg:flex absolute top-1/2 -right-8 -translate-y-1/2 bg-white rounded-2xl px-4 py-3 shadow-xl border border-stone-100 items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base" style={{ background: "#fff7ed" }}>✅</div>
                <div>
                  <div className="text-sm font-black text-stone-900 leading-none"><CountUp value="2,000+" trigger={refreshTick} /></div>
                  <div className="text-xs text-stone-400 mt-0.5">Patients Served</div>
                </div>
              </div>

              {/* Dot grids */}
              <div className="absolute -bottom-6 -left-6 w-20 h-20 pointer-events-none"
                style={{ backgroundImage: "radial-gradient(circle, #fdba74 1.5px, transparent 1.5px)", backgroundSize: "10px 10px", opacity: 0.55 }} />
              <div className="absolute -top-6 right-8 w-16 h-16 pointer-events-none"
                style={{ backgroundImage: "radial-gradient(circle, #fca5a5 1.5px, transparent 1.5px)", backgroundSize: "10px 10px", opacity: 0.4 }} />
            </div>

          </div>
        </div>
        <div className="h-px w-full bg-gradient-to-r from-transparent via-stone-200 to-transparent" />
      </section>

      {/* ── Trust Strip ──────────────────────────────────────── */}
      <section className="bg-white py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: "🦷", number: "2,000+", label: "Patients Served",  color: "#ea580c", bg: "#fff7ed" },
              { icon: "👨‍⚕️", number: "50+",    label: "Expert Dentists", color: "#0891b2", bg: "#f0f9ff" },
              { icon: "⭐", number: "4.9",    label: "Average Rating",  color: "#f59e0b", bg: "#fffbeb" },
              { icon: "🕐", number: "24/7",   label: "Always Available",color: "#7c3aed", bg: "#faf5ff" },
            ].map(({ icon, number, label, color, bg }, i) => (
              <div
                key={label}
                className={`sr d${i + 1} group flex flex-col items-center text-center p-6 rounded-2xl border border-stone-100 bg-white hover:shadow-lg hover:-translate-y-1.5 transition-all duration-300 cursor-default`}
              >
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-3 group-hover:scale-110 transition-transform duration-300"
                  style={{ background: bg }}>
                  {icon}
                </div>
                <div className="text-3xl font-black mb-1" style={{ color }}><CountUp value={number} trigger={refreshTick} /></div>
                <div className="text-xs text-stone-500 font-medium uppercase tracking-wider">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Services ─────────────────────────────────────────── */}
      <section className="py-20 px-4 border-t border-stone-100" style={{ background: "#f8fafb" }}>
        <div className="max-w-7xl mx-auto">
          <div className="sr text-center mb-14">
            <span className="section-pill">What We Offer</span>
            <h2 className="text-3xl md:text-4xl font-black text-stone-900 tracking-tight mb-3">
              Our Treatments
            </h2>
            <p className="text-stone-500 max-w-md mx-auto text-sm leading-relaxed">
              Complete dental care designed to keep your smile healthy, confident, and bright.
            </p>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-5 md:gap-6">
            {services.map((service, index) => (
              <button
                key={index}
                onClick={() => navigate(servicePathMap[service.label] || "/")}
                className={`sr d${(index % 6) + 1} group flex flex-col items-center gap-2.5 focus:outline-none`}
              >
                <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-2xl overflow-hidden border-2 border-stone-100 bg-white group-hover:border-orange-400 group-hover:-translate-y-2 group-hover:shadow-xl transition-all duration-300">
                  {service.isNew && (
                    <span
                      className="absolute top-1 left-1 z-10 text-[8px] font-bold uppercase tracking-wide text-white px-1.5 py-0.5 rounded-full shadow-sm"
                      style={{ background: "linear-gradient(135deg, #f43f5e 0%, #db2777 100%)" }}
                    >
                      New
                    </span>
                  )}
                  <img src={service.src} alt={service.label} loading="lazy" onError={handleImgError} className="w-full h-full object-cover" />
                </div>
                <p className="text-center text-xs font-semibold text-stone-700 group-hover:text-orange-600 transition-colors leading-tight">
                  {service.label}
                </p>
                {service.price ? (
                  <p className="text-center text-[11px] font-bold text-orange-600 leading-tight">
                    £{service.price}
                  </p>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── App Banner ───────────────────────────────────────── */}
      <div className="sr px-6 md:px-12 py-10 bg-white">
        <div className="max-w-7xl mx-auto rounded-3xl overflow-hidden shadow-2xl border border-stone-100">
          <div className="relative w-full aspect-[3/1]">
            <img src={appbanner} alt="Download the ToothX app" className="w-full h-full object-cover" />
            {/* gradient left→transparent so text stays readable */}
            <div className="absolute inset-0"
              style={{ background: "linear-gradient(to right, rgba(15,23,42,0.82) 0%, rgba(15,23,42,0.45) 55%, transparent 100%)" }} />
            {/* overlay content */}
            <div className="absolute inset-0 flex flex-col justify-center px-8 md:px-12 gap-3">
              <p className="text-xs md:text-sm font-semibold uppercase tracking-widest text-orange-400">
                Now Available
              </p>
              <h2 className="text-xl md:text-3xl font-black text-white leading-tight max-w-xs md:max-w-sm">
                Your Smile, <br className="hidden md:block" />In Your Pocket
              </h2>
              <p className="text-white/70 text-xs md:text-sm max-w-xs leading-relaxed hidden sm:block">
                Book appointments, track treatments, and chat with your dentist — all from the ToothX app.
              </p>
              <div className="flex gap-3 mt-1 flex-wrap">
                <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white border border-white/30 hover:bg-white/20 transition-all duration-200"
                  style={{ background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)" }}>
                  <FaApple className="text-base" />
                  <span className="leading-none">
                    <span className="block text-white/60 text-[10px] font-normal">Download on the</span>
                    App Store
                  </span>
                </button>
                <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white border border-white/30 hover:bg-white/20 transition-all duration-200"
                  style={{ background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)" }}>
                  <FaGooglePlay className="text-base" />
                  <span className="leading-none">
                    <span className="block text-white/60 text-[10px] font-normal">Get it on</span>
                    Google Play
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Doctors ──────────────────────────────────────────── */}
      <section className="py-20 px-4 border-t border-stone-100" style={{ background: "#f8fafb" }}>
        <div className="max-w-7xl mx-auto">
          <div className="sr text-center mb-14">
            <span className="section-pill">Our Team</span>
            <h2 className="text-3xl md:text-4xl font-black text-stone-900 tracking-tight mb-3">
              Meet Our Doctors
            </h2>
            <p className="text-stone-500 max-w-md mx-auto text-sm leading-relaxed">
              Experienced specialists dedicated to your dental health and beautiful smile.
            </p>
          </div>

          <div className="relative px-8">
            <Slider {...doctorSliderSettings}>
              {doctors.map((doc, index) => (
                <div key={index} className="px-3">
                  <div className="group relative overflow-hidden rounded-2xl bg-white shadow-sm border border-stone-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                    <div className="relative h-64 overflow-hidden">
                      <img
                        src={doc.img}
                        alt={doc.name}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0"
                        style={{ background: "linear-gradient(to top, rgba(15,23,42,0.88) 0%, rgba(15,23,42,0.08) 55%, transparent 100%)" }} />
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <h3 className="font-bold text-sm text-white leading-tight">{doc.name}</h3>
                        <p className="text-white/65 text-xs mt-0.5 leading-tight">{doc.specialty}</p>
                      </div>
                    </div>
                    <div className="px-4 py-3 flex items-center justify-between" style={{ background: "#fff7ed" }}>
                      <span className="text-xs text-stone-500 font-medium">Experience</span>
                      <span className="text-xs font-bold px-3 py-1 rounded-full text-white" style={{ background: "#ea580c" }}>
                        {doc.experience}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </Slider>
          </div>
        </div>
      </section>

      {/* ── Reviews ──────────────────────────────────────────── */}
      <section className="py-20 px-4 bg-white border-t border-stone-100">
        <div className="max-w-7xl mx-auto">
          <div className="sr text-center mb-14">
            <span className="section-pill">Testimonials</span>
            <h2 className="text-3xl md:text-4xl font-black text-stone-900 tracking-tight mb-3">
              What Patients Say
            </h2>
            <p className="text-stone-500 text-sm italic">Real stories, real smiles.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {reviews.map((review, index) => (
              <div
                key={index}
                className={`sr d${(index % 4) + 1} bg-white rounded-2xl p-5 shadow-sm border border-stone-100 hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex flex-col`}
              >
                <FaQuoteLeft size={18} className="mb-3 flex-shrink-0" style={{ color: "#fed7aa" }} />
                <div className="flex gap-0.5 mb-3">
                  {Array(5).fill(0).map((_, i) => (
                    <span key={i} style={{ color: "#f59e0b", fontSize: "0.75rem" }}>★</span>
                  ))}
                </div>
                <p className="text-stone-500 text-xs italic leading-relaxed mb-4 flex-grow">
                  "{review.review}"
                </p>
                <div className="flex items-center gap-2.5 mt-auto">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white flex-shrink-0"
                    style={{ background: avatarPalette[index % avatarPalette.length] }}
                  >
                    {review.name.charAt(0)}
                  </div>
                  <span className="font-semibold text-stone-800 text-xs">{review.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Partners ─────────────────────────────────────────── */}
      <section className="py-20 px-4" style={{ background: "linear-gradient(135deg, #f0f7ff 0%, #e8f4fd 50%, #f5f0ff 100%)" }}>
        <div className="max-w-7xl mx-auto">
          <div className="sr text-center mb-14">
            <span className="section-pill">Trusted By</span>
            <h2 className="text-3xl md:text-4xl font-black text-stone-900 tracking-tight mb-3">
              Our Partners
            </h2>
            <p className="text-stone-500 text-sm">
              Trusted by leading dental and healthcare organizations.
            </p>
          </div>

          <div className="sr">
            <Slider
              dots={false}
              infinite={true}
              speed={700}
              slidesToShow={4}
              slidesToScroll={1}
              autoplay={true}
              autoplaySpeed={2200}
              responsive={[
                { breakpoint: 1024, settings: { slidesToShow: 3 } },
                { breakpoint: 768,  settings: { slidesToShow: 2 } },
                { breakpoint: 480,  settings: { slidesToShow: 1 } },
              ]}
            >
              {partnerLogos.map((src, index) => (
                <div key={index} className="px-4">
                  <div
                    className="h-24 flex items-center justify-center rounded-2xl transition-all duration-300 cursor-pointer"
                    style={{
                      background: "rgba(255,255,255,0.85)",
                      boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
                      border: "1.5px solid rgba(99,102,241,0.10)",
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.boxShadow = "0 6px 24px rgba(99,102,241,0.18)";
                      e.currentTarget.style.transform = "translateY(-3px)";
                      e.currentTarget.style.borderColor = "rgba(99,102,241,0.35)";
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.07)";
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.borderColor = "rgba(99,102,241,0.10)";
                    }}
                  >
                    <img src={src} alt={`Partner ${index + 1}`} className="max-h-14 max-w-full object-contain px-3" />
                  </div>
                </div>
              ))}
            </Slider>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer
        className="text-slate-300/80 pb-24 md:pb-0"
        style={{ background: "linear-gradient(135deg, #57534e 0%, #78716c 55%, #c2410c 100%)" }}
      >
        <div className="max-w-7xl mx-auto px-8 py-14 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10">
          {/* Brand */}
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
                { Icon: FaTwitter,   href: "https://twitter.com" },
                { Icon: FaLinkedinIn,href: "https://linkedin.com" },
                { Icon: FaYoutube,   href: "https://youtube.com" },
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

          {/* Company */}
          <div>
            <h3 className="text-white/90 text-xs font-semibold uppercase tracking-[0.15em] mb-5">Company</h3>
            <ul className="space-y-3 text-sm">
              {[
                { label: "Home",     href: "/HomePage" },
                { label: "About Us", href: "/about" },
                { label: "Careers",  href: "/careers" },
                { label: "Blog",     href: "/blog" },
              ].map(({ label, href }) => (
                <li key={label}>
                  <a href={href} className="text-slate-400 hover:text-white transition-colors">{label}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Treatments */}
          <div>
            <h3 className="text-white/90 text-xs font-semibold uppercase tracking-[0.15em] mb-5">Treatments</h3>
            <ul className="space-y-3 text-sm">
              {["Dental Implants", "Root Canal", "Braces", "Teeth Whitening"].map((t) => (
                <li key={t} className="text-slate-400 hover:text-white cursor-pointer transition-colors">{t}</li>
              ))}
            </ul>
          </div>

          {/* Contact */}
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
                return (
                  <line
                    key={i}
                    x1={450 + 10 * Math.cos(angle)}
                    y1={300 + 10 * Math.sin(angle)}
                    x2={450 + 90 * Math.cos(angle)}
                    y2={300 + 90 * Math.sin(angle)}
                    stroke="#000080"
                    strokeWidth="4"
                  />
                );
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
            onClick={() => navigate("/Customer_Login")}
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
}

export default Welcome;
