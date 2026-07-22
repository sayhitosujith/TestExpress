import "./App.css";
import {
  MdPhoneIphone,
  MdAndroid,
  MdAdd,
  MdMedicalServices,
  MdCall,
  MdMailOutline,
} from "react-icons/md";
import Flag from "react-world-flags";
import adritaImage from "./assets/Adrita.png";
import rajeshImage from "./assets/Rajesh.png";
import RoyImage from "./assets/Roy.png";
import ManishImage from "./assets/Manish.png";
import appbanner from "./assets/2-1.png";
import Banner_wallpaper from "./assets/Jalavastra.jpeg";
import logo from "./assets/Jala.jpg";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { FaWhatsapp } from "react-icons/fa6";
import { useState } from "react";
import { Scanner } from "@yudiel/react-qr-scanner";
import {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Typography,
  Button,
} from "@material-tailwind/react";

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
  const [showScanner, setShowScanner] = useState(false);
  const [scanResult, setScanResult] = useState("");
  const menuItems = [
    { name: "Home", path: "/HomePage" },
    { name: "Gallery", path: "/gallery" },
    { name: "Contact Center", path: "/ContactCenter" },
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

  const services = [
    {
      src: "https://encrypted-tbn1.gstatic.com/shopping?q=tbn:ANd9GcSNrK41ptDKaUbKOZEFAdA2TVzexxfq6LaHgPXsrs8B7aT2nNPYmZuqgeJBREvH3PNHebm0y3pn6MaygJeM8bYijXqueyrR1g",
    },
    {
      src: "https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ANd9GcQygeAnYtGIbH1bahLLqQ1lrl9G1bIgX2Kvb72snghvxnWq4ojZriBpfTg7AgUoHy63XjRL8_ZGECukXeXaD08FN2q5uMuwGFe-hY8wghAu",
    },
    {
      src: "https://encrypted-tbn2.gstatic.com/shopping?q=tbn:ANd9GcSM0pz3Ps4Xt83kRSdgwa_l4LyYYjCNzChhLADTwZzppylmzi-dvPlNuty_hzRIdCkcdQvYuAX24uGwmNfd8sxUxqKVNaNZC1OUgatn-en2Q1t4vAgpZR-PfQ",
    },
    {
      src: "https://encrypted-tbn2.gstatic.com/shopping?q=tbn:ANd9GcSpLt95ezPcSr6mpNmQZ94Pk6ytlnzLd_mkZTyqHA3rt1-2Xu-VPEW1DXvkhiFRO1eA4DHwmeesQullY5N8NEGXbSnTG9_JfcYm-ped26rQOt7_ZHmVH482Gw",
    },
    {
      src: "https://encrypted-tbn1.gstatic.com/shopping?q=tbn:ANd9GcSNrK41ptDKaUbKOZEFAdA2TVzexxfq6LaHgPXsrs8B7aT2nNPYmZuqgeJBREvH3PNHebm0y3pn6MaygJeM8bYijXqueyrR1g",
    },
    {
      src: "https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ANd9GcQygeAnYtGIbH1bahLLqQ1lrl9G1bIgX2Kvb72snghvxnWq4ojZriBpfTg7AgUoHy63XjRL8_ZGECukXeXaD08FN2q5uMuwGFe-hY8wghAu",
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

  return (
    <div className="p-4 md:p-7 bg-white">
      {/* App Logo */}
      <img
        src={logo}
        alt="App Logo"
        className="absolute top-4 left-4 w-25 md:w-28 h-auto z-20"
      />

      {/* Call + Email */}
      <div className="absolute top-4 right-6 z-30 flex items-center gap-4 text-sm md:text-base font-semibold text-orange-700">
        <div className="flex items-center gap-2">
          <FaWhatsapp
            size={26}
            color="orange"
            className="cursor-pointer"
            onClick={() => setShowScanner(true)}
          />{" "}
          <span> </span>
          <button
            onClick={() =>
              (window.location.href = "mailto:support@dutydentist.com")
            }
            className="flex items-center gap-1 hover:text-orange-900"
          >
            <MdMailOutline size={26} color="maroon" />
            <span></span>
          </button>
        </div>
      </div>

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
          <h1 className="text-white text-2xl md:text-4xl font-bold mb-4 drop-shadow-lg">
            Your personal online Saree Store
          </h1>
          <p className="text-white text-sm md:text-lg font-medium drop-shadow-md leading-relaxed">
            Looking for the perfect saree? Tired of searching store to store?
            Frustrated not finding the right design? Don’t worry – we’re here to
            help. Browse and shop the latest saree collections online, from the
            comfort of your home. Discover premium designs, great prices, and
            quick delivery – all in just a few clicks.
          </p>

          <Button
            size="lg"
            className="flex items-center gap-3 mt-6 shadow-lg cursor-pointer bg-orange-600 hover:bg-orange-700 text-white"
            onClick={() => navigate("/Customer_home")}
          >
            <MdAdd size={22} />
            <span>Book ONLINE NOW</span>
          </Button>
        </div>
      </div>

      {/* Services */}
      <div className="flex justify-center items-center">
        <Typography variant="h2" color="black" className="text-center">
          Our Saree Collection → Elegant styles you’ll love.
        </Typography>
      </div>

      <div className="mb-6">
        <p className="text-base text-gray-600 mt-2 flex justify-center items-center italic">
          Explore premium sarees crafted for every occasion. From timeless
          classics to trendy designs, find your perfect drape today!
        </p>
      </div>

<div className="flex flex-wrap justify-center gap-6 mt-8 px-4">
  {services.map((service, index) => (
    <div
      key={index}
      className="w-44 md:w-56 h-64 md:h-72 bg-white rounded-xl shadow-md overflow-hidden group cursor-pointer"
    >
      <div className="w-full h-full flex flex-col pt-4">
        <img
          src={service.src}
          alt={service.name || "service"}
          className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
        />
      </div>
    </div>
  ))}
</div>


      {/* <img
        src={appbanner}
        alt="App banner scanner"
        className="w-full h-[30vh] md:h-[50vh] object-cover rounded-lg shadow-md"
      /> */}

      {/* Reviews Section */}
      <div className="my-14 px-4">
        <div className="text-center mb-10">
          <Typography variant="h2" color="black">
            What Our Customers Say
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
                "Loved the saree quality and fast delivery and the consultation was smooth. The doctor explained everything clearly. Highly recommend Jala Vastra!",
              rating: 5,
            },
            {
              name: "Paul Miam",
              review:
                "I got a same-day consultation and quick relief from tooth pain. Excellent service and very professional doctors.",
              rating: 5,
            },
            {
              name: "James Smith",
              review:
                "The platform is very user-friendly and the doctors are extremely knowledgeable. Will definitely use again.",
              rating: 5,
            },
            {
              name: "Amita Patel",
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
              name: "Karthika Iyer",
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
              name: "Rohita Mehra",
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

      {showScanner && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white p-5 rounded-xl w-[320px] shadow-xl text-center">
            <h2 className="text-lg font-semibold mb-3">Scan WhatsApp QR</h2>

            <Scanner
              onScan={(result) => {
                if (result?.length) {
                  setScanResult(result[0].rawValue);
                }
              }}
              onError={(error) => console.error(error)}
              constraints={{ facingMode: "environment" }}
              style={{ width: "100%" }}
            />

            {scanResult && (
              <p className="mt-3 text-sm text-orange-600 break-words">
                {scanResult}
              </p>
            )}

            <button
              onClick={() => setShowScanner(false)}
              className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="relative w-full bg-orange-900 text-white">
        <div className="mx-auto w-full max-w-7xl px-6 py-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Typography
              variant="h5"
              className="mb-6 flex items-center space-x-2 text-white"
            >
              <span className="text-white">Jala</span>
              <span className="text-orange-300">Vastra</span>
              <MdMedicalServices className="text-orange-300" />
            </Typography>

            <div className="flex items-center gap-3 text-white text-sm md:text-base ml-auto">
              <b>
                <i className="text-lg">DOWNLOAD FOR FREE - </i>
              </b>

              <div className="relative">
                <Button
                  disabled
                  className="flex items-center gap-3 bg-orange-600 hover:bg-orange-700 opacity-70 cursor-not-allowed"
                >
                  <MdAndroid size={28} color="white" />
                  <MdPhoneIphone size={28} color="white" />
                </Button>

                {/* Animated Coming Soon Tag */}
                <span className="absolute -top-3 -right-3 bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded-full shadow-md animate-pulse">
                  Coming Soon
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              {LINKS.map(({ title, items }) => (
                <ul key={title}>
                  <Typography
                    variant="small"
                    className="mb-3 font-medium text-white opacity-70"
                  >
                    {title}
                  </Typography>
                  {items.map((link) => (
                    <li key={link}>
                      <button
                        onClick={() => {
                          const path = footerLinkMap[link];
                          if (path) navigate(path);
                        }}
                        className="py-1.5 font-normal text-white/80 transition-colors hover:text-white cursor-pointer"
                      >
                        {link}
                      </button>
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          </div>

          <div className="mt-12 flex w-full flex-col items-center justify-center border-t border-white/20 py-4 md:flex-row md:justify-between">
            <Typography
              variant="small"
              className="mb-4 text-center font-normal text-white md:mb-0"
            >
              &copy; {new Date().getFullYear()} Jala Vastra — All Rights
              Reserved.
              <div className="flex items-center space-x-2 mt-2 justify-center md:justify-start">
                <span className="text-sm font-semibold">MADE IN INDIA</span>
                <Flag code="IN" style={{ width: 30, height: 20 }} />
              </div>
            </Typography>

            <div className="flex gap-4 text-white sm:justify-center">
              <button
                onClick={() =>
                  window.open("https://www.facebook.com/YourPage", "_blank")
                }
                className="opacity-80 transition-opacity hover:opacity-100 cursor-pointer"
              >
                Facebook
              </button>
              <button
                onClick={() =>
                  window.open("https://www.youtube.com/YourChannel", "_blank")
                }
                className="opacity-80 transition-opacity hover:opacity-100 cursor-pointer"
              >
                YouTube
              </button>
              <button
                onClick={() =>
                  window.open("https://twitter.com/YourProfile", "_blank")
                }
                className="opacity-80 transition-opacity hover:opacity-100 cursor-pointer"
              >
                Twitter
              </button>
              <button
                onClick={() =>
                  window.open("https://github.com/YourProfile", "_blank")
                }
                className="opacity-80 transition-opacity hover:opacity-100 cursor-pointer"
              >
                GitHub
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Welcome;
