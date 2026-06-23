import "./App.css";
import { RiAppleLine } from "react-icons/ri";
import { GrAndroid } from "react-icons/gr";
import Flag from "react-world-flags";
import adritaImage from "./assets/Adrita.png";
import rajeshImage from "./assets/Rajesh.png";
import RoyImage from "./assets/Roy.png";
import ManishImage from "./assets/Manish.png";
import appbanner from "./assets/2-1.png";
import Banner_wallpaper from "./assets/DentalWallpaper.png";
import { BsPlus } from "react-icons/bs";
import logo from "./assets/Toothx_Logo-removebg-preview.png";
import { TbDental } from "react-icons/tb";
import { IoCallSharp, IoMailOutline } from "react-icons/io5";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { useState, useEffect } from "react";

import {
  FaFacebookF,
  FaInstagram,
  FaTwitter,
  FaLinkedinIn,
  FaYoutube,
  FaQuoteLeft,
  FaChevronUp,
} from "react-icons/fa";

import { MdSupportAgent, MdMenu, MdClose } from "react-icons/md";

import { useNavigate } from "react-router-dom";
import Slider from "react-slick";

function Welcome() {
  const navigate = useNavigate();
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

  const menuItems = [
    { name: "Home", path: "/HomePage" },
    { name: "Gallery", path: "/gallery" },
    { name: "Contact Us", path: "/Contact_us" },
    {
      name: "About Us",
      external: "https://www.myherveybaydental.com.au/about-us/",
    },
    { name: "Support", path: "/CustomerCare" },
    { name: "What we Treat", path: "/WhatWeTreatPage" },
  ];

  const servicePathMap = {
    "Root Canal Treatment": "/RootCanalTreatment",
    "Dental Crowns": "/services/dental-crowns",
    "Laser Dentistry": "/services/laser-dentistry",
    "Invisible Braces": "/services/invisible-braces",
    "Dental Fillings": "/services/dental-fillings",
    "Wisdom Tooth": "/services/wisdom-tooth",
    "Dental Braces": "/services/dental-braces",
    "Dental Implants": "/services/dental-implants",
    Dentures: "/services/dentures",
    "Kids Dentistry": "/services/kids-dentistry",
    "Mouth Ulcers": "/services/mouth-ulcers",
    "Gum Treatment": "/services/gum-treatment",
  };

  const services = [
    {
      src: "https://clovecontent.s3.ap-south-1.amazonaws.com/All/2019/02/RCT.gif",
      label: "Root Canal Treatment",
    },
    {
      src: "https://clovecontent.s3.ap-south-1.amazonaws.com/All/2019/02/Crowns.gif",
      label: "Dental Crowns",
    },
    {
      src: "https://clovecontent.s3.ap-south-1.amazonaws.com/All/2019/02/Dental-Fillings-1-1.gif",
      label: "Laser Dentistry",
    },
    {
      src: "https://clovecontent.s3.ap-south-1.amazonaws.com/All/2025/06/Invisible-Braces-1.gif",
      label: "Invisible Braces",
    },
    {
      src: "https://clovecontent.s3.ap-south-1.amazonaws.com/All/2019/02/Dental-Fillings-1-1.gif",
      label: "Dental Fillings",
    },
    {
      src: "https://clovecontent.s3.ap-south-1.amazonaws.com/All/2019/02/Wisdom-Tooth-1.gif",
      label: "Wisdom Tooth",
    },
    {
      src: "https://clovecontent.s3.ap-south-1.amazonaws.com/All/2017/05/Braces-2.gif",
      label: "Dental Braces",
    },
    {
      src: "https://clovecontent.s3.ap-south-1.amazonaws.com/All/2019/02/Dental-Implants.gif",
      label: "Dental Implants",
    },
    {
      src: "https://clovecontent.s3.ap-south-1.amazonaws.com/All/2019/02/Dentures.gif",
      label: "Dentures",
    },
    {
      src: "https://clovecontent.s3.ap-south-1.amazonaws.com/All/2019/02/Kids-Dentistery.gif",
      label: "Kids Dentistry",
    },
    {
      src: "https://clovecontent.s3.ap-south-1.amazonaws.com/All/2019/02/Mouth-ulcers-1-2.gif",
      label: "Mouth Ulcers",
    },
    {
      src: "https://clovecontent.s3.ap-south-1.amazonaws.com/All/2017/05/Gum-Treatment.gif",
      label: "Gum Treatment",
    },
  ];

  const doctors = [
    {
      name: "Dr. Manish Kaushik",
      img: ManishImage,
      specialty: "Oral Surgery Specialist",
      experience: "13 Years",
    },
    {
      name: "Dr. Supriya Kumar Roy",
      img: RoyImage,
      specialty: "Senior Consultant Oral and Maxillofacial Surgeon",
      experience: "41 Years",
    },
    {
      name: "Brigadier Dr. Rajesh Madan",
      img: rajeshImage,
      specialty: "Prosthodontist Expert",
      experience: "47 Years",
    },
    {
      name: "Dr. Adrita Nag",
      img: adritaImage,
      specialty: "Oral Medicine and Radiologist",
      experience: "23 Years",
    },
  ];

  const reviews = [
    {
      name: "Danny Brook",
      review:
        "Booking was super easy and the consultation was smooth. The doctor explained everything clearly. Highly recommend ToothX!",
      rating: 5,
    },
    {
      name: "Paul Morris",
      review:
        "I got a same-day consultation and quick relief from tooth pain. Excellent service and very professional doctors.",
      rating: 5,
    },
    {
      name: "James White Bread",
      review:
        "The platform is very user-friendly and the doctors are extremely knowledgeable. Will definitely use again.",
      rating: 5,
    },
    {
      name: "Amit Patel",
      review:
        "Quick appointment, clear diagnosis, and effective treatment. Saved me a lot of time and stress.",
      rating: 5,
    },
    {
      name: "Sneha Reddy",
      review:
        "Very polite doctors and smooth online consultation experience. Highly satisfied with the service.",
      rating: 5,
    },
    {
      name: "Karthik Iyer",
      review:
        "Best online dental service I've used. Great for busy professionals like me.",
      rating: 5,
    },
    {
      name: "Neha Gupta",
      review:
        "Fast response, detailed guidance, and friendly support team. Truly impressive!",
      rating: 5,
    },
    {
      name: "Rohit Mehra",
      review:
        "Got immediate help during an emergency. Doctors were calm, patient, and professional.",
      rating: 5,
    },
  ];

  const avatarPalette = [
    "#EA580C",
    "#7C3AED",
    "#0E7490",
    "#16A34A",
    "#DC2626",
    "#2563EB",
    "#BE185D",
    "#0F766E",
  ];

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
      className="absolute -left-6 top-1/2 -translate-y-1/2 z-20 bg-orange-600 text-white w-10 h-10 rounded-full shadow-lg hover:bg-orange-700 transition text-xl font-bold"
    >
      ‹
    </button>
  );

  const NextArrow = ({ onClick }) => (
    <button
      onClick={onClick}
      className="absolute -right-6 top-1/2 -translate-y-1/2 z-20 bg-orange-600 text-white w-10 h-10 rounded-full shadow-lg hover:bg-orange-700 transition text-xl font-bold"
    >
      ›
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
    <div style={{ background: "#FAFAF9" }} className="min-h-screen">

      {/* ─── Sticky Navigation ─── */}
      <nav
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-white shadow-sm border-b border-stone-100"
            : "bg-transparent"
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
                  scrolled
                    ? "text-stone-600 hover:text-orange-600"
                    : "text-white/90 hover:text-orange-300"
                }`}
              >
                {item.name}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCallPopup(true)}
              className={`hidden sm:flex items-center gap-1.5 text-sm font-medium transition-colors ${
                scrolled
                  ? "text-stone-600 hover:text-orange-600"
                  : "text-white/80 hover:text-white"
              }`}
            >
              <IoCallSharp size={16} />
              <span>Call Us</span>
            </button>
            <button
              onClick={() =>
                (window.location.href = "mailto:support@dutydentist.com")
              }
              className={`hidden sm:flex items-center gap-1.5 text-sm font-medium transition-colors ${
                scrolled
                  ? "text-stone-600 hover:text-orange-600"
                  : "text-white/80 hover:text-white"
              }`}
            >
              <IoMailOutline size={16} />
              <span>Email</span>
            </button>
            <button
              onClick={() => navigate("/Customer_home")}
              className="bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              Book Now
            </button>
            <button
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
              className={`md:hidden p-2 rounded-lg transition-colors ${
                scrolled ? "text-stone-700 hover:bg-stone-100" : "text-white hover:bg-white/10"
              }`}
            >
              <MdMenu size={24} />
            </button>
          </div>
        </div>
      </nav>

      {/* ─── Mobile Drawer ─── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Panel */}
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
                <IoCallSharp size={16} /> Call Us
              </button>
              <button
                onClick={() => { setMobileMenuOpen(false); navigate("/Customer_home"); }}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-opacity hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #EA580C, #7C3AED)" }}
              >
                Book Appointment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Call Popup ─── */}
      {showCallPopup && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 w-80 text-center shadow-2xl relative animate-popup">
            <button
              onClick={() => setShowCallPopup(false)}
              aria-label="Close"
              className="absolute top-3 right-4 w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors text-lg"
            >
              ✕
            </button>
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: "#FFF7ED" }}
            >
              <MdSupportAgent size={32} style={{ color: "#EA580C" }} />
            </div>
            <h2 className="text-lg font-bold mb-1 text-stone-900">
              24×7 Support
            </h2>
            <p className="text-stone-500 text-sm mb-3">
              We're always here to help you
            </p>
            <p className="text-stone-700 font-bold text-base mb-4">
              +91 94808 60587
            </p>
            <button
              onClick={() => (window.location.href = "tel:+919480860587")}
              className="w-full text-white py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
              style={{
                background: "linear-gradient(135deg, #EA580C, #7C3AED)",
              }}
            >
              <IoCallSharp className="inline mr-2" size={16} />
              Call Now
            </button>
          </div>
        </div>
      )}

      {/* ─── Hero ─── */}
      <section className="relative w-full h-[500px] md:h-[620px] overflow-hidden">
        <img
          src={Banner_wallpaper}
          alt="Dental clinic"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Orange→violet gradient overlay — commits to ToothX's brand identity */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(120deg, rgba(154,52,18,0.88) 0%, rgba(124,58,237,0.72) 55%, rgba(88,28,135,0.55) 100%)",
          }}
        />

        <div className="absolute inset-0 flex flex-col justify-center px-8 md:px-20 max-w-2xl">
          <span className="inline-flex items-center gap-2 text-orange-200 text-xs font-semibold uppercase tracking-[0.15em] mb-4">
            <span className="w-5 h-px bg-orange-400" />
            Online Consultations Available
          </span>

          <h1 className="text-white text-4xl md:text-6xl font-black leading-tight tracking-tight mb-5">
            Your dentist,
            <br />
            <span style={{ color: "#FED7AA" }}>wherever you are.</span>
          </h1>

          <p className="text-white/75 text-sm md:text-base leading-relaxed mb-8 max-w-md">
            Skip the waiting room. Book a same-day or next-day online
            consultation with an experienced dentist — in minutes.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={() => navigate("/Customer_home")}
              className="flex items-center gap-2 text-white text-sm font-bold px-6 py-3 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
              style={{
                background: "#EA580C",
                boxShadow: "0 4px 20px rgba(234,88,12,0.45)",
              }}
            >
              <BsPlus size={20} />
              Book Online Now
            </button>
            <div className="flex items-center gap-2 text-white/65 text-xs">
              <div className="flex gap-0.5">
                {Array(5)
                  .fill(0)
                  .map((_, i) => (
                    <span key={i} style={{ color: "#FCD34D" }}>
                      ★
                    </span>
                  ))}
              </div>
              <span>4.9 · 2,000+ patients</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Trust Strip ─── */}
      <div style={{ background: "#ffffff" }} className="py-6 px-4">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { number: "2,000+", label: "Patients Served" },
            { number: "50+", label: "Expert Dentists" },
            { number: "4.9★", label: "Average Rating" },
            { number: "24/7", label: "Support Available" },
          ].map(({ number, label }) => (
            <div key={label}>
              <div
                className="text-2xl font-black tracking-tight"
                style={{ color: "#FED7AA" }}
              >
                {number}
              </div>
              <div className="text-xs text-stone-500 mt-0.5 uppercase tracking-wider">
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Services ─── */}
      <section className="py-16 px-4" style={{ background: "#FAFAF9" }}>
        <div className="max-w-5xl mx-auto">
          <div className="mb-10">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-600 mb-2">
              What We Offer
            </p>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight text-stone-900">
              Professional Services
            </h2>
            <p className="text-stone-500 text-sm mt-2">
              Complete dental care designed to keep your smile healthy,
              confident, and bright.
            </p>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4 md:gap-6">
            {services.map((service, index) => (
              <button
                key={index}
                onClick={() =>
                  navigate(servicePathMap[service.label] || "/")
                }
                className="group flex flex-col items-center gap-2.5 focus:outline-none"
              >
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl overflow-hidden shadow-sm ring-2 ring-transparent group-hover:ring-orange-500 group-hover:-translate-y-1 group-hover:shadow-lg transition-all duration-300 bg-white">
                  <img
                    src={service.src}
                    alt={service.label}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="text-center text-xs font-semibold text-stone-700 group-hover:text-orange-600 transition-colors leading-tight">
                  {service.label}
                </p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ─── App Banner ─── */}
      <div className="px-4 md:px-8 pb-12">
        <div className="max-w-5xl mx-auto rounded-2xl overflow-hidden shadow-md">
          <div className="relative w-full aspect-[3/1]">
            <img
              src={appbanner}
              alt="Download the ToothX app"
              className="w-full h-full object-cover"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to right, rgba(255,255,255,0.15), transparent)",
              }}
            />
          </div>
        </div>
      </div>

      {/* ─── Doctors ─── */}
      <section className="py-16 px-4" style={{ background: "#F5F5F4" }}>
        <div className="max-w-5xl mx-auto">
          <div className="mb-10">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-600 mb-2">
              Our Team
            </p>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight text-stone-900">
              Meet Our Doctors
            </h2>
          </div>

          <div className="relative px-8">
            <Slider {...doctorSliderSettings}>
              {doctors.map((doc, index) => (
                <div key={index} className="px-3">
                  <div className="group relative overflow-hidden rounded-2xl bg-white shadow-sm border border-stone-100 hover:shadow-xl transition-all duration-300">
                    <div className="relative h-64 overflow-hidden">
                      <img
                        src={doc.img}
                        alt={doc.name}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div
                        className="absolute inset-0"
                        style={{
                          background:
                            "linear-gradient(to top, rgba(28,25,23,0.85) 0%, rgba(28,25,23,0.1) 60%, transparent 100%)",
                        }}
                      />
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <h3 className="font-bold text-sm text-white leading-tight">
                          {doc.name}
                        </h3>
                        <p className="text-white/65 text-xs mt-0.5 leading-tight">
                          {doc.specialty}
                        </p>
                      </div>
                    </div>
                    <div
                      className="px-4 py-3 flex items-center justify-between"
                      style={{ background: "#FFF7ED" }}
                    >
                      <span className="text-xs text-stone-500 font-medium">
                        Experience
                      </span>
                      <span
                        className="text-xs font-bold px-3 py-1 rounded-full text-white"
                        style={{ background: "#EA580C" }}
                      >
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

      {/* ─── Reviews ─── */}
      <section className="py-16 px-4" style={{ background: "#FAFAF9" }}>
        <div className="max-w-5xl mx-auto">
          <div className="mb-10">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-600 mb-2">
              Testimonials
            </p>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight text-stone-900">
              What Patients Say
            </h2>
            <p className="text-stone-500 text-sm mt-2 italic">
              Real stories, real smiles.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {reviews.map((review, index) => (
              <div
                key={index}
                className="bg-white rounded-2xl p-5 shadow-sm border border-stone-100 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex flex-col"
              >
                <FaQuoteLeft
                  size={18}
                  style={{ color: "#FED7AA" }}
                  className="mb-3 flex-shrink-0"
                />
                <div className="flex gap-0.5 mb-3">
                  {Array(5)
                    .fill(0)
                    .map((_, i) => (
                      <span
                        key={i}
                        style={{ color: "#F59E0B", fontSize: "0.75rem" }}
                      >
                        ★
                      </span>
                    ))}
                </div>
                <p className="text-stone-500 text-xs italic leading-relaxed mb-4 flex-grow">
                  "{review.review}"
                </p>
                <div className="flex items-center gap-2.5 mt-auto">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white flex-shrink-0"
                    style={{
                      background: avatarPalette[index % avatarPalette.length],
                    }}
                  >
                    {review.name.charAt(0)}
                  </div>
                  <span className="font-semibold text-stone-800 text-xs">
                    {review.name}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Partners ─── */}
      <section className="py-14 px-4" style={{ background: "#F5F5F4" }}>
        <div className="max-w-5xl mx-auto">
          <div className="mb-10">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-600 mb-2">
              Trusted By
            </p>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight text-stone-900">
              Our Partners
            </h2>
            <p className="text-stone-500 text-sm mt-2 italic">
              Trusted by leading dental and healthcare organizations.
            </p>
          </div>

          <Slider
            dots={false}
            infinite={true}
            speed={600}
            slidesToShow={4}
            slidesToScroll={1}
            autoplay={true}
            autoplaySpeed={2500}
            responsive={[
              { breakpoint: 1024, settings: { slidesToShow: 3 } },
              { breakpoint: 768, settings: { slidesToShow: 2 } },
              { breakpoint: 480, settings: { slidesToShow: 1 } },
            ]}
          >
            {partnerLogos.map((src, index) => (
              <div key={index} className="px-6">
                <div className="h-20 flex items-center justify-center opacity-50 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-300">
                  <img
                    src={src}
                    alt={`Partner ${index + 1}`}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              </div>
            ))}
          </Slider>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer style={{ background: "linear-gradient(135deg, #1E0A3C 0%, #3730A3 100%)" }} className="text-purple-200/70">
        <div className="max-w-7xl mx-auto px-8 py-12 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <img
              src={logo}
              alt="ToothX"
              className="w-24 mb-4 brightness-0 invert opacity-90"
            />
            <p className="text-sm leading-relaxed text-purple-200/60">
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
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-purple-300/70 hover:text-white hover:bg-orange-600 transition-all duration-200"
                  style={{ background: "rgba(255,255,255,0.08)" }}
                >
                  <Icon size={13} />
                </a>
              ))}
            </div>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-white/90 text-xs font-semibold uppercase tracking-[0.15em] mb-4">
              Company
            </h3>
            <ul className="space-y-2.5 text-sm">
              {[
                { label: "Home", href: "/HomePage" },
                { label: "About Us", href: "/about" },
                { label: "Careers", href: "/careers" },
                { label: "Blog", href: "/blog" },
              ].map(({ label, href }) => (
                <li key={label}>
                  <a
                    href={href}
                    className="text-purple-200/60 hover:text-white transition-colors"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Treatments */}
          <div>
            <h3 className="text-white/90 text-xs font-semibold uppercase tracking-[0.15em] mb-4">
              Treatments
            </h3>
            <ul className="space-y-2.5 text-sm">
              {["Dental Implants", "Root Canal", "Braces", "Teeth Whitening"].map(
                (t) => (
                  <li
                    key={t}
                    className="text-purple-200/60 hover:text-white cursor-pointer transition-colors"
                  >
                    {t}
                  </li>
                )
              )}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-white/90 text-xs font-semibold uppercase tracking-[0.15em] mb-4">
              Contact
            </h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2 text-purple-200/60">
                <span className="mt-px">📍</span>
                <span>Head Office – WTC, Bangalore, India</span>
              </li>
              <li className="flex items-center gap-2 text-purple-200/60">
                <span>📞</span>
                <span>HR – +91 86188 60059</span>
              </li>
              <li className="flex items-center gap-2 text-purple-200/60">
                <span>✉</span>
                <a
                  href="mailto:supportblr@dutydentist.com"
                  className="hover:text-white transition-colors"
                >
                  supportblr@dutydentist.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-purple-700/40 text-center py-4 text-xs text-purple-300/50">
          © {new Date().getFullYear()} ToothX. All rights reserved.
        </div>
      </footer>

      {/* ─── Floating Booking Bar — mobile only ─── */}
      <div
        className={`md:hidden fixed bottom-0 inset-x-0 z-40 transition-all duration-300 ${
          showFloatingCTA ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
        }`}
        style={{ background: "#1C1917" }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => setShowCallPopup(true)}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-stone-600 text-stone-300 font-semibold text-sm hover:border-orange-500 hover:text-orange-400 transition-colors"
          >
            <IoCallSharp size={16} /> Call Us
          </button>
          <button
            onClick={() => navigate("/Customer_home")}
            className="flex-[2] py-3 rounded-xl text-white font-bold text-sm hover:opacity-90 transition-opacity"
            style={{ background: "linear-gradient(135deg, #EA580C, #7C3AED)" }}
          >
            Book Appointment →
          </button>
        </div>
        <div style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
      </div>

      {/* ─── Back to Top ─── */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Back to top"
        className={`fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${
          showFloatingCTA
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-4 pointer-events-none"
        }`}
        style={{ background: "#EA580C" }}
      >
        <FaChevronUp size={14} className="text-white" />
      </button>
    </div>
  );
}

export default Welcome;
