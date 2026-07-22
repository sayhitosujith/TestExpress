import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import AppLogo from "./AppLogo";
import { MdOutlinePowerSettingsNew } from "react-icons/md";
import packageJson from "../package.json";
import MitraChat from "./MitraChat";

const TIME_SLOTS = [
  "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
  "12:00 PM", "12:30 PM", "01:00 PM", "01:30 PM", "02:00 PM", "02:30 PM",
  "03:00 PM", "03:30 PM", "04:00 PM", "04:30 PM", "05:00 PM", "05:30 PM",
  "06:00 PM",
];

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const NAV_ITEMS = [
  { label: "Dashboard",    icon: "🏠", path: "/Welcome" },
  { label: "Doctors",      icon: "👨‍⚕️", path: "/DoctorList" },
  { label: "Receptionist", icon: "📋", path: "/Receptionist" },
  { label: "Patients",     icon: "👤", path: "/PatientPortal" },
  { label: "Appointments", icon: "📅", path: "/BookAppointment" },
  { label: "Billing",      icon: "💳", path: "/BillingDetails" },
  { label: "Settings",     icon: "⚙️", path: "/Settings" },
  { label: "Contact Center", icon: "📞", path: "/ContactCenter" },
];

function getInitials(name = "") {
  return name.split(" ").filter(Boolean).map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function SectionLabel({ step, title, subtitle }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-7 h-7 rounded-full bg-orange-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
        {step}
      </div>
      <div>
        <p className="text-sm font-bold text-gray-800 leading-tight">{title}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function Card({ children, className = "", ...props }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`} {...props}>
      {children}
    </div>
  );
}

export default function Receptionist() {
  const navigate = useNavigate();

  const [viewDate, setViewDate]       = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [doctors, setDoctors]         = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedSlot, setSelectedSlot]     = useState("");
  const [form, setForm] = useState({ patientName: "", phone: "", email: "", reason: "" });
  const [errors, setErrors]   = useState({});
  const [successMsg, setSuccessMsg] = useState("");
  const [showDateModal, setShowDateModal] = useState(false);
  const [modalStep, setModalStep] = useState("overview");
  const [modalDoctor, setModalDoctor] = useState(null);
  const [modalSlot, setModalSlot] = useState("");
  const [modalForm, setModalForm] = useState({ patientName: "", phone: "", email: "", reason: "" });
  const [modalErrors, setModalErrors] = useState({});

  const [user] = useState(() => {
    try {
      const u = JSON.parse(localStorage.getItem("loggedInUser"));
      if (u) {
        const name = u.name || `${u.firstName || ""} ${u.lastName || ""}`.trim();
        return { name: name || "User", initials: getInitials(name || "User") };
      }
    } catch {}
    return { name: "User", initials: "U" };
  });

  const loadDoctors = () => {
    try {
      const stored = JSON.parse(localStorage.getItem("doctors") || "[]");
      setDoctors(stored.map((d) => ({ ...d, appointments: Array.isArray(d.appointments) ? d.appointments : [] })));
    } catch {}
  };

  useEffect(() => {
    loadDoctors();
    window.addEventListener("doctorsUpdated", loadDoctors);
    return () => window.removeEventListener("doctorsUpdated", loadDoctors);
  }, []);

  const year      = viewDate.getFullYear();
  const month     = viewDate.getMonth();
  const firstDay  = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const isToday    = (day) => { const d = new Date(year, month, day); d.setHours(0,0,0,0); return d.getTime() === today.getTime(); };
  const isSelected = (day) => selectedDate && day === selectedDate.getDate() && month === selectedDate.getMonth() && year === selectedDate.getFullYear();
  const isPast     = (day) => { const d = new Date(year, month, day); d.setHours(0,0,0,0); return d < today; };

  const availableDoctors = useMemo(() => {
    if (!selectedDate) return [];
    const dayName = DAY_NAMES[selectedDate.getDay()];
    return doctors.filter((d) => d.isActive !== false && Array.isArray(d.availableDays) && d.availableDays.includes(dayName));
  }, [selectedDate, doctors]);

  const bookedSlots = useMemo(() => {
    if (!selectedDoctor || !selectedDate) return new Set();
    const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth()+1).padStart(2,"0")}-${String(selectedDate.getDate()).padStart(2,"0")}`;
    const booked = new Set();
    (selectedDoctor.appointments || []).forEach((a) => {
      if (String(a.date || "").split("T")[0] === dateStr && a.status !== "CANCELLED") booked.add(a.time);
    });
    return booked;
  }, [selectedDoctor, selectedDate]);

  const selectedDateAppointments = useMemo(() => {
    if (!selectedDate) return [];
    const ds = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth()+1).padStart(2,"0")}-${String(selectedDate.getDate()).padStart(2,"0")}`;
    const result = [];
    doctors.forEach((d) => {
      (d.appointments || []).forEach((a) => {
        if (String(a.date || "").split("T")[0] === ds)
          result.push({ ...a, doctorName: `Dr. ${d.firstName || ""} ${d.lastName || ""}`.trim(), doctorFirstName: d.firstName, doctorLastName: d.lastName });
      });
    });
    return result.sort((a, b) => a.time > b.time ? 1 : -1);
  }, [selectedDate, doctors]);

  const modalBookedSlots = useMemo(() => {
    if (!modalDoctor || !selectedDate) return new Set();
    const ds = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth()+1).padStart(2,"0")}-${String(selectedDate.getDate()).padStart(2,"0")}`;
    const booked = new Set();
    (modalDoctor.appointments || []).forEach((a) => {
      if (String(a.date || "").split("T")[0] === ds && a.status !== "CANCELLED") booked.add(a.time);
    });
    return booked;
  }, [modalDoctor, selectedDate]);

  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  const todayAppointments = useMemo(() => {
    const result = [];
    doctors.forEach((d) => {
      (d.appointments || []).forEach((a) => {
        if (String(a.date || "").split("T")[0] === todayStr)
          result.push({ ...a, doctorName: `Dr. ${d.firstName || ""} ${d.lastName || ""}`.trim(), specialization: d.specialization || "" });
      });
    });
    return result.sort((a, b) => a.time > b.time ? 1 : -1);
  }, [doctors, todayStr]);

  const validate = () => {
    const e = {};
    if (!form.patientName.trim()) e.patientName = "Required";
    if (!form.phone.trim()) e.phone = "Required";
    else if (!/^\d{10}$/.test(form.phone.trim())) e.phone = "Enter a valid 10-digit number";
    if (!selectedSlot) e.slot = "Please select a time slot";
    return e;
  };

  const handleBook = () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setErrors({});
    const d = selectedDate;
    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    const newAppt = {
      patientName: form.patientName.trim(), phone: form.phone.trim(),
      email: form.email.trim(), reason: form.reason.trim(),
      date: dateStr, time: selectedSlot, status: "PENDING",
      appointmentID: `REC-${Date.now()}`, bookedBy: "Receptionist",
    };
    const idx = doctors.findIndex((doc) => doc.firstName === selectedDoctor.firstName && doc.lastName === selectedDoctor.lastName);
    if (idx === -1) return;
    const updated = doctors.map((doc, i) => i === idx ? { ...doc, appointments: [...(doc.appointments || []), newAppt] } : doc);
    setDoctors(updated);
    localStorage.setItem("doctors", JSON.stringify(updated));
    window.dispatchEvent(new Event("doctorsUpdated"));
    const docName = `Dr. ${selectedDoctor.firstName} ${selectedDoctor.lastName}`;
    sendWhatsApp(form.phone,
      `Hi ${form.patientName.trim()}! 🩺 Your appointment is confirmed.\n📅 Date: ${dateStr}\n🕐 Time: ${selectedSlot}\n👨‍⚕️ Doctor: ${docName}\n🆔 ID: ${newAppt.appointmentID}`
    );
    if (selectedDoctor.phone) {
      sendWhatsApp(selectedDoctor.phone,
        `📋 New appointment booked\nPatient: ${form.patientName.trim()}\n📅 ${dateStr} at ${selectedSlot}\n📞 ${form.phone.trim()}${form.reason.trim() ? `\nReason: ${form.reason.trim()}` : ""}`
      );
    }
    setSuccessMsg(`Appointment confirmed for ${form.patientName} with Dr. ${selectedDoctor.firstName} ${selectedDoctor.lastName} on ${dateStr} at ${selectedSlot}`);
    setForm({ patientName: "", phone: "", email: "", reason: "" });
    setSelectedSlot("");
    setTimeout(() => setSuccessMsg(""), 8000);
  };

  const handleDateSelect = (day) => {
    setSelectedDate(new Date(year, month, day));
    setSelectedDoctor(null); setSelectedSlot(""); setErrors({});
    setShowDateModal(true);
    setModalStep("overview");
    setModalDoctor(null); setModalSlot("");
    setModalForm({ patientName: "", phone: "", email: "", reason: "" });
    setModalErrors({});
  };

  const handleModalBook = () => {
    const e = {};
    if (!modalForm.patientName.trim()) e.patientName = "Required";
    if (!modalForm.phone.trim()) e.phone = "Required";
    else if (!/^\d{10}$/.test(modalForm.phone.trim())) e.phone = "Enter a valid 10-digit number";
    if (Object.keys(e).length > 0) { setModalErrors(e); return; }
    setModalErrors({});
    const d = selectedDate;
    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    const newAppt = {
      patientName: modalForm.patientName.trim(), phone: modalForm.phone.trim(),
      email: modalForm.email.trim(), reason: modalForm.reason.trim(),
      date: dateStr, time: modalSlot, status: "PENDING",
      appointmentID: `REC-${Date.now()}`, bookedBy: "Receptionist",
    };
    const idx = doctors.findIndex((doc) => doc.firstName === modalDoctor.firstName && doc.lastName === modalDoctor.lastName);
    if (idx === -1) return;
    const updated = doctors.map((doc, i) => i === idx ? { ...doc, appointments: [...(doc.appointments || []), newAppt] } : doc);
    setDoctors(updated);
    localStorage.setItem("doctors", JSON.stringify(updated));
    window.dispatchEvent(new Event("doctorsUpdated"));
    const mDocName = `Dr. ${modalDoctor.firstName} ${modalDoctor.lastName}`;
    sendWhatsApp(modalForm.phone,
      `Hi ${modalForm.patientName.trim()}! 🩺 Your appointment is confirmed.\n📅 Date: ${dateStr}\n🕐 Time: ${modalSlot}\n👨‍⚕️ Doctor: ${mDocName}\n🆔 ID: ${newAppt.appointmentID}`
    );
    if (modalDoctor.phone) {
      sendWhatsApp(modalDoctor.phone,
        `📋 New appointment booked\nPatient: ${modalForm.patientName.trim()}\n📅 ${dateStr} at ${modalSlot}\n📞 ${modalForm.phone.trim()}${modalForm.reason.trim() ? `\nReason: ${modalForm.reason.trim()}` : ""}`
      );
    }
    setModalStep("done");
  };

  const handleCancelAppointment = (appt) => {
    const updated = doctors.map((doc) => {
      if (doc.firstName === appt.doctorFirstName && doc.lastName === appt.doctorLastName) {
        return {
          ...doc,
          appointments: (doc.appointments || []).map((a) =>
            a.appointmentID === appt.appointmentID ? { ...a, status: "CANCELLED", cancelReason: "Doctor not available" } : a
          ),
        };
      }
      return doc;
    });
    setDoctors(updated);
    localStorage.setItem("doctors", JSON.stringify(updated));
    window.dispatchEvent(new Event("doctorsUpdated"));
    const cancelDoc = doctors.find((d) => d.firstName === appt.doctorFirstName && d.lastName === appt.doctorLastName);
    const cancelDocName = `Dr. ${appt.doctorFirstName || ""} ${appt.doctorLastName || ""}`.trim();
    if (appt.phone) {
      sendWhatsApp(appt.phone,
        `Hi ${appt.patientName}, your appointment with ${cancelDocName} on ${appt.date} at ${appt.time} has been cancelled.\n⚠️ Reason: Doctor not available\nPlease contact us to reschedule.`
      );
    }
    if (cancelDoc?.phone) {
      sendWhatsApp(cancelDoc.phone,
        `⚠️ Appointment Cancelled\nPatient: ${appt.patientName}\nScheduled: ${appt.date} at ${appt.time}`
      );
    }
  };

  const handleReschedule = (appt) => {
    const apptDate = appt.date ? new Date(appt.date + "T00:00:00") : new Date();
    setSelectedDate(apptDate);
    setModalForm({ patientName: appt.patientName || "", phone: appt.phone || "", email: appt.email || "", reason: appt.reason || "" });
    setModalDoctor(null); setModalSlot(""); setModalErrors({});
    setModalStep("book");
    setShowDateModal(true);
  };

  const statusBadge = (status) => {
    if (status === "PAID" || status === "COMPLETED") return { bg: "bg-emerald-50 text-emerald-700 border-emerald-200", label: status };
    if (status === "CANCELLED") return { bg: "bg-red-50 text-red-600 border-red-200", label: "Cancelled" };
    return { bg: "bg-amber-50 text-amber-700 border-amber-200", label: "Pending" };
  };

  const activeStep = !selectedDate ? 1 : !selectedDoctor ? 2 : !selectedSlot ? 3 : 4;

  const formatPhone = (phone) => {
    const digits = String(phone || "").replace(/\D/g, "");
    if (digits.length === 10) return `+91${digits}`;
    return String(phone).startsWith("+") ? phone : `+${digits}`;
  };

  const sendWhatsApp = (to, message) => {
    if (!to) return;
    fetch("/.netlify/functions/send-whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: formatPhone(to), message }),
    }).catch(() => {});
  };

  return (
    <div className="flex min-h-screen" style={{ background: "#F5F5F5" }}>

      {/* ── Sidebar ── */}
      <aside className="w-64 bg-white fixed left-0 top-0 h-full border-r border-gray-200 flex flex-col z-20 shadow-sm">
        <div className="px-5 pt-6 pb-4 border-b border-gray-100">
          <AppLogo />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = item.path === "/Receptionist";
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-all duration-150 flex items-center gap-3 text-sm no-underline ${
                  active
                    ? "bg-orange-600 text-white font-semibold shadow-sm"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 font-medium"
                }`}
              >
                <span className="text-base w-5 text-center">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-3 border-t border-gray-100">
          <button
            onClick={() => navigate("/Logout")}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 transition-colors font-medium"
          >
            <MdOutlinePowerSettingsNew size={16} /> Sign Out
          </button>
        </div>

        <div className="px-4 py-3 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-orange-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {user.initials}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-800 truncate">{user.name}</p>
              <p className="text-xs text-gray-400">v{packageJson.version}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="ml-64 flex-1 flex flex-col min-h-screen">

        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-0.5">Reception Desk</p>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Book Appointment</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-gray-400">{new Date().toLocaleDateString("en-GB", { weekday: "long" })}</p>
              <p className="text-sm font-semibold text-gray-700">
                {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div className="flex gap-2">
              {[
                { n: doctors.length, label: "Doctors", color: "text-gray-800" },
                { n: todayAppointments.length, label: "Today", color: "text-orange-600" },
                { n: todayAppointments.filter(a => !a.status || a.status === "PENDING").length, label: "Pending", color: "text-amber-600" },
              ].map(({ n, label, color }) => (
                <div key={label} className="text-center px-3 py-1 bg-gray-50 rounded-lg border border-gray-200">
                  <p className={`text-base font-black ${color}`}>{n}</p>
                  <p className="text-xs text-gray-400">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </header>

        <div className="flex-1 p-6">

          {/* Progress Steps */}
          <div className="flex items-center gap-0 mb-6 bg-white rounded-xl border border-gray-200 px-6 py-4">
            {[
              { n: 1, label: "Select Date" },
              { n: 2, label: "Choose Doctor" },
              { n: 3, label: "Pick Time Slot" },
              { n: 4, label: "Patient Info" },
            ].map(({ n, label }, i, arr) => {
              const done    = activeStep > n;
              const current = activeStep === n;
              return (
                <React.Fragment key={n}>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                      done    ? "bg-orange-600 border-orange-600 text-white" :
                      current ? "bg-white border-orange-600 text-orange-600" :
                                "bg-white border-gray-300 text-gray-400"
                    }`}>
                      {done ? "✓" : n}
                    </div>
                    <span className={`text-xs font-semibold hidden sm:block ${
                      done || current ? "text-gray-800" : "text-gray-400"
                    }`}>{label}</span>
                  </div>
                  {i < arr.length - 1 && (
                    <div className={`flex-1 h-px mx-3 ${done ? "bg-orange-400" : "bg-gray-200"}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Success Banner */}
          {successMsg && (
            <div className="mb-5 flex items-start gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-5 py-4">
              <span className="text-lg">✅</span>
              <div>
                <p className="font-semibold text-sm">Appointment Confirmed</p>
                <p className="text-sm mt-0.5 text-emerald-700">{successMsg}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            {/* ── LEFT ── */}
            <div className="xl:col-span-2 space-y-5">

              {/* Calendar */}
              <Card className="p-6" id="calendar-section">
                <SectionLabel step="1" title="Select Appointment Date" subtitle="Choose a future date from the calendar below" />

                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={() => setViewDate(new Date(year, month - 1, 1))}
                    className="w-8 h-8 rounded-lg border border-gray-200 hover:border-orange-400 hover:bg-orange-50 flex items-center justify-center text-gray-600 hover:text-orange-600 transition-all font-bold"
                  >‹</button>
                  <h2 className="text-sm font-bold text-gray-800 tracking-wide uppercase">
                    {MONTH_NAMES[month]} {year}
                  </h2>
                  <button
                    onClick={() => setViewDate(new Date(year, month + 1, 1))}
                    className="w-8 h-8 rounded-lg border border-gray-200 hover:border-orange-400 hover:bg-orange-50 flex items-center justify-center text-gray-600 hover:text-orange-600 transition-all font-bold"
                  >›</button>
                </div>

                {/* Day header */}
                <div className="grid grid-cols-7 border border-gray-300 rounded-t-lg overflow-hidden">
                  {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
                    <div key={d} className="text-center text-xs font-bold text-gray-500 py-2.5 bg-gray-50 border-r border-gray-300 last:border-r-0 uppercase tracking-wide">
                      {d}
                    </div>
                  ))}
                </div>

                {/* Day cells */}
                <div className="grid grid-cols-7 border-l border-r border-b border-gray-300 rounded-b-lg overflow-hidden">
                  {Array.from({ length: firstDay }).map((_, i) => (
                    <div key={`b${i}`} className="aspect-square border-r border-b border-gray-200 last:border-r-0 bg-gray-50/60" />
                  ))}
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                    const past     = isPast(day);
                    const selected = isSelected(day);
                    const tod      = isToday(day);
                    return (
                      <button
                        key={day}
                        disabled={past}
                        onClick={() => handleDateSelect(day)}
                        className={[
                          "aspect-square flex items-center justify-center text-sm font-semibold transition-all border-r border-b border-gray-200 last:border-r-0",
                          past     ? "text-gray-300 bg-gray-50/60 cursor-not-allowed" : "",
                          selected ? "bg-orange-600 text-white font-bold" : "",
                          tod && !selected ? "bg-orange-50 text-orange-700 font-bold ring-inset ring-2 ring-orange-500" : "",
                          !past && !selected && !tod ? "text-gray-700 hover:bg-orange-50 hover:text-orange-700" : "",
                        ].filter(Boolean).join(" ")}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>

                {selectedDate && (
                  <div className="mt-4 flex items-center justify-center gap-2 text-sm font-semibold text-orange-700 bg-orange-50 border border-orange-200 rounded-lg py-2.5">
                    <span>📅</span>
                    {selectedDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  </div>
                )}
              </Card>

              {/* Available Doctors */}
              {selectedDate && (
                <Card className="p-6" id="doctor-section">
                  <SectionLabel
                    step="2"
                    title="Select Doctor"
                    subtitle={`Doctors available on ${DAY_NAMES[selectedDate.getDay()]}s`}
                  />

                  {availableDoctors.length === 0 ? (
                    <div className="text-center py-10 border border-dashed border-gray-300 rounded-xl">
                      <p className="text-3xl mb-2">🗓️</p>
                      <p className="text-sm font-semibold text-gray-600">No doctors available</p>
                      <p className="text-xs text-gray-400 mt-1">No active doctors are scheduled on {DAY_NAMES[selectedDate.getDay()]}s. Try a different date.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {availableDoctors.map((doc, i) => {
                        const active = selectedDoctor?.firstName === doc.firstName && selectedDoctor?.lastName === doc.lastName;
                        return (
                          <button
                            key={i}
                            onClick={() => { setSelectedDoctor(doc); setSelectedSlot(""); setErrors({}); }}
                            className={`text-left p-4 rounded-xl border-2 transition-all group ${
                              active
                                ? "border-orange-500 bg-orange-50"
                                : "border-gray-200 bg-white hover:border-orange-300 hover:bg-orange-50/40"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0 ${
                                active ? "bg-orange-600 text-white" : "bg-gray-100 text-gray-600 group-hover:bg-orange-100 group-hover:text-orange-700"
                              }`}>
                                {String(doc.firstName || "?")[0].toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-gray-900 text-sm">Dr. {doc.firstName} {doc.lastName}</p>
                                {doc.specialization && (
                                  <p className="text-xs text-orange-600 font-medium mt-0.5">{doc.specialization}</p>
                                )}
                                <div className="flex items-center gap-2 mt-1">
                                  {doc.experience && (
                                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{doc.experience} yrs</span>
                                  )}
                                  {doc.consultationFee && (
                                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">₹{doc.consultationFee}</span>
                                  )}
                                </div>
                              </div>
                              {active && (
                                <div className="ml-auto w-5 h-5 rounded-full bg-orange-600 flex items-center justify-center flex-shrink-0">
                                  <span className="text-white text-xs">✓</span>
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </Card>
              )}

              {/* Time Slots */}
              {selectedDoctor && selectedDate && (
                <Card className="p-6">
                  <SectionLabel
                    step="3"
                    title="Select Time Slot"
                    subtitle={`Dr. ${selectedDoctor.firstName} ${selectedDoctor.lastName} · ${selectedDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`}
                  />

                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                    {TIME_SLOTS.map((slot) => {
                      const booked = bookedSlots.has(slot);
                      const active = selectedSlot === slot;
                      return (
                        <button
                          key={slot}
                          disabled={booked}
                          onClick={() => { setSelectedSlot(slot); setErrors((e) => ({ ...e, slot: undefined })); }}
                          className={[
                            "py-2.5 px-1 text-xs font-semibold rounded-lg border-2 transition-all",
                            booked  ? "bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed line-through" :
                            active  ? "bg-orange-600 text-white border-orange-600 shadow-sm" :
                                      "bg-white text-gray-700 border-gray-200 hover:border-orange-400 hover:bg-orange-50 hover:text-orange-700",
                          ].join(" ")}
                        >
                          {booked ? slot : slot}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <div className="w-3 h-3 rounded border-2 border-orange-600 bg-orange-600" /> Selected
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <div className="w-3 h-3 rounded border-2 border-gray-200 bg-white" /> Available
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <div className="w-3 h-3 rounded border-2 border-gray-200 bg-gray-50" /> Booked
                    </div>
                  </div>

                  {errors.slot && <p className="text-red-500 text-xs mt-2">{errors.slot}</p>}
                </Card>
              )}

              {/* Patient Form */}
              {selectedDoctor && selectedSlot && (
                <Card className="p-6">
                  <SectionLabel step="4" title="Patient Information" subtitle="Fill in the patient's details to confirm the booking" />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                    {[
                      { key: "patientName", label: "Patient Name", placeholder: "Full name", type: "text", required: true },
                      { key: "phone",       label: "Phone Number", placeholder: "10-digit mobile", type: "tel", required: true },
                      { key: "email",       label: "Email Address", placeholder: "patient@email.com", type: "email", required: false },
                      { key: "reason",      label: "Reason for Visit", placeholder: "e.g. Toothache, Routine checkup", type: "text", required: false },
                    ].map(({ key, label, placeholder, type, required }) => (
                      <div key={key}>
                        <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">
                          {label} {required && <span className="text-red-500 normal-case tracking-normal">*</span>}
                        </label>
                        <input
                          type={type}
                          placeholder={placeholder}
                          value={form[key]}
                          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                          className={`w-full border-2 rounded-lg px-3.5 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-orange-500 transition-colors ${
                            errors[key] ? "border-red-400 bg-red-50" : "border-gray-200 bg-white hover:border-gray-300"
                          }`}
                        />
                        {errors[key] && <p className="text-red-500 text-xs mt-1">{errors[key]}</p>}
                      </div>
                    ))}
                  </div>

                  {/* Booking Summary */}
                  <div className="border-2 border-orange-200 rounded-xl overflow-hidden mb-5">
                    <div className="bg-orange-600 px-4 py-2.5">
                      <p className="text-white text-xs font-bold uppercase tracking-widest">Booking Summary</p>
                    </div>
                    <div className="bg-orange-50 px-4 py-4">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        {[
                          ["Doctor",        `Dr. ${selectedDoctor.firstName} ${selectedDoctor.lastName}`],
                          ["Speciality",    selectedDoctor.specialization || "—"],
                          ["Date",          selectedDate?.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" })],
                          ["Time",          selectedSlot],
                          ...(selectedDoctor.consultationFee ? [["Consultation Fee", `₹${selectedDoctor.consultationFee}`]] : []),
                          ["Status",        "Pending Confirmation"],
                        ].map(([k, v]) => (
                          <React.Fragment key={k}>
                            <span className="text-gray-500 font-medium">{k}</span>
                            <span className="text-gray-900 font-semibold">{v}</span>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleBook}
                    className="w-full bg-orange-600 hover:bg-orange-700 active:scale-[0.98] text-white font-bold py-3.5 rounded-xl text-sm tracking-wide transition-all shadow-sm hover:shadow-md"
                  >
                    Confirm Appointment
                  </button>
                </Card>
              )}
            </div>

            {/* ── RIGHT ── */}
            <div className="space-y-5">

              {/* Today's Appointments */}
              <Card id="today-schedule">
                <div className="px-5 py-4 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Today's Schedule</p>
                    <span className="bg-orange-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {todayAppointments.length}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
                  </p>
                </div>

                <div className="px-5 py-4">
                  {todayAppointments.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl">
                      <p className="text-2xl mb-1.5">📭</p>
                      <p className="text-sm font-semibold text-gray-500">No appointments today</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto -mr-2 pr-2">
                      {todayAppointments.map((appt, i) => {
                        const badge = statusBadge(appt.status);
                        return (
                          <div key={i} className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 hover:border-gray-200 bg-gray-50/50 transition-colors">
                            <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-xs flex-shrink-0 mt-0.5">
                              {String(appt.patientName || "P")[0].toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-gray-800 truncate">{appt.patientName || "Patient"}</p>
                              <p className="text-xs text-orange-600 font-medium truncate">{appt.doctorName}</p>
                              <p className="text-xs text-gray-500 mt-0.5">🕐 {appt.time}</p>
                              {appt.reason && <p className="text-xs text-gray-400 truncate mt-0.5">{appt.reason}</p>}
                              {appt.status === "CANCELLED" && (
                                <button onClick={() => handleReschedule(appt)} className="text-xs text-orange-600 hover:text-orange-700 font-semibold hover:underline mt-1 transition-colors">
                                  Reschedule →
                                </button>
                              )}
                            </div>
                            <div className="relative group/badge flex-shrink-0">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border cursor-default ${badge.bg}`}>
                                {badge.label}
                              </span>
                              {appt.status === "CANCELLED" && appt.cancelReason && (
                                <div className="absolute right-0 bottom-full mb-1.5 hidden group-hover/badge:block z-20 bg-gray-900 text-white text-xs rounded-lg px-3 py-1.5 whitespace-nowrap shadow-xl">
                                  ⚠ {appt.cancelReason}
                                  <div className="absolute right-3 top-full border-4 border-transparent border-t-gray-900" />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </Card>

              {/* Stats */}
              <Card className="p-5">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Overview</p>
                <div className="space-y-2">
                  {[
                    { label: "Total Doctors",    value: doctors.length,    color: "bg-slate-600" },
                    { label: "Active Doctors",   value: doctors.filter((d) => d.isActive !== false).length, color: "bg-emerald-600" },
                    { label: "Today's Total",    value: todayAppointments.length, color: "bg-blue-600" },
                    { label: "Pending Today",    value: todayAppointments.filter((a) => !a.status || a.status === "PENDING").length, color: "bg-amber-500" },
                    { label: "Completed Today",  value: todayAppointments.filter((a) => a.status === "COMPLETED" || a.status === "PAID").length, color: "bg-orange-600" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${color}`} />
                        <span className="text-sm text-gray-600">{label}</span>
                      </div>
                      <span className="text-sm font-black text-gray-800">{value}</span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Legend */}
              <Card className="p-5">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Calendar Guide</p>
                <div className="space-y-2.5">
                  {[
                    { swatch: "bg-orange-600", label: "Selected date" },
                    { swatch: "bg-orange-50 ring-2 ring-orange-500", label: "Today" },
                    { swatch: "bg-gray-50", label: "Past date (disabled)" },
                    { swatch: "bg-orange-600", label: "Selected slot" },
                    { swatch: "bg-gray-50 border border-gray-200 line-through-demo", label: "Booked slot" },
                  ].map(({ swatch, label }) => (
                    <div key={label} className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-md flex-shrink-0 ${swatch}`} />
                      <span className="text-xs text-gray-500">{label}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </div>
      </main>

    {/* ── Mitra Chat ── */}
    <MitraChat
      initialGreeting={`Hi! I'm Mitra 🤖 I'm your receptionist assistant. I can help you book appointments, view today's schedule, manage patients, and more. What would you like to do?`}
      quickActions={[
        {
          icon: "📅", label: "Book Appointment", command: "book",
          onClick: () => document.getElementById("calendar-section")?.scrollIntoView({ behavior: "smooth" }),
          reply: "I've scrolled to the calendar! Pick a date to start booking 📅",
        },
        {
          icon: "📋", label: "Today's Schedule", command: "schedule",
          onClick: () => document.getElementById("today-schedule")?.scrollIntoView({ behavior: "smooth" }),
          reply: "Scrolling to today's schedule 👇",
        },
        {
          icon: "❌", label: "Cancel Appointment", command: "cancel",
          chatFlow: ({ botReply }) => {
            const pending = todayAppointments.filter((a) => a.status === "PENDING" || !a.status);
            if (pending.length === 0) {
              botReply("No pending appointments today 🎉");
            } else {
              botReply(
                `You have ${pending.length} pending appointment(s) today:\n` +
                pending.map((a) => `• ${a.patientName} with ${a.doctorName} at ${a.time}`).join("\n") +
                "\n\nClick on today in the calendar to cancel any of them."
              );
            }
          },
        },
        {
          icon: "🔄", label: "Reschedule", command: "reschedule",
          chatFlow: ({ botReply }) => {
            const cancelled = todayAppointments.filter((a) => a.status === "CANCELLED");
            if (cancelled.length === 0) {
              botReply("No cancelled appointments to reschedule today.");
            } else {
              botReply(
                `${cancelled.length} cancelled appointment(s) today:\n` +
                cancelled.map((a) => `• ${a.patientName} — ${a.cancelReason || "Cancelled"}`).join("\n") +
                "\n\nClick on the date in the calendar and use the Reschedule button."
              );
            }
          },
        },
        {
          icon: "👤", label: "Add Patient", command: "add patient",
          chatFlow: ({ botReply, setChatStep }) => {
            botReply("Sure! Please enter the patient's full name.");
            setChatStep("askName");
          },
        },
        {
          icon: "👨‍⚕️", label: "Find Doctor", command: "doctor",
          onClick: () => navigate("/DoctorList"),
          reply: "Opening Doctor portal 👨‍⚕️",
        },
        {
          icon: "📊", label: "Overview", command: "overview",
          chatFlow: ({ botReply }) => {
            botReply(
              `📊 Today's Overview:\n` +
              `• Total doctors: ${doctors.length}\n` +
              `• Active doctors: ${doctors.filter((d) => d.isActive !== false).length}\n` +
              `• Today's appointments: ${todayAppointments.length}\n` +
              `• Pending: ${todayAppointments.filter((a) => !a.status || a.status === "PENDING").length}\n` +
              `• Completed: ${todayAppointments.filter((a) => a.status === "COMPLETED" || a.status === "PAID").length}`
            );
          },
        },
        {
          icon: "📞", label: "Support", command: "support",
          onClick: () => navigate("/ContactCenter"),
          reply: "Opening support page 📞",
        },
      ]}
    />

    {/* ── Date Action Modal ── */}
    {showDateModal && selectedDate && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowDateModal(false)}>
        <div
          className={`bg-white rounded-2xl shadow-2xl w-full mx-4 overflow-hidden transition-all ${modalStep === "overview" || modalStep === "done" ? "max-w-md" : "max-w-lg"}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-orange-600 px-6 py-4">
            <div className="flex items-start justify-between">
              <div>
                {modalStep !== "overview" && modalStep !== "done" && (
                  <button
                    onClick={() => setModalStep(modalStep === "slot" ? "book" : modalStep === "patient" ? "slot" : "overview")}
                    className="text-orange-200 hover:text-white text-xs flex items-center gap-1 mb-1 transition-colors"
                  >← Back</button>
                )}
                <p className="text-orange-200 text-xs font-semibold uppercase tracking-widest">{DAY_NAMES[selectedDate.getDay()]}</p>
                <h2 className="text-white text-xl font-black mt-0.5">
                  {selectedDate.getDate()} {MONTH_NAMES[selectedDate.getMonth()]} {selectedDate.getFullYear()}
                </h2>
                {modalStep === "book"    && <p className="text-orange-200 text-xs mt-0.5">Step 1 of 3 — Choose a doctor</p>}
                {modalStep === "slot"    && <p className="text-orange-200 text-xs mt-0.5">Step 2 of 3 — Pick a time · Dr. {modalDoctor?.firstName} {modalDoctor?.lastName}</p>}
                {modalStep === "patient" && <p className="text-orange-200 text-xs mt-0.5">Step 3 of 3 — Patient details · {modalSlot}</p>}
              </div>
              <button onClick={() => setShowDateModal(false)} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white text-xl font-bold transition-colors">×</button>
            </div>
            {modalStep === "overview" && (
              <div className="flex gap-3 mt-3">
                {[
                  { n: selectedDateAppointments.length, label: "Appointments" },
                  { n: availableDoctors.length, label: "Doctors" },
                  { n: selectedDateAppointments.filter((a) => !a.status || a.status === "PENDING").length, label: "Pending" },
                ].map(({ n, label }) => (
                  <div key={label} className="bg-white/20 rounded-lg px-3 py-1.5 text-center flex-1">
                    <p className="text-white text-lg font-black">{n}</p>
                    <p className="text-orange-200 text-xs font-medium">{label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Body */}
          <div className="p-5 max-h-[70vh] overflow-y-auto">

            {/* ── OVERVIEW ── */}
            {modalStep === "overview" && (
              <>
                <button
                  onClick={() => setModalStep("book")}
                  className="w-full bg-orange-600 hover:bg-orange-700 active:scale-[0.98] text-white font-bold py-3 rounded-xl text-sm tracking-wide transition-all shadow-sm hover:shadow-md mb-4 flex items-center justify-center gap-2"
                >
                  <span>📅</span> Book New Appointment
                </button>
                {selectedDateAppointments.length > 0 && (
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Appointments on this day</p>
                )}
                {selectedDateAppointments.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl">
                    <p className="text-3xl mb-2">📭</p>
                    <p className="text-sm font-semibold text-gray-500">No appointments on this day</p>
                    <p className="text-xs text-gray-400 mt-1">Click above to book the first one</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedDateAppointments.map((appt, i) => {
                      const badge = statusBadge(appt.status);
                      const cancellable = appt.status !== "CANCELLED" && appt.status !== "COMPLETED" && appt.status !== "PAID";
                      return (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50 hover:border-gray-200 transition-colors">
                          <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-sm flex-shrink-0">
                            {String(appt.patientName || "P")[0].toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-gray-800 truncate">{appt.patientName || "Patient"}</p>
                            <p className="text-xs text-gray-500 truncate">{appt.doctorName}</p>
                            <p className="text-xs text-gray-400">🕐 {appt.time}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                            <div className="relative group/badge">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border cursor-default ${badge.bg}`}>{badge.label}</span>
                              {appt.status === "CANCELLED" && appt.cancelReason && (
                                <div className="absolute right-0 bottom-full mb-1.5 hidden group-hover/badge:block z-20 bg-gray-900 text-white text-xs rounded-lg px-3 py-1.5 whitespace-nowrap shadow-xl">
                                  ⚠ {appt.cancelReason}
                                  <div className="absolute right-3 top-full border-4 border-transparent border-t-gray-900" />
                                </div>
                              )}
                            </div>
                            {cancellable && (
                              <button onClick={() => handleCancelAppointment(appt)} className="text-xs text-red-500 hover:text-red-700 font-medium hover:underline transition-colors">Cancel</button>
                            )}
                            {appt.status === "CANCELLED" && (
                              <button onClick={() => handleReschedule(appt)} className="text-xs text-orange-600 hover:text-orange-700 font-semibold hover:underline transition-colors">Reschedule</button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* ── STEP 1: SELECT DOCTOR ── */}
            {modalStep === "book" && (
              availableDoctors.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-gray-300 rounded-xl">
                  <p className="text-3xl mb-2">🗓️</p>
                  <p className="text-sm font-semibold text-gray-600">No doctors available</p>
                  <p className="text-xs text-gray-400 mt-1">No active doctors scheduled on {DAY_NAMES[selectedDate.getDay()]}s. Try a different date.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {availableDoctors.map((doc, i) => (
                    <button
                      key={i}
                      onClick={() => { setModalDoctor(doc); setModalSlot(""); setModalStep("slot"); }}
                      className="w-full text-left p-4 rounded-xl border-2 border-gray-200 bg-white hover:border-orange-400 hover:bg-orange-50/40 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-gray-100 group-hover:bg-orange-100 flex items-center justify-center text-sm font-black text-gray-600 group-hover:text-orange-700 flex-shrink-0 transition-colors">
                          {String(doc.firstName || "?")[0].toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-gray-900 text-sm">Dr. {doc.firstName} {doc.lastName}</p>
                          {doc.specialization && <p className="text-xs text-orange-600 font-medium mt-0.5">{doc.specialization}</p>}
                          <div className="flex items-center gap-2 mt-1">
                            {doc.experience && <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{doc.experience} yrs</span>}
                            {doc.consultationFee && <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">₹{doc.consultationFee}</span>}
                          </div>
                        </div>
                        <span className="text-gray-300 group-hover:text-orange-500 font-bold text-xl transition-colors">›</span>
                      </div>
                    </button>
                  ))}
                </div>
              )
            )}

            {/* ── STEP 2: SELECT TIME SLOT ── */}
            {modalStep === "slot" && (
              <>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-4">
                  {TIME_SLOTS.map((slot) => {
                    const booked = modalBookedSlots.has(slot);
                    const active = modalSlot === slot;
                    return (
                      <button
                        key={slot}
                        disabled={booked}
                        onClick={() => setModalSlot(slot)}
                        className={[
                          "py-2.5 px-1 text-xs font-semibold rounded-lg border-2 transition-all",
                          booked ? "bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed line-through" :
                          active  ? "bg-orange-600 text-white border-orange-600 shadow-sm" :
                                    "bg-white text-gray-700 border-gray-200 hover:border-orange-400 hover:bg-orange-50 hover:text-orange-700",
                        ].join(" ")}
                      >{slot}</button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-4 pt-3 border-t border-gray-100 mb-4">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500"><div className="w-3 h-3 rounded border-2 border-orange-600 bg-orange-600" /> Selected</div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500"><div className="w-3 h-3 rounded border-2 border-gray-200 bg-white" /> Available</div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500"><div className="w-3 h-3 rounded border-2 border-gray-200 bg-gray-50" /> Booked</div>
                </div>
                <button
                  disabled={!modalSlot}
                  onClick={() => modalSlot && setModalStep("patient")}
                  className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl text-sm tracking-wide transition-all"
                >
                  Continue{modalSlot ? ` · ${modalSlot}` : ""}
                </button>
              </>
            )}

            {/* ── STEP 3: PATIENT INFO ── */}
            {modalStep === "patient" && (
              <>
                <div className="grid grid-cols-1 gap-3 mb-4">
                  {[
                    { key: "patientName", label: "Patient Name",    placeholder: "Full name",                     type: "text",  required: true },
                    { key: "phone",       label: "Phone Number",    placeholder: "10-digit mobile",               type: "tel",   required: true },
                    { key: "email",       label: "Email Address",   placeholder: "patient@email.com",             type: "email", required: false },
                    { key: "reason",      label: "Reason for Visit",placeholder: "e.g. Toothache, Routine checkup",type: "text",  required: false },
                  ].map(({ key, label, placeholder, type, required }) => (
                    <div key={key}>
                      <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wide">
                        {label} {required && <span className="text-red-500">*</span>}
                      </label>
                      <input
                        type={type}
                        placeholder={placeholder}
                        value={modalForm[key]}
                        onChange={(e) => setModalForm((f) => ({ ...f, [key]: e.target.value }))}
                        className={`w-full border-2 rounded-lg px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-orange-500 transition-colors ${
                          modalErrors[key] ? "border-red-400 bg-red-50" : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                      />
                      {modalErrors[key] && <p className="text-red-500 text-xs mt-1">{modalErrors[key]}</p>}
                    </div>
                  ))}
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 mb-4">
                  <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">Booking Summary</p>
                  <div className="space-y-1 text-xs text-gray-600">
                    {[
                      ["Doctor", `Dr. ${modalDoctor?.firstName} ${modalDoctor?.lastName}`],
                      ["Date",   selectedDate?.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long" })],
                      ["Time",   modalSlot],
                      ...(modalDoctor?.consultationFee ? [["Fee", `₹${modalDoctor.consultationFee}`]] : []),
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span className="text-gray-500">{k}</span>
                        <span className="font-semibold text-gray-800">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  onClick={handleModalBook}
                  className="w-full bg-orange-600 hover:bg-orange-700 active:scale-[0.98] text-white font-bold py-3 rounded-xl text-sm tracking-wide transition-all shadow-sm hover:shadow-md"
                >
                  Confirm Appointment
                </button>
              </>
            )}

            {/* ── SUCCESS ── */}
            {modalStep === "done" && (
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">✅</span>
                </div>
                <p className="text-lg font-black text-gray-800 mb-1">Appointment Confirmed!</p>
                <p className="text-sm text-gray-500">{modalForm.patientName}</p>
                <p className="text-sm text-orange-600 font-semibold mt-0.5">Dr. {modalDoctor?.firstName} {modalDoctor?.lastName}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {selectedDate?.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long" })} · {modalSlot}
                </p>
                <button
                  onClick={() => setShowDateModal(false)}
                  className="mt-6 w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-xl text-sm tracking-wide transition-all"
                >Done</button>
                <button
                  onClick={() => { setModalStep("book"); setModalDoctor(null); setModalSlot(""); setModalForm({ patientName: "", phone: "", email: "", reason: "" }); setModalErrors({}); }}
                  className="mt-2 w-full text-orange-600 hover:text-orange-700 font-semibold py-2 rounded-xl text-sm transition-colors"
                >Book Another</button>
              </div>
            )}

          </div>
        </div>
      </div>
    )}
    </div>
  );
}
