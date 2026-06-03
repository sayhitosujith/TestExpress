import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";

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
import { FaUserMd } from "react-icons/fa";
import { AiOutlineDelete } from "react-icons/ai";
import {
  MdOutlineFestival,
} from "react-icons/md";
import { FaFlag, FaSun, FaMoon, FaStar, FaChurch } from "react-icons/fa";
import { MdOutlinePhoneIphone, MdOutlineEmail } from "react-icons/md";
import { GiPartyPopper, GiRam } from "react-icons/gi";

// Styles
import "./DoctorList.css";

function DoctorList() {
  const navigate = useNavigate();
const [appointments, setAppointments] = useState([]);
  // ==================== State Variables ====================
  const [doctors, setDoctors] = useState([]);
  const [editIndex, setEditIndex] = useState(null);
  const [editDoctor, setEditDoctor] = useState({});
  const [gridView, setGridView] = useState(true);
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
  const getAppointmentStatus = (appt) => {
    if (appt?.status) {
      const s = appt.status.toUpperCase();
      if (["CANCELLED", "PAID", "PENDING", "COMPLETED"].includes(s)) return s;
      if (s === "UPCOMING") return "PENDING";
      return s;
    }
    if (appt?.paid || appt?.isPaid) return "PAID";
    if (!appt?.date) return "PENDING";
    const today = new Date();
    const apptDate = new Date(appt.date);
    today.setHours(0, 0, 0, 0);
    apptDate.setHours(0, 0, 0, 0);
    if (apptDate < today) return "COMPLETED";
    return "PENDING";
  };

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
    updated[editIndex] = editDoctor;
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

  const handlePrevPage = () => setCurrentPage((p) => Math.max(p - 1, 1));
  const handleNextPage = () =>
    setCurrentPage((p) => Math.min(p + 1, totalPages));

  const allAppointments = useMemo(() => {
    return doctors.flatMap((doc) =>
      (doc.appointments || []).map((appt) => ({
        ...appt,
        doctorName: `${doc.firstName || ""} ${doc.lastName || ""}`,
        doctorId: doc.id,
      })),
    );
  }, [doctors]);

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
    <div className="p-4 sm:p-6 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
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
      <Card className="p-4 sm:p-6 shadow-lg border border-gray-200 mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 mb-4">
          <div className="flex items-center gap-3">
            <Typography
              variant="h5"
              className="text-xl sm:text-2xl font-semibold"
            >
              Dentist List
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
                    className={`p-3 flex relative border min-h-[280px] ${
                      selectedDoctors.includes(realIndex)
                        ? "border-red-100 bg-red-100"
                        : "border-white bg-blue-100 shadow-md"
                    } ${
                      gridView
                        ? "flex-col items-center text-center justify-between"
                        : "flex-row items-start gap-3"
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
                      />
                    )}

                    {/* Doctor Details */}
                    <div className="flex-1 w-full flex flex-col items-start text-left space-y-1 text-black">
                      <Typography
                        variant="h3"
                        className="font-semibold text-sm sm:text-base"
                      >
                        <div className="flex items-center gap-1">
                          <FaUserMd color="blue" />:
                          <span>
                            {doc.firstName} {doc.lastName}
                          </span>
                        </div>
                      </Typography>

                      {doc.phone && (
                        <Typography className="text-xs sm:text-sm flex items-center gap-1 break-all">
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

                      {/* Appointments Card */}
                      {doc.appointments && doc.appointments.length > 0 && (
                        <div className="w-full mt-2 bg-gray-50 border rounded-lg shadow-sm overflow-hidden text-xs">
                          <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 border-b">
                            <span className="text-sm">📅</span>
                            <p className="font-semibold text-gray-800 text-xs">
                              Appointments ({doc.appointments.length})
                            </p>
                          </div>
                          <div className="p-1 max-h-32 overflow-y-auto">
                            {doc.appointments.slice(0, 2).map((appt, i) => (
                              <div
                                key={i}
                                className="text-[10px] p-1 mb-1 bg-white border rounded"
                              >
                                <p className="font-semibold text-gray-700">
                                  {appt?.patientName || "Patient"}
                                </p>
                                <p className="text-gray-600">
                                  {appt?.date || "N/A"}
                                </p>
                                <span
                                  className={`inline-block text-[9px] px-1 py-0 rounded ${
                                    getAppointmentStatus(appt) === "COMPLETED"
                                      ? "bg-gray-400 text-white"
                                      : "bg-green-400 text-white"
                                  }`}
                                >
                                  {getAppointmentStatus(appt)}
                                </span>
                              </div>
                            ))}
                            {doc.appointments.length > 2 && (
                              <p className="text-[10px] text-gray-500 text-center pt-1">
                                +{doc.appointments.length - 2} more
                              </p>
                            )}
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
        <DialogBody className="space-y-3 max-h-[70vh] overflow-y-auto">
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
        <DialogBody className="space-y-3 max-h-[70vh] overflow-y-auto">
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
  );
}

export default DoctorList;
