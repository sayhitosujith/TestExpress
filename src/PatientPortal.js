import React, { useState, useEffect } from "react";
import "./PatientPortal.css";
import packageJson from "../package.json";
import {
  MdOutlineDocumentScanner,
  MdHome,
  MdAssignment,
  MdPersonOutline,
  MdBuild,
  MdSupportAgent,
  MdNotifications,
} from "react-icons/md";
import logo from "./assets/Toothx_Logo.png";

import { Link, useNavigate, useLocation } from "react-router-dom";

const PatientPortal = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [editMode, setEditMode] = useState(location.state?.editMode || false);

  const [profile, setProfile] = useState({
    name: "Sujith S",
  });

  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("theme") === "dark",
  );

  useEffect(() => {
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const [successMessage, setSuccessMessage] = useState("");

  const handleOnboardPatient = () => {
    const medical = forms.find((f) => f.id === 1)?.responses || {};
    const insurance = forms.find((f) => f.id === 3)?.responses || {};
    const emergency = forms.find((f) => f.id === 4)?.responses || {};
    const lifestyle = forms.find((f) => f.id === 5)?.responses || {};

    const patientId = generatePatientId(); // generate first

    const patient = {
      patientId: patientId,

      firstName: "Patient",
      lastName: patientId,

      phone: emergency.contactPhone || "",
      countryCode: emergency.countryCode || "+91",

      aadhaar: emergency.aadharNumber?.replace(/\D/g, "") || "",

      insuranceProvider: insurance.q1 || "",
      policyNumber: insurance.q2 || "",

      chronicIllness: medical.q1 || "",
      medications: medical.q2 || "",

      exercise: lifestyle.q1 || "",
      consumption: lifestyle.q2 || "",

      sex: "",
      pregnancyStatus: "",

      appointmentStatus: "Not Scheduled",

      createdAt: new Date().toISOString(),
    };

    const stored = JSON.parse(localStorage.getItem("allProfiles")) || [];

    const exists = stored.find((p) => p.phone === patient.phone);

    if (exists) {
      alert("⚠ Patient with this phone already exists");
      return;
    }

    const updated = [...stored, patient];

    localStorage.setItem("allProfiles", JSON.stringify(updated));

    setSuccessMessage("✅ Patient Onboarded Successfully");

    setTimeout(() => {
      navigate("/Profile");
    }, 1200);
  };
  // Forms data with dynamic questions
  const [forms, setForms] = useState([
    {
      id: 1,
      title: "Medical History Form",
      completed: false,
      responses: {},
      questions: [
        {
          id: "q1",
          type: "select",
          label: "Do you have any chronic illness?",
          options: ["Yes", "No"],
          required: true,
        },
        {
          id: "q2",
          type: "select",
          label: "Please list any medications you take:",
          options: [
            "None",
            "Blood Pressure Medication",
            "Diabetes Medication",
            "Painkillers",
            "Antibiotics",
            "Other",
          ],
          required: false,
        },
      ],
    },

    {
      id: 3,
      title: "Insurance Details",
      completed: false,
      responses: {},
      questions: [
        {
          id: "q1",
          type: "select",
          label: "Insurance Provider:",
          options: [
            "Aetna",
            "Cigna",
            "United Healthcare",
            "orange Cross",
            "Other",
          ],
          required: true,
        },
        {
          id: "q2",
          type: "text",
          label: "Policy Number:",
          required: true,
        },
      ],
    },

    {
      id: 4,
      title: "Emergency Contact Info",
      completed: false,
      responses: {},
      questions: [
        {
          id: "contactName",
          type: "text",
          label: "Contact Name",
          required: true,
        },

        {
          id: "countryCode",
          type: "country",
          label: "Country Code",
          required: true,
        },

        {
          id: "contactPhone",
          type: "text",
          label: "Phone Number",
          required: true,
        },

        {
          id: "relationship",
          type: "select",
          label: "Relationship",
          options: ["Spouse", "Father", "Mother", "Friend", "Sibling"],
          required: true,
        },

        {
          id: "aadharNumber",
          type: "text",
          label: "Aadhar Number",
          required: true,
        },
      ],
    },

    {
      id: 5,
      title: "Lifestyle Questionnaire",
      completed: false,
      responses: {},
      questions: [
        {
          id: "q1",
          type: "select",
          label: "Do you exercise regularly?",
          options: ["Yes", "No"],
          required: true,
        },
        {
          id: "q2",
          type: "select",
          label: "Which of these do you consume?",
          options: ["Alcohol", "Tobacco", "Caffeine", "None"],
          required: false,
        },
      ],
    },
  ]);
  const countryOptions = [
    { code: "+91", label: "🇮🇳 India" },
    { code: "+1", label: "🇺🇸 USA" },
    { code: "+44", label: "🇬🇧 UK" },
    { code: "+61", label: "🇦🇺 Australia" },
  ];

  const generatePatientId = () => {
    const existing = JSON.parse(localStorage.getItem("allProfiles")) || [];
    return "PT" + String(existing.length + 1001);
  };

  const [searchTerm, setSearchTerm] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [activeForm, setActiveForm] = useState(null);
  const [formResponses, setFormResponses] = useState({});

  const completedForms = forms.filter((f) => f.completed).length;
  const progress =
    forms.length > 0 ? Math.round((completedForms / forms.length) * 100) : 0;

  const handleStartForm = (form) => {
    setActiveForm(form);
    setFormResponses(form.responses || {});
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setActiveForm(null);
    setFormResponses({});
    setModalOpen(false);
  };

  const formatAadhaar = (value) => {
    let digits = value.replace(/\D/g, "").slice(0, 12);
    return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
  };

  const handleInputChange = (questionId, value) => {
    if (!activeForm) return;

    // Insurance Policy Number → only digits, max 12
    if (activeForm.id === 3 && questionId === "q2") {
      value = value.replace(/\D/g, ""); // remove non-digits
      if (value.length > 12) value = value.slice(0, 12);
    }

    // Emergency Contact Form Formatting
    if (activeForm.id === 4) {
      // Phone → only digits, max 10
      if (questionId === "contactPhone") {
        value = value.replace(/\D/g, "");
        if (value.length > 10) value = value.slice(0, 10);
      }
      // Aadhaar → 12 digits formatted XXXX XXXX XXXX
      if (questionId === "aadharNumber") {
        let digits = value.replace(/\D/g, "").slice(0, 12);
        value = formatAadhaar(digits);
      }
    }

    setFormResponses((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSubmitForm = () => {
    const missing = activeForm.questions.filter(
      (q) => q.required && !formResponses[q.id],
    );

    if (missing.length > 0) {
      alert("Please answer all required fields!");
      return;
    }

    if (activeForm.id === 4) {
      if (!formResponses.countryCode) {
        alert("Please select country code.");
        return;
      }

      if (formResponses.contactPhone?.length !== 10) {
        alert("Phone number must be exactly 10 digits.");
        return;
      }

      const aadharDigits = formResponses.aadharNumber?.replace(/\D/g, "");

      if (aadharDigits?.length !== 12) {
        alert("Aadhaar number must be 12 digits.");
        return;
      }
    }

    setForms((prev) =>
      prev.map((f) =>
        f.id === activeForm.id
          ? { ...f, completed: true, responses: formResponses }
          : f,
      ),
    );

    handleCloseModal();
  };

  const filteredForms = forms.filter((form) =>
    form.title.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
   <div className={`portal-container ${darkMode ? "dark-mode" : ""}`}>
  
  {/* Sidebar */}
<aside className="sidebar min-h-screen bg-gradient-to-r from-orange-700 via-orange-700 to-orange-700 flex flex-col items-center py-16 px-4">
  {/* Logo */}
  <img
    className="sidebar-logo"
    src={logo}
    alt="Application Logo"
  />

  <hr className="sidebar-divider" />

  {/* Navigation */}
  <nav className="sidebar-nav">
    <Link to="/Welcome" className="nav-item">
      <MdHome size={20} />
      <span>Home</span>
    </Link>

    <Link to="/PatientPortal" className="nav-item">
      <MdAssignment size={20} />
      <span>Forms</span>
    </Link>

    <Link to="/DocumentCenter" className="nav-item">
      <MdOutlineDocumentScanner size={20} />
      <span>Documents Center</span>
    </Link>

    <Link to="/Settings" className="nav-item">
      <MdBuild size={22} />
      <span>Settings</span>
    </Link>

    <Link to="/Profile" state={{ editMode: true }} className="nav-item">
      <MdPersonOutline size={20} />
      <span>Profile</span>
    </Link>

    <div className="nav-item">
      <MdSupportAgent size={20} />
      <span>Help</span>
    </div>
  </nav>

  <hr className="sidebar-divider" />

  {/* Dark Mode Toggle */}
  <button
    className="dark-mode-toggle"
    onClick={() => setDarkMode(!darkMode)}
  >
    {darkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
  </button>

  <hr className="sidebar-divider" />

  {/* Version */}
  <div className="sidebar-support">
    <p>App Version: {packageJson.version}</p>
  </div>

</aside>

      {/* Main content */}
      <main className="main-content">
        <header className="main-header">
          <b>
            <h1>Patient Onboarding Portal</h1>
          </b>
          <div className="header-actions">
            <div className="notification-wrapper">
              <MdNotifications
                size={22}
                className="cursor-pointer"
                onClick={() => setShowNotifications(!showNotifications)}
              />
              {showNotifications && (
                <div className="notifications-dropdown">
                  {[
                    "New message from your doctor",
                    "Insurance approved",
                    "Appointment rescheduled",
                  ].map((note, idx) => (
                    <div key={idx} className="notification-item">
                      {note}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <span style={{borderLeft:"1px solid currentColor", height:"1em", display:"inline-block", margin:"0 4px"}} />
            <div
              className="user-badge"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
            >
              <div className="user-icon">SS</div>
              <span className="username">Sujith S</span>
              {showProfileMenu && (
                <div className="profile-dropdown">
                  <Link to="/Profile" state={{ editMode: true }}>
                    Edit Profile
                  </Link>
                  <Link to="/Settings">Settings</Link>
                  <Link to="/Logout">Logout</Link>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Stats & Progress */}
        <section className="stats-card">
          <div className="card stats-container">
            <h3 className="stats-title">Forms KPI</h3>
            <div className="stats-section">
      <div className="stat-box total-box min-h-[150px] bg-gradient-to-r from-orange-300 via-orange-700 to-orange-300 flex flex-col items-center justify-center p-4 rounded-lg shadow-lg">
  <h4>Total Forms</h4>
  <p>{forms.length}</p>
</div>

      <div className="stat-box total-box min-h-[150px] bg-gradient-to-r from-orange-300 via-orange-700 to-orange-300 flex flex-col items-center justify-center p-4 rounded-lg shadow-lg">
  <h4>Completed Forms</h4>
  <p>{completedForms}</p>
</div>

      <div className="stat-box total-box min-h-[150px] bg-gradient-to-r from-orange-300 via-orange-700 to-orange-300 flex flex-col items-center justify-center p-4 rounded-lg shadow-lg">
  <h4>Pending Forms</h4>
  <p>{forms.length - completedForms}</p>
</div>
            </div>
          </div>
        </section>

        {/* Progress Stepper */}
<section style={{ background: "#fff", borderRadius: 16, padding: "24px 32px", marginBottom: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.07)", border: "1px solid #f3f4f6" }}>
  {/* Header */}
  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid #f3f4f6" }}>
    <div style={{ background: "#fef2f2", borderRadius: 10, padding: 8 }}>
      <MdAssignment size={20} color="#e11d48" />
    </div>
    <div>
      <div style={{ fontWeight: 700, fontSize: 16, color: "#111827" }}>Patient Onboarding</div>
      <div style={{ fontSize: 13, color: "#9ca3af" }}>Complete all forms to onboard the patient</div>
    </div>
  </div>

  {/* Stepper label */}
  <div style={{ fontWeight: 700, fontSize: 15, color: "#111827", marginBottom: 20 }}>Your Progress</div>

  {/* Stepper */}
  <div style={{ overflowX: "auto", paddingBottom: 8 }}>
    <div style={{ display: "flex", alignItems: "flex-start", minWidth: "max-content", position: "relative" }}>
      {forms.map((form, index) => {
        const isCompleted = form.completed;
        const isActive = !form.completed && forms.slice(0, index).every(f => f.completed);
        const stepNum = index + 1;

        return (
          <div key={form.id} style={{ display: "flex", alignItems: "flex-start" }}>
            {/* Step */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 90 }}>
              <div
                onClick={() => handleStartForm(form)}
                style={{
                  width: 40, height: 40, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer",
                  fontWeight: 700, fontSize: 14,
                  background: isCompleted ? "#0d9488" : isActive ? "#690d04" : "#fff",
                  color: isCompleted || isActive ? "#fff" : "#9ca3af",
                  border: isCompleted ? "2px solid #0d9488" : isActive ? "2px solid #690d04" : "2px solid #e5e7eb",
                  boxShadow: isActive ? "0 0 0 4px rgba(124,58,237,0.15)" : "none",
                  transition: "all 0.2s",
                  zIndex: 1, position: "relative",
                }}
              >
                {isCompleted ? "✓" : stepNum}
              </div>
              <div style={{
                marginTop: 8, fontSize: 12, textAlign: "center", lineHeight: 1.3,
                color: isCompleted ? "#0d9488" : isActive ? "#690d04" : "#690d04",
                fontWeight: isActive ? 700 : 500,
                maxWidth: 80,
              }}>
                {form.title.replace(" Form", "").replace(" Details", "").replace(" Info", "").replace(" Questionnaire", "")}
              </div>
            </div>

            {/* Connector line */}
            {index < forms.length - 1 && (
              <div style={{
                height: 2, width: 380, marginTop: 19,
                background: forms[index].completed ? "#690d04" : "#690d04",
                transition: "background 0.3s",
              }} />
            )}
          </div>
        );
      })}
    </div>
  </div>

  {/* Progress bar */}
  <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #f3f4f6" }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
      <span style={{ fontSize: 13, color: "#690d04" }}>{completedForms} of {forms.length} forms completed</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: "#690d04" }}>{progress}%</span>
    </div>

  </div>
</section>

        {/* Search */}
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search forms..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Forms Section */}
        <section className="forms-section">
          {filteredForms.map((form) => (
            <div key={form.id} className="card">
              <div className="card-body">
                <h2 className="card-title">{form.title}</h2>
                <p className="card-text">
                  Please complete all forms assigned to you. Your responses help
                  our team provide the most accurate care.
                </p>
                <button
                  className={`form-btn ${form.completed ? "completed" : ""}`}
                  onClick={() => handleStartForm(form)}
                >
                  {form.completed ? "View / Edit" : "Start Form"}
                </button>
              </div>
            </div>
          ))}
        </section>

        {successMessage && (
          <div className="fixed bottom-20 right-6 bg-orange-600 text-white px-4 py-2 rounded shadow-lg">
            {successMessage}
          </div>
        )}

        <div className="fixed bottom-6 right-6 flex flex-col items-end gap-1 z-50">
          <button
            disabled={completedForms !== forms.length}
            onClick={handleOnboardPatient}
            className={`px-4 py-2 rounded-lg shadow-lg transition-all duration-300 transform
      ${
        completedForms === forms.length
          ? "bg-red-600 text-white hover:bg-red-700 cursor-pointer animate-pulse scale-105"
          : "bg-gray-400 text-gray-700 cursor-not-allowed"
      }
    `}
          >
            + ONBOARD NEW PATIENT
          </button>

          {completedForms !== forms.length && (
            <span className="text-xs text-red-600 font-medium">
              <u>NOTE: complete all forms to enable this Button</u>
            </span>
          )}
        </div>

        {/* Dynamic Modal */}
        {modalOpen && activeForm && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h2>{activeForm.title}</h2>
              <div className="modal-body">
                {activeForm.questions.map((q) => {
                  // Only show "medications" if chronic illness is "Yes"
                  if (
                    q.id === "q2" &&
                    activeForm.id === 1 &&
                    formResponses["q1"] === "No"
                  ) {
                    return null; // Hide this field
                  }

                  switch (q.type) {
                    case "country":
                      return (
                        <label key={q.id}>
                          {q.label}:
                          <select
                            value={formResponses[q.id] || ""}
                            onChange={(e) =>
                              handleInputChange(q.id, e.target.value)
                            }
                          >
                            <option value="">Select Country</option>
                            {countryOptions.map((country) => (
                              <option key={country.code} value={country.code}>
                                {country.label} ({country.code})
                              </option>
                            ))}
                          </select>
                        </label>
                      );
                    case "text":
                      if (q.id === "contactPhone") {
                        return (
                          <label key={q.id}>
                            {q.label}:
                            <div style={{ display: "flex", gap: "8px" }}>
                              <input
                                type="text"
                                value={formResponses.countryCode || ""}
                                disabled
                                style={{ width: "80px", background: "#eee" }}
                              />

                              <input
                                type="text"
                                value={formResponses[q.id] || ""}
                                onChange={(e) =>
                                  handleInputChange(q.id, e.target.value)
                                }
                                inputMode="numeric"
                                maxLength={10}
                                placeholder="Enter 10 digit number"
                                style={{ flex: 1 }}
                              />
                            </div>
                          </label>
                        );
                      }

                      return (
                        <label key={q.id}>
                          {q.label}:
                          <input
                            type="text"
                            value={formResponses[q.id] || ""}
                            onChange={(e) =>
                              handleInputChange(q.id, e.target.value)
                            }
                          />
                        </label>
                      );

                    case "select":
                      return (
                        <label key={q.id}>
                          {q.label}:
                          <select
                            value={formResponses[q.id] || ""}
                            onChange={(e) =>
                              handleInputChange(q.id, e.target.value)
                            }
                          >
                            <option value="">Select</option>
                            {q.options.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </label>
                      );
                    case "textarea":
                      return (
                        <label key={q.id}>
                          {q.label}:
                          <textarea
                            value={formResponses[q.id] || ""}
                            onChange={(e) =>
                              handleInputChange(q.id, e.target.value)
                            }
                          />
                        </label>
                      );
                    case "checkbox":
                      return (
                        <fieldset key={q.id}>
                          <legend>{q.label}:</legend>
                          {q.options.map((opt) => (
                            <label key={opt}>
                              <input
                                type="checkbox"
                                checked={formResponses[q.id]?.includes(opt)}
                                onChange={(e) => {
                                  const prev = formResponses[q.id] || [];
                                  if (e.target.checked)
                                    handleInputChange(q.id, [...prev, opt]);
                                  else
                                    handleInputChange(
                                      q.id,
                                      prev.filter((v) => v !== opt),
                                    );
                                }}
                              />
                              {opt}
                            </label>
                          ))}
                        </fieldset>
                      );
                    default:
                      return null;
                  }
                })}
              </div>
              <div className="modal-footer">
                <button onClick={handleCloseModal} className="modal-btn cancel">
                  Cancel
                </button>
                <button onClick={handleSubmitForm} className="modal-btn submit">
                  Submit
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default PatientPortal;
