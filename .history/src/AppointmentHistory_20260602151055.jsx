import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaEye,
  FaPrint,
  FaTrash,
  FaShareAlt,
  FaSyncAlt,
  FaClone,
  FaEdit,
  FaDownload,
} from "react-icons/fa";
import "./Calendar.css";
import { Breadcrumbs } from "@material-tailwind/react";

const AppointmentHistory = () => {
  const [appointments, setAppointments] = useState([]);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [appointmentsToPrint, setAppointmentsToPrint] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState([]);
  const appointmentsPerPage = 10;
  const navigate = useNavigate();

  // ---------------- Load Appointments ----------------
  useEffect(() => {
    const storedAppointments =
      JSON.parse(localStorage.getItem("appointments")) || [];

    // ✅ Normalize appointmentID
    const updatedAppointments = storedAppointments.map((apt) => ({
      ...apt,
      appointmentID:
        apt.appointmentID || apt.appointmentId || `APT-${Date.now()}`,
      consultationCharges: apt.consultationCharges || 300,
    }));
    setAppointments(updatedAppointments);
  }, []);

  const totalPages = Math.ceil(appointments.length / appointmentsPerPage);
  const indexOfLast = currentPage * appointmentsPerPage;
  const indexOfFirst = indexOfLast - appointmentsPerPage;
  const currentAppointments = appointments.slice(indexOfFirst, indexOfLast);

  // ---------------- Format currency ----------------
  const formatCurrency = (value) => {
    if (!value) return "N/A";
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
    }).format(parseFloat(value.toString().replace(/[^\d.]/g, "")));
  };

  // ---------------- Total Consultation Charges ----------------
  const totalConsultationCharges = (list) => {
    return list.reduce(
      (sum, apt) => sum + (parseFloat(apt.consultationCharges) || 0),
      0
    );
  };

  // ---------------- Generate Print Content ----------------
  const generatePrintContent = (apts) => `
    <html>
      <head>
        <title>Appointments</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; margin:0; }
          header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #007BFF; padding-bottom: 10px; margin-bottom: 20px; background: #fff; }
          header img { height: 60px; }
          header h1 { color: #007BFF; margin:0; font-size:1.5rem; }
          .report-body { position: relative; padding: 20px; min-height:80vh; }
          .report-body::before { content: ""; position: absolute; top:0; left:0; right:0; bottom:0; background: url('https://upload.wikimedia.org/wikipedia/commons/6/65/Hospital_sign.svg') center center no-repeat; background-size: 300px; opacity: 0.08; }
          h2 { color: #007BFF; text-align:center; margin:15px 0; }
          section { margin-bottom:25px; border-bottom:1px solid #ccc; padding-bottom:15px; }
          h3 { margin-bottom:10px; color:#007BFF; font-size:1.1rem; }
          .details-grid { 
            display:grid; 
            grid-template-columns:1fr 1fr; 
            gap:8px 20px; 
            margin-bottom:15px; 
            background-color:#f0f8ff; /* ✅ Light blue background */
            padding:10px; 
            border-radius:5px;
          }
          p { margin:5px 0; font-size:0.95rem; }
          strong { color:#333; }
          footer { text-align:center; border-top:2px solid #007BFF; margin-top:30px; padding-top:10px; font-size:0.85rem; color:#555; background:#fff; }
        </style>
      </head>
      <body>
        <header>
          <img src="https://doc.vortala.com/childsites/uploads/4495/files/logo-v2.png" alt="Hospital Logo" />
          <h1>Hervy Bay Dental</h1>
        </header>
        <div class="report-body">
          <h2>Appointment Report</h2>
          ${apts
            .map(
              (apt) => `
            <section>
              <h3>📅 Appointment Info</h3>
              <div class="details-grid">
                <p><strong>Appointment ID:</strong> ${apt.appointmentID}</p>
                <p><strong>Date:</strong> ${new Date(
                  apt.date
                ).toLocaleDateString()}</p>
                <p><strong>Time:</strong> ${apt.time}</p>
                <p><strong>Type:</strong> ${apt.appointmentType}</p>
                <p><strong>Consultation Charges:</strong> ${formatCurrency(
                  apt.consultationCharges
                )}</p>
                <p><strong>Service Particulars:</strong> ${
                  apt.serviceParticulars || "N/A"
                }</p>
                <p><strong>Notes:</strong> ${apt.notes || "N/A"}</p>
              </div>
              <h3>👤 Patient Information</h3>
              <div class="details-grid">
                <p><strong>Name:</strong> ${apt.firstName} ${
                apt.middleName || ""
              } ${apt.lastName}</p>
                <p><strong>Gender:</strong> ${apt.gender || "N/A"}</p>
                <p><strong>Age:</strong> ${apt.age || "N/A"}</p>
                <p><strong>Phone:</strong> ${apt.phone || "N/A"}</p>
                <p><strong>Email:</strong> ${apt.email || "N/A"}</p>
                <p><strong>Address:</strong> ${apt.address || "N/A"}</p>
              </div>
              <h3>🏥 Doctor & Department</h3>
              <div class="details-grid">
                <p><strong>Department:</strong> ${apt.department}</p>
                <p><strong>Doctor:</strong> ${apt.doctor}</p>
              </div>
            </section>
          `
            )
            .join("")}
          <h3 style="text-align:right; margin-top:20px;">Total Consultation Charges: ${formatCurrency(
            totalConsultationCharges(apts)
          )}</h3>
        </div>
        <footer>
          <p>Generated on: ${new Date().toLocaleString()}</p>
          <p>Hervy Bay Dental | 123 Medical Street, Queensland | +61 7 1234 5678</p>
        </footer>
      </body>
    </html>
  `;

  // ---------------- CSV Download ----------------
  const downloadCSV = () => {
    const exportAppointments = selectedIds.length
      ? appointments.filter((apt) => selectedIds.includes(apt.appointmentID))
      : appointments;

    if (exportAppointments.length === 0)
      return alert("No appointments to download!");

    const headers = [
      "Appointment ID",
      "Date",
      "Time",
      "Type",
      "Consultation Charges",
      "Service Particulars",
      "Notes",
      "Patient Name",
      "Gender",
      "Age",
      "Phone",
      "Email",
      "Address",
      "Department",
      "Doctor",
    ];

    const rows = exportAppointments.map((appt) => [
      appt.appointmentID,
      new Date(appt.date).toLocaleDateString(),
      appt.time,
      appt.appointmentType,
      formatCurrency(appt.consultationCharges),
      appt.serviceParticulars || "N/A",
      appt.notes || "N/A",
      `${appt.firstName} ${appt.middleName || ""} ${appt.lastName}`,
      appt.gender || "N/A",
      appt.age || "N/A",
      appt.phone || "N/A",
      appt.email || "N/A",
      appt.address || "N/A",
      appt.department,
      appt.doctor,
    ]);

    rows.push([
      "TOTAL",
      "",
      "",
      "",
      formatCurrency(totalConsultationCharges(exportAppointments)),
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers, ...rows].map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "appointments_full.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ---------------- Print Preview ----------------
  const openPrintPreview = (apts) => {
    if (!apts || apts.length === 0) return alert("No appointments to print!");
    setAppointmentsToPrint(apts);
    setShowPrintPreview(true);
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    printWindow.document.write(generatePrintContent(appointmentsToPrint));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    setShowPrintPreview(false);
  };

  // ---------------- Selection ----------------
  const toggleSelect = (id) =>
    selectedIds.includes(id)
      ? setSelectedIds(selectedIds.filter((sid) => sid !== id))
      : setSelectedIds([...selectedIds, id]);

  const toggleSelectAll = () =>
    selectedIds.length === currentAppointments.length
      ? setSelectedIds([])
      : setSelectedIds(currentAppointments.map((apt) => apt.appointmentID));

  // ---------------- CRUD / Share / Clone / Edit ----------------
  const handleDeleteAppointment = (id) => {
    if (!window.confirm("Are you sure you want to delete this appointment?"))
      return;
    const updatedAppointments = appointments.filter(
      (apt) => apt.appointmentID !== id
    );
    setAppointments(updatedAppointments);
    localStorage.setItem("appointments", JSON.stringify(updatedAppointments));
    if (selectedAppointment?.appointmentID === id)
      setSelectedAppointment(null);
    if (currentPage > Math.ceil(updatedAppointments.length / appointmentsPerPage))
      setCurrentPage((prev) => prev - 1);
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return alert("No appointments selected!");
    if (!window.confirm("Are you sure you want to delete selected appointments?"))
      return;
    const updatedAppointments = appointments.filter(
      (apt) => !selectedIds.includes(apt.appointmentID)
    );
    setAppointments(updatedAppointments);
    localStorage.setItem("appointments", JSON.stringify(updatedAppointments));
    setSelectedIds([]);
  };

  const handleShare = (apt) => {
    const shareText = `Appointment Details:\nID: ${apt.appointmentID}\nName: ${apt.firstName} ${apt.lastName}\nDate: ${apt.date}\nTime: ${apt.time}\nConsultation Charges: ${formatCurrency(
      apt.consultationCharges
    )}`;
    navigator.clipboard.writeText(shareText);
    alert("Appointment details copied to clipboard!");
  };

  const handleClone = (apt) => {
    const clonedApt = {
      ...apt,
      appointmentID: `Clone-${Date.now()}`,
      firstName: `Clone - ${apt.firstName}`,
      consultationCharges: apt.consultationCharges || 300,
    };
    const updatedAppointments = [...appointments, clonedApt];
    setAppointments(updatedAppointments);
    localStorage.setItem("appointments", JSON.stringify(updatedAppointments));
  };

  const handleEdit = (apt) => {
    navigate(`/BookAppointment`, { state: { appointment: apt } });
  };

  const handleRefresh = () => window.location.reload();
  

  return (
    <div className="appointment-card container">
      <h1 className="book-appointment-header">Appointment History</h1>

      <div className="action-buttons">
        <Breadcrumbs>
          <button type="button" className="opacity-60">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
            </svg>
          </button>

          <a href="/HomePage" className="opacity-60">
            Home
          </a>

          <a href="/Welcome" className="opacity-60">
            Welcome
          </a>
          <span>Appointment History</span>
        </Breadcrumbs>

        <button
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white 
                     bg-purple-600 hover:bg-purple-700 transition"
          onClick={() => navigate("/BookAppointment")}
        >
          ➕ Add New Appointment
        </button>

        <button
          className="submit-btn bg-gradient-to-r from-purple-600 via-purple-700 to-purple-900 text-white shadow-lg hover:scale-105 transition duration-300 flex items-center gap-2"
          onClick={() => openPrintPreview(appointments)}
        >
          <FaPrint /> Print All
        </button>

        <button
          className="submit-btn bg-gradient-to-r from-orange-600 via-orange-700 to-orange-900 text-white shadow-lg hover:scale-105 transition duration-300 flex items-center gap-2"
          onClick={downloadCSV}
        >
          <FaDownload /> Download CSV
        </button>

        <button
          className="cancel-btn bg-gradient-to-r from-red-600 via-red-700 to-red-900 text-white shadow-lg hover:scale-105 transition duration-300 flex items-center gap-2"
          onClick={handleDeleteSelected}
        >
          🗑️ Delete Selected
        </button>

        <button
          className="submit-btn bg-gradient-to-r from-orange-600 via-orange-700 to-orange-900 text-white shadow-lg hover:scale-105 transition duration-300 flex items-center gap-2"
          onClick={handleRefresh}
        >
          <FaSyncAlt /> Refresh
        </button>
      </div>

      {/* Table */}
      {appointments.length === 0 ? (
        <p>No appointments booked yet.</p>
      ) : (
        <>
          <table className="appointment-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    onChange={toggleSelectAll}
                    checked={selectedIds.length === currentAppointments.length}
                  />
                </th>
                <th className="sl-no">Sl No</th>
                <th>Appointment ID</th>
                <th className="date-col">Date</th>
                <th>Time</th>
                <th>Patient Name</th>
                <th>Department</th>
                <th>Doctor</th>
                <th>Appointment Type</th>
                <th>Consultation Charges</th>
                <th className="actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentAppointments.map((apt, index) => {
                // Get patient name from various possible field names
                const patientName = apt.firstName || apt.patientName || apt.name || "N/A";
                const patientLastName = apt.lastName || "";
                const fullName = `${patientName} ${patientLastName}`.trim();
                
                return (
                <tr key={apt.appointmentID}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(apt.appointmentID)}
                      onChange={() => toggleSelect(apt.appointmentID)}
                    />
                  </td>
                  <td className="sl-no">{indexOfFirst + index + 1}</td>
                  <td>{apt.appointmentID}</td>
                  <td className="date-col">
                    {new Date(apt.date).toLocaleDateString()}
                  </td>
                  <td>{apt.time}</td>
                  <td>{fullName}</td>
                  <td>{apt.department}</td>
                  <td>{apt.doctor}</td>
                  <td>{apt.appointmentType}</td>
                  <td>{formatCurrency(apt.consultationCharges)}</td>
                  <td className="actions table-actions">
                    <button
                      className="icon-btn view"
                      onClick={() => setSelectedAppointment(apt)}
                      title="View"
                    >
                      <FaEye />
                    </button>
                    <button
                      className="icon-btn print"
                      onClick={() => openPrintPreview([apt])}
                      title="Print"
                    >
                      <FaPrint />
                    </button>
                    <button
                      className="icon-btn delete"
                      onClick={() => handleDeleteAppointment(apt.appointmentID)}
                      title="Delete"
                    >
                      <FaTrash />
                    </button>
                    <button
                      className="icon-btn share"
                      onClick={() => handleShare(apt)}
                      title="Share"
                    >
                      <FaShareAlt />
                    </button>
                    <button
                      className="icon-btn"
                      style={{ backgroundColor: "#6F42C1" }}
                      onClick={() => handleClone(apt)}
                      title="Clone"
                    >
                      <FaClone />
                    </button>
                    <button
                      className="icon-btn"
                      style={{ backgroundColor: "#17A2B8" }}
                      onClick={() => handleEdit(apt)}
                      title="Edit"
                    >
                      <FaEdit />
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan="9" style={{ textAlign: "right", fontWeight: "bold" }}>
                  Total Consultation Charges:
                </td>
                <td colSpan="2" style={{ fontWeight: "bold" }}>
                  {formatCurrency(
                    selectedIds.length > 0
                      ? totalConsultationCharges(
                          appointments.filter((apt) =>
                            selectedIds.includes(apt.appointmentID)
                          )
                        )
                      : totalConsultationCharges(appointments)
                  )}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Pagination */}
          <div className="pagination">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((prev) => prev - 1)}
            >
              Prev
            </button>
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((prev) => prev + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}

      {/* Selected Appointment Modal */}
      {selectedAppointment && (
        <div
          className="modal-overlay"
          onClick={() => setSelectedAppointment(null)}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>📌 Appointment Details</h2>
            <div
              className="details-grid"
              style={{ backgroundColor: "#f0f8ff", padding: "10px", borderRadius: "5px" }}
            >
              <pre>
                {JSON.stringify(
                  {
                    ...selectedAppointment,
                    consultationCharges: formatCurrency(
                      selectedAppointment.consultationCharges
                    ),
                  },
                  null,
                  2
                )}
              </pre>
            </div>
            <div className="button-group">
              <button
                className="cancel-btn"
                onClick={() => setSelectedAppointment(null)}
              >
                Close
              </button>
              <button
                className="submit-btn"
                onClick={() => openPrintPreview([selectedAppointment])}
              >
                <FaPrint /> Print
              </button>
              <button
                className="submit-btn"
                onClick={() => handleShare(selectedAppointment)}
              >
                <FaShareAlt /> Share
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Preview Modal */}
      {showPrintPreview && (
        <div className="modal-overlay">
          <div className="modal-content large">
            <h2>🖨 Print Preview</h2>
            <iframe
              title="Print Preview"
              style={{ width: "100%", height: "500px", border: "1px solid #ccc" }}
              srcDoc={generatePrintContent(appointmentsToPrint)}
            />
            <div className="button-group" style={{ marginTop: "10px" }}>
              <button className="submit-btn" onClick={handlePrint}>
                🖨 Print
              </button>
              <button
                className="cancel-btn"
                onClick={() => setShowPrintPreview(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppointmentHistory;
