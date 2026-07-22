import React, { useState } from "react";
import './App.css';
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { MdDelete, MdFavoriteBorder, MdPowerSettingsNew, MdNotificationsNone, MdAdd } from "react-icons/md";
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

const CardItem = ({ item, onDelete, isPublished, onTogglePublish }) => (
  <div
    className="group relative rounded-2xl border border-stone-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col"
    style={{ background: "#fff7ed" }}
  >
    <div
      className="relative h-40 border-b border-stone-100 flex items-center justify-center"
      style={{ background: "radial-gradient(circle at 50% 30%, #fff7ed 0%, #fafaf9 70%)" }}
    >
      {item.isNew && (
        <span
          className="absolute top-2 left-1/2 -translate-x-1/2 z-10 text-[10px] font-bold uppercase tracking-wide text-white px-2.5 py-1 rounded-full shadow-sm"
          style={{ background: "linear-gradient(135deg, #f43f5e 0%, #db2777 100%)" }}
        >
          New
        </span>
      )}
      {/* Published status badge */}
      <span
        className={`absolute bottom-2 left-2 z-10 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full shadow-sm ${
          isPublished ? "bg-green-100 text-green-800 border border-green-300" : "bg-amber-50 text-amber-700 border border-amber-200"
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${isPublished ? "bg-green-500" : "bg-amber-500"}`} />
        {isPublished ? "Live" : "Draft"}
      </span>
      <img
        src={item.src}
        alt={item.name}
        onError={handleImgError}
        className="h-32 w-32 object-cover rounded-xl group-hover:scale-105 transition-transform duration-300"
      />
      <button
        onClick={() => onDelete(item.id)}
        aria-label="Delete item"
        className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/90 text-stone-400 hover:text-red-600 hover:bg-white shadow-sm transition-colors"
      >
        <MdDelete size={16} />
      </button>
      <button
        aria-label="Favorite"
        className="absolute top-2 left-2 p-1.5 rounded-lg bg-white/90 text-stone-400 hover:text-orange-500 hover:bg-white shadow-sm transition-colors"
      >
        <MdFavoriteBorder size={16} />
      </button>
    </div>

    <div className="p-4 flex flex-col gap-3 flex-1">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-orange-600 mb-1">Treatment #{item.id}</p>
        <h3 className="text-sm font-bold text-stone-900 leading-tight">{item.name}</h3>
      </div>

      <select className="border border-stone-200 rounded-xl p-2 text-xs text-stone-600 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all">
        <option>30 mins</option>
        <option>45 mins</option>
        <option>60 mins</option>
        <option>90 mins</option>
      </select>

      <div>
        <label htmlFor={`price-${item.id}`} className="block mb-1 text-xs font-semibold text-stone-500">
          Price
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400">£</span>
          <input
            type="number"
            id={`price-${item.id}`}
            min="0"
            step="0.01"
            placeholder="0.00"
            defaultValue={item.price || ""}
            className="w-full border border-stone-200 rounded-xl p-2 pl-7 text-xs text-stone-600 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
          />
        </div>
      </div>

      <div>
        <label htmlFor={`desc-${item.id}`} className="block mb-1 text-xs font-semibold text-stone-500">
          Description
        </label>
        <textarea
          id={`desc-${item.id}`}
          rows={2}
          className="w-full border border-stone-200 rounded-xl p-2 text-xs text-stone-600 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all resize-none"
        />
      </div>

      <button
        type="button"
        onClick={() => onTogglePublish(item.id, !isPublished)}
        className={`mt-1 w-full text-xs font-bold px-4 py-2.5 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 ${
          isPublished
            ? "border-2 border-orange-300 text-orange-700 bg-orange-50 hover:bg-orange-100"
            : "text-white"
        }`}
        style={
          isPublished
            ? undefined
            : { background: "linear-gradient(135deg, #ea580c 0%, #c2410c 100%)", boxShadow: "0 6px 18px rgba(234,88,12,0.25)" }
        }
      >
        {isPublished ? "Unpublish from Customer" : "Publish to Customer"}
      </button>
    </div>
  </div>
);

function App() {
  const { treatments, deleteTreatment, setPublished } = useTreatments();
  const [successMessage, setSuccessMessage] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);

  const handleDelete = (id) => {
    deleteTreatment(id);
    setSuccessMessage("Item deleted successfully");
    setTimeout(() => setSuccessMessage(""), 3000);
  };

  const handleTogglePublish = (id, publish) => {
    setPublished(id, publish);
    if (publish) {
      setSuccessMessage("Published to Customer successfully!");
    } else {
      setSuccessMessage("Unpublished from Customer.");
    }
    setTimeout(() => setSuccessMessage(""), 3000);
  };

  const totalCount = treatments.length;
  const publishedCount = treatments.filter((t) => t.published).length;
  const draftCount = totalCount - publishedCount;

  const stats = [
    { label: "Total Treatments", value: totalCount, color: "#ea580c" },
    { label: "Published (Live)", value: publishedCount, color: "#059669" },
    { label: "Drafts", value: draftCount, color: "#78716c" },
  ];

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

      {/* Success toast */}
      {successMessage && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-50 pointer-events-none">
          <div className="bg-white border border-stone-100 shadow-2xl rounded-2xl px-6 py-4">
            <span className="font-semibold text-sm text-emerald-600">{successMessage}</span>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        {/* Breadcrumb + account icons */}
        <div className="flex items-center justify-between mb-8">
          <nav className="flex items-center gap-2 text-xs text-stone-500">
            <a href="/Welcome" className="hover:text-orange-600 transition-colors">Welcome</a>
            <span>/</span>
            <span className="text-stone-700 font-medium">Admin Home</span>
          </nav>

          <div className="flex items-center gap-2">
            <button
              aria-label="Notifications"
              className="relative p-2 rounded-xl text-stone-600 hover:text-orange-600 hover:bg-orange-50 transition-colors"
            >
              <MdNotificationsNone size={20} />
              <span className="absolute -top-0.5 -right-0.5 bg-orange-600 text-white text-[10px] font-bold rounded-full px-1.5 leading-[16px]">
                6
              </span>
            </button>
            <a
              href="/Logout"
              className="p-2 rounded-xl text-stone-600 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <MdPowerSettingsNew size={20} />
            </a>
            <img
              src="https://docs.material-tailwind.com/img/face-2.jpg"
              alt="admin avatar"
              className="w-10 h-10 rounded-full object-cover border-2 border-orange-100 ml-1"
            />
          </div>
        </div>

        <div className="text-center mb-10">
          <span className="section-pill">Treatment Management</span>
          <h1 className="text-3xl md:text-4xl font-black text-stone-900 tracking-tight mb-3">
            Admin Treatment Dashboard
          </h1>
          <p className="text-stone-500 max-w-md mx-auto text-sm leading-relaxed">
            Publish treatments to customers, manage availability, and keep pricing and details up to date.
          </p>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          {stats.map((s) => (
            <div
              key={s.label}
              className="bg-white rounded-2xl border border-stone-100 shadow-sm px-4 py-5 text-center hover:shadow-md transition-shadow"
            >
              <p className="text-3xl md:text-4xl font-black tracking-tight" style={{ color: s.color }}>
                {s.value}
              </p>
              <p className="text-[11px] md:text-xs font-semibold uppercase tracking-widest text-stone-500 mt-1">
                {s.label}
              </p>
            </div>
          ))}
        </div>

        {/* Controls row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
          <div className="flex items-center gap-3 flex-wrap">
            <select
              defaultValue="active"
              className="border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-700 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
            >
              <option value="active">🟢 Active</option>
              <option value="inactive">⚪ Inactive</option>
              <option value="fully-booked">🟠 Fully Booked</option>
              <option value="coming-soon">🔴 Coming Soon</option>
            </select>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" defaultChecked className="peer sr-only" />
              <span className="w-9 h-5 rounded-full bg-stone-200 peer-checked:bg-orange-600 relative transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:w-4 after:h-4 after:rounded-full after:transition-transform peer-checked:after:translate-x-4" />
              <span className="text-sm font-medium text-stone-700">Featured</span>
            </label>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <a
              href="/AddMeal"
              className="flex items-center gap-1.5 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
              style={{ background: "linear-gradient(135deg, #ea580c 0%, #c2410c 100%)", boxShadow: "0 6px 18px rgba(234,88,12,0.25)" }}
            >
              <MdAdd size={18} /> Add Treatment
            </a>
            <a
              href="/AddDoctor"
              className="flex items-center gap-1.5 font-bold text-sm px-4 py-2.5 rounded-xl border-2 border-stone-200 text-stone-700 bg-white hover:border-orange-400 hover:text-orange-600 transition-all duration-200"
            >
              <MdAdd size={18} /> Add Doctor
            </a>
            <button className="flex items-center gap-1.5 font-bold text-sm px-4 py-2.5 rounded-xl border-2 border-stone-200 text-stone-700 bg-white hover:border-orange-400 hover:text-orange-600 transition-all duration-200">
              <ArrowDownTrayIcon strokeWidth={2} className="h-4 w-4" /> Download Report
            </button>

            <div className="relative">
              <button
                onClick={() => setProfileOpen((p) => !p)}
                className="font-bold text-sm px-4 py-2.5 rounded-xl border-2 border-stone-200 text-stone-700 bg-white hover:border-orange-400 hover:text-orange-600 transition-all duration-200"
              >
                Profile
              </button>
              {profileOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-stone-100 z-10 overflow-hidden py-2">
                  <a href="/HomePage" className="block px-4 py-2.5 text-sm text-stone-600 hover:bg-orange-50 hover:text-orange-600 transition-colors">About</a>
                  <a href="/ResetPassword" className="block px-4 py-2.5 text-sm text-stone-600 hover:bg-orange-50 hover:text-orange-600 transition-colors">Change Password</a>
                  <a href="/Settings" className="block px-4 py-2.5 text-sm text-stone-600 hover:bg-orange-50 hover:text-orange-600 transition-colors">Settings</a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Treatments grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-10">
          {treatments.map((item) => (
            <CardItem
              key={item.id}
              item={item}
              onDelete={handleDelete}
              isPublished={!!item.published}
              onTogglePublish={handleTogglePublish}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
