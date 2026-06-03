import { useEffect, useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";

// Material Tailwind
import {
  Card,
  Typography,
  Button,
  Dialog,
  DialogBody,
  DialogFooter,
  Breadcrumbs,
} from "@material-tailwind/react";

// Icons
import {
  Bars3Icon,
  Squares2X2Icon,
  PencilIcon,
  TrashIcon,
  DocumentDuplicateIcon,
} from "@heroicons/react/24/solid";
import { FaUserMd } from "react-icons/fa";

import { VscArrowRight } from "react-icons/vsc";
import { FcEngineering } from "react-icons/fc";
import { AiOutlineDelete } from "react-icons/ai";
import { FaArrowTrendUp } from "react-icons/fa6";
// ✅ Merge duplicate Md imports
import {
  MdOutlineFestival,
  MdOutlineEditNote,
  MdOutlineSettings,
  MdOutlinePowerSettingsNew,
} from "react-icons/md";

import { FaFlag, FaSun, FaMoon, FaStar, FaChurch } from "react-icons/fa";
import { MdOutlinePhoneIphone } from "react-icons/md";

import { GiPartyPopper, GiRam } from "react-icons/gi";
import { FaUserNurse } from "react-icons/fa";

// Assets
import logo from "./assets/Toothx_Logo.png";
import painting from "./assets/Painting.jpg";
import { MdOutlineEmail } from "react-icons/md";
import { SlCalender } from "react-icons/sl";

// Styles
import "./DoctorList.css";

function DoctorList() {
  const getAppointmentStatus = (appt) => {
    // If backend already provides status → respect it
    if (appt?.status) return appt.status;

    if (!appt?.date) return "Upcoming";

    const today = new Date();
    const apptDate = new Date(appt.date);

    // Remove time for accurate comparison
    today.setHours(0, 0, 0, 0);
    apptDate.setHours(0, 0, 0, 0);

    if (apptDate < today) {
      return "Completed";
    }

    return "Upcoming";
  };
  const navigate = useNavigate();
  const [doctors, setDoctors] = useState([]);
  const [editIndex, setEditIndex] = useState(null);
  const [editDoctor, setEditDoctor] = useState({});
  const [gridView, setGridView] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");

  const doctorsPerPage = 32;
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
  const [selectAll, setSelectAll] = useState(false);

  const [isLoggedIn, setIsLoggedIn] = useState(
    JSON.parse(localStorage.getItem("isLoggedIn")) || false,
  );

  const [currentTime, setCurrentTime] = useState("");
  const [openSwipeModal, setOpenSwipeModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [appointments, setAppointments] = useState([]);

  const getInitials = (firstName = "", lastName = "") => {
    if (!firstName && !lastName) return "U";
    return `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase();
  };

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

  const [swipeHistory, setSwipeHistory] = useState(
    JSON.parse(localStorage.getItem("swipeHistory")) || [],
  );

  const shiftObj = {
    type: "Flexi Shift",
    start: "10:00 AM",
    end: "10:00 PM",
  };

  const getDayLabel = (dateStr) => {
    if (!dateStr) return "";

    const today = new Date();
    const apptDate = new Date(dateStr);

    const todayDate = today.toDateString();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    if (apptDate.toDateString() === todayDate) {
      return "Today";
    }

    if (apptDate.toDateString() === tomorrow.toDateString()) {
      return "Tomorrow";
    }

    return "";
  };
  const RH_QUOTA = 2;
const [viewDoctor, setViewDoctor] = useState(null);
  const [leaveRequests, setLeaveRequests] = useState(
    JSON.parse(localStorage.getItem("leaveRequests")) || [],
  );

  const usedRH = leaveRequests.filter(
    (l) => l.type === "RH" && l.status !== "Cancelled",
  ).length;

  const remainingRH = RH_QUOTA - usedRH;

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

  const handleDeleteSwipe = (index) => {
    const updatedHistory = swipeHistory.filter((_, i) => i !== index);

    setSwipeHistory(updatedHistory);
    localStorage.setItem("swipeHistory", JSON.stringify(updatedHistory));
  };

  const allAppointments = useMemo(() => {
    return doctors.flatMap((doc) =>
      (doc.appointments || []).map((appt) => ({
        ...appt,
        doctorName: `${doc.firstName || ""} ${doc.lastName || ""}`,
        doctorId: doc.id,
      })),
    );
  }, [doctors]);

  const sortedAppointments = useMemo(() => {
    return [...allAppointments].sort(
      (a, b) => new Date(a.date) - new Date(b.date),
    );
  }, [allAppointments]);

  const completeSignAction = () => {
    setSwipeHistory((prev) => {
      const lastEntry = prev[prev.length - 1];
      let updated;
      let newLoginState;

      if (!lastEntry || lastEntry.signOut) {
        const loginTime = new Date().toISOString();

        console.log("Saving Reason:", workReason);

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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Load Appointments History
  useEffect(() => {
    const storedAppointments =
      JSON.parse(localStorage.getItem("appointments")) || [];
    setAppointments(storedAppointments);
  }, []);

  useEffect(() => {
    const storedDoctors = getDoctorsFromStorage();

    const normalized = storedDoctors.map((doc) => ({
      ...doc,
      appointments: Array.isArray(doc.appointments) ? doc.appointments : [],
    }));

    setDoctors(normalized);
  }, []);

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

  const currentDay = new Date().toLocaleDateString("en-US", {
    weekday: "long",
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  const handleOpen = () => {
    if (!isLoggedIn) {
      setOpenLocationModal(true); // show popup first
    } else {
      completeSignAction();
    }
  };

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

  const executeAction = () => {
    const { type, index } = confirmAction;

    if (type === "edit") {
      setEditIndex(index);
      setEditDoctor(doctors[index]);
    }

    if (type === "delete") {
      const updated = doctors.filter((_, i) => i !== index);
      saveDoctors(updated);
    }

    // ✅ ADD THIS BLOCK
    if (type === "clone") {
      const doctorToClone = doctors[index];

      const clonedDoctor = {
        ...doctorToClone,
        firstName: `${doctorToClone.firstName || ""} Copy`,
        appointments: [...(doctorToClone.appointments || [])],
      };

      const updated = [...doctors];
      updated.splice(index + 1, 0, clonedDoctor); // insert below original

      setDoctors(updated);
      localStorage.setItem("doctors", JSON.stringify(updated));
    }

    setConfirmAction({ open: false, type: "", index: null });
  };
  const handleSave = () => {
    const updated = [...doctors];
    updated[editIndex] = editDoctor;

    setDoctors(updated);
    localStorage.setItem("doctors", JSON.stringify(updated));

    setEditIndex(null);
  };

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
  const handlePrevPage = () => setCurrentPage((p) => Math.max(p - 1, 1));
  const handleNextPage = () =>
    setCurrentPage((p) => Math.min(p + 1, totalPages));

  const toggleDoctorSelect = (index) => {
    setSelectedDoctors((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
    );
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedDoctors([]);
    } else {
      const allIndices = currentDoctors.map((_, i) => indexOfFirstDoctor + i);
      setSelectedDoctors(allIndices);
    }
    setSelectAll(!selectAll);
  };

  const deleteSelectedDoctors = () => {
    const updated = doctors.filter((_, i) => !selectedDoctors.includes(i));
    saveDoctors(updated);
    setSelectedDoctors([]);
    setSelectAll(false);
  };

  const [openHolidayDialog, setOpenHolidayDialog] = useState(false);
  const [openSettingsModal, setOpenSettingsModal] = useState(false);
  const [openLeaveHistory, setOpenLeaveHistory] = useState(false);
  const [openLocationModal, setOpenLocationModal] = useState(false);
  const [workLocation, setWorkLocation] = useState("");
  const today = new Date();

  const upcomingHolidays = holidays
    .filter((holiday) => new Date(holiday.date) >= today)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const handleApplyLeave = (holiday) => {
    const isDuplicate = leaveRequests.some(
      (l) => l.date === holiday.date && l.status !== "Cancelled",
    );

    if (isDuplicate) {
      alert("Leave already applied for this date.");
      return;
    }

    if (remainingRH <= 0) {
      alert("RH quota exhausted. You cannot apply more RH leaves.");
      return;
    }

    const newLeave = {
      id: Date.now(),
      date: holiday.date,
      name: holiday.name,
      type: holiday.type,
      status: "Approved",
      appliedOn: new Date().toLocaleString(),
    };

    const updated = [...leaveRequests, newLeave];
    setLeaveRequests(updated);
    localStorage.setItem("leaveRequests", JSON.stringify(updated));
  };

  const [openSwipeDialog, setOpenSwipeDialog] = useState(false);
  const [openAllAppointments, setOpenAllAppointments] = useState(false);
  const handleCancelLeave = (id) => {
    const updated = leaveRequests.map((l) =>
      l.id === id ? { ...l, status: "Cancelled" } : l,
    );
    setLeaveRequests(updated);
    localStorage.setItem("leaveRequests", JSON.stringify(updated));
  };

  return (
    <div className="p-4 sm:p-6 min-h-screen bg-white-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4 p-1 bg-white shadow-md rounded-xl">
        <img
          className="w-24 h-24 sm:w-40 sm:h-28 md:w-32 md:h-32 object-contain"
          src={logo}
          alt="Application Logo"
        />

        {/* Painting Image (End / Right Side) */}
        <div className="hidden md:flex flex-1 justify-end">
          <img
            src={painting}
            alt="Painting"
            className="h-28 md:h-32 object-contain"
          />
        </div>

        {/* User Badge */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2 px-3 py-2 bg-orange-50 text-orange-900 font-semibold rounded-full shadow-sm hover:bg-orange-100 transition"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-orange-700 text-white flex items-center justify-center font-bold text-sm sm:text-base">
              {user.initials}
            </div>
            <span className="hidden sm:inline">{user.name}</span>
            <svg
              className={`w-4 h-4 ml-1 transform transition-transform duration-200 ${
                showProfileMenu ? "rotate-180" : "rotate-0"
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 9l-7 7-7-7"
              ></path>
            </svg>
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-3 w-64 bg-white rounded-xl shadow-lg border z-20 overflow-hidden">
              {/* Profile Header */}
              <div className="flex items-center gap-3 p-4 bg-orange-50 border-b">
                <div className="w-12 h-12 rounded-full bg-orange-700 text-white flex items-center justify-center font-bold text-lg">
                  {user.initials}
                </div>

                <div>
                  <p className="font-semibold text-orange-900">{user.name}</p>
                  <p className="text-xs text-gray-600">{user.email}</p>
                  <p className="text-xs text-gray-500">{user.role}</p>
                </div>
              </div>

              {/* Menu */}
              <button
                onClick={() => navigate("/NewRegistration")}
                className="w-full px-4 py-3 text-left hover:bg-orange-50 flex items-center gap-2"
              >
                <MdOutlineEditNote size={20} />
                Edit Profile
              </button>

              <button
                onClick={() => navigate("/Settings")}
                className="w-full px-4 py-3 text-left hover:bg-orange-50 flex items-center gap-2"
              >
                <MdOutlineSettings size={20} />
                Settings
              </button>

              <button
                onClick={() => {
                  setSuccessMsg("Successfully Signed Out ✅");
                  navigate("/Logout");
                }}
                className="w-full px-4 py-3 text-left text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <MdOutlinePowerSettingsNew size={20} />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Breadcrumbs */}
      <Breadcrumbs className="mt-2 sm:mt-6 mb-4 text-sm">
        <Link to="/HomePage" className="opacity-60 hover:opacity-100">
          Home
        </Link>
        <Link to="/Welcome" className="opacity-60 hover:opacity-100">
          Welcome
        </Link>
        <Link to="/DoctorList" className="font-semibold text-black-700">
          DoctorList
        </Link>
      </Breadcrumbs>

      {successMsg && (
        <div className="flex justify-center mb-3">
          <div className="bg-orange-100 text-orange-800 px-6 py-2 rounded-lg text-center font-semibold shadow max-w-md w-full">
            {successMsg}
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6 items-stretch">
        {/* Greeting Card */}
        <Card className="w-full lg:w-1/3 p-1 shadow-xl rounded-2xl bg-white border border-gray-200">
          <Typography variant="h5" className="mb-2">
            Hello, {getGreeting()}
          </Typography>

          {/* 🌍 Weather Info
          <p className="text-sm text-gray-600 mb-2">
            📍 {weather.city || "Detecting location..."} • 🌡{" "}
            {weather.temp !== null ? `${weather.temp}°C` : "Loading..."}
          </p> */}

          <Typography className="text-gray-700 italic text-sm sm:text-base">
            “Don’t worry about failures, worry about the chances you miss when
            you don’t even try.”
          </Typography>
        </Card>

        {/* Time & Shift Card */}
        <Card className="relative w-full lg:w-1/3 p-1 shadow-xl rounded-2xl bg-white border border-gray-200">
          <FcEngineering
            size={26}
            className="absolute top-4 right-4 cursor-pointer hover:scale-110 transition"
            title="Settings"
            onClick={() => setOpenSettingsModal(true)}
          />

          <Dialog
            open={openSettingsModal}
            handler={() => setOpenSettingsModal(false)}
            size="sm"
          >
            <DialogBody className="space-y-4">
              <Typography variant="h5" className="text-center">
                SETTINGS
              </Typography>

              <div className="flex justify-between items-center border-b pb-2">
                <Typography className="font-medium">Dark Mode</Typography>
                <input type="checkbox" className="w-5 h-5" />
              </div>

              <div className="flex justify-between items-center border-b pb-2">
                <Typography className="font-medium">Show Holidays</Typography>
                <input type="checkbox" defaultChecked className="w-5 h-5" />
              </div>

              <div className="flex justify-between items-center border-b pb-2">
                <Typography className="font-medium">
                  Enable Notifications
                </Typography>
                <input type="checkbox" className="w-5 h-5" />
              </div>

              <div className="flex justify-between items-center border-b pb-2">
                <Typography className="font-medium">
                  Enable Timezone Support
                </Typography>
                <input type="checkbox" className="w-5 h-5" />
              </div>
            </DialogBody>

            <DialogFooter>
              <Button
                variant="text"
                color="red"
                onClick={() => setOpenSettingsModal(false)}
              >
                Close
              </Button>
              <Button
                color="orange"
                onClick={() => setOpenSettingsModal(false)}
              >
                Save
              </Button>
            </DialogFooter>
          </Dialog>

          <Typography
            variant="h5"
            className="mb-4 text-center font-bold tracking-wide 
  bg-gradient-to-r from-white via-red-900 to-white-900 
  bg-clip-text text-transparent"
          >
            Time & Shift Information
          </Typography>

          <div
            className="bg-gradient-to-r from-green-100 via-green-50 to-orange-100 
p-2 rounded-xl shadow-md mb-3 border border-orange-200"
          >
            <p className="text-orange-900 font-semibold text-center text-sm sm:text-base">
              {`Monday-Friday | ${shiftObj.type}`}
            </p>

            <p className="text-orange-700 text-center text-xs sm:text-sm mt-1">
              <b>
                <u>{`${shiftObj.start} – ${shiftObj.end}`}</u>
              </b>
            </p>
          </div>

          <p className="inline-block px-2 py-1 ">
            <b>
              {" "}
              {currentTime} - <i>{currentDay}</i>
            </b>
          </p>

          <div className="text-center mt-2 space-y-1">
            <Button
              size="sm"
              className="inline-flex items-center px-3 py-1 
    text-white rounded-lg shadow-md 
    bg-gradient-to-r from-green-300 via-green-700 to-green-900 
    hover:scale-105 transition duration-300"
              onClick={() => setOpenSwipeDialog(true)}
            >
              View Swipes
            </Button>

            <p className="text-red-700 text-sm sm:text-base font-semibold">
              <u>Timezone:</u> {timeZoneLabel}
            </p>
          </div>

          <div className="mt-5 flex justify-center sm:justify-end">
            <Button
              className={`inline-flex items-center px-5 py-2 sm:px-6 sm:py-3 rounded-lg shadow-md 
  text-white transition-transform hover:scale-105 
  ${
    isLoggedIn
      ? "bg-gradient-to-r from-red-900 via-red-600 to-red-900"
      : "bg-gradient-to-r from-green-900 via-green-600 to-green-900"
  }`}
              onClick={handleOpen}
            >
              {isLoggedIn ? "Sign Out" : "Sign In"}
            </Button>
          </div>
        </Card>

        {/* Upcoming Holidays */}
        <Card className="relative w-full lg:w-1/3 p-1 shadow-xl rounded-2xl bg-white border border-gray-200">
          {" "}
          <Typography
            variant="h5"
            className="mb-4 relative text-center font-bold tracking-wide 
  bg-gradient-to-r from-white via-red-900 to-white-900 
  bg-clip-text text-transparent"
          >
            Upcoming Holidays
            <VscArrowRight
              size={24}
              className="absolute right-0 top-1/2 -translate-y-1/2 cursor-pointer text-green-600 hover:scale-110 transition"
              title="View all holidays"
              onClick={() => setOpenHolidayDialog(true)}
            />
          </Typography>
          <div className="mb-3 p-1 bg-green-100 rounded-lg text-center shadow-inner">
            <Typography className="font-semibold text-red-800">
              RH Leave Balance: {remainingRH} / {RH_QUOTA}
            </Typography>
            <Button
              size="sm"
              className="inline-flex items-center mt-2 px-4 py-1.5 
  text-white rounded-lg shadow-md 
  bg-gradient-to-r from-green-600 via-green-700 to-green-900 
  hover:scale-105 transition duration-300"
              onClick={() => setOpenLeaveHistory(true)}
            >
              View Leave History
            </Button>
          </div>
          <Dialog
            open={openSwipeDialog}
            handler={() => setOpenSwipeDialog(false)}
            size="md"
          >
            <DialogBody className="space-y-3 max-h-[70vh] overflow-y-auto">
              <Typography variant="h5" className="text-center mb-3">
                Swipe History
              </Typography>

              {swipeHistory.length === 0 && (
                <p className="text-center text-gray-500">
                  No swipe history available
                </p>
              )}

              {swipeHistory.map((entry, index) => (
                <div
                  key={index}
                  className="relative border rounded-lg p-3 bg-orange-50 shadow-sm text-sm space-y-1"
                >
                  {/* ✅ index is available here */}
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
                </div>
              ))}
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
          <Dialog
            open={openHolidayDialog}
            handler={() => setOpenHolidayDialog(false)}
            size="md"
          >
            <DialogBody className="space-y-3 max-h-[70vh] overflow-y-auto">
              <Typography variant="h5" className="mb-3 text-center">
                All Holidays
              </Typography>

              {upcomingHolidays.slice(0, 3).map((holiday, index) => {
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
              <Button
                color="orange"
                onClick={() => setOpenHolidayDialog(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </Dialog>
          {upcomingHolidays.slice(0, 5).map((holiday, index) => {
            const alreadyApplied = leaveRequests.some(
              (l) => l.date === holiday.date && l.status !== "Cancelled",
            );

            return (
              <div
                key={index}
                className="border-b pb-3 flex justify-between items-center"
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
                    disabled={alreadyApplied || remainingRH <= 0}
                    onClick={() => handleApplyLeave(holiday)}
                    className={`inline-flex items-center px-4 py-2 rounded-lg text-white shadow-md 
  transition duration-300 hover:scale-105
  ${
    alreadyApplied || remainingRH <= 0
      ? "bg-gray-400 cursor-not-allowed"
      : "bg-gradient-to-r from-orange-600 via-orange-700 to-orange-900"
  }`}
                  >
                    {alreadyApplied
                      ? "Applied"
                      : remainingRH <= 0
                        ? "Quota Full"
                        : "Apply Leave"}
                  </Button>
                )}
              </div>
            );
          })}
        </Card>
      </div>

      {/* Leave History Modal */}
      <Dialog
        open={openLeaveHistory}
        handler={() => setOpenLeaveHistory(false)}
        size="md"
      >
        <DialogBody className="space-y-4 max-h-[70vh] overflow-y-auto">
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
                className="border p-1 rounded-lg bg-orange-50 shadow-sm flex justify-between items-center gap-2"
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
                  <Button
                    size="sm"
                    color="red"
                    onClick={() => handleCancelLeave(leave.id)}
                  >
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

      {/* 📅 APPOINTMENTS HISTORY SECTION */}
      {appointments.length > 0 && (
        <Card className="mb-6 p-4 sm:p-6 bg-gradient-to-r from-blue-50 to-purple-50 shadow-lg border border-blue-200">
          <div className="flex items-center justify-between mb-4">
            <Typography variant="h5" className="font-bold text-blue-900 flex items-center gap-2">
              📅 APPOINTMENTS HISTORY
              <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm">
                {appointments.length}
              </span>
            </Typography>
            <Button
              size="sm"
              className="bg-gradient-to-r from-blue-600 via-blue-700 to-blue-900 text-white hover:scale-105 transition"
              onClick={() => navigate("/AppointmentHistory")}
            >
              View All →
            </Button>
          </div>

          {/* Recent Appointments Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-blue-300 bg-blue-100">
                  <th className="px-3 py-2 text-left text-blue-900 font-semibold">Sl No</th>
                  <th className="px-3 py-2 text-left text-blue-900 font-semibold">Patient Name</th>
                  <th className="px-3 py-2 text-left text-blue-900 font-semibold">Date</th>
                  <th className="px-3 py-2 text-left text-blue-900 font-semibold">Time</th>
                  <th className="px-3 py-2 text-left text-blue-900 font-semibold">Doctor</th>
                  <th className="px-3 py-2 text-left text-blue-900 font-semibold">Department</th>
                  <th className="px-3 py-2 text-center text-blue-900 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {appointments.slice(0, 5).map((apt, index) => {
                  // Get patient name from various possible field names
                  const patientName = apt.firstName || apt.patientName || apt.name || "N/A";
                  const patientLastName = apt.lastName || "";
                  const fullName = `${patientName} ${patientLastName}`.trim();
                  
                  return (
                  <tr
                    key={index}
                    className={`border-b border-blue-200 hover:bg-blue-50 transition ${getAppointmentStatus(apt) === "Completed" ? "bg-gray-200" : ""}`}
                  >
                    <td className="px-3 py-2 text-gray-700">{index + 1}</td>
                    <td className="px-3 py-2 font-medium text-gray-800">
                      {fullName || "Unknown Patient"}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {apt.date ? new Date(apt.date).toLocaleDateString("en-GB") : "N/A"}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{apt.time || "N/A"}</td>
                    <td className="px-3 py-2 text-gray-700">{apt.doctor || "N/A"}</td>
                    <td className="px-3 py-2 text-gray-700">{apt.department || "N/A"}</td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          getAppointmentStatus(apt) === "Completed"
                            ? "bg-gray-600 text-white"
                            : "bg-green-600 text-white"
                        }`}
                      >
                        {getAppointmentStatus(apt)}
                      </span>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {appointments.length > 5 && (
            <div className="mt-4 text-center">
              <Button
                variant="text"
                color="blue"
                onClick={() => navigate("/AppointmentHistory")}
                className="text-blue-600 hover:text-blue-800 font-semibold"
              >
                View All {appointments.length} Appointments →
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Delete Selected */}
      {selectedDoctors.length > 0 && (
        <div className="mt-4 flex justify-end">
          <Button color="red" onClick={deleteSelectedDoctors}>
            <AiOutlineDelete size={20} className="mr-1" /> Delete (
            {selectedDoctors.length})
          </Button>
        </div>
      )}

      {/* View Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4 mt-6">
        {/* Left Side */}
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <Typography
            variant="h4"
            color="orange-gray"
            className="text-xl sm:text-2xl font-semibold"
          >
            Dentist List
          </Typography>

          {/* Search Box */}
          <input
            type="text"
            placeholder="Search Doctor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>

        {/* Right Side Controls */}
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
      {/* Add DENTIST Button */}
      <div className="flex justify-center sm:justify-end mb-4">
        <Button
          className="inline-flex items-center px-6 sm:px-10 py-2 text-sm sm:text-lg 
    text-white rounded-lg shadow-md 
    bg-gradient-to-r from-orange-600 via-orange-700 to-orange-900 
    hover:scale-105 transition duration-300"
          onClick={() => navigate("/AddDoctor")}
        >
          + ADD NEW DENTIST
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
                  className={`p-1 flex relative border min-h-[170px]
          ${
          selectedDoctors.includes(realIndex)
            ? "border-red-100 bg-red-100"
            : "border-white bg-blue-100 shadow-md"
          }
          ${
          gridView
            ? "flex-col items-center text-center justify-between"
            : "flex-row items-center gap-3"
          }`}
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
                          ? "w-24 h-24 sm:w-28 sm:h-28"
                          : "w-20 h-20 sm:w-24 sm:h-24"
                      } object-cover border-2 border-orange-100 mb-2 cursor-pointer rounded-lg transition-transform duration-200 hover:scale-105 hover:shadow-xl`}
                      onClick={() => setViewDoctor(doc)}
                    />
                  )}

                  <div className="flex-1 w-full flex flex-col items-start text-left space-y-1 text-black">
                  <Typography
                    variant="h3"
                    className="font-semibold text-sm sm:text-base"
                  >
                    <div className="flex items-center gap-1">
                    <FaUserMd color="blue" /> :
                    <span>
                      {doc.firstName} {doc.lastName}
                    </span>
                    </div>{" "}
                  </Typography>

                  {doc.phone && (
                    <Typography className="text-xs sm:text-sm flex items-center gap-1">
                    <span className="flex items-center gap-1 font-medium">
                      <MdOutlinePhoneIphone color="blue" />:
                    </span>

                    <a
                      href={`tel:${doc.phone}`}
                      className="text-black hover:underline"
                    >
                      {doc.phone}
                    </a>
                    </Typography>
                  )}

                  {doc.email && (
                    <Typography className="text-xs sm:text-sm flex items-center gap-1 break-all">
                    <span className="flex items-center gap-1 font-medium">
                      <MdOutlineEmail color="blue" />:
                    </span>

                    <a
                      href={`mailto:${doc.email}`}
                      className="text-black hover:underline"
                    >
                      {doc.email}
                    </a>
                    </Typography>
                  )}
                  {/* appointments */}
                  <div className="w-full mt-2 bg-gray-50 border rounded-xl shadow-sm overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 border-b">
                    <div className="w-8 h-8 flex items-center justify-center rounded-md bg-gray-200">
                      📅
                    </div>
                    <p className="font-semibold text-gray-800">
                      Scheduled Appointments
                    </p>
                    </div>

                    {/* Body */}
                    {!doc?.appointments || doc.appointments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 px-4 text-center">
                      <div className="w-12 h-12 rounded-full bg-pink-100 flex items-center justify-center mb-3">
                      <span className="text-pink-500 text-lg">✔</span>
                      </div>

                      <p className="text-gray-800 font-medium">
                      All caught up
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                      No appointments right now, we'll notify you when
                      there's something new.
                      </p>
                    </div>
                    ) : (
                    <div className="p-3 space-y-3">
                      {doc.appointments.map((appt, i) => (
                      <div
                        key={i}
                        className="border rounded-lg p-3 bg-white shadow-sm space-y-2"
                      >
                        {/* Top */}
                        <div className="flex justify-between items-start">
                        <div>
                          <p className="text-[11px] text-orange-900">
                          Booked on:{" "}
                          {appt?.date
                            ? new Date(appt.date).toLocaleDateString(
                              "en-GB",
                              {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              },
                            )
                            : "Not available"}
                          </p>

                          <p className="font-semibold text-gray-800 flex items-center gap-1">
                          <FaUserNurse />
                          <span>
                            {appt?.patientName || "Patient"}
                          </span>
                          </p>
                        </div>

                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                          getAppointmentStatus(appt) === "Completed"
                            ? "bg-gray-600 text-white"
                            : "bg-green-700 text-green-100"
                          }`}
                        >
                          {getAppointmentStatus(appt)}
                        </span>
                        </div>

                        {/* Details */}
                        <p className="text-sm text-gray-600 flex items-center gap-1">
                        <SlCalender />
                        <span>
                          {getDayLabel(appt?.date) && (
                          <span className="text-green-600 font-semibold mr-1">
                            {getDayLabel(appt?.date)} •
                          </span>
                          )}
                          {appt?.date || "N/A"} • {appt?.time || ""}
                        </span>
                        </p>

                        <p className="text-xs text-gray-500 mt-1">
                        {appt?.type || "General"}
                        </p>

                        {/* Amount */}
                        {appt?.amount && (
                        <p className="text-sm font-medium text-gray-700">
                          ₹{appt.amount}
                        </p>
                        )}

                        {/* ✅ Join Button (SAFE) */}
                        {appt?.consultationType === "ONLINE" && appt?.meetingUrl && (
                          getAppointmentStatus(appt) === "Completed" ? (
                            <span className="text-xs px-3 py-1 bg-gray-400 text-white rounded-md">Completed</span>
                          ) : (
                            <button
                              onClick={() =>
                                window.open(
                                  appt.meetingUrl.startsWith("http")
                                    ? appt.meetingUrl
                                    : `https://${appt.meetingUrl}`,
                                  "_blank"
                                )
                              }
                              className="text-xs px-3 py-1 bg-green-500 text-white rounded-md"
                            >
                              ▶ Join Call
                            </button>
                          )
                        )}

                        {/* Notes */}
                        {appt?.notes && (
                        <p className="text-xs text-gray-400">
                          Notes: {appt.notes}
                        </p>
                        )}
                        <Dialog
                        open={openAllAppointments}
                        handler={() => setOpenAllAppointments(false)}
                        size="lg"
                        >
                        <DialogBody className="max-h-[70vh] overflow-y-auto">
                          <Typography
                          variant="h5"
                          className="text-center mb-4"
                          >
                          All Appointments
                          </Typography>

                          {sortedAppointments.length === 0 ? (
                          <p className="text-center text-gray-500">
                            No appointments available
                          </p>
                          ) : (
                          <div className="space-y-3">
                            {sortedAppointments.map((appt, i) => (
                            <div
                              key={i}
                              className="border rounded-lg p-3 bg-white shadow-sm"
                            >
                              <div className="flex justify-between">
                              <div>
                                <p className="font-semibold text-gray-800">
                                {appt.patientName || "Patient"}
                                </p>
                                <p className="text-sm text-gray-500">
                                Doctor: {appt.doctorName}
                                </p>
                              </div>

                              <span
                                className={`text-xs px-2 py-1 rounded-full ${
                                getAppointmentStatus(appt) ===
                                "Completed"
                                  ? "bg-gray-500 text-white"
                                  : "bg-green-600 text-white"
                                }`}
                              >
                                {getAppointmentStatus(appt)}
                              </span>
                              </div>

                              <p className="text-sm mt-2">
                              📅 {appt.date || "N/A"} •{" "}
                              {appt.time || ""}
                              </p>

                              {appt.amount && (
                              <p className="text-sm font-medium">
                                ₹{appt.amount}
                              </p>
                              )}

                              {appt.notes && (
                              <p className="text-xs text-gray-500">
                                Notes: {appt.notes}
                              </p>
                              )}
                            </div>
                            ))}
                          </div>
                          )}
                        </DialogBody>

                        <DialogFooter>
                          <Button
                          color="red"
                          onClick={() =>
                            setOpenAllAppointments(false)
                          }
                          >
                          Close
                          </Button>
                        </DialogFooter>
                        </Dialog>
                      </div>
                      ))}
                    </div>
                    )}
                  </div>
                  </div>

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

      {/* Swipe Details Modal */}
      <Dialog
        open={openSwipeModal}
        handler={() => setOpenSwipeModal(false)}
        size="lg"
      >
        <DialogBody>
          <div className="space-y-4 text-gray-900">
            <h2 className="text-xl font-semibold mb-2">Swipe History</h2>

            {swipeHistory.length > 0 && (
              <div className="p-1 rounded-lg bg-orange-50 border-l-4 border-orange-400 shadow-sm">
                <p className="font-semibold text-orange-700">Last Sign In:</p>
                <p>
                  {new Date(
                    swipeHistory[swipeHistory.length - 1].signIn,
                  ).toLocaleDateString()}
                </p>
                <p>
                  {new Date(
                    swipeHistory[swipeHistory.length - 1].signIn,
                  ).toLocaleTimeString()}
                </p>
              </div>
            )}

            {swipeHistory.length === 0 ? (
              <p>No swipes recorded yet.</p>
            ) : (
              swipeHistory.map((entry, idx) => (
                <div
                  key={idx}
                  className="border p-1 rounded-lg bg-gray-50 shadow-sm text-sm sm:text-base"
                >
                  <p>
                    <span className="font-bold">Date:</span>{" "}
                    {new Date(entry.signIn).toLocaleDateString()}
                  </p>
                  <p>
                    <span className="font-bold">Sign In:</span>{" "}
                    {new Date(entry.signIn).toLocaleTimeString()}
                  </p>
                  <p>
                    <span className="font-bold">Location:</span>{" "}
                    {entry.location || "Office"}
                  </p>

                  <p>
                    <span className="font-bold">Reason:</span>{" "}
                    {entry.reason || "-"}
                  </p>
                  <p>
                    <span className="font-bold">Sign Out:</span>{" "}
                    {entry.signOut
                      ? new Date(entry.signOut).toLocaleTimeString()
                      : "-"}
                  </p>
                </div>
              ))
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button color="orange" onClick={() => setOpenSwipeModal(false)}>
            Close
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Confirm Action Modal */}
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

      {editIndex !== null && (
        <Dialog open={true} handler={() => setEditIndex(null)}>
          <DialogBody className="space-y-3">
            <Typography variant="h6">Edit Doctor</Typography>

            {/* Image Preview */}
            {editDoctor.image && (
              <img
                src={editDoctor.image}
                alt="Doctor"
                className="w-24 h-24 object-cover rounded-lg border"
              />
            )}

            {/* Upload Image */}
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

            {/* First Name */}
            <input
              type="text"
              placeholder="First Name"
              value={editDoctor.firstName || ""}
              onChange={(e) =>
                setEditDoctor({ ...editDoctor, firstName: e.target.value })
              }
              className="w-full border px-3 py-2 rounded"
            />

            {/* Last Name */}
            <input
              type="text"
              placeholder="Last Name"
              value={editDoctor.lastName || ""}
              onChange={(e) =>
                setEditDoctor({ ...editDoctor, lastName: e.target.value })
              }
              className="w-full border px-3 py-2 rounded"
            />

            {/* Phone */}
            <input
              type="tel"
              placeholder="Phone Number"
              value={editDoctor.phone || ""}
              onChange={(e) =>
                setEditDoctor({ ...editDoctor, phone: e.target.value })
              }
              className="w-full border px-3 py-2 rounded"
            />

            {/* Email */}
            <input
              type="email"
              placeholder="Email ID"
              value={editDoctor.email || ""}
              onChange={(e) =>
                setEditDoctor({ ...editDoctor, email: e.target.value })
              }
              className="w-full border px-3 py-2 rounded"
            />
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

      {/* Session Expired Modal */}
      <Dialog open={sessionExpired} handler={() => {}}>
        <DialogBody className="text-center">
          <Typography variant="h5" className="mb-2">
            Session Expired ⏰
          </Typography>
          <Typography className="text-sm sm:text-base">
            Your session has exceeded 5 minutes. Please Close the modal to
            continue.
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

          {/* Reason Input */}
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
            title={!workLocation ? "Please select location" : ""}
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
  );
}

export default DoctorList;
