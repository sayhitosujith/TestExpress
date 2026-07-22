import "./Customer_Home.css";
import { Carousel } from "@material-tailwind/react";
import logo from "./assets/Toothx_Logo.png"; // adjust the path as necessary
import {
  MdOutlineMyLocation,
  MdMailOutline,
  MdOutlineShoppingCart,
  MdAccountBalanceWallet,
  MdLocationOn,
  MdPowerSettingsNew,
  MdNotificationsNone,
  MdSettings,
  MdChatBubbleOutline,
  MdPhone,
  MdEmail,
  MdVideocam,
  MdRefresh,
  MdSearch,
  MdStar,
} from "react-icons/md";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;
const currentDate = new Date().getDate();
const now = new Date();
const startDate = new Date("2025-04-05T08:00:00"); // Start time
const endDate = new Date("2026-04-08T23:59:59"); // End time
const isBannerActive = now >= startDate && now <= endDate;

const locationData = {
  Australia: ["Brisbane", "Melbourne", "Sydney", "Adelaide", "Perth"],
  India: ["Bangalore", "Delhi", "Mumbai", "Chennai", "Hyderabad"],
  USA: ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix"],
  UnitedKingdom: ["London", "Manchester", "Birmingham", "Liverpool"],
};

const clinicData = {
  Brisbane: ["ToothX Brisbane Central", "Smile Care Brisbane"],
  Melbourne: ["ToothX Melbourne Hub", "Dental Plus Melbourne"],
  Sydney: ["Sydney Dental Clinic", "ToothX Sydney Center"],
  Adelaide: ["Adelaide Smile Studio"],
  Perth: ["Perth Dental Care"],

  Bangalore: ["ToothX Bangalore Main", "Smile Dental Bangalore"],
  Delhi: ["Delhi Dental Hub", "ToothX Delhi Center"],
  Mumbai: ["Mumbai Smile Clinic"],
  Chennai: ["Chennai Dental Care"],
  Hyderabad: ["Hyderabad ToothX Clinic"],

  "New York": ["NY Dental Center"],
  "Los Angeles": ["LA Smile Studio"],
  Chicago: ["Chicago Dental Hub"],
  Houston: ["Houston ToothX Clinic"],
  Phoenix: ["Phoenix Smile Care"],

  London: ["London Dental Care"],
  Manchester: ["Manchester Smile Hub"],
  Birmingham: ["Birmingham ToothX"],
  Liverpool: ["Liverpool Dental Studio"],
};

const CardItem = ({ item, navigate }) => {
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [clinic, setClinic] = useState("");
  const [showHover, setShowHover] = useState(false);
  const [booked, setBooked] = useState(false);
  const [booking, setBooking] = useState(null);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("bookings")) || [];
    const found = saved.find((b) => b.item.id === item.id);

    if (found) {
      setBooked(true);
      setBooking(found);
    } else {
      setBooked(false);
      setBooking(null);
    }
  }, [item.id]);

  const handleBook = () => {
    if (!country || !city || !clinic) {
      alert("Please select country, city, and clinic");
      return;
    }

    const bookingData = {
      item,
      country,
      city,
      clinic,
      id: Date.now(),
    };

    const existing = JSON.parse(localStorage.getItem("bookings")) || [];
    const updatedBookings = [...existing, bookingData];

    localStorage.setItem("bookings", JSON.stringify(updatedBookings));

    setBooked(true);
    setBooking(bookingData);

    navigate("/MyCart");
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowHover(true)}
      onMouseLeave={() => setShowHover(false)}
    >
      <div
        className="group relative h-full transition-colors duration-300"
        style={{ background: "#fff7ed" }}
      >
        {item.isNew && (
          <span
            className="absolute top-3 right-3 z-10 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-white px-2.5 py-1 rounded-full shadow-sm"
            style={{ background: "linear-gradient(135deg, #f43f5e 0%, #db2777 100%)" }}
          >
            <MdStar className="text-xs" />
            New
          </span>
        )}
        {booked && (
          <span
            className="absolute top-3 right-3 z-10 text-[10px] font-bold uppercase tracking-wide text-white px-2.5 py-1 rounded-full shadow-sm"
            style={{ background: "#16a34a" }}
          >
            Booked
          </span>
        )}

        <div
          className="h-36 flex items-center justify-center border-b border-stone-100"
          style={{ background: "radial-gradient(circle at 50% 30%, #fff7ed 0%, #fafaf9 70%)" }}
        >
          <img
            src={item.src}
            alt={item.name}
            onError={handleImgError}
            className="h-28 w-28 object-cover rounded-xl group-hover:scale-105 transition-transform duration-300"
          />
        </div>

        <div className="p-4 flex flex-col gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-orange-600 mb-1">
              Treatment #{item.id}
            </p>
            <h3 className="text-sm font-bold text-stone-900 leading-tight">
              {item.name}
            </h3>
            {item.price ? (
              <p className="text-sm font-extrabold text-orange-600 mt-1">£{item.price}</p>
            ) : null}
          </div>

          <div className="flex gap-0.5">
            {Array(5)
              .fill(0)
              .map((_, i) => (
                <span key={i} style={{ color: "#f59e0b", fontSize: "0.85rem" }}>
                  ★
                </span>
              ))}
          </div>

          <select
            className="border border-stone-200 rounded-xl p-2 text-xs text-stone-600 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
            value={country}
            onChange={(e) => {
              setCountry(e.target.value);
              setCity("");
              setClinic("");
            }}
          >
            <option value="">Select Country</option>
            {Object.keys(locationData).map((c, i) => (
              <option key={i} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            className="border border-stone-200 rounded-xl p-2 text-xs text-stone-600 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all disabled:bg-stone-50 disabled:text-stone-300"
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              setClinic("");
            }}
            disabled={!country}
          >
            <option value="">Select City</option>
            {country &&
              locationData[country].map((ct, i) => (
                <option key={i} value={ct}>
                  {ct}
                </option>
              ))}
          </select>

          <select
            className="border border-stone-200 rounded-xl p-2 text-xs text-stone-600 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all disabled:bg-stone-50 disabled:text-stone-300"
            value={clinic}
            onChange={(e) => setClinic(e.target.value)}
            disabled={!city}
          >
            <option value="">Select Clinic</option>
            {city &&
              clinicData[city]?.map((cl, i) => (
                <option key={i} value={cl}>
                  {cl}
                </option>
              ))}
          </select>

          <button
            onClick={handleBook}
            disabled={!country || !city || !clinic}
            className="w-full text-white font-bold text-xs uppercase tracking-wide py-2.5 rounded-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-95"
            style={{ background: "linear-gradient(135deg, #ea580c 0%, #c2410c 100%)", boxShadow: "0 6px 18px rgba(234,88,12,0.25)" }}
          >
            {booked ? "Re-book" : "Book Now"}
          </button>
        </div>

        {booked && showHover && booking && (
          <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-64 bg-white shadow-xl border border-stone-100 rounded-2xl p-4 z-20">
            <p className="font-bold text-xs uppercase tracking-wide mb-2" style={{ color: "#ea580c" }}>
              Booking Details
            </p>
            <div className="text-xs space-y-1 text-stone-600">
              <p>
                <b className="text-stone-800">Country:</b> {booking.country}
              </p>
              <p>
                <b className="text-stone-800">City:</b> {booking.city}
              </p>
              <p>
                <b className="text-stone-800">Clinic:</b> {booking.clinic}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

function App() {
  const { treatments } = useTreatments();
  const [isOpen, setIsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const toggleCard = () => {
    setIsOpen((prev) => !prev);
    setProfileOpen(false);
  };
  const toggleProfile = () => {
    setProfileOpen((prev) => !prev);
    setIsOpen(false);
  };

  const [currentCity, setCurrentCity] = useState("");

  const getCurrentLocation = () => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
          );
          const data = await res.json();

          const city =
            data.address.city ||
            data.address.town ||
            data.address.village ||
            "";

          setCurrentCity(city);
        } catch (err) {
          console.error(err);
        }
      },
      () => console.log("Permission denied"),
    );
  };

  const filteredData = treatments
    .filter((item) => item.published)
    .filter((item) => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const navigate = useNavigate();

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg, #fffbeb 0%, #ffffff 22%, #ffffff 100%)" }}>
      <style>{`
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

      {/* Sticky Nav */}
      <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-stone-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-4">
          <img src={logo} alt="ToothX" className="h-8 w-auto flex-shrink-0" />

          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={getCurrentLocation}
              title="Get your current location"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl text-stone-600 hover:text-orange-600 hover:bg-orange-50 transition-colors"
            >
              <MdOutlineMyLocation size={20} />
              <span className="hidden sm:inline text-sm font-medium max-w-[100px] truncate">
                {currentCity || "Location"}
              </span>
            </button>

            <span className="hidden sm:block w-px h-6 bg-stone-200" />

            <div className="relative">
              <button
                onClick={toggleProfile}
                aria-label="Account menu"
                className="p-2 rounded-xl text-stone-600 hover:text-orange-600 hover:bg-orange-50 transition-colors"
              >
                <MdAccountBalanceWallet size={20} />
              </button>
              {profileOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-stone-100 z-10 overflow-hidden py-2">
                  <a href="/MyCart" className="block px-4 py-2.5 text-sm text-stone-600 hover:bg-orange-50 hover:text-orange-600 transition-colors">
                    My Wallet
                  </a>
                  <a href="/HomePage" className="block px-4 py-2.5 text-sm text-stone-600 hover:bg-orange-50 hover:text-orange-600 transition-colors">
                    About
                  </a>
                  <a href="/ResetPassword" className="block px-4 py-2.5 text-sm text-stone-600 hover:bg-orange-50 hover:text-orange-600 transition-colors">
                    Change Password
                  </a>
                </div>
              )}
            </div>

            <a
              href="/Settings"
              className="p-2 rounded-xl text-stone-600 hover:text-orange-600 hover:bg-orange-50 transition-colors"
            >
              <MdSettings size={20} />
            </a>

            <a
              href="/MyCart"
              className="relative p-2 rounded-xl text-stone-600 hover:text-orange-600 hover:bg-orange-50 transition-colors"
            >
              <MdOutlineShoppingCart size={20} />
              <span className="absolute -top-0.5 -right-0.5 bg-orange-600 text-white text-[10px] font-bold rounded-full px-1.5 leading-[16px]">
                12
              </span>
            </a>

            <div className="relative">
              <button
                onClick={toggleCard}
                aria-label="Notifications"
                className="relative p-2 rounded-xl text-stone-600 hover:text-orange-600 hover:bg-orange-50 transition-colors"
              >
                <MdNotificationsNone size={20} />
                <span className="absolute -top-0.5 -right-0.5 bg-orange-600 text-white text-[10px] font-bold rounded-full px-1.5 leading-[16px]">
                  99+
                </span>
              </button>

              {isOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-stone-100 z-10 overflow-hidden">
                  <div className="p-4">
                    <p className="font-bold text-sm text-stone-900 mb-2">Notifications</p>
                    <ul className="space-y-2 text-xs text-stone-600">
                      <li className="pb-2 border-b border-stone-100">
                        🔔 New Campaign has been published
                      </li>
                      <li className="pb-2 border-b border-stone-100">📦 Your order has shipped</li>
                      <li>🎉 Welcome to our platform!</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>

            <span className="hidden sm:block w-px h-6 bg-stone-200" />

            <div className="relative group">
              <a
                href="/Customer_Login"
                className="p-2 rounded-xl text-stone-600 hover:text-red-600 hover:bg-red-50 transition-colors inline-block"
              >
                <MdPowerSettingsNew size={20} />
              </a>
              <span className="pointer-events-none absolute -bottom-8 right-0 bg-stone-900 text-white text-[10px] rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                Logout
              </span>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-stone-500 mb-6">
          <a href="/HomePage" className="hover:text-orange-600 transition-colors">Home</a>
          <span>/</span>
          <a href="/Welcome" className="hover:text-orange-600 transition-colors">Welcome</a>
          <span>/</span>
          <span className="text-stone-700 font-medium">Customer Home</span>
        </nav>

        {/* Promo Marquee */}
        {isBannerActive && (
          <div className="mb-6 rounded-2xl border border-orange-100 overflow-hidden" style={{ background: "#fff7ed" }}>
            <div className="py-2.5 px-4 overflow-hidden whitespace-nowrap">
              <span className="animate-scroll inline-block text-sm font-semibold text-orange-700">
                <i>
                  Struggling to get a GP appointment? Fed up of long queues?
                  Frustrated waiting? Don’t worry – we’re here to help. Book a
                  same day or next day consultation in just a few clicks.
                </i>
              </span>
            </div>
          </div>
        )}

        {/* Carousel */}
        <div className="mb-10 rounded-2xl overflow-hidden shadow-lg border border-stone-100">
          <Carousel className="w-full">
            <figure className="relative h-[240px] w-full">
              <img
                className="w-full h-full object-cover object-center"
                src="https://aadhyadentalcare.com/assets/images/Banner.png"
                alt="Dental Smile Banner"
              />
              <figcaption className="absolute bottom-6 left-1/2 flex w-[calc(100%-3rem)] -translate-x-1/2 justify-between rounded-2xl border border-stone-100 bg-white/85 py-3 px-5 shadow-lg backdrop-blur-sm">
                <div>
                  <h3 className="text-base font-bold text-stone-900">
                    Creating Confident Smiles in ToothX - A bright healthy smile can be yours!
                  </h3>
                  <p className="text-stone-500 text-xs mt-1">
                    Date: {currentDate}-{currentMonth}-{currentYear}
                    <br />
                    Time: {new Date().toLocaleTimeString()}
                  </p>
                </div>
              </figcaption>
            </figure>

            <figure className="relative h-[240px] w-full">
              <img
                className="w-full h-full object-cover object-center"
                src="https://content.wepik.com/statics/15456878/preview-page0.jpg"
                alt="banner image 2"
              />
              <figcaption className="absolute bottom-6 left-1/2 flex w-[calc(100%-3rem)] -translate-x-1/2 rounded-2xl border border-stone-100 bg-white/85 py-3 px-5 shadow-lg backdrop-blur-sm">
                <h3 className="text-base font-bold text-stone-900">
                  Tasty Bites Await 🍽️ — Don't miss today's specials!
                </h3>
              </figcaption>
            </figure>

            <figure className="relative h-[240px] w-full">
              <img
                className="w-full h-full object-cover object-center"
                src="https://thegooddentists.com.au/wp-content/uploads/2023/08/the-good-dentist-banners-02.jpg"
                alt="banner image 3"
              />
              <figcaption className="absolute bottom-6 left-1/2 flex w-[calc(100%-3rem)] -translate-x-1/2 rounded-2xl border border-stone-100 bg-white/85 py-3 px-5 shadow-lg backdrop-blur-sm">
                <h3 className="text-base font-bold text-stone-900">
                  Exciting Offers Await — Don't miss today's Deals!
                </h3>
              </figcaption>
            </figure>
          </Carousel>
        </div>

        {/* Treatments Section */}
        <section className="mb-6">
          <div className="text-center mb-10">
            <span className="section-pill">Book A Treatment</span>
            <h2 className="text-3xl md:text-4xl font-black text-stone-900 tracking-tight mb-3">
              Choose Your Treatment
            </h2>
            <p className="text-stone-500 max-w-md mx-auto text-sm leading-relaxed">
              Select a procedure below, then pick your country, city and clinic to book instantly.
            </p>
          </div>

          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-10">
            <div className="relative w-full md:max-w-sm">
              <MdSearch size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Search for treatment..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-11 rounded-xl border border-stone-200 bg-white pl-10 pr-4 text-sm text-stone-700 placeholder:text-stone-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
              />
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-white border border-stone-100 rounded-xl px-3 py-2 shadow-sm">
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide mr-1 hidden sm:inline">
                  Support
                </span>
                <button className="p-1.5 rounded-lg text-stone-500 hover:text-orange-600 hover:bg-orange-50 transition-colors">
                  <MdPhone size={16} />
                </button>
                <button className="p-1.5 rounded-lg text-stone-500 hover:text-orange-600 hover:bg-orange-50 transition-colors">
                  <MdChatBubbleOutline size={16} />
                </button>
                <button className="p-1.5 rounded-lg text-stone-500 hover:text-orange-600 hover:bg-orange-50 transition-colors">
                  <MdEmail size={16} />
                </button>
                <button className="p-1.5 rounded-lg text-stone-500 hover:text-orange-600 hover:bg-orange-50 transition-colors">
                  <MdVideocam size={16} />
                </button>
              </div>

              <button
                onClick={() => window.location.reload()}
                title="Refresh"
                className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl border border-stone-100 bg-white text-stone-500 hover:text-orange-600 hover:border-orange-200 shadow-sm transition-colors"
              >
                <MdRefresh size={18} />
              </button>
            </div>
          </div>

          {filteredData.length === 0 ? (
            <p className="text-center text-stone-400 text-sm py-16">No treatments found</p>
          ) : (
            <>
              <p className="text-xs text-stone-500 mb-4">
                Showing <span className="font-bold text-orange-600">{filteredData.length}</span>{" "}
                {filteredData.length === 1 ? "treatment" : "treatments"}
                {searchTerm && <> for “<span className="font-medium text-stone-700">{searchTerm}</span>”</>}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-px bg-stone-200 rounded-2xl overflow-hidden mb-6 border border-stone-200">
                {filteredData.map((item) => (
                  <CardItem key={item.id} item={item} navigate={navigate} />
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      {/* Footer */}
      <footer
        className="text-slate-300/80"
        style={{ background: "linear-gradient(135deg, #57534e 0%, #78716c 55%, #c2410c 100%)" }}
      >
        <div className="max-w-7xl mx-auto px-8 py-14 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10">
          <div>
            <img src={logo} alt="ToothX" className="w-24 mb-4 opacity-90" />
            <p className="text-sm leading-relaxed text-slate-400">
              Providing trusted dental treatments with modern technology and
              expert dentists. Your smile is our priority.
            </p>
          </div>

          <div>
            <h3 className="text-white/90 text-xs font-semibold uppercase tracking-[0.15em] mb-5">Company</h3>
            <ul className="space-y-3 text-sm">
              <li><a href="/HomePage" className="text-slate-400 hover:text-white transition-colors">Home</a></li>
              <li><a href="/about" className="text-slate-400 hover:text-white transition-colors">About Us</a></li>
              <li><a href="/careers" className="text-slate-400 hover:text-white transition-colors">Careers</a></li>
              <li><a href="/blog" className="text-slate-400 hover:text-white transition-colors">Blog</a></li>
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
                <MdLocationOn size={18} className="mt-px flex-shrink-0" />
                <span>WTC 12th floor, Bangalore, India</span>
              </li>
              <li className="flex items-center gap-2 text-slate-400">
                <MdPhone size={18} className="flex-shrink-0" />
                <span>+91 - 8618860059</span>
              </li>
              <li>
                <a href="mailto:supportblr@dutydentist.com" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
                  <MdMailOutline size={18} className="flex-shrink-0" />
                  <span>support@toothx.com</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 text-center py-5 text-xs text-slate-500">
          © {currentYear} ToothX. All rights reserved.
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
    </div>
  );
}

export default App;
