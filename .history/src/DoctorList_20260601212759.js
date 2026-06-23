import { useEffect, useState, useMemo, useCallback } from "react";
   import { useNavigate } from "react-router-dom";
import { Switch } from "@material-tailwind/react";
// Material Tailwind
import {
  Card,
  Typography,
  Button,
  Dialog,
  DialogBody,
  DialogFooter,
} from "@material-tailwind/react";

// Icons
import {
  Bars3Icon,
  Squares2X2Icon,
  PencilIcon,
  TrashIcon,
  DocumentDuplicateIcon,
} from "@heroicons/react/24/solid";
// removed unused FaUserMd
import { AiOutlineDelete } from "react-icons/ai";
import {
  MdOutlineFestival,
} from "react-icons/md";
import { FaFlag, FaSun, FaMoon, FaStar, FaChurch } from "react-icons/fa";
import { MdOutlinePhoneIphone, MdOutlineEmail } from "react-icons/md";
import { GiPartyPopper, GiRam } from "react-icons/gi";
import { MdOutlinePowerSettingsNew } from "react-icons/md";
// Components
import AppLogo from "./AppLogo";

// Styles
import "./DoctorList.css";

function DoctorList() {
  const navigate = useNavigate();

  // ==================== State Variables ====================
  const [doctors, setDoctors] = useState([]);
  const [editIndex, setEditIndex] = useState(null);
  const [editDoctor, setEditDoctor] = useState({});
  const [editingAppointmentIndex, setEditingAppointmentIndex] = useState(null);
  const [tempAppointment, setTempAppointment] = useState({});
  const [gridView, setGridView] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [timeZoneLabel, setTimeZoneLabel] = useState("");
  const [confirmAction, setConfirmAction] = useState({
    open: false,
    type: "",
    index: null,
    doctor: null,
  });
  const [workReason, setWorkReason] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [selectedDoctors, setSelectedDoctors] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(
    JSON.parse(localStorage.getItem("isLoggedIn")) || false,
  );
  const [currentTime, setCurrentTime] = useState("");
  const [apptPages, setApptPages] = useState({}); // per-doctor appointments pagination state
  const [openSwipeDialog, setOpenSwipeDialog] = useState(false);
  const [openHolidayDialog, setOpenHolidayDialog] = useState(false);
  const [openLeaveHistory, setOpenLeaveHistory] = useState(false);
  const [openLocationModal, setOpenLocationModal] = useState(false);
  const [workLocation, setWorkLocation] = useState("");
  const [sessionExpired, setSessionExpired] = useState(false);
  const [swipeHistory, setSwipeHistory] = useState(
    JSON.parse(localStorage.getItem("swipeHistory")) || [],
  );
  const [leaveRequests, setLeaveRequests] = useState(
    JSON.parse(localStorage.getItem("leaveRequests")) || [],
  );

  const doctorsPerPage = 32;
  const RH_QUOTA = 2;

  // ==================== Helper Functions ====================
  const WEEK_DAYS = useMemo(() => ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"], []);

  const sortDays = useCallback((arr = []) => {
    if (!Array.isArray(arr)) return [];
    const set = new Set(arr);
    return WEEK_DAYS.filter((d) => set.has(d));
  }, [WEEK_DAYS]);

  // Appointment status helpers
  const getAppointmentStatusKey = (appt) => {
    if (appt?.status) {
      const s = String(appt.status).toUpperCase();
      if (["CANCELLED", "PAID", "PENDING", "COMPLETED"].includes(s)) return s;
      if (s === "UPCOMING") return "PENDING";
      return s;
    }
    if (appt?.paid || appt?.isPaid === true) return "PAID";
    if (appt?.paymentStatus && String(appt.paymentStatus).toUpperCase() === "PAID") return "PAID";
    if (appt?.payment_method || appt?.paymentMethod || appt?.paidVia) return "PAID";
    try {
      const paidObj = JSON.parse(localStorage.getItem("paidAppointments")) || {};
      const id = appt?.appointmentID || appt?.id || appt?.appointmentId;
      if (id && paidObj[id]) return "PAID";
    } catch (e) {}
    if (!appt?.date) return "PENDING";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const apptDate = new Date(appt.date);
    apptDate.setHours(0, 0, 0, 0);
    if (apptDate < today) return "COMPLETED";
    return "PENDING";
  };

  const getAppointmentDisplay = (appt) => {
    const key = getAppointmentStatusKey(appt);
    if (key === "PAID") {
      const method = appt?.paymentMethod || appt?.payment || appt?.payment_method || appt?.paidVia || appt?.paymentMode || null;
      let fallbackMethod = null;
      try {
        const paidObj = JSON.parse(localStorage.getItem("paidAppointments")) || {};
        const id = appt?.appointmentID || appt?.id || appt?.appointmentId;
        if (id && paidObj[id]) fallbackMethod = paidObj[id];
      } catch (e) {}
      const finalMethod = method || fallbackMethod;
      if (finalMethod) {
        if (/upi/i.test(finalMethod)) return `PAID (UPI Scanner)`;
        if (/cash/i.test(finalMethod)) return `PAID (Cash)`;
        return `PAID (${finalMethod})`;
      }
      if (appt?.paid === true || appt?.isPaid === true) return "PAID";
      return "PAID";
    }
    if (key === "PENDING") return "PENDING";
    if (key === "CANCELLED") return "CANCELLED";
    if (key === "COMPLETED") return "COMPLETED";
    return key;
  };

  const getBadgeClass = (appt) => {
    const key = getAppointmentStatusKey(appt);
    if (key === "PAID") return "bg-green-500 text-white";
    if (key === "COMPLETED") return "bg-blue-100 text-blue-700";
    if (key === "CANCELLED") return "bg-red-100 text-red-700";
    return "bg-orange-100 text-orange-700";
  };

  const getSortedAppointments = (appts = []) => {
    try {
      return [...appts].sort((a, b) => {
        const da = a?.date ? new Date(a.date) : new Date(0);
        const db = b?.date ? new Date(b.date) : new Date(0);
        return db - da;
      });
    } catch (e) {
      return appts;
    }
  };

  const APPTS_PER_PAGE = 5;

  const getApptPage = (doctorIdx) => apptPages[doctorIdx] || 1;

  const setApptPage = (doctorIdx, page) =>
    setApptPages((prev) => ({ ...prev, [doctorIdx]: page }));


  const getInitials = (firstName = "", lastName = "") => {
    if (!firstName && !lastName) return "U";
    return `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase();
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  // ==================== User Data ====================
  const [user] = useState(() => {
    try {
      const storedUser = JSON.parse(localStorage.getItem("loggedInUser"));
      if (storedUser) {
        const fullName =
          storedUser.name ||
          `${storedUser.firstName || ""} ${storedUser.lastName || ""}`.trim();
        return {
          name: fullName || "User",
          email: storedUser.email || "user@email.com",
          role: storedUser.role || "User",
          initials: getInitials(storedUser.firstName, storedUser.lastName),
        };
      }
      return {
        name: "User",
        email: "user@email.com",
        role: "User",
        initials: "U",
      };
    } catch {
      return {
        name: "User",
        email: "user@email.com",
        role: "User",
        initials: "U",
      };
    }
  });

  const shiftObj = {
    type: "Flexi Shift",
    start: "10:00 AM",
    end: "10:00 PM",
  };

  const usedRH = leaveRequests.filter(
    (l) => l.type === "RH" && l.status !== "Cancelled",
  ).length;
  const remainingRH = RH_QUOTA - usedRH;

  // ==================== Holidays Array ====================
  const holidays = [
    {
      date: "1 Jan 2026",
      day: "Thursday",
      name: "New Year's Day",
      type: "NH",
      icon: <FaSun className="inline mr-1 text-yellow-500" />,
    },
    {
      date: "3 Jan 2026",
      day: "Saturday",
      name: "Hazrat Ali's Birthday",
      type: "RH",
      icon: <FaMoon className="inline mr-1 text-orange-500" />,
    },
    {
      date: "14 Jan 2026",
      day: "Wednesday",
      name: "Makar Sankranti / Pongal",
      type: "RH",
      icon: <FaStar className="inline mr-1 text-orange-500" />,
    },
    {
      date: "23 Jan 2026",
      day: "Friday",
      name: "Vasant Panchami",
      type: "RH",
      icon: <MdOutlineFestival className="inline mr-1 text-yellow-400" />,
    },
    {
      date: "26 Jan 2026",
      day: "Monday",
      name: "Republic Day",
      type: "NH",
      icon: <FaFlag className="inline mr-1 text-red-500" />,
    },
    {
      date: "15 Feb 2026",
      day: "Sunday",
      name: "Maha Shivaratri",
      type: "RH",
      icon: <FaMoon className="inline mr-1 text-gray-700" />,
    },
    {
      date: "4 Mar 2026",
      day: "Wednesday",
      name: "Holi",
      type: "NH",
      icon: <GiPartyPopper className="inline mr-1 text-pink-500" />,
    },
    {
      date: "21 Mar 2026",
      day: "Saturday",
      name: "Eid-ul-Fitr (Tentative)",
      type: "RH",
      icon: <FaMoon className="inline mr-1 text-orange-600" />,
    },
    {
      date: "26 Mar 2026",
      day: "Thursday",
      name: "Ram Navami",
      type: "RH",
      icon: <GiRam className="inline mr-1 text-orange-400" />,
    },
    {
      date: "31 Mar 2026",
      day: "Tuesday",
      name: "Mahavir Jayanti",
      type: "RH",
      icon: <FaStar className="inline mr-1 text-orange-400" />,
    },
    {
      date: "3 Apr 2026",
      day: "Friday",
      name: "Good Friday",
      type: "NH",
      icon: <FaChurch className="inline mr-1 text-red-600" />,
    },
    {
      date: "1 May 2026",
      day: "Friday",
      name: "Labour Day / Buddha Purnima",
      type: "NH",
      icon: <FaFlag className="inline mr-1 text-orange-500" />,
    },
    {
      date: "27 May 2026",
      day: "Wednesday",
      name: "Eid-ul-Zuha (Bakrid) (Tentative)",
      type: "RH",
      icon: <FaMoon className="inline mr-1 text-orange-700" />,
    },
    {
      date: "26 Jun 2026",
      day: "Friday",
      name: "Muharram (Tentative)",
      type: "RH",
      icon: <FaMoon className="inline mr-1 text-gray-800" />,
    },
    {
      date: "15 Aug 2026",
      day: "Saturday",
      name: "Independence Day",
      type: "NH",
      icon: <FaFlag className="inline mr-1 text-red-600" />,
    },
    {
      date: "26 Aug 2026",
      day: "Wednesday",
      name: "Milad-un-Nabi (Tentative)",
      type: "RH",
      icon: <FaMoon className="inline mr-1 text-orange-600" />,
    },
    {
      date: "4 Sep 2026",
      day: "Friday",
      name: "Janmashtami",
      type: "RH",
      icon: <GiRam className="inline mr-1 text-purple-500" />,
    },
    {
      date: "2 Oct 2026",
      day: "Friday",
      name: "Gandhi Jayanti",
      type: "NH",
      icon: <FaFlag className="inline mr-1 text-orange-600" />,
    },
    {
      date: "20 Oct 2026",
      day: "Tuesday",
      name: "Dussehra",
      type: "RH",
      icon: <MdOutlineFestival className="inline mr-1 text-orange-600" />,
    },
    {
      date: "8 Nov 2026",
      day: "Sunday",
      name: "Diwali",
      type: "NH",
      icon: <GiPartyPopper className="inline mr-1 text-yellow-500" />,
    },
    {
      date: "24 Nov 2026",
      day: "Tuesday",
      name: "Guru Nanak Jayanti",
      type: "RH",
      icon: <FaStar className="inline mr-1 text-orange-500" />,
    },
    {
      date: "25 Dec 2026",
      day: "Friday",
      name: "Christmas",
      type: "NH",
      icon: <FaChurch className="inline mr-1 text-red-500" />,
    },
  ];

  // ==================== Event Handlers ====================
  const handleDeleteSwipe = (index) => {
    const updatedHistory = swipeHistory.filter((_, i) => i !== index);
    setSwipeHistory(updatedHistory);
    localStorage.setItem("swipeHistory", JSON.stringify(updatedHistory));
  };

  const handleApplyLeave = (holiday) => {
    const newRequest = {
      id: Date.now(),
      date: holiday.date,
      name: holiday.name,
      type: holiday.type,
      status: "Pending",
      appliedOn: new Date().toLocaleDateString(),
    };
    const updated = [...leaveRequests, newRequest];
    setLeaveRequests(updated);
    localStorage.setItem("leaveRequests", JSON.stringify(updated));
  };

  const handleCancelLeave = (id) => {
    const updated = leaveRequests.map((leave) =>
      leave.id === id ? { ...leave, status: "Cancelled" } : leave,
    );
    setLeaveRequests(updated);
    localStorage.setItem("leaveRequests", JSON.stringify(updated));
  };

  const getDoctorsFromStorage = () => {
    try {
      return JSON.parse(localStorage.getItem("doctors")) || [];
    } catch {
      return [];
    }
  };

  const saveDoctors = (updated) => {
    setDoctors(updated);
    localStorage.setItem("doctors", JSON.stringify(updated));
  };

  const handleOpen = () => {
    if (!isLoggedIn) {
      setOpenLocationModal(true);
    } else {
      completeSignAction();
    }
  };



  const completeSignAction = () => {
    setSwipeHistory((prev) => {
      const lastEntry = prev[prev.length - 1];
      let updated;
      let newLoginState;

      if (!lastEntry || lastEntry.signOut) {
        const loginTime = new Date().toISOString();
        updated = [
          ...prev,
          {
            signIn: loginTime,
            signOut: null,
            location: workLocation,
            reason: workReason,
          },
        ];
        newLoginState = true;
        setSuccessMsg("Successfully Signed In ✅");
        localStorage.setItem("loginTime", loginTime);
      } else {
        updated = prev.map((entry, i) =>
          i === prev.length - 1
            ? { ...entry, signOut: new Date().toISOString() }
            : entry,
        );
        newLoginState = false;
        setSuccessMsg("Successfully Signed Out ✅");
        localStorage.removeItem("loginTime");
      }

      setIsLoggedIn(newLoginState);
      localStorage.setItem("isLoggedIn", JSON.stringify(newLoginState));
      localStorage.setItem("swipeHistory", JSON.stringify(updated));
      setWorkLocation("");
      setWorkReason("");
      return updated;
    });
  };

  const executeAction = () => {
    const { type, index } = confirmAction;

    if (type === "delete") {
      const updated = doctors.filter((_, i) => i !== index);
      saveDoctors(updated);
    }

    if (type === "clone") {
      const doctorToClone = doctors[index];
      const clonedDoctor = {
        ...doctorToClone,
        firstName: `${doctorToClone.firstName || ""} Copy`,
        appointments: [...(doctorToClone.appointments || [])],
      };
      const updated = [...doctors];
      updated.splice(index + 1, 0, clonedDoctor);
      setDoctors(updated);
      localStorage.setItem("doctors", JSON.stringify(updated));
    }

    setConfirmAction({ open: false, type: "", index: null });
  };

  const handleSave = () => {
    const updated = [...doctors];
    // ensure availableDays are kept in canonical weekday order
    const cleaned = { ...editDoctor };
    cleaned.availableDays = sortDays(cleaned.availableDays || []);
    updated[editIndex] = cleaned;
    setDoctors(updated);
    localStorage.setItem("doctors", JSON.stringify(updated));
    setEditIndex(null);
  };

  const toggleDoctorSelect = (index) => {
    setSelectedDoctors((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
    );
  };

  // ==================== Computed Values ====================
  const indexOfLastDoctor = currentPage * doctorsPerPage;
  const indexOfFirstDoctor = indexOfLastDoctor - doctorsPerPage;

  const filteredDoctors = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return doctors.filter((doctor) =>
      `${doctor.firstName || ""} ${doctor.lastName || ""} ${doctor.email || ""}`
        .toLowerCase()
        .includes(term),
    );
  }, [doctors, searchTerm]);

  const currentDoctors = filteredDoctors.slice(
    indexOfFirstDoctor,
    indexOfLastDoctor,
  );
  

  const totalPages = Math.ceil(filteredDoctors.length / doctorsPerPage);
const handleToggle = (doctorIndex, value) => {
  const updatedDoctors = doctors.map((doctor, idx) =>
    idx === doctorIndex ? { ...doctor, isActive: !!value } : doctor,
  );
  setDoctors(updatedDoctors);
  localStorage.setItem("doctors", JSON.stringify(updatedDoctors));
  window.dispatchEvent(new Event("doctorsUpdated"));
};
  const handlePrevPage = () => setCurrentPage((p) => Math.max(p - 1, 1));
  const handleNextPage = () =>
    setCurrentPage((p) => Math.min(p + 1, totalPages));

  const upcomingHolidays = holidays.filter((h) => {
    const holidayDate = new Date(h.date);
    return holidayDate >= new Date();
  });

  const currentDay = new Date().toLocaleDateString("en-US", {
    weekday: "long",
  });

  // ==================== Effects ====================
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const loadDoctors = useCallback(() => {
    const storedDoctors = getDoctorsFromStorage();
    const normalized = storedDoctors.map((doc) => ({
      ...doc,
      appointments: Array.isArray(doc.appointments) ? doc.appointments : [],
      availableDays: sortDays(doc.availableDays || []),
    }));
    // debug: show loaded doctors and appointment statuses
    try {
      console.debug("DoctorList: loaded doctors", normalized.map(d=>({name:`${d.firstName||''} ${d.lastName||''}`.trim(), appointments: d.appointments?.map(a=>({id:a.appointmentID||a.id, status:a.status, paid:a.paid, paymentMethod:a.paymentMethod}))})));
    } catch (e) {}
    setDoctors(normalized);
    // reset per-doctor pagination when reloading doctors
    setApptPages({});
  }, [sortDays]);

  useEffect(() => {
    loadDoctors();
    window.addEventListener("doctorsUpdated", loadDoctors);
    return () => window.removeEventListener("doctorsUpdated", loadDoctors);
  }, [loadDoctors]);

  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => {
        setSuccessMsg("");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const systemTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      let zone = "";
      switch (systemTimeZone) {
        case "Asia/Kolkata":
          zone = "IST";
          break;
        case "America/New_York":
          zone = "EST / EDT";
          break;
        case "America/Los_Angeles":
          zone = "PST / PDT";
          break;
        case "America/Chicago":
          zone = "CST / CDT";
          break;
        case "Europe/London":
          zone = "GMT / BST";
          break;
        default:
          zone = systemTimeZone;
      }

      const timeString = now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      setCurrentTime(timeString);
      setTimeZoneLabel(zone);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;

    const loginTime = localStorage.getItem("loginTime");
    if (!loginTime) return;

    const loginTimestamp = new Date(loginTime).getTime();
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    const remainingTime = fiveMinutes - (now - loginTimestamp);

    if (remainingTime <= 0) {
      setSessionExpired(true);
    } else {
      const timer = setTimeout(() => {
        setSessionExpired(true);
      }, remainingTime);

      return () => clearTimeout(timer);
    }
  }, [isLoggedIn]);

  // ==================== Render ====================
  return (
    <div className="flex min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Left Navigation Bar */}
      <div className="w-64 bg-blue-500 text-white shadow-lg fixed left-0 top-0 h-full border-r border-blue-700 flex flex-col">
        {/* Logo and Navigation */}
        <div className="p-6 flex-1 overflow-y-auto">
          <div className="mb-8">
            <AppLogo />
          </div>

          <nav className="space-y-2">
            <button
              onClick={() => navigate("/Welcome")}
              className="w-full text-left px-4 py-2 rounded-lg text-white hover:bg-blue-500 hover:text-white transition duration-200 flex items-center gap-3"
            >
              <span className="text-xl">🏠</span>
              <span className="font-medium">Dashboard</span>
            </button>

            <button
              onClick={() => navigate("/DoctorList")}
              className="w-full text-left px-4 py-2 rounded-lg bg-blue-700 text-white font-medium transition duration-200 flex items-center gap-3"
            >
              <span className="text-xl">👨‍⚕️</span>
              <span>Doctors</span>
            </button>

            <button
              onClick={() => navigate("/PatientPortal")}
              className="w-full text-left px-4 py-2 rounded-lg text-white hover:bg-blue-500 hover:text-white transition duration-200 flex items-center gap-3"
            >
              <span className="text-xl">👤</span>
              <span className="font-medium">Patients</span>
            </button>

            <button
              onClick={() => navigate("/BookAppointment")}
              className="w-full text-left px-4 py-2 rounded-lg text-white hover:bg-blue-500 hover:text-white transition duration-200 flex items-center gap-3"
            >
              <span className="text-xl">📅</span>
              <span className="font-medium">Appointments</span>
            </button>

            <button
              onClick={() => navigate("/BillingDetails")}
              className="w-full text-left px-4 py-2 rounded-lg text-white hover:bg-blue-500 hover:text-white transition duration-200 flex items-center gap-3"
            >
              <span className="text-xl">💳</span>
              <span className="font-medium">Billing</span>
            </button>

            <button
              onClick={() => navigate("/Settings")}
              className="w-full text-left px-4 py-2 rounded-lg text-white hover:bg-blue-500 hover:text-white transition duration-200 flex items-center gap-3"
            >
              <span className="text-xl">⚙️</span>
              <span className="font-medium">Settings</span>
            </button>

            <button
              onClick={() => navigate("/Contact_us")}
              className="w-full text-left px-4 py-2 rounded-lg text-white hover:bg-blue-500 hover:text-white transition duration-200 flex items-center gap-3"
            >
              <span className="text-xl">📞</span>
              <span className="font-medium">Contact</span>
            </button>
          </nav>
        </div>

        {/* Sign Out Button */}
        <button
          onClick={() => navigate("/Logout")}
          className="flex items-center gap-2 w-full px-4 py-3 text-white hover:bg-red-600 hover:text-white"
        >
          <MdOutlinePowerSettingsNew /> Logout
        </button>

        {/* User Profile Section */}
        <div className="p-4 border-t border-blue-700 bg-blue-600">
          <div className="flex items-center gap-3 px-2 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 transition duration-200 cursor-pointer shadow-sm">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {user.initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">
                {user.name}
              </p>
              <p className="text-xs text-gray-600 truncate">
                {user.email}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="ml-64 flex-1 p-4 sm:p-6">
      {/* Success Message */}
      {successMsg && (
        <div className="fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          {successMsg}
        </div>
      )}

      {/* Top Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Greeting Card */}
        <Card className="p-4 sm:p-6 bg-gradient-to-r from-blue-50 to-purple-50 shadow-lg border border-blue-200">
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 flex items-center justify-center text-white text-2xl font-bold">
              {user.initials}
            </div>
            <div>
              <Typography variant="h6" className="text-blue-900">
                {getGreeting()}, {user.name}
              </Typography>
              <Typography className="text-sm text-blue-700">
                {user.email}
              </Typography>
            </div>
          </div>
        </Card>

        {/* Time & Shift Card */}
        <Card className="p-4 sm:p-6 bg-gradient-to-r from-green-50 to-orange-50 shadow-lg border border-green-200">
          <Typography
            variant="h5"
            className="mb-3 text-center font-bold text-green-900"
          >
            Time & Shift
          </Typography>
          <div className="bg-gradient-to-r from-green-100 to-orange-100 p-3 rounded-lg mb-2 border border-green-200">
            <p className="text-orange-900 font-semibold text-center text-sm">
              {`Monday-Friday | ${shiftObj.type}`}
            </p>
            <p className="text-orange-700 text-center text-xs font-bold mt-1">
              {`${shiftObj.start} – ${shiftObj.end}`}
            </p>
          </div>
          <p className="text-center text-sm font-semibold text-gray-800">
            {currentTime} - {currentDay}
          </p>
          <p className="text-center text-xs text-red-700 font-semibold mt-1">
            Timezone: {timeZoneLabel}
          </p>
          <div className="mt-3 flex justify-center gap-2">
            <Button
              size="sm"
              className="bg-green-600 text-white hover:bg-green-700"
              onClick={() => setOpenSwipeDialog(true)}
            >
              View Swipes
            </Button>
            <Button
              size="sm"
              className={`${
                isLoggedIn
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-green-600 hover:bg-green-700"
              } text-white`}
              onClick={handleOpen}
            >
              {isLoggedIn ? "Sign Out" : "Sign In"}
            </Button>
          </div>
        </Card>

        {/* Holidays Card */}
        <Card className="p-4 sm:p-6 bg-gradient-to-r from-purple-50 to-pink-50 shadow-lg border border-purple-200">
          <Typography
            variant="h5"
            className="mb-3 text-center font-bold text-purple-900 flex items-center justify-center gap-2"
          >
            Holidays
            <span className="bg-purple-600 text-white px-2 py-1 rounded-full text-sm">
              {upcomingHolidays.length}
            </span>
          </Typography>
          <div className="bg-purple-100 p-2 rounded-lg mb-3 text-center border border-purple-200">
            <p className="font-semibold text-purple-900 text-sm">
              RH Leave: {remainingRH} / {RH_QUOTA}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Button
              size="sm"
              className="bg-purple-600 text-white hover:bg-purple-700"
              onClick={() => setOpenHolidayDialog(true)}
            >
              View All Holidays
            </Button>
            <Button
              size="sm"
              className="bg-pink-600 text-white hover:bg-pink-700"
              onClick={() => setOpenLeaveHistory(true)}
            >
              Leave History
            </Button>
          </div>
        </Card>
      </div>

      {/* Doctor List Section */}
      <Card className="p-4 sm:p-6 shadow-lg border border-blue-500 mb-6 bg-blue-50 hover:bg-blue-100 transition duration-200">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 mb-4">
          <div className="flex items-center gap-3">
            <Typography
              variant="h5"
              className="text-xl sm:text-2xl font-semibold"
            >
              Dentists
            </Typography>

            <input
              type="text"
              placeholder="Search Doctor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant={!gridView ? "filled" : "outlined"}
              onClick={() => setGridView(false)}
              className="flex items-center gap-2"
            >
              <Bars3Icon className="h-5 w-5" />
            </Button>

            <Button
              variant={gridView ? "filled" : "outlined"}
              onClick={() => setGridView(true)}
              className="flex items-center gap-2"
            >
              <Squares2X2Icon className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="flex justify-center sm:justify-end mb-4">
          <Button
            className="inline-flex items-center px-6 sm:px-10 py-2 text-sm sm:text-lg text-white rounded-lg shadow-md bg-gradient-to-r from-orange-600 via-orange-700 to-orange-900 hover:scale-105 transition duration-300"
            onClick={() => navigate("/AddDoctor")}
          >
            + ADD DENTIST
          </Button>
        </div>

        {/* Doctors Display */}
        {doctors.length === 0 ? (
          <Typography>No Dentist added yet.</Typography>
        ) : (
          <>
            <div
              className={
                gridView
                  ? "grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
                  : "flex flex-col gap-4"
              }
            >
              {currentDoctors.map((doc, index) => {
                const realIndex = indexOfFirstDoctor + index;
                return (
                  <Card
                    key={realIndex}
                    className={`p-3 flex relative border ${
                      selectedDoctors.includes(realIndex)
                        ? "border-blue-400 bg-blue-100 shadow-lg"
                        : "border-white bg-white shadow-md"
                    } ${
                      gridView
                        ? "flex-col items-center text-center justify-between"
                        : "flex-row items-start gap-3"
                    } hover:shadow-xl transition duration-200`}
                  >
                    <input
                      type="checkbox"
                      className="absolute top-2 left-2"
                      checked={selectedDoctors.includes(realIndex)}
                      onChange={() => toggleDoctorSelect(realIndex)}
                    />

                    {/* Doctor Image */}
                    {doc.image && (
                      <img
                        src={doc.image}
                        alt="Doctor"
                        className={`${
                          gridView
                            ? "w-20 h-20 sm:w-24 sm:h-24"
                            : "w-20 h-20 sm:w-24 sm:h-24"
                        } object-cover border-2 border-blue-100 mb-2 cursor-pointer rounded-lg transition-transform duration-200 hover:scale-105 hover:shadow-xl`}
                      />
                    )}

{/* Doctor Details */}
<div className="flex-1 w-full flex flex-col items-start text-left space-y-1 text-black">
  {/* Doctor Name */}
  <Typography
    variant="h6"
    className="font-semibold text-sm sm:text-base flex items-center gap-2"
  >
  <span className="font-medium text-black-700">
   <b> DENTIST NAME:</b>
  </span>    <span>
      {doc.firstName} {doc.lastName}
    </span>
  </Typography>

  {/* Specialization */}
  {doc.specialization && (
    <div className="bg-blue-100 text-blue-800 text-xs px-3 py-1 rounded-full font-medium">
      {doc.specialization}
    </div>
  )}

  {/* Experience + Consultation Fee */}
  <div className="flex justify-between items-center w-full text-sm">
    <span className="text-gray-700">
     <span className="font-medium text-black-700">
    Experience:
  </span> {doc.experience || 0} years
    </span>

    <div className="flex items-center gap-1 bg-orange-100 px-2 py-1 rounded-full border border-orange-300">  <span className="font-semibold text-green-700 text-sm">
    ₹ - {doc.consultationFee || doc.fees || 0}
  </span>
</div>
  </div>

 {/* Available Days */}
{doc.availableDays?.length > 0 && (
  <div className="w-full">
    <Typography className="text-xs font-semibold text-gray-700 mb-1">
      Available Days:
    </Typography>

    <div className="flex flex-wrap gap-1">
      {doc.availableDays.map((day, i) => (
        <span
          key={i}
          className="px-2 py-1 text-xs bg-green-100 text-black-700 rounded-full border border-green-300"
        >
          {day}
        </span>
      ))}
    </div>
  </div>
)}

  {/* Active Status */}
  <div className="flex items-center gap-2 text-sm">
  <span className="font-medium text-gray-700">
    Is Active:
  </span>

  <Switch
    checked={doc.isActive}
    onChange={(e) => handleToggle(realIndex, e.target.checked)}
    color="green"
  />
</div>



  {/* Phone */}
  {doc.phone && (
    <Typography className="text-xs sm:text-sm flex items-center gap-1 break-all">
      <MdOutlinePhoneIphone className="text-blue-600" />
      <a
        href={`tel:${doc.phone}`}
        className="text-black hover:underline"
      >
        {doc.phone}
      </a>
    </Typography>
  )}

  {/* Email */}
  {doc.email && (
    <Typography className="text-xs sm:text-sm flex items-center gap-1 break-all">
      <MdOutlineEmail className="text-blue-600" />
      <a
        href={`mailto:${doc.email}`}
        className="text-black hover:underline"
      >
        {doc.email}
      </a>
    </Typography>
  )}

  {/* Appointments Card */}
 {Array.isArray(doc.appointments) && doc.appointments.length > 0 && (
  <div className="w-full mt-2 bg-gradient-to-r from-blue-50 to-indigo-50 border border-indigo-200 rounded-lg overflow-hidden">
    
    <div className="px-2 py-1 bg-indigo-100 border-b">
      <p className="font-semibold text-indigo-800">
        📅 Appointments ({doc.appointments.length})
      </p>
    </div>
    <div className="p-2">
      {(() => {
        const sorted = getSortedAppointments(doc.appointments || []);
        const totalPages = Math.max(1, Math.ceil(sorted.length / APPTS_PER_PAGE));
        const page = getApptPage(realIndex);
        const start = (page - 1) * APPTS_PER_PAGE;
        const paged = sorted.slice(start, start + APPTS_PER_PAGE);

        return (
          <>
            {paged.map((appt, idx) => {
              const badgeClass = getBadgeClass(appt);
              return (
                <div
                  key={idx}
                  className="mb-2 p-2 bg-white rounded border border-gray-200"
                >
                  <div className="font-semibold">Name: {appt.patientName || appt.name || "Patient"}</div>

                  <div className="text-xs text-gray-600">Date: {appt.date || "No Date"}</div>

                  <div className="text-xs text-gray-600">Time: {appt.time || ""}</div>

                  <span className={`inline-block mt-1 px-2 py-1 rounded-full text-xs ${badgeClass}`}>
                    {getAppointmentDisplay(appt)}
                  </span>
                </div>
              );
            })}

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-2">
                <div className="text-xs text-gray-600">Page {page} / {totalPages}</div>
                <div className="flex gap-2 items-center">
                  <Button
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setApptPage(realIndex, Math.max(1, page - 1))}
                    className="bg-gray-200 text-gray-700 hover:bg-gray-300 px-2 py-1 text-xs"
                  >
                    Prev
                  </Button>

                  <div className="flex gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        onClick={() => setApptPage(realIndex, p)}
                        className={`px-2 py-1 text-xs rounded ${p === page ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>

                  <Button
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setApptPage(realIndex, Math.min(totalPages, page + 1))}
                    className="bg-gray-200 text-gray-700 hover:bg-gray-300 px-2 py-1 text-xs"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        );
      })()}
    </div>
  </div>
)}
</div>
                      

                    {/* Action Buttons */}
                    <div className="mt-2 flex justify-center gap-2 flex-wrap">
                      <Button
                        size="sm"
                        className="flex items-center bg-green-500 text-white hover:bg-green-600 text-xs px-2 py-1"
                        onClick={() => {
                          setEditIndex(realIndex);
                          setEditDoctor(doc);
                        }}
                      >
                        <PencilIcon className="w-4 h-4 mr-1" />
                      </Button>

                      <Button
                        size="sm"
                        className="bg-blue-500 text-white hover:bg-blue-600 text-xs px-2 py-1"
                        onClick={() =>
                          setConfirmAction({
                            open: true,
                            type: "clone",
                            index: realIndex,
                          })
                        }
                      >
                        <DocumentDuplicateIcon className="w-4 h-4 mr-1" />
                      </Button>

                      <Button
                        size="sm"
                        className="bg-red-500 text-white hover:bg-red-600 text-xs px-2 py-1"
                        onClick={() =>
                          setConfirmAction({
                            open: true,
                            type: "delete",
                            index: realIndex,
                          })
                        }
                      >
                        <TrashIcon className="w-4 h-4 mr-1" />
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 mt-6">
              <Button onClick={handlePrevPage} disabled={currentPage === 1}>
                Prev
              </Button>
              <Typography className="text-sm sm:text-base">
                Page {currentPage} of {totalPages}
              </Typography>
              <Button
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </>
        )}
      </Card>

      {/* ==================== DIALOGS ==================== */}

      {/* Swipe Dialog */}
      <Dialog
        open={openSwipeDialog}
        handler={() => setOpenSwipeDialog(false)}
        size="md"
      >
        <DialogBody className="space-y-3">
          <Typography variant="h5" className="text-center mb-3">
            Swipe History
          </Typography>

          {swipeHistory.length === 0 ? (
            <p className="text-center text-gray-500">No swipe history available</p>
          ) : (
            swipeHistory.map((entry, index) => (
              <div
                key={index}
                className="relative border rounded-lg p-3 bg-orange-50 shadow-sm text-sm space-y-1"
              >
                <button
                  onClick={() => {
                    if (window.confirm("Delete this swipe record?")) {
                      handleDeleteSwipe(index);
                    }
                  }}
                  className="absolute top-2 right-2 text-red-600 hover:text-red-800"
                >
                  <AiOutlineDelete size={18} />
                </button>

                <p>
                  <span className="font-bold">Date:</span>{" "}
                  {new Date(entry.signIn).toLocaleDateString()}
                </p>
                <p>
                  <span className="font-bold">Sign In:</span>{" "}
                  {new Date(entry.signIn).toLocaleTimeString()}
                </p>
                <p>
                  <span className="font-bold">Sign Out:</span>{" "}
                  {entry.signOut ? (
                    new Date(entry.signOut).toLocaleTimeString()
                  ) : (
                    <span className="text-red-500">Not Signed Out</span>
                  )}
                </p>
                <p>
                  <span className="font-bold">Location:</span> {entry.location || "-"}
                </p>
              </div>
            ))
          )}
        </DialogBody>

        <DialogFooter>
          <Button
            color="red"
            variant="text"
            onClick={() => setOpenSwipeDialog(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Holiday Dialog */}
      <Dialog
        open={openHolidayDialog}
        handler={() => setOpenHolidayDialog(false)}
        size="md"
      >
        <DialogBody className="space-y-3">
          <Typography variant="h5" className="mb-3 text-center">
            All Holidays
          </Typography>

          {upcomingHolidays.map((holiday, index) => {
            const alreadyApplied = leaveRequests.some(
              (l) => l.date === holiday.date && l.status !== "Cancelled",
            );

            return (
              <div
                key={index}
                className="mt-2 space-y-1 text-gray-700 border-b pb-2 flex justify-between items-center gap-2"
              >
                <div>
                  <div className="font-semibold">
                    {holiday.icon} {holiday.date} • {holiday.day}
                  </div>
                  <div>
                    {holiday.name}
                    <span className="text-xs text-gray-500">
                      ({holiday.type})
                    </span>
                  </div>
                </div>

                {holiday.type === "RH" && (
                  <Button
                    size="sm"
                    color="orange"
                    disabled={alreadyApplied || remainingRH <= 0}
                    onClick={() => handleApplyLeave(holiday)}
                  >
                    {alreadyApplied
                      ? "Applied"
                      : remainingRH <= 0
                        ? "Quota Full"
                        : "Apply"}
                  </Button>
                )}
              </div>
            );
          })}
        </DialogBody>

        <DialogFooter>
          <Button color="orange" onClick={() => setOpenHolidayDialog(false)}>
            Close
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Leave History Dialog */}
      <Dialog
        open={openLeaveHistory}
        handler={() => setOpenLeaveHistory(false)}
        size="md"
      >
        <DialogBody className="space-y-4">
          <Typography variant="h5" className="text-center">
            Leave History
          </Typography>

          {leaveRequests.length === 0 ? (
            <Typography className="text-center text-gray-600">
              No leave requests yet.
            </Typography>
          ) : (
            leaveRequests.map((leave) => (
              <div
                key={leave.id}
                className="border p-2 rounded-lg bg-orange-50 shadow-sm flex justify-between items-center gap-2"
              >
                <div>
                  <p className="font-semibold">
                    {leave.date} • {leave.name}
                  </p>
                  <p className="text-sm text-gray-600">
                    Type: {leave.type} | Status:{" "}
                    <span
                      className={`font-semibold ${
                        leave.status === "Approved"
                          ? "text-orange-600"
                          : leave.status === "Cancelled"
                            ? "text-red-600"
                            : "text-gray-600"
                      }`}
                    >
                      {leave.status}
                    </span>
                  </p>
                  <p className="text-xs text-gray-500">
                    Applied on: {leave.appliedOn}
                  </p>
                </div>

                {leave.status !== "Cancelled" && (
                  <Button size="sm" color="red" onClick={() => handleCancelLeave(leave.id)}>
                    Cancel
                  </Button>
                )}
              </div>
            ))
          )}
        </DialogBody>
        <DialogFooter>
          <Button color="orange" onClick={() => setOpenLeaveHistory(false)}>
            Close
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Confirm Action Dialog */}
      <Dialog
        open={confirmAction.open}
        handler={() => setConfirmAction({ open: false, type: "", index: null })}
      >
        <DialogBody>
          Are you sure you want to {confirmAction.type} this doctor?
        </DialogBody>

        <DialogFooter>
          <Button
            variant="text"
            color="red"
            onClick={() =>
              setConfirmAction({ open: false, type: "", index: null })
            }
          >
            Cancel
          </Button>

          <Button color="orange" onClick={executeAction}>
            Yes
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Edit Doctor Dialog */}
      {editIndex !== null && (
        <Dialog open={true} handler={() => setEditIndex(null)}>
          <DialogBody className="space-y-3">
            <Typography variant="h6">Edit Doctor</Typography>

            {editDoctor.image && (
              <img
                src={editDoctor.image}
                alt="Doctor"
                className="w-24 h-24 object-cover rounded-lg border"
              />
            )}

            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    setEditDoctor({ ...editDoctor, image: reader.result });
                  };
                  reader.readAsDataURL(file);
                }
              }}
              className="w-full border px-3 py-2 rounded"
            />

            <input
              type="text"
              placeholder="First Name"
              value={editDoctor.firstName || ""}
              onChange={(e) =>
                setEditDoctor({ ...editDoctor, firstName: e.target.value })
              }
              className="w-full border px-3 py-2 rounded"
            />

            <input
              type="text"
              placeholder="Last Name"
              value={editDoctor.lastName || ""}
              onChange={(e) =>
                setEditDoctor({ ...editDoctor, lastName: e.target.value })
              }
              className="w-full border px-3 py-2 rounded"
            />

            <input
  type="text"
  placeholder="Specialization"
  value={editDoctor.specialization || ""}
  onChange={(e) =>
    setEditDoctor({
      ...editDoctor,
      specialization: e.target.value,
    })
  }
  className="w-full border px-3 py-2 rounded"
/>


            <input
              type="tel"
              placeholder="Phone Number"
              value={editDoctor.phone || ""}
              onChange={(e) =>
                setEditDoctor({ ...editDoctor, phone: e.target.value })
              }
              className="w-full border px-3 py-2 rounded"
            />

            <input
              type="email"
              placeholder="Email ID"
              value={editDoctor.email || ""}
              onChange={(e) =>
                setEditDoctor({ ...editDoctor, email: e.target.value })
              }
              className="w-full border px-3 py-2 rounded"
            />
            <input
  type="number"
  placeholder="Consultation Fee"
  value={editDoctor.consultationFee || ""}
  onChange={(e) =>
    setEditDoctor({
      ...editDoctor,
      consultationFee: Number(e.target.value),
    })
  }
  className="w-full border px-3 py-2 rounded"
/>

            <div className="border rounded p-3">
              <Typography className="text-sm font-semibold mb-2">Available Days</Typography>
              <div className="grid grid-cols-2 gap-2">
                {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => (
                  <label key={day} className="flex items-center gap-2 border rounded p-2 cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={(editDoctor.availableDays || []).includes(day)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setEditDoctor({
                            ...editDoctor,
                            availableDays: [...(editDoctor.availableDays || []), day],
                          });
                        } else {
                          setEditDoctor({
                            ...editDoctor,
                            availableDays: (editDoctor.availableDays || []).filter((d) => d !== day),
                          });
                        }
                      }}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">{day}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Appointments Editor */}
            <div className="border rounded p-3 mt-3">
              <Typography className="text-sm font-semibold mb-2">Appointments</Typography>
              {(editDoctor.appointments || []).length === 0 ? (
                <Typography className="text-xs text-gray-500">No appointments</Typography>
              ) : (
                (editDoctor.appointments || []).map((apt, ai) => (
                  <div key={ai} className="mb-2 p-2 bg-gray-50 rounded border">
                    <div className="font-semibold text-sm">{apt.patientName || apt.name || "Patient"}</div>
                    <div className="text-xs text-gray-600">Date: {apt.date || "-"}</div>
                    <div className="text-xs text-gray-600">Time: {apt.time || "-"}</div>
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        color="green"
                        onClick={() => {
                          setEditingAppointmentIndex(ai);
                          setTempAppointment({ ...(apt || {}) });
                        }}
                      >
                        Edit
                      </Button>

                      <Button
                        size="sm"
                        color="red"
                        onClick={() => {
                          if (!window.confirm("Delete this appointment?")) return;
                          const updatedAppts = (editDoctor.appointments || []).filter((_, i) => i !== ai);
                          setEditDoctor({ ...editDoctor, appointments: updatedAppts });
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))
              )}

              {editingAppointmentIndex !== null && (
                <div className="mt-3 border-t pt-3">
                  <Typography className="text-sm font-semibold">Edit Appointment</Typography>

                  <input
                    type="text"
                    placeholder="Patient Name"
                    value={tempAppointment.patientName || tempAppointment.name || ""}
                    onChange={(e) => setTempAppointment({ ...tempAppointment, patientName: e.target.value })}
                    className="w-full border px-3 py-2 rounded mt-2"
                  />

                  <input
                    type="date"
                    value={tempAppointment.date ? (tempAppointment.date.split && tempAppointment.date.split('T')[0]) : (tempAppointment.date || "")}
                    onChange={(e) => setTempAppointment({ ...tempAppointment, date: e.target.value })}
                    className="w-full border px-3 py-2 rounded mt-2"
                  />

                  <input
                    type="time"
                    value={tempAppointment.time || ""}
                    onChange={(e) => setTempAppointment({ ...tempAppointment, time: e.target.value })}
                    className="w-full border px-3 py-2 rounded mt-2"
                  />

                  <select
                    value={tempAppointment.status || "Pending"}
                    onChange={(e) => setTempAppointment({ ...tempAppointment, status: e.target.value })}
                    className="w-full border px-3 py-2 rounded mt-2"
                  >
                    <option>Pending</option>
                    <option>Paid</option>
                    <option>Completed</option>
                    <option>Cancelled</option>
                  </select>

                  <select
                    value={tempAppointment.paymentMethod || ""}
                    onChange={(e) => setTempAppointment({ ...tempAppointment, paymentMethod: e.target.value })}
                    className="w-full border px-3 py-2 rounded mt-2"
                  >
                    <option value="">Payment Method (optional)</option>
                    <option value="UPI Scanner">UPI Scanner</option>
                    <option value="Cash">Cash</option>
                  </select>

                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      color="orange"
                      onClick={() => {
                        const updated = [...(editDoctor.appointments || [])];
                        updated[editingAppointmentIndex] = { ...updated[editingAppointmentIndex], ...tempAppointment };
                        setEditDoctor({ ...editDoctor, appointments: updated });
                        setEditingAppointmentIndex(null);
                        setTempAppointment({});
                      }}
                    >
                      Save Appointment
                    </Button>

                    <Button
                      size="sm"
                      color="red"
                      onClick={() => {
                        setEditingAppointmentIndex(null);
                        setTempAppointment({});
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </DialogBody>

          <DialogFooter>
            <Button color="red" onClick={() => setEditIndex(null)}>
              Cancel
            </Button>

            <Button color="orange" onClick={handleSave}>
              Save
            </Button>
          </DialogFooter>
        </Dialog>
      )}

      {/* Session Expired Dialog */}
      <Dialog open={sessionExpired} handler={() => {}}>
        <DialogBody className="text-center">
          <Typography variant="h5" className="mb-2">
            Session Expired ⏰
          </Typography>
          <Typography className="text-sm sm:text-base">
            Your session will expire in 1 minute. Please Close the modal to continue.
          </Typography>
        </DialogBody>
        <DialogFooter className="flex justify-center">
          <Button
            color="red"
            onClick={() => {
              setSessionExpired(false);
              handleOpen();
            }}
          >
            Close
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Location Modal */}
      <Dialog
        open={openLocationModal}
        handler={() => setOpenLocationModal(false)}
      >
        <DialogBody className="space-y-4 text-center">
          <div className="flex flex-col items-center gap-2">
            <Typography variant="h6">Select Work Location</Typography>

            <select
              value={workLocation}
              onChange={(e) => setWorkLocation(e.target.value)}
              className="border border-orange-300 rounded-xl px-4 py-2 w-64 shadow-sm focus:ring-2 focus:ring-orange-400"
            >
              <option value="">Select Location</option>
              <option value="Office">🏢 Office</option>
              <option value="WFH">🏠 Work From Home</option>
              <option value="OnDuty">🛠 On Duty</option>
              <option value="ClientLocation">📍 Client Location</option>
            </select>
          </div>

          <div className="mt-3">
            <Typography className="text-sm mb-1">Enter Reason</Typography>

            <input
              type="text"
              placeholder="Example: Working from home today"
              value={workReason}
              onChange={(e) => setWorkReason(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
        </DialogBody>

        <DialogFooter>
          <Button
            variant="text"
            color="red"
            onClick={() => setOpenLocationModal(false)}
          >
            Cancel
          </Button>

          <Button
            color="orange"
            disabled={
              !workLocation ||
              ((workLocation === "WFH" ||
                workLocation === "OnDuty" ||
                workLocation === "ClientLocation") &&
                !workReason)
            }
            onClick={() => {
              setOpenLocationModal(false);
              completeSignAction();
            }}
          >
            Save & Sign In
          </Button>
        </DialogFooter>
      </Dialog>
      </div>
    </div>
  );
}

export default DoctorList;
