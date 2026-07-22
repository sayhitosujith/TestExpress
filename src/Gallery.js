import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import logo from "./assets/Toothx_Logo_trimmed.png";
import dentist1 from "./assets/dentist1.jpeg";
import xrayImg from "./assets/xray.jpg";
import rootCanalImg from "./assets/RootCanal.jpg";
import { MdMenu, MdClose, MdSupportAgent, MdCall, MdMailOutline, MdSearch } from "react-icons/md";
import {
  FaFacebookF, FaInstagram, FaTwitter, FaLinkedinIn, FaYoutube,
  FaChevronLeft, FaChevronRight, FaChevronUp, FaTimes,
} from "react-icons/fa";

const CATEGORIES = ["All", "Procedures", "Before & After", "Smile Design", "Clinic"];

const GALLERY_ITEMS = [
  { id: 1,  src: "https://clovecontent.s3.ap-south-1.amazonaws.com/All/2019/02/RCT.gif",                title: "Root Canal Treatment",  category: "Procedures",     tags: ["rct", "root canal", "endodontics"] },
  { id: 2,  src: "https://clovecontent.s3.ap-south-1.amazonaws.com/All/2019/02/Crowns.gif",             title: "Dental Crowns",         category: "Procedures",     tags: ["crown", "cap", "restoration"] },
  { id: 3,  src: "https://clovecontent.s3.ap-south-1.amazonaws.com/All/2019/02/Dental-Fillings-1-1.gif",title: "Dental Fillings",       category: "Procedures",     tags: ["filling", "cavity", "composite"] },
  { id: 4,  src: "https://clovecontent.s3.ap-south-1.amazonaws.com/All/2019/02/Dental-Implants.gif",    title: "Dental Implants",       category: "Procedures",     tags: ["implant", "titanium", "missing tooth"] },
  { id: 5,  src: "https://clovecontent.s3.ap-south-1.amazonaws.com/All/2019/02/Dentures.gif",           title: "Dentures",              category: "Procedures",     tags: ["denture", "prosthetics"] },
  { id: 6,  src: "https://clovecontent.s3.ap-south-1.amazonaws.com/All/2019/02/Kids-Dentistery.gif",    title: "Kids Dentistry",        category: "Procedures",     tags: ["pediatric", "children", "kids"] },
  { id: 7,  src: "https://clovecontent.s3.ap-south-1.amazonaws.com/All/2019/02/Wisdom-Tooth-1.gif",     title: "Wisdom Tooth Removal",  category: "Procedures",     tags: ["extraction", "wisdom", "surgery"] },
  { id: 8,  src: "https://clovecontent.s3.ap-south-1.amazonaws.com/All/2017/05/Braces-2.gif",           title: "Dental Braces",         category: "Smile Design",   tags: ["braces", "orthodontics", "alignment"] },
  { id: 9,  src: "https://clovecontent.s3.ap-south-1.amazonaws.com/All/2025/06/Invisible-Braces-1.gif", title: "Invisible Braces",      category: "Smile Design",   tags: ["invisalign", "clear aligners", "braces"] },
  { id: 10, src: "https://clovecontent.s3.ap-south-1.amazonaws.com/All/2019/02/Mouth-ulcers-1-2.gif",   title: "Mouth Ulcer Treatment", category: "Before & After", tags: ["ulcer", "oral medicine", "lesion"] },
  { id: 11, src: "https://clovecontent.s3.ap-south-1.amazonaws.com/All/2017/05/Gum-Treatment.gif",      title: "Gum Treatment",         category: "Before & After", tags: ["gum", "periodontal", "gingivitis"] },
  { id: 12, src: rootCanalImg,                                                                           title: "Root Canal Clinic",     category: "Clinic",         tags: ["clinic", "room", "equipment"] },
  { id: 13, src: xrayImg,                                                                                title: "Digital X-Ray",         category: "Clinic",         tags: ["xray", "digital", "diagnostic"] },
  { id: 14, src: dentist1,                                                                               title: "Our Expert Team",       category: "Clinic",         tags: ["team", "doctor", "staff"] },
  { id: 15, src: "https://clovecontent.s3.ap-south-1.amazonaws.com/All/2019/02/Wisdom-Tooth-1.gif",     title: "Laser Dentistry",       category: "Procedures",     tags: ["laser", "painless", "advanced"] },
];

function Gallery() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const [showCallPopup, setShowCallPopup] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showFloatingCTA, setShowFloatingCTA] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const menuItems = [
    { name: "Home", path: "/HomePage" },
    { name: "Gallery", path: "/gallery" },
    { name: "Support", path: "/CustomerCare" },
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
    document.body.style.overflow = (mobileMenuOpen || lightboxIndex !== null) ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen, lightboxIndex]);

  const filteredItems = GALLERY_ITEMS.filter((item) => {
    const matchCat = activeCategory === "All" || item.category === activeCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      item.title.toLowerCase().includes(q) ||
      item.tags.some((t) => t.includes(q)) ||
      item.category.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  const openLightbox = (index) => {
    setImgLoaded(false);
    setLightboxIndex(index);
  };
  const closeLightbox = () => setLightboxIndex(null);

  const prevImage = useCallback(() => {
    setImgLoaded(false);
    setLightboxIndex((i) => (i <= 0 ? filteredItems.length - 1 : i - 1));
  }, [filteredItems.length]);

  const nextImage = useCallback(() => {
    setImgLoaded(false);
    setLightboxIndex((i) => (i >= filteredItems.length - 1 ? 0 : i + 1));
  }, [filteredItems.length]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKey = (e) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") prevImage();
      if (e.key === "ArrowRight") nextImage();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightboxIndex, prevImage, nextImage]);

  const currentItem = lightboxIndex !== null ? filteredItems[lightboxIndex] : null;

  const categoryCount = (cat) =>
    cat === "All"
      ? GALLERY_ITEMS.length
      : GALLERY_ITEMS.filter((i) => i.category === cat).length;

  return (
    <div className="min-h-screen bg-white">
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes scaleIn { from { opacity:0; transform:scale(0.94); } to { opacity:1; transform:scale(1); } }
        .fu { animation: fadeUp 0.55s ease both; }
        .fu2 { animation: fadeUp 0.55s 0.1s ease both; }
        .fu3 { animation: fadeUp 0.55s 0.2s ease both; }
        .fi { animation: fadeIn 0.3s ease both; }
        .si { animation: scaleIn 0.3s ease both; }
        .section-pill {
          display: inline-block; padding: 5px 14px; border-radius: 999px;
          font-size: 0.7rem; font-weight: 700; letter-spacing: 0.12em;
          text-transform: uppercase; color: #c2410c;
          background: #fff7ed; border: 1px solid #fed7aa; margin-bottom: 10px;
        }
        .gallery-card { transition: transform 0.25s ease, box-shadow 0.25s ease; }
        .gallery-card:hover { transform: translateY(-4px); box-shadow: 0 16px 40px rgba(0,0,0,0.14); }
        .gallery-card:hover .gallery-overlay { opacity: 1; }
        .gallery-overlay { opacity: 0; transition: opacity 0.25s ease; }
      `}</style>

      {/* ── Sticky Nav ─────────────────────────────────── */}
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-white shadow-md border-b border-stone-100" : "bg-white/80 backdrop-blur-md border-b border-stone-100/50"
      }`}>
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <img src={logo} alt="ToothX" className="h-8 w-auto cursor-pointer" onClick={() => navigate("/HomePage")} />

          <div className="hidden md:flex items-center gap-6">
            {menuItems.map((item) => (
              <button
                key={item.name}
                onClick={() => navigate(item.path)}
                className={`text-sm font-medium transition-colors duration-200 ${
                  item.path === "/gallery"
                    ? "text-orange-600 border-b-2 border-orange-500 pb-0.5"
                    : "text-stone-700 hover:text-orange-600"
                }`}
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
              <MdMailOutline size={16} /><span>Email</span>
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

      {/* ── Mobile Drawer ───────────────────────────────── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute top-0 right-0 h-full w-72 bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
              <img src={logo} alt="ToothX" className="h-7 w-auto" />
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-lg text-stone-500 hover:bg-stone-100 transition-colors">
                <MdClose size={22} />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-4 px-4 space-y-1">
              {menuItems.map((item) => (
                <button
                  key={item.name}
                  onClick={() => { setMobileMenuOpen(false); navigate(item.path); }}
                  className="w-full text-left px-4 py-3 rounded-xl text-stone-700 hover:bg-orange-50 hover:text-orange-700 font-medium text-sm transition-colors"
                >
                  {item.name}
                </button>
              ))}
            </nav>
            <div className="p-4 border-t border-stone-100 space-y-2">
              <button
                onClick={() => { setMobileMenuOpen(false); navigate("/Customer_home"); }}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm"
                style={{ background: "linear-gradient(135deg, #ea580c, #c2410c)" }}
              >
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
            <button onClick={() => (window.location.href = "tel:+919480860587")} className="w-full text-white py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity" style={{ background: "linear-gradient(135deg, #ea580c, #c2410c)" }}>
              <MdCall className="inline mr-2" size={16} />Call Now
            </button>
          </div>
        </div>
      )}

      {/* ── Hero ────────────────────────────────────────── */}
      <section className="relative overflow-hidden" style={{ paddingTop: "64px", background: "linear-gradient(135deg, #fff7ed 0%, #ffffff 60%, #f0f9ff 100%)" }}>
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(254,215,170,0.45) 0%, transparent 70%)" }} />
        <div className="max-w-5xl mx-auto px-6 py-16 text-center">
          <div className="fu">
            <span className="section-pill">Visual Showcase</span>
          </div>
          <h1 className="fu2 font-black text-stone-900 tracking-tight mb-4" style={{ fontSize: "clamp(2rem,5vw,3.2rem)" }}>
            Our{" "}
            <span className="text-orange-600 relative inline-block">
              Gallery
              <svg className="absolute -bottom-1 left-0 w-full overflow-visible" viewBox="0 0 200 8" preserveAspectRatio="none" style={{ height: "6px" }}>
                <path d="M2,5 Q50,1 100,5 Q150,9 198,3" stroke="#fed7aa" strokeWidth="3" fill="none" strokeLinecap="round" />
              </svg>
            </span>
          </h1>
          <p className="fu3 text-stone-500 text-base md:text-lg max-w-lg mx-auto leading-relaxed mb-8">
            Explore our treatments, procedures, and state-of-the-art clinic through our curated image gallery.
          </p>

          {/* Search bar */}
          <div className="fu3 flex items-center max-w-md mx-auto bg-white border border-stone-200 rounded-2xl px-4 py-3 shadow-sm focus-within:border-orange-400 focus-within:shadow-md transition-all duration-200">
            <MdSearch size={18} className="text-stone-400 mr-3 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search by treatment, category…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 text-sm text-stone-700 placeholder-stone-400 outline-none bg-transparent"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="ml-2 text-stone-400 hover:text-stone-700 transition-colors">
                <MdClose size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Stats strip */}
        <div className="border-t border-stone-100 bg-white/60 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto px-6 py-4 flex flex-wrap items-center justify-center gap-6 text-sm text-stone-500">
            <span><strong className="text-stone-800">{GALLERY_ITEMS.length}</strong> photos</span>
            <span className="w-px h-4 bg-stone-200" />
            <span><strong className="text-stone-800">{CATEGORIES.length - 1}</strong> categories</span>
            <span className="w-px h-4 bg-stone-200" />
            <span className="text-orange-600 font-semibold">Updated regularly</span>
          </div>
        </div>
      </section>

      {/* ── Category Filters ────────────────────────────── */}
      <section className="sticky top-16 z-30 bg-white border-b border-stone-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                activeCategory === cat
                  ? "bg-orange-600 text-white shadow-sm"
                  : "bg-stone-100 text-stone-600 hover:bg-orange-50 hover:text-orange-700"
              }`}
            >
              {cat}
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                activeCategory === cat ? "bg-white/25 text-white" : "bg-stone-200 text-stone-500"
              }`}>
                {categoryCount(cat)}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Gallery Grid ────────────────────────────────── */}
      <section className="py-12 px-4" style={{ background: "#f8fafb" }}>
        <div className="max-w-6xl mx-auto">
          {filteredItems.length === 0 ? (
            <div className="text-center py-24">
              <div className="text-5xl mb-4">🔍</div>
              <h3 className="text-xl font-bold text-stone-700 mb-2">No results found</h3>
              <p className="text-stone-500 text-sm mb-6">Try a different search term or category</p>
              <button
                onClick={() => { setSearchQuery(""); setActiveCategory("All"); }}
                className="px-6 py-2.5 rounded-xl text-white font-semibold text-sm"
                style={{ background: "linear-gradient(135deg, #ea580c, #c2410c)" }}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <>
              <p className="text-stone-400 text-xs font-medium mb-5">
                Showing {filteredItems.length} of {GALLERY_ITEMS.length} photos
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredItems.map((item, index) => (
                  <div
                    key={item.id}
                    className="gallery-card relative rounded-2xl overflow-hidden cursor-pointer bg-white shadow-sm border border-stone-100"
                    style={{ aspectRatio: index % 7 === 0 ? "1/1.2" : "1/1" }}
                    onClick={() => openLightbox(index)}
                  >
                    <img
                      src={item.src}
                      alt={item.title}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                    {/* Hover Overlay */}
                    <div className="gallery-overlay absolute inset-0 flex flex-col justify-end p-3"
                      style={{ background: "linear-gradient(to top, rgba(15,23,42,0.82) 0%, rgba(15,23,42,0.1) 60%, transparent 100%)" }}>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-orange-300 mb-0.5">{item.category}</span>
                      <h3 className="text-white text-xs font-bold leading-tight">{item.title}</h3>
                    </div>
                    {/* Category badge */}
                    <div className="absolute top-2.5 left-2.5">
                      <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-full text-white"
                        style={{ background: "rgba(234,88,12,0.85)", backdropFilter: "blur(6px)" }}>
                        {item.category}
                      </span>
                    </div>
                    {/* Expand icon */}
                    <div className="gallery-overlay absolute top-2.5 right-2.5 w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: "rgba(255,255,255,0.2)", backdropFilter: "blur(6px)" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                        <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
                        <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ── Lightbox ────────────────────────────────────── */}
      {lightboxIndex !== null && currentItem && (
        <div
          className="fi fixed inset-0 z-[80] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.94)", backdropFilter: "blur(12px)" }}
          onClick={closeLightbox}
        >
          {/* Close */}
          <button
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-all z-10"
            onClick={closeLightbox}
            aria-label="Close"
          >
            <FaTimes size={18} />
          </button>

          {/* Counter */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-xs font-semibold text-white/70"
            style={{ background: "rgba(255,255,255,0.1)", backdropFilter: "blur(6px)" }}>
            {lightboxIndex + 1} / {filteredItems.length}
          </div>

          {/* Prev */}
          <button
            className="absolute left-3 md:left-6 w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl md:rounded-2xl text-white hover:bg-white/15 transition-all z-10"
            onClick={(e) => { e.stopPropagation(); prevImage(); }}
            aria-label="Previous"
          >
            <FaChevronLeft size={18} />
          </button>

          {/* Next */}
          <button
            className="absolute right-3 md:right-6 w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl md:rounded-2xl text-white hover:bg-white/15 transition-all z-10"
            onClick={(e) => { e.stopPropagation(); nextImage(); }}
            aria-label="Next"
          >
            <FaChevronRight size={18} />
          </button>

          {/* Image container */}
          <div
            className="si relative flex flex-col items-center max-w-3xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative rounded-2xl overflow-hidden shadow-2xl w-full"
              style={{ background: "#111", minHeight: "200px" }}>
              {!imgLoaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
              )}
              <img
                key={currentItem.src}
                src={currentItem.src}
                alt={currentItem.title}
                onLoad={() => setImgLoaded(true)}
                className={`w-full object-contain transition-opacity duration-300 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
                style={{ maxHeight: "70vh" }}
              />
            </div>

            {/* Caption */}
            <div className="mt-4 text-center">
              <span className="text-orange-400 text-xs font-bold uppercase tracking-widest">{currentItem.category}</span>
              <h3 className="text-white font-bold text-lg mt-0.5">{currentItem.title}</h3>
              <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2">
                {currentItem.tags.map((tag) => (
                  <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full text-white/50"
                    style={{ background: "rgba(255,255,255,0.08)" }}>
                    #{tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Keyboard hint */}
            <p className="mt-4 text-white/25 text-xs">Use ← → arrow keys to navigate · Esc to close</p>
          </div>
        </div>
      )}

      {/* ── CTA Banner ──────────────────────────────────── */}
      <section className="py-16 px-4 bg-white border-t border-stone-100 text-center">
        <div className="max-w-xl mx-auto">
          <span className="section-pill">Ready to smile?</span>
          <h2 className="text-2xl md:text-3xl font-black text-stone-900 mb-3">
            Book Your Appointment Today
          </h2>
          <p className="text-stone-500 text-sm mb-8 leading-relaxed">
            Experience the same expert care you've seen here. Our dentists are ready to help.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => navigate("/Customer_home")}
              className="flex items-center gap-2 text-white font-bold px-7 py-3.5 rounded-2xl text-sm transition-all hover:scale-105"
              style={{ background: "linear-gradient(135deg, #ea580c, #c2410c)", boxShadow: "0 8px 24px rgba(234,88,12,0.3)" }}
            >
              Book Appointment
            </button>
            <button
              onClick={() => setShowCallPopup(true)}
              className="flex items-center gap-2 font-bold px-7 py-3.5 rounded-2xl text-sm border-2 border-stone-200 text-stone-700 bg-white hover:border-orange-400 hover:text-orange-600 transition-all"
            >
              <MdCall size={16} /> Call Us Free
            </button>
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
                { Icon: FaFacebookF, href: "https://facebook.com" },
                { Icon: FaInstagram, href: "https://instagram.com" },
                { Icon: FaTwitter,   href: "https://twitter.com" },
                { Icon: FaLinkedinIn,href: "https://linkedin.com" },
                { Icon: FaYoutube,   href: "https://youtube.com" },
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
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Back to top"
        className={`fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${showFloatingCTA ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"}`}
        style={{ background: "#ea580c" }}
      >
        <FaChevronUp size={14} className="text-white" />
      </button>
    </div>
  );
}

export default Gallery;
