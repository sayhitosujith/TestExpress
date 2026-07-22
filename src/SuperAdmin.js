import React, { useState, useMemo, useEffect } from "react";
import { Line } from "react-chartjs-2";
import { useNavigate } from "react-router-dom";
import { FaDownload } from "react-icons/fa";
import { Typography } from "@material-tailwind/react";

import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import {
  MdOutlineEditNote,
  MdOutlineSettings,
  MdOutlinePowerSettingsNew,
  MdExpandMore,
  MdFileCopy,
  MdCreditCard,
  MdSearch,
  MdPersonSearch,
  MdMemory,
  MdEdit,
  MdDelete,
} from "react-icons/md";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
);

const ROLE_OPTIONS = [
  "Super Admin",
  "Admin",
  "Doctor",
  "Nurse",
  "Receptionist",
  "Technician",
  "Pharmacist",
  "Lab Technician",
  "HR",
  "Finance",
  "IT Support",
  "Patient",
];

export default function SuperAdmin({
  initialUsers = [],
  initialDoctors = [],
  initialRevenueChart = {},
}) {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user")) || {
    name: "Guest",
    initials: "G",
  };

  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const handleClone = (user) => {
    const newId = Date.now(); // unique ID
    const clonedUser = {
      ...user,
      id: newId,
      email: `copy_${newId}_${user.email}`, // ensure email is unique
    };

    setAppointments((prev) => [...prev, clonedUser]);

    const registeredUsers =
      JSON.parse(localStorage.getItem("registeredUsers")) || [];
    registeredUsers.push({
      firstName: clonedUser.name.split(" ")[0] || "",
      lastName: clonedUser.name.split(" ")[1] || "",
      email: clonedUser.email,
      phoneNumber: clonedUser.phone,
      role: clonedUser.role,
      password: clonedUser.password,
    });
    localStorage.setItem("registeredUsers", JSON.stringify(registeredUsers));

    window.dispatchEvent(new Event("storage"));
  };

  const [appointments, setAppointments] = useState([]);

  /* ---------------- LOAD USERS ---------------- */
  useEffect(() => {
    const loadUsers = () => {
      const registeredUsers =
        JSON.parse(localStorage.getItem("registeredUsers")) || [];
      const savedUsers = JSON.parse(localStorage.getItem("appointments")) || [];

      // Map registeredUsers to match appointments structure
      const formattedRegisteredUsers = registeredUsers.map((user) => ({
        id: user.email,
        name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        phone: user.phoneNumber || "",
        email: user.email || "",
        password: user.password || "",
        role: user.role || "Patient",
        practice: user.practice || "General",
        paidAmount: user.paidAmount || Math.floor(Math.random() * 1000 + 100), // demo revenue
        date: user.date || new Date().toISOString(), // demo date
      }));

      const mergedUsers = [...savedUsers];

      // Merge without duplicates
      formattedRegisteredUsers.forEach((user) => {
        const exists = mergedUsers.some((u) => u.email === user.email);
        if (!exists) mergedUsers.push(user);
      });

      // Ensure all merged users have paidAmount & date
      const finalUsers = mergedUsers.map((u) => ({
        ...u,
        paidAmount: u.paidAmount || Math.floor(Math.random() * 1000 + 100),
        date: u.date || new Date().toISOString(),
      }));

      setAppointments(finalUsers);
    };

    loadUsers();
    window.addEventListener("storage", loadUsers);

    return () => window.removeEventListener("storage", loadUsers);
  }, []);

  const handleDelete = (id) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;

    const registeredUsers =
      JSON.parse(localStorage.getItem("registeredUsers")) || [];

    const appointments = JSON.parse(localStorage.getItem("appointments")) || [];

    const userToDelete = appointments.find((u) => u.id === id);

    // remove from registered users
    const updatedRegisteredUsers = registeredUsers.filter(
      (u) => u.email !== userToDelete?.email,
    );

    // remove from appointments
    const updatedAppointments = appointments.filter((u) => u.id !== id);

    localStorage.setItem(
      "registeredUsers",
      JSON.stringify(updatedRegisteredUsers),
    );
    localStorage.setItem("appointments", JSON.stringify(updatedAppointments));

    setAppointments(updatedAppointments);

    window.dispatchEvent(new Event("storage"));
  };

  const [doctors, setDoctors] = useState(
    JSON.parse(localStorage.getItem("doctors")) || initialDoctors,
  );

  const [showModal, setShowModal] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    role: "",
    practice: "",
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  /* ---------------- PERSIST DATA ---------------- */

  useEffect(() => {
    localStorage.setItem("appointments", JSON.stringify(appointments));
  }, [appointments]);

  useEffect(() => {
    localStorage.setItem("doctors", JSON.stringify(doctors));
  }, [doctors]);

  /* ---------------- SEARCH ---------------- */

  const filteredAppointments = useMemo(() => {
    const term = searchTerm.toLowerCase();

    return appointments.filter(
      (ap) =>
        (ap.name || "").toLowerCase().includes(term) ||
        (ap.phone || "").includes(term) ||
        (ap.email || "").toLowerCase().includes(term) ||
        (ap.role || "").toLowerCase().includes(term),
    );
  }, [appointments, searchTerm]);

  /* ---------------- PAGINATION ---------------- */

  const totalPages = Math.ceil(filteredAppointments.length / rowsPerPage);

  const paginatedAppointments = filteredAppointments.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage,
  );

  /* ---------------- MULTI SELECT ---------------- */

  const handleSelectUser = (id) => {
    setSelectedUsers((prev) => {
      if (prev.includes(id)) {
        return prev.filter((uid) => uid !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleSelectAll = () => {
    const pageIds = paginatedAppointments.map((ap) => ap.id);

    const allSelected = pageIds.every((id) => selectedUsers.includes(id));

    if (allSelected) {
      setSelectedUsers((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedUsers((prev) => [...new Set([...prev, ...pageIds])]);
    }
  };

  useEffect(() => {
    setSelectedUsers([]);
  }, [currentPage, searchTerm]);

  /* ----------Revenue chart ------------- */
  const [revenueData, setRevenueData] = useState({
    labels: [],
    analytics: [],
  });

  useEffect(() => {
    if (!appointments || appointments.length === 0) return;

    const dataMap = {};

    appointments.forEach((ap) => {
      const amount = ap.paidAmount ? Number(ap.paidAmount) : 0;
      const date = ap.date ? new Date(ap.date) : new Date();

      // Group by month-year
      const month = date.toLocaleString("default", {
        month: "short",
        year: "numeric",
      });

      if (dataMap[month]) dataMap[month] += amount;
      else dataMap[month] = amount;
    });

    // Sort months chronologically
    const labels = Object.keys(dataMap).sort(
      (a, b) => new Date(a) - new Date(b),
    );
    const analytics = labels.map((label) => dataMap[label]);

    setRevenueData({ labels, analytics });
  }, [appointments]);

  useEffect(() => {
    if (!appointments || appointments.length === 0) return;

    // If appointments don't have paidAmount/date, create mock data for demo
    const dataMap = {};

    appointments.forEach((ap, index) => {
      // Use paidAmount or default to random number for demo
      const amount = ap.paidAmount
        ? ap.paidAmount
        : Math.floor(Math.random() * 1000 + 100);

      // Use date or generate one based on index for demo
      const date = ap.date
        ? new Date(ap.date)
        : new Date(Date.now() - (appointments.length - index) * 86400000);

      const month = date.toLocaleString("default", {
        month: "short",
        year: "numeric",
      });

      if (dataMap[month]) dataMap[month] += amount;
      else dataMap[month] = amount;
    });

    const labels = Object.keys(dataMap).sort(
      (a, b) => new Date(a) - new Date(b),
    );
    const analytics = labels.map((label) => dataMap[label]);

    setRevenueData({ labels, analytics });
  }, [appointments]);

  /* ---------------- CRUD ---------------- */

  const openCreateModal = () => {
    setEditingAppointment(null);
    setFormData({ name: "", phone: "", email: "", role: "" });
    setShowModal(true);
  };

  const openEditModal = (user) => {
    setEditingAppointment(user);
    setFormData(user);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingAppointment(null);
  };

  // Sum total revenue from all appointments
  const totalRevenue = appointments.reduce(
    (sum, ap) => sum + (ap.paidAmount ? Number(ap.paidAmount) : 0),
    0,
  );

  const totalRevenuePlugin = {
    id: "totalRevenuePlugin",
    afterDraw: (chart) => {
      const {
        ctx,
        chartArea: { top, width },
      } = chart;
      ctx.save();
      ctx.font = "bold 20px Arial";
      ctx.fillStyle = "#111827"; // dark color
      ctx.textAlign = "center";
      ctx.fillText(`Total Revenue: ₹${totalRevenue}`, width / 2, top - 20);
    },
  };
  // Get revenue for last 12 months
  const last12MonthsRevenue = useMemo(() => {
    const today = new Date();
    const months = [];

    // Precompute year-month strings for last 12 months
    const last12 = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const yearMonth = `${d.getFullYear()}-${d.getMonth() + 1}`; // e.g., "2026-3"
      const label = d.toLocaleString("default", {
        month: "short",
        year: "numeric",
      });
      last12.push({ yearMonth, label });
    }

    // Sum revenue per month
    last12.forEach(({ yearMonth, label }) => {
      const [year, month] = yearMonth.split("-").map(Number);
      const revenue = appointments
        .filter((ap) => {
          if (!ap.date) return false;
          const apDate = new Date(ap.date);
          return (
            apDate.getFullYear() === year && apDate.getMonth() + 1 === month
          );
        })
        .reduce((sum, ap) => sum + (Number(ap.paidAmount) || 0), 0);

      months.push({ month: label, revenue });
    });

    return months;
  }, [appointments]);
  /* ---------------- SAVE / CREATE USER ---------------- */
  const handleSaveAppointment = (e) => {
    e.preventDefault();

    if (
      !formData.name ||
      !formData.phone ||
      !formData.email ||
      !formData.role
    ) {
      alert("Please fill all fields");
      return;
    }

    const registeredUsers =
      JSON.parse(localStorage.getItem("registeredUsers")) || [];

    if (editingAppointment) {
      // UPDATE appointments
      const updatedAppointments = appointments.map((ap) =>
        ap.id === editingAppointment.id ? { ...ap, ...formData } : ap,
      );

      setAppointments(updatedAppointments);

      // UPDATE registeredUsers
      const updatedRegisteredUsers = registeredUsers.map((u) =>
        u.email === editingAppointment.email
          ? {
              ...u,
              firstName: formData.name.split(" ")[0] || "",
              lastName: formData.name.split(" ")[1] || "",
              phoneNumber: formData.phone,
              email: formData.email,
              role: formData.role,
              paidAmount:
                u.paidAmount || Math.floor(Math.random() * 1000 + 100),
              date: u.date || new Date().toISOString(),
            }
          : u,
      );

      localStorage.setItem(
        "registeredUsers",
        JSON.stringify(updatedRegisteredUsers),
      );
      localStorage.setItem("appointments", JSON.stringify(updatedAppointments));
    } else {
      // CREATE new user
      const newUser = {
        id: Date.now(),
        ...formData,
        paidAmount: Math.floor(Math.random() * 1000 + 100), // demo revenue
        date: new Date().toISOString(), // demo date
      };

      const updatedAppointments = [...appointments, newUser];

      setAppointments(updatedAppointments);
      localStorage.setItem("appointments", JSON.stringify(updatedAppointments));
    }

    window.dispatchEvent(new Event("storage"));
    closeModal();
  };

  const handleBulkDelete = () => {
    if (!window.confirm("Delete selected users?")) return;

    const registeredUsers =
      JSON.parse(localStorage.getItem("registeredUsers")) || [];

    const updatedRegisteredUsers = registeredUsers.filter(
      (u) => !selectedUsers.includes(u.email),
    );

    const updatedAppointments = appointments.filter(
      (u) => !selectedUsers.includes(u.id),
    );

    localStorage.setItem(
      "registeredUsers",
      JSON.stringify(updatedRegisteredUsers),
    );
    localStorage.setItem("appointments", JSON.stringify(updatedAppointments));

    setAppointments(updatedAppointments);
    setSelectedUsers([]);

    window.dispatchEvent(new Event("storage"));
  };

  /* ---------------- CSV DOWNLOAD ---------------- */

  const handleDownloadCSV = () => {
    const headers = ["Name", "Phone", "Email", "Password", "Role"];
    const rows = filteredAppointments.map((ap) => [
      ap.name,
      ap.phone,
      ap.email,
      ap.password,
      ap.role,
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const blob = new Blob([csv]);

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = "users.csv";

    link.click();
  };

  /* ---------------- CHART ---------------- */

  const chartData = {
    labels: revenueData.labels,
    datasets: [
      {
        label: "Monthly Revenue",
        data: revenueData.analytics,
        borderColor: "#22c55e",
        backgroundColor: "rgba(34,197,94,0.15)",
        tension: 0.4,
        fill: true,
        pointRadius: 8,
        pointHoverRadius: 10,
        borderWidth: 3,
      },
      {
        label: "Total Revenue",
        data: revenueData.labels.map(() => totalRevenue),
        borderColor: "#3b82f6",
        borderDash: [5, 5],
        borderWidth: 2,
        fill: false,
        pointRadius: 0,
        tension: 0,
      },
    ],
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* SIDEBAR */}

      {/* MAIN */}

      <main className="flex-1 p-6">
        {/* HEADER */}

        <div className="flex justify-between mb-6">
          <h1 className="text-3xl font-semibold">
            Welcome Back <b>Super Admin</b>
          </h1>

          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2"
            >
              <div className="w-10 h-10 rounded-full bg-orange-700 text-white flex items-center justify-center">
                {user.initials}
              </div>
              {user.name}
              <MdExpandMore />
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg z-10 overflow-hidden">
                <button
                  onClick={() => navigate("/NewRegistration")}
                  className="w-full px-4 py-3 text-left hover:bg-orange-50 flex items-center gap-2"
                >
                  <MdOutlineEditNote size={22} />
                  Edit Profile
                </button>

                <button
                  onClick={() => navigate("/Settings")}
                  className="w-full px-4 py-3 text-left hover:bg-orange-50 flex items-center gap-2"
                >
                  <MdOutlineSettings size={22} />
                  Settings
                </button>

                <button
                  onClick={() => navigate("/Logout")}
                  className="w-full px-4 py-3 text-left text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <MdOutlinePowerSettingsNew size={22} />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>

        {/* CHART */}

        <div className="bg-white p-6 rounded-xl shadow mb-8">
          <Line data={chartData} height={70} />

          {/* Last 12 months revenue summary */}
          <div className="mt-4">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">Revenue Last 12 Months</h3>
              <MdMemory size={30} />
            </div>

            <div className="flex justify-end w-full mb-6">
              <button
                onClick={() => navigate("/Subscriptions")}
                className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
              >
                <MdCreditCard />
                My Subscriptions
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {last12MonthsRevenue.map((item) => (
                <div
                  key={item.month}
                  className="p-2 bg-gray-100 rounded flex justify-between"
                >
                  <span>{item.month}</span>
                  <span className="font-bold text-orange-700">
                    ₹{item.revenue}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* TABLE */}

        <div className="bg-white p-6 rounded-xl shadow">
          {/* TOP BAR */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <MdPersonSearch size={24} className="text-xl" />

              <div className="relative">
                <MdSearch className="absolute left-3 top-3 text-gray-500" />

                <input
                  type="text"
                  placeholder="Search user"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-10 border px-4 py-2 rounded-lg"
                />
              </div>

              {/* <button
                onClick={openCreateModal}
                className="bg-orange-600 text-white px-4 py-2 rounded"
              >
                <FaPlus /> Add User
              </button> */}
            </div>

            <button
              onClick={handleDownloadCSV}
              className="bg-orange-600 text-white px-4 py-2 rounded"
            >
              <FaDownload /> Download CSV
            </button>
          </div>

          {/* BULK DELETE */}

          {selectedUsers.length > 0 && (
            <button
              onClick={handleBulkDelete}
              className="mb-4 bg-red-600 text-white px-4 py-2 rounded"
            >
              Delete Selected ({selectedUsers.length})
            </button>
          )}

          {/* TABLE */}

          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th>
                  <input
                    type="checkbox"
                    onChange={handleSelectAll}
                    checked={
                      paginatedAppointments.length > 0 &&
                      paginatedAppointments.every((u) =>
                        selectedUsers.includes(u.id),
                      )
                    }
                  />
                </th>
                <th className="text-left px-4 py-2">
                  <Typography className="font-bold text-left">
                    UserName
                  </Typography>
                </th>
                <th className="text-left px-4 py-2">
                  <Typography className="font-bold text-left">
                    PhoneNumber
                  </Typography>
                </th>
                <th className="text-left px-4 py-2">
                  <Typography className="font-bold text-left">Email</Typography>
                </th>
                <th className="text-left px-4 py-2">
                  <Typography className="font-bold text-left">
                    Password
                  </Typography>
                </th>
                <th className="text-left px-4 py-2">
                  <Typography className="font-bold text-left">
                    Practice
                  </Typography>
                </th>
                <th className="text-left px-4 py-2">Role</th>

                <th className="text-left px-4 py-2">Actions</th>
              </tr>
            </thead>

            <tbody>
              {paginatedAppointments.map((ap) => (
                <tr key={ap.id} className="border-b">
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(ap.id)}
                      onChange={() => handleSelectUser(ap.id)}
                    />
                  </td>

                  <td>{ap.name}</td>

                  <td>
                    <PhoneInput
                      value={ap.phone}
                      disabled
                      inputClass="border-none bg-transparent"
                    />
                  </td>

                  <td>{ap.email}</td>
                  <td>{ap.password}</td>
                  <td>{ap.practice}</td>

                  <td>
                    <select
                      value={ap.role}
                      onChange={(e) => {
                        const role = e.target.value;
                        setAppointments((prev) =>
                          prev.map((u) =>
                            u.id === ap.id ? { ...u, role } : u,
                          ),
                        );
                      }}
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role}>{role}</option>
                      ))}
                    </select>
                  </td>

                  <td className="flex gap-3">
                    <button
                      onClick={() => openEditModal(ap)}
                      style={{ color: "orange" }}
                    >
                      <MdEdit />
                    </button>

                    <button
                      className="delete-btn"
                      onClick={() => handleDelete(ap.id)}
                      style={{ color: "red" }}
                    >
                      <MdDelete />
                    </button>

                    <button
                      onClick={() => handleClone(ap)}
                      style={{ color: "orange" }}
                    >
                      <MdFileCopy />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {/* MODAL */}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white p-6 rounded-xl w-96">
            <h3 className="text-xl font-semibold mb-4">
              {editingAppointment ? "Edit User" : "Add User"}
            </h3>

            <form onSubmit={handleSaveAppointment} className="space-y-4">
              <input
                type="text"
                placeholder="Name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full border px-4 py-2 rounded"
              />

              <PhoneInput
                country={"in"}
                value={formData.phone}
                onChange={(phone) => setFormData({ ...formData, phone })}
              />

              <input
                type="text"
                placeholder="Practice"
                value={formData.practice}
                onChange={(e) =>
                  setFormData({ ...formData, practice: e.target.value })
                }
                className="w-full border px-4 py-2 rounded"
              />
              <input
                type="email"
                placeholder="Email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="w-full border px-4 py-2 rounded"
              />

              <select
                value={formData.role}
                onChange={(e) =>
                  setFormData({ ...formData, role: e.target.value })
                }
                className="w-full border px-4 py-2 rounded"
              >
                <option value="">Select role</option>

                {ROLE_OPTIONS.map((role) => (
                  <option key={role}>{role}</option>
                ))}
              </select>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="bg-gray-300 px-4 py-2 rounded"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="bg-orange-600 text-white px-4 py-2 rounded"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
