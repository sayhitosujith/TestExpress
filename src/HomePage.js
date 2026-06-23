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
import { useState } from "react";

import {
  FaFacebookF,
  FaInstagram,
  FaTwitter,
  FaLinkedinIn,
  FaYoutube,
} from "react-icons/fa";

import {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Typography,
  Button,
} from "@material-tailwind/react";
import { MdSupportAgent } from "react-icons/md";

import { useNavigate } from "react-router-dom";
import Slider from "react-slick";

const doctorSliderSettings = {
  dots: true,
  infinite: true,
  speed: 500,
  slidesToShow: 3,
  slidesToScroll: 1,
  autoplay: true,
  autoplaySpeed: 3000,
  responsive: [
    {
      breakpoint: 1024,
      settings: { slidesToShow: 2 },
    },
    {
      breakpoint: 640,
      settings: { slidesToShow: 1 },
    },
  ],
};

const LINKS = [
  {
    title: "Product",
    items: ["Overview", "Features", "Solutions", "Tutorials"],
  },
  { title: "Company", items: ["About us", "Careers", "Press", "News"] },
  { title: "Resource", items: ["Blog", "Newsletter", "Events", "Help center"] },
];

function Welcome() {
  const navigate = useNavigate();

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

  const footerLinkMap = {
    Overview: "/overview",
    Features: "/features",
    Solutions: "/solutions",
    Tutorials: "/tutorials",
    "About us": "/about",
    Careers: "/careers",
    Press: "/press",
    News: "/news",
    Blog: "/blog",
    Newsletter: "/newsletter",
    Events: "/events",
    "Help center": "/help",
  };

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

  const [showCallPopup, setShowCallPopup] = useState(false);

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

  const PrevArrow = ({ onClick }) => (
    <button
      onClick={onClick}
      className="absolute -left-6 top-1/2 -translate-y-1/2 z-20 bg-orange-600 text-white w-10 h-10 rounded-full shadow-lg hover:bg-orange-700 transition"
    >
      ‹
    </button>
  );

  const NextArrow = ({ onClick }) => (
    <button
      onClick={onClick}
      className="absolute -right-6 top-1/2 -translate-y-1/2 z-20 bg-orange-600 text-white w-10 h-10 rounded-full shadow-lg hover:bg-orange-700 transition"
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
    <div className="p-4 md:p-7 bg-white">
      {/* App Logo */}
      <img
        src={logo}
        alt="App Logo"
        className="absolute -top-4 left-4 w-65 md:w-52 h-auto z-20"
      />
      {/* Call + Email */}
      <div className="absolute top-4 right-6 z-30 flex items-center gap-4 text-sm md:text-base font-semibold text-orange-900">
        <div
          onClick={() => setShowCallPopup(true)}
          className="flex items-center gap-2 cursor-pointer hover:text-orange-700"
        >
          <IoCallSharp size={26} />
          <span>Call Us</span>
        </div>
        <button
          onClick={() =>
            (window.location.href = "mailto:support@dutydentist.com")
          }
          className="flex items-center gap-1 hover:text-orange-900"
        >
          <IoMailOutline size={26} />
          <span>Email Us</span>
        </button>
      </div>

      {showCallPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-80 text-center shadow-xl relative">
            {/* Close Button */}
            <button
              onClick={() => setShowCallPopup(false)}
              className="absolute top-2 right-3 text-gray-500 hover:text-black text-lg"
            >
              ✕
            </button>

            <h2 className="text-xl font-bold mb-4 text-orange-900 flex items-center justify-center gap-2">
              Contact 24*7 Support
              <MdSupportAgent size={40} />
            </h2>

            {/* <p className="text-lg font-semibold text-orange-700">
              (+91) 94808-60587
              <br />
              (+91) 88888-88888
            </p> */}

            <button
              onClick={() => (window.location.href = "tel:+919480860587")}
              className="mt-4 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700"
            >
              Call Now
            </button>
          </div>
        </div>
      )}

      {/* Banner */}
      <div className="relative w-full h-[280px] md:h-[420px] rounded-xl overflow-hidden mt-14">
        <img
          src={Banner_wallpaper}
          alt="Dental Banner"
          className="w-full h-full object-cover"
        />

        {/* Overlay */}
        <div className="absolute inset-0 bg-black/50 pointer-events-none"></div>

        {/* Top Right Menu */}
        <div className="absolute top-4 right-4 flex flex-wrap justify-end gap-2 md:gap-4 bg-grey/60 px-4 md:px-6 py-2 md:py-3 rounded-2xl shadow-xl z-20">
          {menuItems.map((item) => (
            <button
              key={item.name}
              onClick={() =>
                item.external
                  ? window.open(item.external, "_blank")
                  : navigate(item.path)
              }
              className="text-white hover:text-orange-300 font-semibold text-sm md:text-base transition-all duration-200 cursor-pointer"
            >
              {item.name}
            </button>
          ))}
        </div>

        {/* Text + Book Now */}
        <div className="absolute inset-0 flex flex-col justify-center items-center text-center px-4 md:px-20 z-10">
          <i>
            <h1 className="text-white text-2xl md:text-4xl font-bold mb-4 drop-shadow-lg">
              Your personal online Dentist
            </h1>
          </i>
          <p className="text-white text-sm md:text-lg font-medium drop-shadow-md leading-relaxed">
            Struggling to get a dentist appointment? Fed up with long queues?
            Frustrated waiting? <br />
            Don’t worry – ToothX is here to help <br />
            Book a same day or next day online consultation, with a experienced
            Dentist, in just a few clicks.
          </p>

          <div className="relative inline-block mt-6">
            {/* Glow */}
            <div className="absolute inset-0 rounded-xl blur-md bg-gradient-to-r from-orange-400 via-orange-600 to-orange-900 opacity-60"></div>

            <Button
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
              <span className="tracking-wide font-semibold">
                BOOK ONLINE NOW
              </span>
            </Button>
          </div>
        </div>
      </div>

      {/* Services */}
      <div className="flex items-center justify-center my-10">
        <div className="flex-grow h-[1px] bg-orange-100"></div>

        <Typography
          variant="h5"
          className="mx-4 text-center font-semibold text-black whitespace-nowrap"
        >
          Our Professional Services → Expert care you can trust.
        </Typography>

        <div className="flex-grow h-[1px] bg-orange-100"></div>
      </div>

      <div className="mb-6">
        <p className="text-base text-gray-600 mt-2 flex justify-center items-center italic">
          Complete dental care designed to keep your smile healthy, confident,
          and bright.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-6 mt-8 px-4">
        {services.map((service, index) => (
          <button
            key={index}
            onClick={() => navigate(servicePathMap[service.label] || "/")}
            className="flex flex-col items-center hover:scale-105 transition-transform duration-200 cursor-pointer"
          >
            <img
              src={service.src}
              alt={service.label}
              className="w-28 h-28 md:w-36 md:h-36 rounded-full border border-orange-100 shadow-x shadow-orange-100/20 ring-4 ring-orange-800/90 object-cover"
            />
            <p className="text-center mt-2 font-semibold text-sm md:text-base">
              {service.label}
            </p>
          </button>
        ))}
      </div>

      {/* App Banner */}
      <div className="relative w-full aspect-[3/1] rounded-lg overflow-hidden shadow-md">
        <img
          src={appbanner}
          alt="App banner scanner"
          className="w-full h-full object-cover"
        />

        {/* Light overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/30 via-white/10 to-transparent"></div>
      </div>
      {/* Doctors */}
      <div className="flex items-center justify-center my-">
        <div className="flex-grow h-[1px] bg-orange-100"></div>

        <Typography
          variant="h5"
          className="mx-4 text-center font-semibold text-black whitespace-nowrap"
        >
          Meet Our Doctors
        </Typography>

        <div className="flex-grow h-[1px] bg-orange-100"></div>
      </div>

      <div className="mt-10 px-4 relative">
        <Slider {...doctorSliderSettings}>
          {doctors.map((doc, index) => (
            <div key={index} className="px-5">
              <Card className="bg-orange-50">
                <CardHeader
                  variant="gradient"
                  color="white"
                  className="grid h-24 place-items-center mb-6 bg-orange-700"
                >
                  <Typography
                    variant="h6"
                    className="font-bold text-white text-center"
                  >
                    {doc.name}
                  </Typography>
                </CardHeader>

                <CardFooter className="pt-0 flex flex-col items-center">
                  <img
                    src={doc.img}
                    alt={`${doc.name} Profile`}
                    className="w-full h-[40vh] object-cover rounded-lg shadow-md"
                  />
                  <Typography
                    variant="small"
                    className="mt-4 text-center font-semibold"
                  >
                    {doc.specialty}
                  </Typography>
                  <Typography
                    variant="small"
                    className="mt-2 text-center font-semibold"
                  >
                    Experience - {doc.experience}
                  </Typography>
                </CardFooter>
              </Card>
            </div>
          ))}
        </Slider>
      </div>

      {/* Reviews Section */}
      <div className="my-14 px-4">
        <div className="text-center mb-10">
          <Typography variant="h2" color="black">
            What Our Patients Say
          </Typography>
          <p className="text-gray-600 mt-2 italic">
            Trusted by thousands — real stories, real smiles.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
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
                "Best online dental service I’ve used. Great for busy professionals like me.",
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
          ].map((review, index) => (
            <Card
              key={index}
              className="shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
            >
              <CardBody className="flex flex-col items-center text-center">
                <Typography variant="h6" className="mb-2 font-semibold">
                  {review.name}
                </Typography>

                <div className="flex mb-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span
                      key={i}
                      className={`text-xl ${
                        i < review.rating ? "text-yellow-500" : "text-gray-300"
                      }`}
                    >
                      ★
                    </span>
                  ))}
                </div>

                <Typography variant="small" className="text-gray-600 italic">
                  "{review.review}"
                </Typography>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>

      {/* Our Partners Section */}
      <div className="my-14 px-4">
        <div className="text-center mb-10">
          <Typography variant="h2" color="black">
            Our Partners
          </Typography>
          <p className="text-gray-600 mt-2 italic">
            Trusted by leading dental and healthcare organizations.
          </p>
        </div>

        <Slider
          dots={false}
          infinite={true}
          speed={500}
          slidesToShow={4} // Number of logos visible on desktop
          slidesToScroll={1}
          autoplay={true}
          autoplaySpeed={2500}
          responsive={[
            { breakpoint: 1024, settings: { slidesToShow: 3 } },
            { breakpoint: 768, settings: { slidesToShow: 2 } },
            { breakpoint: 480, settings: { slidesToShow: 1 } },
          ]}
        >
          {[
            "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTYQ-Exq-bRTBdMI9hToshO-uY-K5CyQ6iZHg&s",
            "https://i.pinimg.com/originals/b1/fe/43/b1fe43b1d5c1305009c9d8c8b7cd517a.jpg",
            "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS4cL6Hc7Agl9y0-9A6opnjYV2_PiYLBqazBw&s",
            "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSBwaJHo04qp9RYN3lX-ZOo9h-3XnALv7W3IA&s",
            "https://marketplace.canva.com/EAE-iqmczr4/1/0/1600w/canva-orange-and-purple-minimalist-dental-clinic-logo-py32dplr4L8.jpg",
            "https://narayandental.com/wp-content/uploads/2022/02/logo.png",
          ].map((logo, index) => (
            <div key={index} className="px-4 flex justify-center">
              <img
                src={logo}
                alt={`Partner ${index + 1}`}
                className="w-32 h-32 md:w-36 md:h-36 object-contain"
              />
            </div>
          ))}
        </Slider>
      </div>

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
}

export default Welcome;
