import { useEffect, useState, useMemo } from "react";
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
import { FaUserMd } from "react-icons/fa";
import { AiOutlineDelete } from "react-icons/ai";
import {
  MdOutlineFestival,
} from "react-icons/md";
import { FaFlag, FaSun, FaMoon, FaStar, FaChurch } from "react-icons/fa";
import { MdOutlinePhoneIphone, MdOutlineEmail } from "react-icons/md";
import { GiPartyPopper, GiRam } from "react-icons/gi";
import {
  MdOutlineEditNote,
  MdOutlineSettings,
  MdOutlinePowerSettingsNew,
} from "react-icons/md";
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
      icon: ,
    },
    {
      date: "3 Jan 2026",
      day: "Saturday",
      name: "Hazrat Ali's Birthday",
      type: "RH",
      icon: ,
    },
    {
      date: "14 Jan 2026",
      day: "Wednesday",
      name: "Makar Sankranti / Pongal",
      type: "RH",
      icon: ,
    },
    {
      date: "23 Jan 2026",
      day: "Friday",
      name: "Vasant Panchami",
      type: "RH",
      icon: ,
    },
    {
      date: "26 Jan 2026",
      day: "Monday",
      name: "Republic Day",
      type: "NH",
      icon: ,
    },
    {
      date: "15 Feb 2026",
      day: "Sunday",
      name: "Maha Shivaratri",
      type: "RH",
      icon: ,
    },
    {
      date: "4 Mar 2026",
      day: "Wednesday",
      name: "Holi",
      type: "NH",
      icon: ,
    },
    {
      date: "21 Mar 2026",
      day: "Saturday",
      name: "Eid-ul-Fitr (Tentative)",
      type: "RH",
      icon: ,
    },
    {
      date: "26 Mar 2026",
      day: "Thursday",
      name: "Ram Navami",
      type: "RH",
      icon: ,
    },
    {
      date: "31 Mar 2026",
      day: "Tuesday",
      name: "Mahavir Jayanti",
      type: "RH",
      icon: ,
    },
    {
      date: "3 Apr 2026",
      day: "Friday",
      name: "Good Friday",
      type: "NH",
      icon: ,
    },
    {
      date: "1 May 2026",
      day: "Friday",
      name: "Labour Day / Buddha Purnima",
      type: "NH",
      icon: ,
    },
    {
      date: "27 May 2026",
      day: "Wednesday",
      name: "Eid-ul-Zuha (Bakrid) (Tentative)",
      type: "RH",
      icon: ,
    },
    {
      date: "26 Jun 2026",
      day: "Friday",
      name: "Muharram (Tentative)",
      type: "RH",
      icon: ,
    },
    {
      date: "15 Aug 2026",
      day: "Saturday",
      name: "Independence Day",
      type: "NH",
      icon: ,
    },
    {
      date: "26 Aug 2026",
      day: "Wednesday",
      name: "Milad-un-Nabi (Tentative)",
      type: "RH",
      icon: ,
    },
    {
      date: "4 Sep 2026",
      day: "Friday",
      name: "Janmashtami",
      type: "RH",
      icon: ,
    },
    {
      date: "2 Oct 2026",
      day: "Friday",
      name: "Gandhi Jayanti",
      type: "NH",
      icon: ,
    },
    {
      date: "20 Oct 2026",
      day: "Tuesday",
      name: "Dussehra",
      type: "RH",
      icon: ,
    },
    {
      date: "8 Nov 2026",
      day: "Sunday",
      name: "Diwali",
      type: "NH",
      icon: ,
    },
    {
      date: "24 Nov 2026",
      day: "Tuesday",
      name: "Guru Nanak Jayanti",
      type: "RH",
      icon: ,
    },
    {
      date: "25 Dec 2026",
      day: "Friday",
      name: "Christmas",
      type: "NH",
      icon: ,
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

  const handleSignOut = () => {
    if (window.confirm("Are you sure you want to sign out?")) {
      localStorage.removeItem("isLoggedIn");
      localStorage.removeItem("loginTime");
      localStorage.removeItem("loggedInUser");
      setIsLoggedIn(false);
      setSuccessMsg("Signed out successfully!");
      setTimeout(() => {
        navigate("/Welcome");
      }, 1500);
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
const handleToggle = (id, value) => {
  setDoctors((prev) =>
    prev.map((doc) =>
      doc.id === id
        ? { ...doc, isActive: value }
        : doc
    )
  );
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
    
      {/* Left Navigation Bar */}
      
        {/* Logo and Navigation */}
        
          
            
          

          
             navigate("/Welcome")}
              className="w-full text-left px-4 py-2 rounded-lg text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition duration-200 flex items-center gap-3"
            >
              🏠
              Dashboard
            

             navigate("/DoctorList")}
              className="w-full text-left px-4 py-2 rounded-lg bg-orange-50 text-orange-600 font-medium transition duration-200 flex items-center gap-3"
            >
              👨‍⚕️
              Doctors
            

             navigate("/PatientPortal")}
              className="w-full text-left px-4 py-2 rounded-lg text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition duration-200 flex items-center gap-3"
            >
              👤
              Patients
            

             navigate("/BookAppointment")}
              className="w-full text-left px-4 py-2 rounded-lg text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition duration-200 flex items-center gap-3"
            >
              📅
              Appointments
            

             navigate("/BillingDetails")}
              className="w-full text-left px-4 py-2 rounded-lg text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition duration-200 flex items-center gap-3"
            >
              💳
              Billing
            

             navigate("/Settings")}
              className="w-full text-left px-4 py-2 rounded-lg text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition duration-200 flex items-center gap-3"
            >
              ⚙️
              Settings
            

             navigate("/Contact_us")}
              className="w-full text-left px-4 py-2 rounded-lg text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition duration-200 flex items-center gap-3"
            >
              📞
              Contact
            
          
        

        {/* Sign Out Button */}
         navigate("/Logout")}
                      className="flex items-center gap-2 w-full px-4 py-3 text-red-600 hover:bg-red-50"
                    >
                       Logout
                    

        {/* User Profile Section */}
        
          
            
              {user.initials}
            
            
              
                {user.name}
              
              
                {user.email}
              
            
          
        
      

      {/* Main Content Area */}
      
      {/* Success Message */}
      {successMsg && (
        
          {successMsg}
        
      )}

      {/* Top Cards */}
      
        {/* Greeting Card */}
        
          
            
              {user.initials}
            
            
              
                {getGreeting()}, {user.name}
              
              
                {user.email}
              
            
          
        

        {/* Time & Shift Card */}
        
          
            Time & Shift
          
          
            
              {`Monday-Friday | ${shiftObj.type}`}
            
            
              {`${shiftObj.start} – ${shiftObj.end}`}
            
          
          
            {currentTime} - {currentDay}
          
          
            Timezone: {timeZoneLabel}
          
          
             setOpenSwipeDialog(true)}
            >
              View Swipes
            
            
              {isLoggedIn ? "Sign Out" : "Sign In"}
            
          
        

        {/* Holidays Card */}
        
          
            Holidays
            
              {upcomingHolidays.length}
            
          
          
            
              RH Leave: {remainingRH} / {RH_QUOTA}
            
          
          
             setOpenHolidayDialog(true)}
            >
              View All Holidays
            
             setOpenLeaveHistory(true)}
            >
              Leave History
            
          
        
      

      {/* Doctor List Section */}
      
        
          
            
              Dentists
            

             setSearchTerm(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          

          
             setGridView(false)}
              className="flex items-center gap-2"
            >
              
            

             setGridView(true)}
              className="flex items-center gap-2"
            >
              
            
          
        

        
           navigate("/AddDoctor")}
          >
            + ADD DENTIST
          
        

        {/* Doctors Display */}
        {doctors.length === 0 ? (
          No Dentist added yet.
        ) : (
          <>
            
              {currentDoctors.map((doc, index) => {
                const realIndex = indexOfFirstDoctor + index;
                return (
                  
                     toggleDoctorSelect(realIndex)}
                    />

                    {/* Doctor Image */}
                    {doc.image && (
                      
                    )}

{/* Doctor Details */}


  {/* Doctor Name */}
  
    
    
      {doc.firstName} {doc.lastName}
    
  

  {/* Specialization */}
  {doc.specialization && (
    
      {doc.specialization}
    
  )}

  {/* Experience + Consultation Fee */}
  
    
      {doc.experience || 0} yrs experience
    

    
      ₹{doc.consultationFee || doc.fees || 0}
    
  

 {/* Available Days */}
{doc.availableDays?.length > 0 && (
  
    
      Available:
    

    
      {doc.availableDays.map((day, i) => (
        
          {day.slice(0, 3)}
        
      ))}
    
  
)}

  {/* Active Status */}
  
  
    Is Active:
  

  
      handleToggle(doc.id, e.target.checked)
    }
    color="green"
  />




  {/* Phone */}
  {doc.phone && (
    
      
      
        {doc.phone}
      
    
  )}

  {/* Email */}
  {doc.email && (
    
      
      
        {doc.email}
      
    
  )}

  {/* Appointments Card */}
  {doc.appointments?.length > 0 && (
    
      
        📅
        
          Appointments ({doc.appointments.length})
        
      

      
        {doc.appointments.slice(0, 2).map((appt, i) => (
          
            
              {appt?.patientName || "Patient"}
            

            
              {appt?.date || "N/A"}
            

            
              {getAppointmentStatus(appt)}
            
          
        ))}

        {doc.appointments.length > 2 && (
          
            +{doc.appointments.length - 2} more
          
        )}
      
    
  )}

                      

                    {/* Action Buttons */}
                    
                       {
                          setEditIndex(realIndex);
                          setEditDoctor(doc);
                        }}
                      >
                        
                      

                      
                          setConfirmAction({
                            open: true,
                            type: "clone",
                            index: realIndex,
                          })
                        }
                      >
                        
                      

                      
                          setConfirmAction({
                            open: true,
                            type: "delete",
                            index: realIndex,
                          })
                        }
                      >
                        
                      
                    
                  
                );
              })}
            

            {/* Pagination */}
            
              
                Prev
              
              
                Page {currentPage} of {totalPages}
              
              
                Next
              
            
          
        )}
      

      {/* ==================== DIALOGS ==================== */}

      {/* Swipe Dialog */}
       setOpenSwipeDialog(false)}
        size="md"
      >
        
          
            Swipe History
          

          {swipeHistory.length === 0 ? (
            No swipe history available
          ) : (
            swipeHistory.map((entry, index) => (
              
                 {
                    if (window.confirm("Delete this swipe record?")) {
                      handleDeleteSwipe(index);
                    }
                  }}
                  className="absolute top-2 right-2 text-red-600 hover:text-red-800"
                >
                  
                

                
                  Date:{" "}
                  {new Date(entry.signIn).toLocaleDateString()}
                
                
                  Sign In:{" "}
                  {new Date(entry.signIn).toLocaleTimeString()}
                
                
                  Sign Out:{" "}
                  {entry.signOut ? (
                    new Date(entry.signOut).toLocaleTimeString()
                  ) : (
                    Not Signed Out
                  )}
                
                
                  Location: {entry.location || "-"}
                
              
            ))
          )}
        

        
           setOpenSwipeDialog(false)}
          >
            Close
          
        
      

      {/* Holiday Dialog */}
       setOpenHolidayDialog(false)}
        size="md"
      >
        
          
            All Holidays
          

          {upcomingHolidays.map((holiday, index) => {
            const alreadyApplied = leaveRequests.some(
              (l) => l.date === holiday.date && l.status !== "Cancelled",
            );

            return (
              
                
                  
                    {holiday.icon} {holiday.date} • {holiday.day}
                  
                  
                    {holiday.name}
                    
                      ({holiday.type})
                    
                  
                

                {holiday.type === "RH" && (
                   handleApplyLeave(holiday)}
                  >
                    {alreadyApplied
                      ? "Applied"
                      : remainingRH <= 0
                        ? "Quota Full"
                        : "Apply"}
                  
                )}
              
            );
          })}
        

        
           setOpenHolidayDialog(false)}>
            Close
          
        
      

      {/* Leave History Dialog */}
       setOpenLeaveHistory(false)}
        size="md"
      >
        
          
            Leave History
          

          {leaveRequests.length === 0 ? (
            
              No leave requests yet.
            
          ) : (
            leaveRequests.map((leave) => (
              
                
                  
                    {leave.date} • {leave.name}
                  
                  
                    Type: {leave.type} | Status:{" "}
                    
                      {leave.status}
                    
                  
                  
                    Applied on: {leave.appliedOn}
                  
                

                {leave.status !== "Cancelled" && (
                   handleCancelLeave(leave.id)}>
                    Cancel
                  
                )}
              
            ))
          )}
        
        
           setOpenLeaveHistory(false)}>
            Close
          
        
      

      {/* Confirm Action Dialog */}
       setConfirmAction({ open: false, type: "", index: null })}
      >
        
          Are you sure you want to {confirmAction.type} this doctor?
        

        
          
              setConfirmAction({ open: false, type: "", index: null })
            }
          >
            Cancel
          

          
            Yes
          
        
      

      {/* Edit Doctor Dialog */}
      {editIndex !== null && (
         setEditIndex(null)}>
          
            Edit Doctor

            {editDoctor.image && (
              
            )}

             {
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

            
                setEditDoctor({ ...editDoctor, firstName: e.target.value })
              }
              className="w-full border px-3 py-2 rounded"
            />

            
                setEditDoctor({ ...editDoctor, lastName: e.target.value })
              }
              className="w-full border px-3 py-2 rounded"
            />

            
                setEditDoctor({ ...editDoctor, phone: e.target.value })
              }
              className="w-full border px-3 py-2 rounded"
            />

            
                setEditDoctor({ ...editDoctor, email: e.target.value })
              }
              className="w-full border px-3 py-2 rounded"
            />
          

          
             setEditIndex(null)}>
              Cancel
            

            
              Save
            
          
        
      )}

      {/* Session Expired Dialog */}
       {}}>
        
          
            Session Expired ⏰
          
          
            Your session will expire in 1 minute. Please Close the modal to continue.
          
        
        
           {
              setSessionExpired(false);
              handleOpen();
            }}
          >
            Close
          
        
      

      {/* Location Modal */}
       setOpenLocationModal(false)}
      >
        
          
            Select Work Location

             setWorkLocation(e.target.value)}
              className="border border-orange-300 rounded-xl px-4 py-2 w-64 shadow-sm focus:ring-2 focus:ring-orange-400"
            >
              Select Location
              🏢 Office
              🏠 Work From Home
              🛠 On Duty
              📍 Client Location
            
          

          
            Enter Reason

             setWorkReason(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          
        

        
           setOpenLocationModal(false)}
          >
            Cancel
          

           {
              setOpenLocationModal(false);
              completeSignAction();
            }}
          >
            Save & Sign In
          
        
      
      
    
  );
}

export default DoctorList;
