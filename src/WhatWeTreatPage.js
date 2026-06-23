import React from "react";
import {
  FaFacebookF,
  FaInstagram,
  FaTwitter,
  FaLinkedinIn,
  FaYoutube,
} from "react-icons/fa";
import { BsPlus } from "react-icons/bs";
import { MdAddCircle } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import logo from "./assets/Toothx_Logo-removebg-preview.png";

const treatItems = [
  "Root Canal Treatment",
  "Dental Crowns",
  "Laser Dentistry",
  "Invisible Braces",
  "Dental Fillings",
  "Wisdom Tooth",
  "Dental Braces",
  "Dental Implants",
  "Dentures",
  "Kids Dentistry",
  "Mouth Ulcers",
  "Gum Treatment",
];

const services = [
  {
    title: "Dental Consultation",
    desc: "Speak to a dentist by video or in-person for any dental concern.",
  },
  {
    title: "Prescription Advice",
    desc: "Get new or repeat dental prescriptions sent directly to your pharmacy.",
  },
  {
    title: "Dental Certificates",
    desc: "Request dental letters or certificates quickly.",
  },
  {
    title: "Referrals and Reports",
    desc: "Arrange scans, tests, or discuss your dental reports.",
  },
  {
    title: "Oral Health & Hygiene",
    desc: "Get advice on brushing, flossing, and dental care.",
  },
  {
    title: "Follow-up Appointment",
    desc: "Continue care or speak with the same dentist again.",
  },
];

const WhatWeTreatPage = () => {
  const navigate = useNavigate();

  return (
    <div className="w-full bg-white font-sans">
      {/* ===== TOP BAR ===== */}
      <div className="bg-[#fc4a03] text-white text-sm px-6 py-2 flex justify-between items-center">
     

<div className="flex items-center gap-3">
  <a
    href="https://facebook.com"
    target="_blank"
    rel="noopener noreferrer"
    className="p-3 rounded-full bg-white/10 text-white hover:bg-orange-600 hover:scale-110 transition duration-300"
  >
    <FaFacebookF />
  </a>

  <a
    href="https://instagram.com"
    target="_blank"
    rel="noopener noreferrer"
    className="p-3 rounded-full bg-white/10 text-white hover:bg-pink-500 hover:scale-110 transition duration-300"
  >
    <FaInstagram />
  </a>

  <a
    href="https://twitter.com"
    target="_blank"
    rel="noopener noreferrer"
    className="p-3 rounded-full bg-white/10 text-white hover:bg-sky-400 hover:scale-110 transition duration-300"
  >
    <FaTwitter />
  </a>

  <a
    href="https://linkedin.com"
    target="_blank"
    rel="noopener noreferrer"
    className="p-3 rounded-full bg-white/10 text-white hover:bg-orange-700 hover:scale-110 transition duration-300"
  >
    <FaLinkedinIn />
  </a>

  <a
    href="https://youtube.com"
    target="_blank"
    rel="noopener noreferrer"
    className="p-3 rounded-full bg-white/10 text-white hover:bg-red-600 hover:scale-110 transition duration-300"
  >
    <FaYoutube />
  </a>
</div>
        <div className="flex items-center gap-4">
          <span>info@ToothX.com</span>
          <span>Mon–Fri: 9AM–5PM</span>
        </div>
      </div>

    {/* ===== NAVBAR ===== */}
<div className="flex items-center justify-between px-6 py-4 shadow-sm">
  <div className="flex items-center gap-2 text-xl font-bold text-orange-600">
    <img src={logo} alt="ToothX Logo" className="w-40 h-auto" />
  </div>

  <div className="hidden md:flex items-center gap-6 text-sm font-medium">
    <button onClick={() => navigate("/HomePage")}>Home</button>
    <button onClick={() => navigate("/gallery")}>Gallery</button>
    <button
      className="text-orange-600 font-semibold"
      onClick={() => navigate("/treatments")}
    >
      What We Treat
    </button>
    <button onClick={() => navigate("/CustomerCare")}>Support</button>

    <button
        size="lg"
        className="relative flex items-center gap-3 px-6 py-3 
        rounded-xl 
        text-white 
        bg-gradient-to-r from-orange-500 via-orange-700 to-orange-900 
        shadow-lg 
        border border-white/20
        backdrop-blur-md
        hover:scale-105 hover:shadow-orange-500/40
        transition duration-300"
        onClick={() => navigate("/Customer_home")}
      >
        <BsPlus size={22} />
        <span className="tracking-wide font-semibold">BOOK ONLINE NOW</span>
      </button>
  </div>
</div>


      {/* ===== WHAT WE TREAT SECTION ===== */}
      <section className="bg-[#fc4a03] text-white py-16 px-6">
        <h2 className="text-3xl font-bold text-center mb-4">What we treat</h2>
        <p className="text-center text-sm text-orange-100 mb-10">
          We help with a wide range of dental concerns — from routine checkups to
          advanced treatments.
        </p>

  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
      {treatItems.map((item, index) => (
    <div
      key={index}
      onClick={() => navigate("/Customer_home")}
      className="relative flex items-center justify-between gap-3 px-5 py-4 
      rounded-xl 
      text-white 
      bg-gradient-to-r from-orange-500 via-orange-700 to-orange-900 
      shadow-lg 
      border border-white/20
      backdrop-blur-md
      hover:scale-105 hover:shadow-orange-500/40
      transition duration-300 cursor-pointer"
    >
      <span className="flex items-center gap-2 text-sm font-semibold tracking-wide">
        <span>📄</span> {item}
      </span>

      <MdAddCircle className="text-white text-xl hover:scale-110 transition" />
    </div>
  ))}
</div>
      </section>

      {/* ===== SERVICES SECTION ===== */}
      <section className="bg-gray-50 py-16 px-6">
        <h2 className="text-3xl font-bold text-center mb-12 text-orange-900">
          Services
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {services.map((service, index) => (
            <div
              key={index}
              className="bg-white rounded-xl shadow p-6 hover:shadow-lg transition"
            >
              <h3 className="text-lg font-semibold mb-2 text-orange-900">
                {service.title}
              </h3>
              <p className="text-sm text-gray-600">{service.desc}</p>
            </div>
          ))}
        </div>
      </section>
{/* Footer */}
      <footer className="mt-10 w-full bg-gradient-to-r from-orange-700 via-purple-800 to-purple-800 text-gray-300 shadow-lg">
              {" "}
              <div className="max-w-7xl mx-auto px-8 py-10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
                {/* Logo + Description */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold">
                      <img src={logo} alt="logo" className="w-28 mb-2" />
                    </h3>
                  </div>
                  <p className="text-sm">
                    Providing trusted dental treatments with modern technology and
                    expert dentists. Your smile is our priority.
                  </p>
                </div>
      
                <div className="justify-self-start text-left">
                  <h3 className="text-white font-semibold mb-3">Company</h3>
                  <ul className="space-y-2 text-sm">
                    <li>
                      <a href="/HomePage" className="hover:text-white">
                        Home
                      </a>
                    </li>
                    <li>
                      <a href="/about" className="hover:text-white">
                        About Us
                      </a>
                    </li>
                    <li>
                      <a href="/careers" className="hover:text-white">
                        Careers
                      </a>
                    </li>
                    <li>
                      <a href="/blog" className="hover:text-white">
                        Blog
                      </a>
                    </li>
                  </ul>
                </div>
      
                {/* Treatments */}
                <div>
                  <h3 className="text-white font-semibold mb-3">Treatments</h3>
                  <ul className="space-y-2 text-sm">
                    <li>Dental Implants</li>
                    <li>Root Canal</li>
                    <li>Braces</li>
                    <li>Teeth Whitening</li>
                  </ul>
                </div>
      
                {/* Contact */}
                <div>
                  <h3 className="text-white font-semibold mb-3">Contact</h3>
                  <ul className="space-y-2 text-sm">
                    <li>📍Head Office - WTC , Bangalore, India</li>
                    <li>📞 HR - +91 - 8618860059</li>
                    <li>
                      <a href="mailto:supportblr@dutydentist.com">
                        ✉ supportblr@dutydentist.com
                      </a>
                         {/* Social Media */}
<div className="flex justify-end gap-4 mt-3">
  <a
    href="https://facebook.com"
    target="_blank"
    rel="noopener noreferrer"
    className="p-3 rounded-full bg-white/10 hover:bg-orange-600 text-white transition duration-300 hover:scale-110"
  >
    <FaFacebookF />
  </a>

  <a
    href="https://instagram.com"
    target="_blank"
    rel="noopener noreferrer"
    className="p-3 rounded-full bg-white/10 hover:bg-pink-500 text-white transition duration-300 hover:scale-110"
  >
    <FaInstagram />
  </a>

  <a
    href="https://twitter.com"
    target="_blank"
    rel="noopener noreferrer"
    className="p-3 rounded-full bg-white/10 hover:bg-sky-400 text-white transition duration-300 hover:scale-110"
  >
    <FaTwitter />
  </a>

  <a
    href="https://linkedin.com"
    target="_blank"
    rel="noopener noreferrer"
    className="p-3 rounded-full bg-white/10 hover:bg-orange-700 text-white transition duration-300 hover:scale-110"
  >
    <FaLinkedinIn />
  </a>

  <a
    href="https://youtube.com"
    target="_blank"
    rel="noopener noreferrer"
    className="p-3 rounded-full bg-white/10 hover:bg-red-600 text-white transition duration-300 hover:scale-110"
  >
    <FaYoutube />
  </a>
</div>
                    </li>{" "}
                  </ul>
                </div>
              </div>
              {/* Bottom Section */}
              <div className="border-t border-gray-700 text-center py-4 text-sm">
                © {new Date().getFullYear()} ToothX. All rights reserved.
              </div>
           
            </footer>
    </div>
  );
};

export default WhatWeTreatPage;
