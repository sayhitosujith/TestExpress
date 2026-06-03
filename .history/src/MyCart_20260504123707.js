import "./App.css";
import React, { useEffect, useState } from "react";
import { FaLocationDot } from "react-icons/fa6";
import {
  Card,
  CardBody,
  CardFooter,
  Button,
  Textarea,
  Alert,
  Breadcrumbs,
} from "@material-tailwind/react";
import { VscChevronDown } from "react-icons/vsc";
import { useNavigate, useLocation } from "react-router-dom";
import scanner from "./assets/Barcode.jpeg";
import { FiPrinter } from "react-icons/fi";
import { MdOutlineWorkHistory } from "react-icons/md";
import logo from "./assets/Toothx_Logo.png";
import { Link } from "react-router-dom";
import QRCode from "qrcode"; // make sure to `npm install qrcode`
import { IoRocketSharp } from "react-icons/io5";

/* ---------------- CHART IMPORTS ---------------- */
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

/* ---------------- PRICING MAP ---------------- */
const APPOINTMENT_PRICING = {
  Consultation: 500, // base fee (always applied)
  Cleaning: 700,
  Extraction: 1000,
  Whitening: 800,
};

/* ---------------- GST CONFIG ---------------- */
const GST_RATE = 0.18;

function MyCart() {
  const navigate = useNavigate();

  const [success, setSuccess] = useState(false);
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState("success");
  const [editingId, setEditingId] = useState(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  /* ---------------- PAYMENT MODAL STATE ---------------- */
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);

  /* ---------------- PAGINATION STATE ---------------- */
  const ITEMS_PER_PAGE = 5;
  const [currentPage, setCurrentPage] = useState(1);

  /* ---------------- PRINT --------------------------*/
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printAppointment, setPrintAppointment] = useState(null);

  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const phoneFromProfile = params.get("phone");

  /* ---------------- CUSTOMER HOME ---------------- */
  const loggedInUser = JSON.parse(localStorage.getItem("loggedInUser")) || {};
  const customerName = loggedInUser?.name || loggedInUser?.email || "";
  const [errors, setErrors] = useState({});
  const [dentists, setDentists] = useState([]);

  const user = {
    name: customerName,
    initials:
      customerName && customerName !== ""
        ? customerName
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
        : "G",
  };

  const validateAppointment = () => {
    const newErrors = {};

    if (!appointment.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!appointment.phone.trim()) {
      newErrors.phone = "Phone is required";
    } else if (!/^\d{10}$/.test(appointment.phone)) {
      newErrors.phone = "Enter valid 10-digit phone number";
    }

    if (!appointment.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!isValidEmail(appointment.email)) {
      newErrors.email = "Invalid email format";
    }

    if (!appointment.date) {
      newErrors.date = "Date is required";
    }

    if (!appointment.time) {
      newErrors.time = "Time is required";
    }

    if (!appointment.dentist) {
      newErrors.dentist = "Select a dentist";
    }

    if (!appointment.consultationType) {
      newErrors.consultationType = "Select consultation type";
    }

    if (appointment.type.length === 0) {
      newErrors.type = "Select at least one treatment";
    }

    if (appointment.consultationType === "ONLINE" && !appointment.meetingUrl) {
      newErrors.meetingUrl = "Meeting link required for online consultation";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  /* ---------------- STATE ---------------- */
  const [appointment, setAppointment] = useState({
    location: "",
    name: customerName || "",
    phone: "",
    email: "",
    date: "",
    time: "",
    dentist: "",
    consultationType: "",
    meetingUrl: "", // 👈 ADD THIS
    notes: "",
    type: ["Consultation"], // ✅ default selected
  });

  const handleReschedule = (item) => {
    setAppointment({
      ...item,
      date: "",
      time: "",
      status: "Pending",

      // ✅ ensure safe defaults
      type: item.type || ["Consultation"],
      consultationType: item.consultationType || "",
      meetingUrl: item.meetingUrl || "",
    });

    setEditingId(item.id);

    window.scrollTo({ top: 0, behavior: "smooth" });

    setToast("✏️ Reschedule your appointment");
    setToastType("success");
    setTimeout(() => setToast(""), 3000);
  };

  const handleCancelAppointment = (item) => {
    const confirmCancel = window.confirm(
      "Are you sure you want to cancel this appointment?",
    );

    if (!confirmCancel) return;

    // 🔄 Update history state
    const updatedHistory = history.map((appt) =>
      appt.id === item.id
        ? {
            ...appt,
            status: "Cancelled",
            cancelledAt: new Date().toISOString(),
          }
        : appt,
    );

    setHistory(updatedHistory);
    localStorage.setItem("appointmentHistory", JSON.stringify(updatedHistory));

    // 🔄 (Optional) update profile appointments as well
    let appointments = JSON.parse(localStorage.getItem("appointments")) || [];

    appointments = appointments.map((a) => {
      if (String(a.phone).trim() === String(item.phone).trim()) {
        return { ...a, status: "Cancelled" };
      }
      return a;
    });

    localStorage.setItem("appointments", JSON.stringify(appointments));

    console.log("✅ Appointment cancelled:", item);

    // 🔔 Optional toast
    setToast("❌ Appointment Cancelled");
    setToastType("error");

    setTimeout(() => setToast(""), 3000);
  };
  const [selectedTreatment, setSelectedTreatment] = useState("");
  const legends = [
    {
      label: "PAID (UPI Scanner)",
      code: "UPI",
      color: "bg-green-500 text-white",
    },
    {
      label: "PAID (Cash)",
      code: "CASH",
      color: "bg-green-500 text-white",
    },
    { label: "Pending", code: "P", color: "bg-orange-100 text-orange-700" },
    { label: "Cancelled", code: "X", color: "bg-red-100 text-red-700" },
  ];

  const DayType = [
    { label: "Rest Day", code: "R", color: "bg-purple-100 text-purple-700" },
    { label: "Leave", code: "L", color: "bg-pink-100 text-pink-700" },
    { label: "On Duty", code: "OD", color: "bg-orange-100 text-orange-700" },
    { label: "Holiday", code: "H", color: "bg-teal-100 text-teal-700" },
    {
      label: "Status Unknown",
      code: "?",
      color: "bg-orange-100 text-orange-700",
    },
  ];

  const [history, setHistory] = useState(
    JSON.parse(localStorage.getItem("appointmentHistory")) || [],
  );

  const [paidAppointments, setPaidAppointments] = useState(
    JSON.parse(localStorage.getItem("paidAppointments")) || {},
  );

  /* ---------------- HELPERS ---------------- */
  const todayISO = new Date().toISOString().split("T")[0];

  const handleChange = (field, value) =>
    setAppointment({ ...appointment, [field]: value });

  const isValidPhone = (phone) => /^\d{10}$/.test(phone.replace(/\D/g, ""));
  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const isAppointmentComplete = () =>
    appointment.name &&
    appointment.phone &&
    appointment.date &&
    appointment.time &&
    appointment.dentist &&
    appointment.consultationType &&
    appointment.type &&
    appointment.type.length > 0 &&
    (appointment.consultationType !== "ONLINE" || appointment.meetingUrl);

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const d = new Date(dateString);
    return `${String(d.getDate()).padStart(2, "0")}-${String(
      d.getMonth() + 1,
    ).padStart(2, "0")}-${d.getFullYear()}`;
  };

  const getTotalPaid = (types) => {
    if (!types) return APPOINTMENT_PRICING["Consultation"];

    const uniqueTypes = Array.isArray(types) ? [...new Set(types)] : [types];

    let total = 0;

    uniqueTypes.forEach((t) => {
      if (APPOINTMENT_PRICING[t]) {
        total += APPOINTMENT_PRICING[t];
      }
    });

    return total;
  };

  const getTaxBreakdown = (amount) => {
    // Amount is GST inclusive
    const base = amount / (1 + GST_RATE);
    const gst = amount - base;

    return {
      base: base.toFixed(2),
      gst: gst.toFixed(2),
      cgst: (gst / 2).toFixed(2),
      sgst: (gst / 2).toFixed(2),
    };
  };

  /* ---------------- SUBMIT / EDIT ---------------- */
  const handleSubmit = () => {
    if (!validateAppointment()) {
      setToast("❌ Please fix the highlighted fields");
      setToastType("error");
      setTimeout(() => setToast(""), 3000);
      return;
    }
    const cleanedUrl =
      appointment.meetingUrl && !appointment.meetingUrl.startsWith("http")
        ? "https://" + appointment.meetingUrl
        : appointment.meetingUrl;

    let updatedHistory;
    let savedAppointment;

    if (editingId) {
      savedAppointment = {
        ...appointment,
        id: editingId,
        customerName: appointment.name || customerName || "",
        status: appointment.status || "Pending",
        // ✅ ensure all fields are saved
        consultationType: appointment.consultationType,
        meetingUrl: appointment.meetingUrl,
        notes: appointment.notes,
        type: appointment.type || [],
      };
      updatedHistory = history.map((item) =>
        item.id === editingId ? savedAppointment : item,
      );
      setToast("✏️ Appointment updated");
      setToastType("success");
    } else {
      savedAppointment = {
        ...appointment,
        id: Date.now(),
        customerName: appointment.name || customerName || "",
        status: "Pending",
      };
      updatedHistory = [...history, savedAppointment];
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      setToast("✅ Appointment booked successfully");
      setToastType("success");
    }

    localStorage.setItem("appointmentHistory", JSON.stringify(updatedHistory));

    /* SAVE FOR PROFILE PAGE */
    let appointments = JSON.parse(localStorage.getItem("appointments")) || [];

    /* remove null values */
    appointments = appointments.filter(Boolean);

    /* create new appointment record */
    const newAppointment = {
      id: savedAppointment.id,
      phone: String(savedAppointment.phone).trim(),
      date: savedAppointment.date,
      time: savedAppointment.time,
      doctor: savedAppointment.dentist,
      status: "Pending",
    };

    /* remove old appointment of same phone */
    appointments = appointments.filter(
      (a) => String(a.phone).trim() !== String(savedAppointment.phone).trim(),
    );

    /* add new one */
    appointments.push(newAppointment);

    localStorage.setItem("appointments", JSON.stringify(appointments));
    setAppointment({
      location: "",
      name: appointment.name || customerName || "",
      phone: "",
      email: "",
      date: "",
      time: "",
      dentist: "",
      notes: "",
      type: [],
    });

    setTimeout(() => setToast(""), 3000);
  };

  const handleEdit = (item) => {
    setAppointment(item);
    setEditingId(item.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* ---------------- PAYMENT FLOW ---------------- */
  const handlePayment = (app) => {
    setSelectedAppointment(app);
    setShowPaymentModal(true);
  };

  const confirmPayment = (method) => {
    setToast(`💳 Processing ${method} payment...`);
    setToastType("success");

    setTimeout(() => {
      const isSuccess = true; // force success (remove randomness)

      if (!isSuccess) {
        setToast("❌ Payment failed. Please try again.");
        setToastType("error");
        setTimeout(() => setToast(""), 3000);
        return;
      }

      const updatedPaid = {
        ...paidAppointments,
        [selectedAppointment.id]: method,
      };

      setPaidAppointments(updatedPaid);
      localStorage.setItem("paidAppointments", JSON.stringify(updatedPaid));

      // ✅ UPDATED SUCCESS MESSAGE
      setToast(
        `✅ Payment Successful!\n₹${getTotalPaid(
          selectedAppointment.type,
        )} paid via ${method}`,
      );
      setToastType("success");

      setShowPaymentModal(false);
      setSelectedAppointment(null);

      setTimeout(() => setToast(""), 3500);
    }, 1000);
  };

  const doctors = JSON.parse(localStorage.getItem("doctors")) || [];
  useEffect(() => {
    const data = JSON.parse(localStorage.getItem("doctors")) || [];
    console.log("Doctors from storage:", data);
  }, []);
  const filteredDoctors = doctors.filter(
    (d) => d.treatment === selectedTreatment,
  );

  // Load dentists once
  useEffect(() => {
    const storedDentists = JSON.parse(localStorage.getItem("dentists")) || [];
    setDentists(storedDentists);
  }, []);

  // Load patient when phone changes
  useEffect(() => {
    if (!phoneFromProfile) return;

    const profiles = JSON.parse(localStorage.getItem("allProfiles")) || [];

    const patient = profiles.find(
      (p) => String(p.phone).trim() === String(phoneFromProfile).trim(),
    );

    if (patient) {
      const fullName =
        `${patient.firstName || ""} ${patient.lastName || ""}`.trim();

      setAppointment((prev) => ({
        ...prev,
        name: fullName,
        phone: patient.phone || "",
        email: patient.email || "",
      }));
    }
  }, [phoneFromProfile]);

  /* ---------------- CLEAR HISTORY ---------------- */
  const handleClearHistory = () => {
    if (
      !window.confirm("Are you sure you want to clear all appointment history?")
    )
      return;

    setHistory([]);
    setPaidAppointments({});
    localStorage.removeItem("appointmentHistory");
    localStorage.removeItem("paidAppointments");
    setToast("🗑️ Appointment history cleared");
    setToastType("success");
    setTimeout(() => setToast(""), 3000);
  };

  /* ---------------- CANCEL + REFUND ---------------- */
  const canRefund = (app) => Date.now() - app.id <= 60 * 60 * 1000;

  const handleCancel = (app) => {
  if (!window.confirm("Cancel this appointment?")) return;

  const updatedHistory = history.map((a) =>
    a.id == app.id
      ? { ...a, status: "Cancelled", cancelledAt: new Date().toISOString() }
      : a
  );

  setHistory(updatedHistory);
  localStorage.setItem("appointmentHistory", JSON.stringify(updatedHistory));

  // ✅ update appointments properly
  let appointments = JSON.parse(localStorage.getItem("appointments")) || [];

  appointments = appointments.map((a) =>
    a.id == app.id ? { ...a, status: "Cancelled" } : a
  );

  localStorage.setItem("appointments", JSON.stringify(appointments));

  // ✅ remove payment
  if (paidAppointments[app.id]) {
    const updatedPaid = { ...paidAppointments };
    delete updatedPaid[app.id];

    setPaidAppointments(updatedPaid);
    localStorage.setItem("paidAppointments", JSON.stringify(updatedPaid));
  }

  setToast("❌ Appointment Cancelled");
  setToastType("error");

  setTimeout(() => setToast(""), 3000);
};
  /* ---------------- PRINT SINGLE APPOINTMENT ---------------- */
  const handlePrintAppointment = (appointment) => {
    const baseAmount = getTotalPaid(appointment.type);
    const gstAmount = baseAmount * GST_RATE;
const tax = {
  base: baseAmount.toFixed(2),
  gst: gstAmount.toFixed(2),
  cgst: (gstAmount / 2).toFixed(2),
  sgst: (gstAmount / 2).toFixed(2),
};   
 const invoiceNumber = `INV-${Date.now()}`;

    const isPaid = paidAppointments[appointment.id];

    // ✅ Calculate Grand Total
const grandTotal = baseAmount + gstAmount;

    const content = `
      <div style="font-family: Arial, sans-serif; max-width: 700px; margin: auto; padding: 20px; border: 1px solid #ccc;">
        
        <!-- HEADER -->
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
          <div>
            <img src="${logo}" alt="ToothX Logo" style="height: 60px;" />
          </div>
          <div style="text-align: right;">
            <h2 style="margin:0; color:#2F855A;">ToothX</h2>
            <p style="margin:0; font-size:0.85rem; color:#555;">Appointment Invoice</p>
            <p style="margin:0; font-size:0.8rem; color:#555;">Invoice #: ${invoiceNumber}</p>
            <p style="margin:0; font-size:0.8rem; color:#555;">Date: ${formatDate(new Date().toISOString())}</p>
          </div>
        </div>

        <hr style="border:1px dashed #888; margin-bottom: 20px;">

        <!-- CUSTOMER DETAILS -->
        <div style="margin-bottom: 20px;">
          <p><b>Customer:</b> ${appointment.customerName || appointment.name}</p>
          <p><b>Phone:</b> ${appointment.phone || "-"}</p>
          <p><b>Email:</b> ${appointment.email || "-"}</p>
        </div>

        <!-- APPOINTMENT DETAILS TABLE -->
        <table style="width:100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr>
              <th style="border:1px solid #ccc; padding:8px; background:#ffffff;">Date</th>
              <th style="border:1px solid #ccc; padding:8px; background:#ffffff;">Time</th>
              <th style="border:1px solid #ccc; padding:8px; background:#ffffff;">Dentist</th>
              <th style="border:1px solid #ccc; padding:8px; background:#ffffff;">Treatment</th>
              <th style="border:1px solid #ccc; padding:8px; background:#ffffff;">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
  ${
    ["Consultation", ...(Array.isArray(appointment.type) ? appointment.type : [appointment.type])]
      .filter(Boolean)
      .map(
        (t) => `
        <tr>
          <td style="border:1px solid #ccc; padding:8px;">${formatDate(appointment.date)}</td>
          <td style="border:1px solid #ccc; padding:8px;">${appointment.time || "-"}</td>
          <td style="border:1px solid #ccc; padding:8px;">${appointment.dentist || "-"}</td>
          <td style="border:1px solid #ccc; padding:8px;">${t}</td>
          <td style="border:1px solid #ccc; padding:8px; text-align:right;">
            ₹${APPOINTMENT_PRICING[t] || 0}
          </td>
        </tr>
      `
      )
      .join("")
  }
</tbody>
        </table>

        ${
          isPaid
            ? `
              <!-- TAX BREAKDOWN -->
              <table style="width:100%; border-collapse: collapse; margin-bottom: 10px;">
                <thead>
                  <tr>
                    <th style="border:1px solid #ccc; padding:8px; background:#f9f9f9;">Base Amount</th>
                    <th style="border:1px solid #ccc; padding:8px; background:#f9f9f9;">GST (18%)</th>
                    <th style="border:1px solid #ccc; padding:8px; background:#f9f9f9;">CGST</th>
                    <th style="border:1px solid #ccc; padding:8px; background:#f9f9f9;">SGST</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="border:1px solid #ccc; padding:8px; text-align:right;">₹${tax.base}</td>
                    <td style="border:1px solid #ccc; padding:8px; text-align:right;">₹${tax.gst}</td>
                    <td style="border:1px solid #ccc; padding:8px; text-align:right;">₹${tax.cgst}</td>
                    <td style="border:1px solid #ccc; padding:8px; text-align:right;">₹${tax.sgst}</td>
                  </tr>
                </tbody>
              </table>
            `
            : ""
        }

        <!-- GRAND TOTAL -->
        <div style="text-align:right; font-size:1.2rem; font-weight:bold; color:#2F855A; margin-bottom:20px;">
          ${isPaid ? "GRAND TOTAL" : "TOTAL AMOUNT"} : ₹${grandTotal}
        </div>

        ${appointment.notes ? `<p><b>Notes:</b> ${appointment.notes}</p>` : ""}

        <hr style="border:1px dashed #888; margin: 20px 0;">

        <!-- TERMS & CONDITIONS -->
        <div style="border:1px solid #ccc; padding:15px; background:#f9f9f9;">
          <h4 style="text-align:center; color:#2F855A; margin-bottom:10px;">Terms & Conditions</h4>
          <p style="font-size:0.85rem; line-height:1.4; color:#555;">
            1. All appointments must be attended on time.<br>
            2. Cancellations within 24 hours may not be refunded.<br>
            3. Payments made are non-transferable.<br>
            4. Follow all safety and hygiene instructions provided by the clinic.<br>
            5. DutyDentist is not responsible for complicaltions outside its treatment scope.<br>
          </p>
        </div>

        <p style="text-align:center; font-size:0.75rem; color:#888; margin-top:20px;">
          Generated by DutyDentist
        </p>
      </div>
    `;

    const newWin = window.open("", "_blank");
    newWin.document.write(`
      <html>
        <head>
          <title>Invoice ${invoiceNumber}</title>
        </head>
        <body>${content}</body>
      </html>
    `);
    newWin.document.close();
    newWin.print();
  };

  const handleDischargeSummary = (appointment) => {
    const content = `
      <div style="font-family: Arial; max-width:700px; margin:auto; padding:20px; border:1px solid #ccc;">
        
        <!-- HEADER -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
          <img src="${logo}" alt="ToothX Logo" style="height:60px;" />
          <div style="text-align:right;">
            <h2 style="margin:0; color:#EA580C;">ToothX Clinic</h2>
            <p style="margin:0; font-size:12px;">Discharge Summary</p>
          </div>
        </div>

        <hr/>

        <!-- PATIENT DETAILS -->
        <p><b>Patient:</b> ${appointment.customerName || appointment.name}</p>
        <p><b>Date:</b> ${formatDate(appointment.date)}</p>
        <p><b>Dentist:</b> ${appointment.dentist}</p>
        <p><b>Treatment:</b> ${Array.isArray(appointment.type) ? appointment.type.join(", ") : appointment.type || "-"}</p>

        <hr/>

        <!-- SUMMARY -->
        <h3 style="color:#EA580C;">Treatment Summary</h3>
        <p>
          The patient has successfully undergone the planned dental procedure. 
          The treatment was completed without complications and the patient was stable at discharge.
        </p>

        <!-- INSTRUCTIONS -->
        <h3 style="color:#EA580C;">Post-Treatment Instructions</h3>
        <ul>
          <li>Maintain proper oral hygiene by brushing twice daily.</li>
          <li>Avoid consuming very hot or cold foods for the next 24 hours.</li>
          <li>Refrain from chewing on the treated side for at least 24 hours.</li>
          <li>Take prescribed medications as directed by the dentist.</li>
          <li>Avoid smoking or alcohol consumption for at least 48 hours.</li>
          <li>Rinse mouth gently with warm salt water if advised.</li>
          <li>Report immediately in case of severe pain, swelling, or bleeding.</li>
          <li>Follow dietary restrictions if provided during consultation.</li>
          <li>Ensure adequate hydration and rest.</li>
          <li>Schedule and attend follow-up appointments if recommended.</li>
        </ul>

        <!-- SYSTEM GENERATED NOTE -->
        <div style="margin-top:20px; padding:12px; background:#f9f9f9; border:1px dashed #aaa;">
          <p style="font-size:12px; text-align:center; color:#555;">
            This summary is system generated. Hence, no signature is required.
          </p>
        </div>

        <hr/>
        <p style="text-align:center; font-size:12px; color:#888;">
          Generated by ToothX Clinic Management System
        </p>
      </div>
    `;

    const win = window.open("", "_blank");
    if (!win) return;

    win.document.write(`
      <html>
        <head>
          <title>Discharge Summary</title>
        </head>
        <body>${content}</body>
      </html>
    `);
    win.document.close();
    win.print();
  };
  /* ---------------- PRINT FUNCTIONS ---------------- */
  const handlePrintAll = () => {
    const printContent = history
      .map((item, idx) => {
        return `
            <div style="padding: 20px; border: 2px dashed #888; margin-bottom: 15px; font-family: Arial, sans-serif;">
              <h2 style="text-align:center; color:#2F855A;">Appointment Invoice #${
                idx + 1
              }</h2>
              <hr style="border:1px dashed #888; margin: 10px 0;">
              <p><b>Customer:</b> ${item.customerName || item.name || ""}</p>
              <p><b>Date:</b> ${formatDate(item.date)}</p>
              <p><b>Time:</b> ${item.time || "-"}</p>
              <p><b>Dentist:</b> ${item.dentist || "-"}</p>
              <p><b>Type:</b> ${Array.isArray(Array.isArray(item.type) ? item.type.join(", ") : Array.isArray(item.type) ? item.type.join(", ") : item.type) ? item.type.join(", ") : item.type || "-"}</p>
              <p><b>Amount:</b> ₹${getTotalPaid(Array.isArray(item.type) ? item.type.join(", ") : item.type)}</p>
              <p><b>Status:</b> ${
                item.status || (paidAppointments[item.id] ? "Paid" : "Pending")
              }</p>
              <hr style="border:1px dashed #888; margin: 10px 0;">
            </div>
          `;
      })
      .join("");

    const newWin = window.open("", "_blank");
    newWin.document.write(
      `<html><head><title>All Appointments</title></head><body>${printContent}</body></html>`,
    );
    newWin.document.close();
    newWin.print();
  };

  const handleExportRevenuePDF = () => {
    const totalRevenue = Object.values(revenueByDate).reduce(
      (sum, amt) => sum + amt,
      0,
    );

    const content = Object.entries(revenueByDate)
      .map(
        ([date, amount]) => `
          <p><b>${date}:</b> ₹${amount}</p>
        `,
      )
      .join("");

    const html = `
      <div style="font-family: Arial; padding: 20px;">
        <h2 style="text-align:center; color:#2F855A;">Revenue Report</h2>
        <hr />
        
        <p style="font-size: 1.1rem;"><b>Total Revenue:</b> ₹${totalRevenue}</p>
        <hr />

        ${content}

        <hr />
        <p style="text-align:center; font-size:0.9rem;">
          Generated by DutyDentist
        </p>
      </div>
    `;

    const win = window.open("", "_blank");
    win.document.write(`<html><body>${html}</body></html>`);
    win.document.close();
    win.print();
  };

  /* ---------------- REVENUE ---------------- */
  const revenueByDate = history.reduce((acc, item) => {
    if (paidAppointments[item.id]) {
      const date = formatDate(item.date);
      acc[date] = (acc[date] || 0) + getTotalPaid(item.type);
    }
    return acc;
  }, {});

  /* ---------------- TODAY'S REVENUE (FIXED) ---------------- */

  /* ---------------- TODAY'S REVENUE (100% SAFE) ---------------- */

  const todaysRevenue = history.reduce((sum, item) => {
    if (!paidAppointments[item.id] || !item.date) return sum;

    const today = new Date();
    const todayString =
      today.getFullYear() +
      "-" +
      String(today.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(today.getDate()).padStart(2, "0");

    if (item.date === todayString) {
      return sum + Number(getTotalPaid(item.type));
    }

    return sum;
  }, 0);

  const revenueDates = Object.keys(revenueByDate);
  const revenueValues = Object.values(revenueByDate);

  const revenueChartData = {
    labels: revenueDates,
    datasets: [
      {
        label: "Daily Revenue (₹)",
        data: revenueValues,
        backgroundColor: "#38A169",
      },
    ],
  };

  const handleMarkCompleted = (item) => {
  const updatedHistory = history.map((appt) =>
    appt.id === item.id
      ? { ...appt, status: "Completed", completedAt: new Date().toISOString() }
      : appt
  );

  setHistory(updatedHistory);
  localStorage.setItem("appointmentHistory", JSON.stringify(updatedHistory));

  // Optional: update profile appointments
  let appointments = JSON.parse(localStorage.getItem("appointments")) || [];

  appointments = appointments.map((a) => {
    if (String(a.phone).trim() === String(item.phone).trim()) {
      return { ...a, status: "Completed" };
    }
    return a;
  });

  localStorage.setItem("appointments", JSON.stringify(appointments));

  setToast("✅ Appointment marked as Completed");
  setToastType("success");

  setTimeout(() => setToast(""), 3000);
};

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  // ✅ Always include Consultation ONCE
  const selectedTreatments = (appointment.type || []).filter(
    (type) => type !== "Consultation",
  );

  // ✅ Always calculate with Consultation included
  const totalCost = getTotalPaid(["Consultation", ...selectedTreatments]);

  /* ---------------- PAGINATION LOGIC ---------------- */
  const sortedHistory = [...history].sort((a, b) => b.id - a.id);
  const totalPages = Math.ceil(sortedHistory.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentAppointments = sortedHistory.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE,
  );

  /* ====================== UI ====================== */
  return (
    <div className="p-4 relative">
      {/* App Logo */}
      <img
        src={logo}
        alt="App Logo"
        className="absolute top-4 left-4 w-20 md:w-28 h-auto z-20"
      />
      {/* ====================== BREADCRUMBS ====================== */}
      <Breadcrumbs className="mt-20 mb-4">
        <Link to="/HomePage" className="opacity-60 hover:opacity-100">
          Home
        </Link>
        <Link to="/Welcome" className="opacity-60 hover:opacity-100">
          Welcome
        </Link>
        <Link to="/MyCart" className="font-semibold text-black-700">
          My Cart
        </Link>
      </Breadcrumbs>
      {/* Toast */}
      {toast && (
        <div className="fixed top-10 right-10 z-50">
          <div className="bg-orange-600 text-white px-6 py-6 rounded-2xl shadow-2xl w-96 flex items-center gap-4">
            <div className="text-yellow-300 text-5xl">⭐</div>

            <div>
              <p className="text-xl font-extrabold">SUCCESS!</p>
              <p className="text-sm mt-1 whitespace-pre-line">{toast}</p>
            </div>
          </div>
        </div>
      )}
      {/* ================= USER BADGE ================= */}
      <div className="flex justify-end mb-2 relative">
        <button
          onClick={() => setShowProfileMenu((prev) => !prev)}
          className="flex items-center gap-3 px-4 py-2 bg-white text-gray-800 font-semibold rounded-full shadow hover:shadow-md transition"
        >
          <div className="w-10 h-10 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold">
            {user.initials}
          </div>
          <span className="hidden sm:block">{user.name}</span>
          <VscChevronDown
            className={`transition-transform ${
              showProfileMenu ? "rotate-180" : ""
            }`}
          />
        </button>

        {showProfileMenu && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg overflow-hidden z-10">
            <button
              onClick={() => navigate("/NewRegistration")}
              className="block w-full text-left px-4 py-3 hover:bg-gray-100 transition font-medium"
            >
              Edit Profile
            </button>
            <button
              onClick={() => navigate("/Settings")}
              className="block w-full text-left px-4 py-3 hover:bg-gray-100 transition font-medium"
            >
              Settings
            </button>
            <button
              onClick={() => navigate("/Logout")}
              className="block w-full text-left px-4 py-3 hover:bg-red-50 transition font-medium text-red-600"
            >
              Logout
            </button>
          </div>
        )}
      </div>
      {/* ================= FORM ================= */}
      <Card className="max-w-xl mx-auto p-6 shadow-lg rounded-xl">
        <h1 className="text-orange-900 text-xl font-bold text-center">
          🦷 Book Appointment
        </h1>
        <p className="text-sm text-gray-500 text-center mt-1">
          Fill in the patient details to schedule an appointment
        </p>
        <hr className="my-4" />

        <CardBody className="flex flex-col gap-4">
          {/* Location */}
          {/* <div>
            <label className="text-sm font-semibold">Location</label>
            <div className="flex items-center border rounded px-3 py-2 mt-1 bg-white focus-within:ring-2 focus-within:ring-orange-300">
              <FaLocationDot className="mr-2 text-orange-500" />
              <select
                className="w-full outline-none bg-transparent"
                value={appointment.location}
                onChange={(e) => handleChange("location", e.target.value)}
              >
                <option value="">Select location</option>
                <option>Brisbane</option>
                <option>Melbourne</option>
                <option>Sydney</option>
                <option>Adelaide</option>
              </select>
            </div>
          </div> */}

          {/* Name */}
          <input
            value={appointment.name || ""}
            readOnly={phoneFromProfile}
            onChange={(e) =>
              !phoneFromProfile &&
              setAppointment({ ...appointment, name: e.target.value })
            }
            placeholder="Enter Patient name" // <-- watermark / placeholder
            className="border px-3 py-2 rounded w-full text-gray-500"
          />

          {/* Phone */}
          <input
            value={appointment.phone || ""}
            readOnly={phoneFromProfile}
            onChange={(e) => {
              const value = e.target.value;

              // Allow only numbers and max 10 digits
              if (!phoneFromProfile && /^\d{0,10}$/.test(value)) {
                setAppointment({ ...appointment, phone: value });
              }
            }}
            placeholder="Enter Patient Phone Number"
            className="border px-3 py-2 rounded w-full text-gray-500"
          />
          {/* Email */}
          <div>
            <label className="text-sm font-semibold">Email</label>
            <input
              placeholder="example@email.com"
              value={appointment.email}
              onChange={(e) => handleChange("email", e.target.value)}
              className="border px-3 py-2 rounded w-full focus:ring-2 focus:ring-orange-300 outline-none"
            />
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold">
                Select Appointment Date
              </label>
              <input
                type="date"
                value={appointment.date}
                onChange={(e) => handleChange("date", e.target.value)}
                className="border px-3 py-2 rounded w-full focus:ring-2 focus:ring-orange-300 outline-none"
                min={todayISO}
              />
            </div>

            <div>
              <label className="text-sm font-semibold">Select Time Slot</label>
              <select
                value={appointment.time}
                onChange={(e) => handleChange("time", e.target.value)}
                className="border px-3 py-2 rounded w-full focus:ring-2 focus:ring-orange-300 outline-none"
              >
                <option value="">Select time</option>
                <option>9:00 AM - 10:00 AM</option>
                <option>10:00 AM - 11:00 AM</option>
                <option>11:00 AM - 12:00 PM</option>
                <option>12:00 PM - 1:00 PM</option>
                <option>1:00 PM - 2:00 PM</option>
                <option>2:00 PM - 3:00 PM</option>
                <option>3:00 PM - 4:00 PM</option>
                <option>4:00 PM - 5:00 PM</option>
                <option>5:00 PM - 6:00 PM</option>
                <option>6:00 PM - 7:00 PM</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-semibold">Treatment Type</label>

            <select
              multiple
              value={appointment.type || []}
              onChange={(e) => {
                const selectedOptions = Array.from(
                  e.target.selectedOptions,
                  (option) => option.value,
                );
                handleChange("type", selectedOptions);
              }}
              className="border p-2 rounded w-full h-32"
            >
              <option value="Cleaning">Cleaning</option>
              <option value="Extraction">Extraction</option>
              <option value="Whitening">Whitening</option>
            </select>

            {/* Cost Display */}
            <div className="mt-2">
              <ul className="text-sm text-gray-600 mt-1 space-y-1">
                {/* ✅ Always show Consultation ONCE */}
                <li className="bg-orange-100 text-orange-800 font-semibold px-3 py-1 rounded-md border border-orange-300">
                  🩺 Consultation: ₹{APPOINTMENT_PRICING["Consultation"]}
                </li>

                {/* ✅ Show selected treatments */}
                {selectedTreatments.map((type) => (
                  <li key={type}>
                    {type}: ₹{APPOINTMENT_PRICING[type]}
                  </li>
                ))}

                <hr className="my-2 border-orange-300" />

                <p className="text-orange-600 font-bold">
                  Total Cost: ₹{totalCost}
                </p>
                <hr className="my-2 border-orange-300" />

                {/* ✅ Empty state */}
                {selectedTreatments.length === 0 && (
                  <li className="text-gray-400 italic">
                    No additional treatments selected
                  </li>
                )}
              </ul>
            </div>

            {/* Consultation Type */}
            <div>
              <label className="text-sm font-semibold">Consultation Type</label>
              <select
                value={appointment.consultationType}
                onChange={(e) =>
                  handleChange("consultationType", e.target.value)
                }
                className="border px-3 py-2 rounded w-full focus:ring-2 focus:ring-orange-300 outline-none"
              >
                <option value="">Select consultation type</option>
                <option value="ONLINE">ONLINE Consultation</option>
                <option value="OFFLINE">OFFLINE Consultation</option>
              </select>
            </div>

            {/* ONLINE Consultation Fields */}
            {appointment.consultationType === "ONLINE" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                {/* Schedule Label */}
                <div className="col-span-2">
                  <p className="text-sm font-semibold text-orange-600">
                    📅 Schedule ONLINE Appointment
                  </p>
                </div>

                {/* Meeting URL */}
                <div className="col-span-2">
                  <label className="text-sm font-semibold">Meeting URL</label>
                  <input
                    type="url"
                    placeholder="Paste Zoom / Google Meet link"
                    value={appointment.meetingUrl}
                    onChange={(e) => {
                      let url = e.target.value.trim();

                      if (url && !url.startsWith("http")) {
                        url = "https://" + url;
                      }

                      handleChange("meetingUrl", url);
                    }}
                    className="border px-3 py-2 rounded w-full focus:ring-2 focus:ring-orange-300 outline-none"
                  />
                </div>
              </div>
            )}

            {/* Dentist */}
            <div className="flex flex-col gap-1 w-full">
              <label className="text-sm font-semibold text-gray-700">
                Dentist
              </label>

              <select
                value={appointment.dentist}
                onChange={(e) => handleChange("dentist", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg 
             bg-white text-gray-700 shadow-sm
             focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400
             hover:border-orange-300 transition duration-200"
              >
                <option value="">Select dentist</option>

                {doctors.length === 0 ? (
                  <option disabled>No dentists available</option>
                ) : (
                  doctors.map((doc, index) => (
                    <option
                      key={doc.id || index}
                      value={`${doc.firstName} ${doc.lastName}`}
                    >
                      {doc.firstName} {doc.lastName}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="text-sm font-semibold">Symptoms / Notes</label>
              <Textarea
                placeholder="Describe symptoms or special instructions"
                value={appointment.notes}
                onChange={(e) => handleChange("notes", e.target.value)}
              />
            </div>
          </div>
        </CardBody>

        <CardFooter className="flex justify-center pt-2">
          <Button
            onClick={handleSubmit}
            disabled={!isAppointmentComplete()}
            className={`w-full ${
              isAppointmentComplete()
                ? "bg-orange-600 hover:bg-orange-700"
                : "bg-gray-400 cursor-not-allowed"
            }`}
          >
            {editingId ? "UPDATE APPOINTMENT" : "BOOK APPOINTMENT"}
          </Button>
        </CardFooter>

        {success && (
          <Alert className="bg-orange-100 text-orange-800 mt-4 text-center">
            ✅ Appointment booked successfully
          </Alert>
        )}
      </Card>
      {/* ================= REVENUE DASHBOARD ================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <Card className="p-5 bg-purple-50 border border-purple-200 shadow rounded-xl">
          <h3 className="text-purple-700 font-semibold mb-1">
            💰 Total Revenue
          </h3>
          <p className="text-3xl font-bold text-purple-900">
            ₹{" "}
            {Object.values(revenueByDate).reduce(
              (sum, amt) => sum + amt,
              0,
            )}{" "}
          </p>
          <Button
            size="sm"
            className="bg-purple-600 text-white mt-3 w-fit"
            onClick={handleExportRevenuePDF}
          >
            📤 Export Revenue PDF
          </Button>
        </Card>

        <Card className="p-5 shadow rounded-xl">
          <h3 className="text-orange-700 font-semibold mb-2">
            📊 Daily Revenue
          </h3>
          {revenueDates.length === 0 ? (
            <p className="text-sm text-gray-600">No revenue yet.</p>
          ) : (
            <div className="h-48">
              <Bar
                data={revenueChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                }}
              />
            </div>
          )}
        </Card>
      </div>
      NOTE - DAILY REVENUE LIST is Disabled in Backend
      {/* ================= DAILY REVENUE LIST =================
        <Card className="p-6 bg-orange-50 border border-orange-200 shadow rounded-xl mt-8">
          <h3 className="text-orange-700 font-semibold mb-4">💰 Daily Revenue</h3>

          <div className="flex justify-between items-center bg-orange-100 px-4 py-3 rounded mb-4">
            <span className="font-semibold text-orange-800">Total Revenue</span>
            <span className="text-xl font-bold text-orange-900">
              ₹{Object.values(revenueByDate).reduce((sum, amt) => sum + amt, 0)}
            </span>
          </div>

          {Object.keys(revenueByDate).length === 0 ? (
            <p className="text-sm text-gray-600">No revenue recorded yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {Object.entries(revenueByDate).map(([date, amount]) => (
                <div
                  key={date}
                  className="flex justify-between items-center bg-white px-4 py-2 rounded shadow-sm"
                >
                  <span className="font-medium">{date}</span>
                  <span className="font-bold text-orange-700">₹{amount}</span>
                </div>
              ))}
            </div>
          )}
        </Card> */}
      {/* ================= APPOINTMENT HISTORY ================= */}
      <div className="w-full mt-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <IoRocketSharp     size={32} className="text-orange-900" />
            <h2 className="text-xl font-bold text-orange-900">
              APPOINTMENTS HISTORY
            </h2>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              className="bg-gradient-to-r from-orange-600 via-orange-700 to-orange-900 text-white shadow-md hover:scale-105 transition duration-300"
              onClick={handlePrintAll}
            >
              PRINT ALL
            </Button>

            <Button
              size="sm"
              className="bg-gradient-to-r from-orange-600 via-orange-700 to-orange-900 text-white shadow-md hover:scale-105 transition duration-300"
              onClick={handleClearHistory}
            >
              CLEAR HISTORY
            </Button>
          </div>
        </div>

        {currentAppointments.length === 0 ? (
          <p className="text-gray-600">No appointments booked yet.</p>
        ) : (
          currentAppointments.map((item) => {
            let borderColor = "#F6AD55";
            if (item.status === "Cancelled") borderColor = "#E53E3E";
            if (paidAppointments[item.id]) borderColor = "#2F855A";

            return (
              <div
                key={item.id}
                className="p-3 mb-3 relative bg-gradient-to-r from-yellow-100 via-orange-100 to-orange-200 rounded-lg"
              >
                <Card
                  className="p-3 shadow-sm rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center border-l-8 bg-white"
                  style={{ borderLeftColor: borderColor }}
                >
                  {/* LEFT CONTENT */}
                  <div className="flex flex-col gap-1 w-full md:w-2/3 text-sm">
                    <div className="flex justify-between items-center">
                      <p className="text-lg font-semibold">
                        {item.customerName || item.name || ""}
                      </p>

                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          item.status === "Cancelled"
                            ? "bg-red-100 text-red-700"
                            : paidAppointments[item.id]
                              ? "bg-orange-100 text-orange-700"
                              : "bg-orange-100 text-orange-700"
                        }`}
                      >
                        {item.status === "Cancelled"
                          ? "CANCELLED"
                          : paidAppointments[item.id]
                            ? `PAID (${paidAppointments[item.id]})`
                            : "PENDING"}
                      </span>
                    </div>

                    <hr className="my-1 border-gray-200" />
                    <p className="text-xs text-gray-700 leading-tight">
                      <b>Appointment:</b>{" "}
                      {new Date(item.date).toLocaleDateString("en-GB", {
                        weekday: "long",
                        day: "2-digit",
                        month: "long",
                      })}{" "}
                      at{" "}
                      {item.time
                        ? item.time.split(" - ")[0] // take start time from slot
                        : "-"}
                    </p>

                    <p>
                      <b>Appointment Type:</b>{" "}
                      {Array.isArray(item.type)
                        ? item.type.join(", ")
                        : item.type || "-"}
                    </p>

                    <p className="flex items-center gap-2">
                      <b>Consultation Mode:</b>
                      <span
                        className={`px-3 py-1 rounded-full font-semibold shadow transition-all duration-500 animate-pulse 
                          ${item.consultationType === "ONLINE"
                            ? "bg-blue-100 text-blue-700 border border-blue-300"
                            : item.consultationType === "OFFLINE"
                              ? "bg-orange-100 text-orange-700 border border-orange-300"
                              : "bg-gray-100 text-gray-500 border border-gray-300"}
                        `}
                      >
                        {item.consultationType || "-"}
                      </span>
                    </p>

                    {item.consultationType === "ONLINE" && item.meetingUrl && (
                      <p className="text-blue-600 text-sm break-all">
                        <b>Meeting Link:</b>{" "}
                        <a
                          href={item.meetingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {item.meetingUrl}
                        </a>
                      </p>
                    )}

                    <p>
                      <b>Scheduled Dentist:</b> {item.dentist || "-"}
                    </p>

                    <p>
                      <b>Notes:</b> {item.notes || "-"}
                    </p>

                    <p>
                      <b>Amount:</b> ₹{getTotalPaid(item.type)}
                    </p>

                    <Button
                      size="sm"
                      variant="text"
                      className="py-1 px-2 text-xs text-blue-900"
                      onClick={() => toggleExpand(item.id)}
                    >
                      {expandedId === item.id
                        ? "Hide consultation Details ▲"
                        : "View consultation Details ▼"}
                    </Button>

                    {expandedId === item.id && (
                      <>
                        <hr className="my-2 border-gray-200" />

                        <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0 text-xs">
                          {" "}
                          <p>
                            <b>Consultation:</b> {item.consultationType || "-"}
                          </p>
                          {item.consultationType === "ONLINE" && (
                            <div className="col-span-2 space-y-1">
                              <p className="font-semibold text-gray-800">
                                Assessment Appointment
                              </p>

                              <p className="text-sm text-gray-600">
                                {new Date(item.date).toLocaleDateString(
                                  "en-GB",
                                  {
                                    weekday: "long",
                                    day: "2-digit",
                                    month: "long",
                                  },
                                )}{" "}
                                at {item.time ? item.time.split(" - ")[0] : "-"}
                              </p>

                              {item.consultationType === "ONLINE" && (
                                <div className="flex gap-3 mt-2">
                                  <a
                                    href={
                                      item.status === "Completed"
                                        ? undefined
                                        : item.meetingUrl.startsWith("http")
                                        ? item.meetingUrl
                                        : `https://${item.meetingUrl}`
                                    }
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`bg-green-400 text-white px-2 py-1.5 rounded-lg transition ${item.status === "Completed" ? "opacity-60 cursor-not-allowed pointer-events-none" : "hover:bg-green-700"}`}
                                    tabIndex={item.status === "Completed" ? -1 : 0}
                                    aria-disabled={item.status === "Completed"}
                                  >
                                    ▶ JOIN CALL
                                  </a>

                                  <Button
  size="sm"
  disabled={
    item.status === "Cancelled" ||
    item.status === "Completed"
  }
  onClick={() => handleMarkCompleted(item)}
  className={`${
    item.status === "Completed"
      ? "bg-gray-400"
      : "bg-blue-600 text-white"
  }`}
>
  {item.status === "Completed" ? "COMPLETED ✅" : "MARK COMPLETED"}
</Button>

                                  {item.consultationType === "ONLINE" && (
                                    <div className="flex gap-3 mt-2">
                                      {/* If NOT cancelled → show Cancel */}
                                      {item.status !== "Cancelled" ? (
                                        <button
                                          onClick={() =>
                                            handleCancelAppointment(item)
                                          }
                                          className="bg-orange-500 text-white px-4 py-1.5 rounded-lg hover:bg-orange-600 transition"
                                        >
                                          CANCEL
                                        </button>
                                      ) : (
                                        /* If Cancelled → show Reschedule */
                                        <button
                                          onClick={() => handleReschedule(item)}
                                          className="bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 transition"
                                        >
                                          Reschedule Appointment
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                          {item.notes && (
                            <p className="col-span-2">
                              <b>Notes:</b> {item.notes}
                            </p>
                          )}
                          {/* Cancel button for OFFLINE or general case */}
                          {item.consultationType !== "ONLINE" && (
                            <div className="col-span-2 mt-3">
                              <button
                                onClick={() => handleCancel(item)}
                                className="bg-red-500 text-white px-3 py-1 rounded-md text-sm hover:bg-red-900 transition"
                              >
                                CANCEL APPOINTMENT
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* RIGHT ACTIONS */}
                  <div className="flex flex-col gap-2 mt-4 md:mt-0 w-full md:w-auto">
                    <Button
                      size="sm"
                      disabled={paidAppointments[item.id]}
                      className={
                        paidAppointments[item.id]
                          ? "bg-gray-400 cursor-not-allowed"
                          : ""
                      }
                      onClick={() => handleEdit(item)}
                    >
                      EDIT
                    </Button>

                    <Button
                      size="sm"
                      disabled={
                        item.status === "Cancelled" || paidAppointments[item.id]
                      }
                      onClick={() => handlePayment(item)}
                      className={`${
                        paidAppointments[item.id] || item.status === "Cancelled"
                          ? "bg-gray-400"
                          : "bg-green-600 text-white"
                      }`}
                    >
                      {paidAppointments[item.id] ? "PAID ✅" : "PAY NOW"}
                    </Button>

                    <Button
                      size="sm"
                      className="bg-gradient-to-r from-orange-600 via-orange-700 to-orange-900 text-white flex items-center gap-2 shadow-md hover:scale-105 transition duration-300"
                      disabled={!paidAppointments[item.id]}
                      onClick={() => handlePrintAppointment(item)}
                    >
                      <FiPrinter size={18} />
                      PRINT
                    </Button>

                    {paidAppointments[item.id] === "UPI Scanner" && (
                      <Button
                        size="sm"
                        className="bg-green-500 text-white shadow-md hover:bg-green-600 transition"
                        onClick={() => handleDischargeSummary(item)}
                      >
                        📄 DISCHARGE SUMMARY
                      </Button>
                    )}
                  </div>
                </Card>
              </div>
            );
          })
        )}

        {/* 🔽 PAGINATION CONTROLS */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-6">
            <Button
              size="sm"
              variant="outlined"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              ◀ Prev
            </Button>

            {[...Array(totalPages)].map((_, i) => (
              <Button
                key={i}
                size="sm"
                className={`${
                  currentPage === i + 1
                    ? "bg-orange-600 text-white"
                    : "bg-white text-gray-700 border"
                }`}
                onClick={() => setCurrentPage(i + 1)}
              >
                {i + 1}
              </Button>
            ))}

            <Button
              size="sm"
              variant="outlined"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              Next ▶
            </Button>
          </div>
        )}
      </div>
      {/* ================= LEGENDS ================= */}
      <Card className="border rounded-xl p-6 bg-white shadow-sm sticky top-4 z-40 mt-10">
        <div className="mb-6">
          <h3 className="font-semibold text-gray-700 mb-3">Legends</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {legends.map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <span
                  className={`w-10 h-10 flex items-center justify-center rounded-full font-bold text-xs ${item.color}`}
                >
                  {item.code}
                </span>
                <span className="text-sm text-gray-700">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <hr className="my-4 border-gray-300" />

        <div>
          <h4 className="font-semibold text-gray-700 mb-3">Day Type</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {DayType.map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <span
                  className={`w-10 h-10 flex items-center justify-center rounded-full font-bold text-xs ${item.color}`}
                >
                  {item.code}
                </span>
                <span className="text-sm text-gray-700">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>
      {/* ================= PAYMENT MODAL ================= */}
      {showPaymentModal && selectedAppointment && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-96 shadow-2xl">
            <h2 className="text-lg font-bold text-center mb-4">
              Choose Payment Method
            </h2>

            <b>
              {" "}
              <p className="text-sm text-red-600 text-center mb-4">
                Amount: ₹{getTotalPaid(selectedAppointment.type)}
              </p>
            </b>

            <div className="flex flex-col gap-4">
              <Button
                className="bg-green-600 text-white"
                onClick={() => confirmPayment("Cash")}
              >
                💵 Pay by Cash
              </Button>

              <div className="border rounded-xl p-4 flex flex-col items-center gap-3 bg-gray-50">
                <p className="font-semibold text-sm">📱 Pay via UPI Scanner</p>

                <img
                  className="w-32 h-32 object-contain"
                  src={scanner}
                  alt="Scanner"
                />

                <p className="text-xs text-gray-600 text-center">
                  Scan using GPay / PhonePe / Paytm
                </p>

                <Button
                  size="sm"
                  className="bg-orange-600 text-white mt-1"
                  onClick={() => confirmPayment("UPI Scanner")}
                >
                  I Have Paid
                </Button>
              </div>

              <Button
                variant="text"
                className="text-gray-600"
                onClick={() => setShowPaymentModal(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MyCart;
