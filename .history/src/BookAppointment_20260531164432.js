import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Calendar.css";

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const timeSlots = [
  "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM",
  "11:30 AM", "12:00 PM", "12:30 PM", "01:00 PM", "02:00 PM",
  "02:30 PM", "03:00 PM", "03:30 PM", "04:00 PM", "04:30 PM", "05:00 PM"
];

const departments = {
  Cardiology: ["Dr. Smith", "Dr. Johnson"],
  Orthopedics: ["Dr. Lee", "Dr. Patel"],
  Neurology: ["Dr. Brown", "Dr. Davis"]
};

const insuranceProviders = ["Provider A", "Provider B", "Provider C"];

const initialFormData = {
  firstName: "", middleName: "", lastName: "", gender: "", dob: "", age: "",
  mobile: "", alternateContact: "", email: "", address: "", emergencyContactName: "",
  emergencyContactNumber: "", patientID: "", department: "", doctor: "", time: "",
  appointmentType: "", reason: "", previousVisit: "", existingConditions: [],
  allergies: "", currentMedications: "", pastSurgeries: "", insuranceProvider: "",
  policyNumber: "", cardHolderName: "", insuranceCard: null, paymentMethod: "",
  termsAccepted: false, consentToShare: false
};

const BookAppointment = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [formData, setFormData] = useState(initialFormData);

  const navigate = useNavigate();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  // ✅ Auto-calculate Age from DOB
  useEffect(() => {
    if (formData.dob) {
      const birthDate = new Date(formData.dob);
      const ageDifMs = Date.now() - birthDate.getTime();
      const ageDate = new Date(ageDifMs);
      setFormData(prev => ({
        ...prev,
        age: Math.abs(ageDate.getUTCFullYear() - 1970).toString()
      }));
    }
  }, [formData.dob]);

  const changeMonth = (offset) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(month + offset);
    setCurrentDate(newDate);
  };

  const isToday = (day) =>
    day === today.getDate() &&
    month === today.getMonth() &&
    year === today.getFullYear();

  const handleDayClick = (day) => {
    const date = new Date(year, month, day);
    setSelectedDate(date);
    setShowCalendar(false);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    if (type === "checkbox" && name === "existingConditions") {
      setFormData(prev => {
        const conditions = prev.existingConditions.includes(value)
          ? prev.existingConditions.filter(c => c !== value)
          : [...prev.existingConditions, value];
        return { ...prev, existingConditions: conditions };
      });
    } else if (type === "checkbox") {
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (type === "file") {
      setFormData(prev => ({ ...prev, [name]: files[0] }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedDate || !formData.time) {
      alert("⚠️ Please select a date and time!");
      return;
    }

    const newAppointment = { 
      ...formData, 
      date: selectedDate.toISOString(),
      appointmentID: `APT-${Date.now()}`,
      consultationCharges: 300,
      patientName: `${formData.firstName} ${formData.lastName}`,
      time: formData.time
    };

    // ✅ Save to global appointments list
    const storedAppointments = JSON.parse(localStorage.getItem("appointments")) || [];
    storedAppointments.push(newAppointment);
    localStorage.setItem("appointments", JSON.stringify(storedAppointments));

    // ✅ ALSO add appointment to the specific doctor's record
    const storedDoctors = JSON.parse(localStorage.getItem("doctors")) || [];
    const updatedDoctors = storedDoctors.map((doctor) => {
      const docFullName = `${doctor.firstName || ""} ${doctor.lastName || ""}`.trim();
      if (docFullName === formData.doctor) {
        return {
          ...doctor,
          appointments: [
            ...(doctor.appointments || []),
            {
              patientName: `${formData.firstName} ${formData.lastName}`,
              date: selectedDate.toISOString().split('T')[0],
              time: formData.time,
              status: "Pending",
              appointmentID: newAppointment.appointmentID
            }
          ]
        };
      }
      return doctor;
    });
    localStorage.setItem("doctors", JSON.stringify(updatedDoctors));

    // ✅ Reset form
    setFormData(initialFormData);
    setSelectedDate(null);

    alert("✅ Appointment booked successfully!");
    navigate("/AppointmentHistory"); // Redirect after booking
  };

  const handleCancel = () => navigate("/Profile");

  const renderDays = () => {
    const cells = dayNames.map(day => (
      <div className="day-name" key={day}>{day}</div>
    ));

    for (let i = 0; i < firstDay; i++) {
      cells.push(<div key={`empty-${i}`} />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const isSelected =
        selectedDate &&
        day === selectedDate.getDate() &&
        month === selectedDate.getMonth() &&
        year === selectedDate.getFullYear();

      cells.push(
        <div
          key={day}
          role="button"
          className={`day ${isToday(day) ? "today" : ""} ${isSelected ? "selected" : ""}`}
          onClick={() => handleDayClick(day)}
        >
          {day}
        </div>
      );
    }
    return cells;
  };

  return (
    <div className="appointment-card container">
      <h1 className="book-appointment-header">Book Appointment</h1>
      <form onSubmit={handleSubmit} className="appointment-form grid">

        {/* PERSONAL INFO */}
        <div className="card-section">
          <h2>Patient Personal Information</h2>
          <div className="grid-2">
            <input type="text" name="firstName" placeholder="First Name" value={formData.firstName} onChange={handleInputChange} required />
            <input type="text" name="middleName" placeholder="Middle Name" value={formData.middleName} onChange={handleInputChange} />
            <input type="text" name="lastName" placeholder="Last Name" value={formData.lastName} onChange={handleInputChange} required />
            <select name="gender" value={formData.gender} onChange={handleInputChange} required>
              <option value="">Gender</option>
              <option>Male</option>
              <option>Female</option>
              <option>Other</option>
            </select>
            <input type="date" name="dob" value={formData.dob} onChange={handleInputChange} required />
            <input type="text" name="age" value={formData.age} placeholder="Age" onChange={handleInputChange} required />
            <input type="tel" name="mobile" placeholder="Mobile" value={formData.mobile} onChange={handleInputChange} required />
            <input type="tel" name="alternateContact" placeholder="Alternate Contact" value={formData.alternateContact} onChange={handleInputChange} />
            <input type="email" name="email" placeholder="Email" value={formData.email} onChange={handleInputChange} required />
            <input type="text" name="address" placeholder="Address" value={formData.address} onChange={handleInputChange} />
            <input type="text" name="emergencyContactName" placeholder="Emergency Contact Name" value={formData.emergencyContactName} onChange={handleInputChange} />
            <input type="tel" name="emergencyContactNumber" placeholder="Emergency Contact Number" value={formData.emergencyContactNumber} onChange={handleInputChange} />
            <input type="text" name="patientID" placeholder="Patient ID / MRN" value={formData.patientID} onChange={handleInputChange} />
          </div>
        </div>

        {/* APPOINTMENT DETAILS */}
        <div className="card-section">
          <h2>Appointment Details</h2>
          <div className="grid-2">
            <select name="department" value={formData.department} onChange={handleInputChange} required>
              <option value="">Department</option>
              {Object.keys(departments).map(dep => <option key={dep}>{dep}</option>)}
            </select>
            <select name="doctor" value={formData.doctor} onChange={handleInputChange} required>
              <option value="">Doctor</option>
              {formData.department && departments[formData.department].map(doc => (
                <option key={doc}>{doc}</option>
              ))}
            </select>
            <div className="date-picker">
              <button type="button" onClick={() => setShowCalendar(!showCalendar)}>
                {showCalendar ? "Close Calendar" : "Select Date"}
              </button>
              {selectedDate && <p>{selectedDate.toDateString()}</p>}
            </div>
            {showCalendar && (
              <div className="calendar">
                <div className="calendar-header">
                  <button type="button" onClick={() => changeMonth(-1)}>←</button>
                  <h3>{currentDate.toLocaleString("default", { month: "long" })} {year}</h3>
                  <button type="button" onClick={() => changeMonth(1)}>→</button>
                </div>
                <div className="calendar-grid">{renderDays()}</div>
              </div>
            )}
            <select name="time" value={formData.time} onChange={handleInputChange} required>
              <option value="">Time Slot</option>
              {timeSlots.map((slot, i) => <option key={i}>{slot}</option>)}
            </select>
            <select name="appointmentType" value={formData.appointmentType} onChange={handleInputChange} required>
              <option value="">Appointment Type</option>
              <option>In-person</option>
              <option>Teleconsultation</option>
              <option>Home Visit</option>
            </select>
            <textarea name="reason" placeholder="Reason for Visit" value={formData.reason} onChange={handleInputChange} />
            <textarea name="previousVisit" placeholder="Previous Visit / Referral" value={formData.previousVisit} onChange={handleInputChange} />
          </div>
        </div>

        {/* MEDICAL HISTORY */}
        <div className="card-section">
          <h2>Medical History</h2>
          <div className="grid-2">
            <label><input type="checkbox" name="existingConditions" value="Diabetes" checked={formData.existingConditions.includes("Diabetes")} onChange={handleInputChange} /> Diabetes</label>
            <label><input type="checkbox" name="existingConditions" value="Hypertension" checked={formData.existingConditions.includes("Hypertension")} onChange={handleInputChange} /> Hypertension</label>
            <label><input type="checkbox" name="existingConditions" value="Heart Disease" checked={formData.existingConditions.includes("Heart Disease")} onChange={handleInputChange} /> Heart Disease</label>
            <input type="text" name="allergies" placeholder="Allergies" value={formData.allergies} onChange={handleInputChange} />
            <input type="text" name="currentMedications" placeholder="Current Medications" value={formData.currentMedications} onChange={handleInputChange} />
            <input type="text" name="pastSurgeries" placeholder="Past Surgeries / Hospitalizations" value={formData.pastSurgeries} onChange={handleInputChange} />
          </div>
        </div>

        {/* INSURANCE & PAYMENT */}
        <div className="card-section">
          <h2>Insurance & Payment</h2>
          <div className="grid-2">
            <select name="insuranceProvider" value={formData.insuranceProvider} onChange={handleInputChange}>
              <option value="">Insurance Provider</option>
              {insuranceProviders.map(p => <option key={p}>{p}</option>)}
            </select>
            <input type="text" name="policyNumber" placeholder="Policy Number" value={formData.policyNumber} onChange={handleInputChange} />
            <input type="text" name="cardHolderName" placeholder="Card Holder Name" value={formData.cardHolderName} onChange={handleInputChange} />
            <input type="file" name="insuranceCard" onChange={handleInputChange} />
            <select name="paymentMethod" value={formData.paymentMethod} onChange={handleInputChange}>
              <option value="">Payment Method</option>
              <option>Cash</option>
              <option>Card</option>
              <option>Online</option>
            </select>
          </div>
        </div>

        {/* CONSENT */}
        <div className="card-section">
          <h2>Consent & Confirmation</h2>
          <label>
            <input type="checkbox" name="termsAccepted" checked={formData.termsAccepted} onChange={handleInputChange} required />
            I accept Terms & Conditions
          </label>
          <label>
            <input type="checkbox" name="consentToShare" checked={formData.consentToShare} onChange={handleInputChange} />
            Consent to share medical data
          </label>
        </div>

        {/* BUTTONS */}
        <div className="button-group">
          <button type="submit" className="submit-btn">Book Appointment</button>
          <button type="button" className="cancel-btn" onClick={handleCancel}>Cancel</button>
          <div className="ml-auto">
            <button
              type="button"
              className="view-btn"
              onClick={() => navigate("/AppointmentHistory")}
            >
              View Appointment History
            </button>
          </div>
        </div>

      </form>
    </div>
  );
};

export default BookAppointment;
