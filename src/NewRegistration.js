import React, { useState, useEffect } from "react";
import { Typography, Input, Button } from "@material-tailwind/react";
import { Link } from "react-router-dom";
import { PencilIcon, TrashIcon } from "@heroicons/react/24/solid";
import { MdFileCopy } from "react-icons/md";
import emailjs from "@emailjs/browser";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

function NewRegistration() {
  const sendRegistrationEmail = async (user) => {
    const templateParams = {
      first_name: user.firstName,
      email: user.email,
      phone: user.phoneNumber,
    };

    try {
      await emailjs.send(
        "service_xxxxx",
        "template_xxxxx",
        templateParams,
        "public_xxxxx",
      );
      console.log("✅ Email sent successfully");
    } catch (error) {
      console.error("❌ Email failed:", error);
    }
  };

  const emptyForm = {
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    password: "",
    confirmPassword: "",
    zipCode: "",
    practice: "",
    role: "",
    profilePicture: "",
  };
  const [showGrid, setShowGrid] = useState(true);
  useEffect(() => {
    localStorage.setItem("showRegisteredUsersGrid", JSON.stringify(showGrid));
  }, [showGrid]);
  useEffect(() => {
    const savedSetting = localStorage.getItem("showRegisteredUsersGrid");
    if (savedSetting !== null) {
      setShowGrid(JSON.parse(savedSetting));
    }
  }, []);
  const [users, setUsers] = useState(() => {
    const storedUsers = localStorage.getItem("registeredUsers");
    return storedUsers ? JSON.parse(storedUsers) : [];
  });

  const [formData, setFormData] = useState(emptyForm);
  const [editIndex, setEditIndex] = useState(null);
  const [phoneError, setPhoneError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUsers, setSelectedUsers] = useState([]);

  const usersPerPage = 5;
  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;
  const currentUsers = users.slice(indexOfFirstUser, indexOfLastUser);
  const totalPages = Math.ceil(users.length / usersPerPage);

  // Load users on mount
  useEffect(() => {
    const loadUsers = () => {
      const data = JSON.parse(localStorage.getItem("registeredUsers")) || [];
      setUsers(data);
    };
    loadUsers();
    window.addEventListener("storage", loadUsers);
    return () => window.removeEventListener("storage", loadUsers);
  }, []);

  // Auto-save to localStorage
  useEffect(() => {
    localStorage.setItem("registeredUsers", JSON.stringify(users));
  }, [users]);

  // Unique ID generator
  const generateUniqueId = () => "_" + Math.random().toString(36).substr(2, 9);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData((prev) => ({
        ...prev,
        profilePicture: reader.result,
      }));
    };

    reader.readAsDataURL(file);
  };

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "phoneNumber") {
      const onlyDigits = value.replace(/\D/g, "");
      if (onlyDigits.length <= 10) {
        setFormData((prev) => ({ ...prev, phoneNumber: onlyDigits }));
      }
      setPhoneError(
        onlyDigits.length > 0 && onlyDigits.length < 10
          ? "Phone number must be 10 digits"
          : "",
      );
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Submit form
  const handleSubmit = (e) => {
    e.preventDefault();
    const {
      firstName,
      lastName,
      email,
      phoneNumber,
      password,
      confirmPassword,
      zipCode,
      practice,
      role,
    } = formData;

    if (
      !firstName ||
      !lastName ||
      !email ||
      !phoneNumber ||
      !password ||
      !confirmPassword ||
      !zipCode ||
      !practice ||
      !role
    ) {
      alert("Please fill all fields");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert("Enter a valid email");
      return;
    }

    if (!/^[0-9]{10}$/.test(phoneNumber)) {
      setPhoneError("Phone number must be exactly 10 digits");
      return;
    }

    if (password !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    if (editIndex !== null) {
      if (
        users.some(
          (user, i) => user.phoneNumber === phoneNumber && i !== editIndex,
        )
      ) {
        setPhoneError("Phone number already registered");
        return;
      }

      const updatedUsers = [...users];
      updatedUsers[editIndex] = {
        ...updatedUsers[editIndex],
        firstName,
        lastName,
        email,
        phoneNumber,
        zipCode,
        practice,
        password,
        role,
        profilePicture: formData.profilePicture,
      };
      setUsers(updatedUsers);
      alert("User Updated Successfully!");
    } else {
      if (users.some((user) => user.email === email)) {
        alert("Email already registered");
        return;
      }
      if (users.some((user) => user.phoneNumber === phoneNumber)) {
        setPhoneError("Phone number already registered");
        return;
      }

      const newUser = {
        id: generateUniqueId(),
        firstName,
        lastName,
        email,
        phoneNumber,
        zipCode,
        practice,
        password,
        role,
        profilePicture: formData.profilePicture,
      };
      setUsers([...users, newUser]);

      sendRegistrationEmail(newUser);

      alert("User Registered Successfully! Email sent.");
    }

    setFormData(emptyForm);
    setEditIndex(null);
    setPhoneError("");
  };

  // Edit user
  const handleEdit = (index) => {
    const userToEdit = users[index];
    setFormData({ ...userToEdit, confirmPassword: userToEdit.password });
    setEditIndex(index);
    setPhoneError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Delete user
  const handleDelete = (index) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    const updatedUsers = users.filter((_, i) => i !== index);
    setUsers(updatedUsers);
  };

  // Clone user
  const handleClone = (user) => {
    const clonedUser = {
      ...user,
      id: generateUniqueId(),
      email: `copy_${Date.now()}_${user.email}`,
    };
    setUsers([...users, clonedUser]);
  };

  // Selection
  const handleSelectUser = (email) => {
    setSelectedUsers((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email],
    );
  };

  const handleSelectAll = () => {
    const currentEmails = currentUsers.map((u) => u.email);
    const allSelected = currentEmails.every((email) =>
      selectedUsers.includes(email),
    );
    if (allSelected) {
      setSelectedUsers((prev) =>
        prev.filter((email) => !currentEmails.includes(email)),
      );
    } else {
      setSelectedUsers((prev) => [...new Set([...prev, ...currentEmails])]);
    }
  };

  const handleBulkDelete = () => {
    if (!window.confirm("Delete selected users?")) return;
    const updatedUsers = users.filter(
      (user) => !selectedUsers.includes(user.email),
    );
    setUsers(updatedUsers);
    setSelectedUsers([]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-r from-orange-100 via-orange-700 to-orange-900 p-6 md:p-10">
      {/* CENTER WRAPPER */}
      <div className="flex items-center justify-center min-h-screen">
        {/* CARD */}
        <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl p-10">
          <h2 className="text-3xl font-bold text-center text-orange-700 mb-8">
            {editIndex !== null ? "Edit User" : "New User Registration"}
          </h2>
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">
                Select Profile Picture
              </label>

              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="border rounded-md p-2 w-full"
              />

              {formData.profilePicture && (
                <img
                  src={formData.profilePicture}
                  alt="Preview"
                  className="mt-3 h-20 w-20 rounded-full object-cover border"
                />
              )}
            </div>
            <Input
              label="First Name"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
            />
            <Input
              label="Last Name"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
            />
            <Input
              label="Email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
            />
            <div>
              <Input
                label="Phone Number"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleChange}
                maxLength={10}
              />
              {phoneError && (
                <p className="text-red-500 text-sm mt-1">{phoneError}</p>
              )}
            </div>
            <Input
              label="Password"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
            />
            <Input
              label="Confirm Password"
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
            />
            <Input
              label="Zip Code"
              name="zipCode"
              value={formData.zipCode}
              onChange={handleChange}
            />
            <select
              name="practice"
              value={formData.practice}
              onChange={handleChange}
              className="border rounded-md p-2"
            >
              <option value="">Select Practice</option>
              <option value="HerveyBay">Hervey Bay Dental</option>
              <option value="SunshineCoast">Sunshine Coast Dental</option>
              <option value="Brisbane">Brisbane Dental Clinic</option>
            </select>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="border rounded-md p-2"
            >
              <option value="">Select Role</option>
              <option value="Super Admin">Super Admin</option>
              <option value="Admin">Admin</option>
              <option value="Doctor">Doctor</option>
              <option value="Receptionist">Receptionist</option>
            </select>

            <div className="md:col-span-2 flex gap-4 mt-4">
              <Button
                type="submit"
                className="flex-1 text-white font-semibold py-2 rounded-md 
             bg-gradient-to-r from-purple-600 to-orange-500 
             hover:opacity-90 transition"
              >
                {editIndex !== null ? "Update User" : "Register"}
              </Button>
              <Button
                variant="outlined"
                color="red"
                className="flex-1"
                onClick={() => {
                  setFormData(emptyForm);
                  setEditIndex(null);
                  setPhoneError("");
                }}
              >
                Cancel
              </Button>
            </div>
          </form>

          <Typography variant="small" className="mt-6 text-center">
            Already have an account?{" "}
            <Link
              to="/my-app"
              className="inline-block text-white font-bold uppercase tracking-wide px-6 py-2 rounded-md
             bg-gradient-to-r from-purple-600 to-orange-500
             hover:shadow-lg hover:scale-[1.02] transition-all"
            >
              Login
            </Link>
          </Typography>

          {/* <div className="flex justify-center items-center gap-3 mb-6">
  <span className="font-semibold text-gray-700">
    {showGrid ? "Hide Registered Users" : "Show Registered Users"}
  </span>

  <label className="relative inline-flex items-center cursor-pointer">
    <input
      type="checkbox"
      className="sr-only peer"
      checked={showGrid}
      onChange={() => setShowGrid(!showGrid)}
    />
    <div className="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:bg-orange-600 transition-colors"></div>
    <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
  </label>
</div> */}

          {users.length > 0 && showGrid && (
            <div className="mt-12">
              <h3 className="text-xl font-semibold text-center mb-6 text-orange-700">
                Registered Users
              </h3>

              {selectedUsers.length > 0 && (
                <div className="mb-4 text-center">
                  <Button color="red" onClick={handleBulkDelete}>
                    Delete Selected ({selectedUsers.length})
                  </Button>
                </div>
              )}

              <div className="overflow-x-auto rounded-xl shadow">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-orange-600 text-white">
                    <tr>
                      <th className="p-3">
                        <input
                          type="checkbox"
                          onChange={handleSelectAll}
                          checked={
                            currentUsers.length > 0 &&
                            currentUsers.every((u) =>
                              selectedUsers.includes(u.email),
                            )
                          }
                        />
                      </th>
                      <th className="p-3">Profile</th>
                      <th className="p-3">Name</th>
                      <th className="p-3">Email</th>
                      <th className="p-3">Phone</th>
                      <th className="p-3">Zip</th>
                      <th className="p-3">Practice</th>
                      <th className="p-3">Role</th>
                      <th className="p-3">Password</th>
                      <th className="p-3 text-center">Actions</th>
                    </tr>
                  </thead>

                  <tbody className="bg-gray-50">
                    {currentUsers.map((user) => {
                      const realIndex = users.findIndex(
                        (u) => u.email === user.email,
                      );

                      return (
                        <tr
                          key={user.id}
                          className="border-b hover:bg-orange-50"
                        >
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={selectedUsers.includes(user.email)}
                              onChange={() => handleSelectUser(user.email)}
                            />
                          </td>
                          <td className="p-3">
                            {user.profilePicture ? (
                              <img
                                src={user.profilePicture}
                                alt="Profile"
                                className="h-10 w-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center text-xs">
                                N/A
                              </div>
                            )}
                          </td>
                          <td className="p-3">
                            {user.firstName} {user.lastName}
                          </td>
                          <td className="p-3">{user.email}</td>
                          <td className="p-3">{user.phoneNumber}</td>
                          <td className="p-3">{user.zipCode}</td>
                          <td className="p-3">{user.practice}</td>
                          <td className="p-3">{user.role}</td>
                          <td className="p-3">{user.password}</td>
                          <td className="p-3 text-center flex justify-center gap-3">
                            <button
                              onClick={() => handleEdit(realIndex)}
                              className="bg-orange-100 p-2 rounded-full hover:bg-orange-200"
                            >
                              <PencilIcon className="h-5 w-5 text-orange-600" />
                            </button>

                            <button
                              onClick={() => handleClone(user)}
                              className="bg-orange-100 p-2 rounded-full hover:bg-orange-200"
                            >
                              <MdFileCopy className="h-5 w-5 text-orange-600" />
                            </button>

                            <button
                              onClick={() => handleDelete(realIndex)}
                              className="bg-red-100 p-2 rounded-full hover:bg-red-200"
                            >
                              <TrashIcon className="h-5 w-5 text-black-600" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="flex justify-center items-center gap-4 mt-6">
                  <Button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                    color="orange"
                  >
                    Previous
                  </Button>
                  <span className="font-semibold">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(currentPage + 1)}
                    color="orange"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default NewRegistration;
