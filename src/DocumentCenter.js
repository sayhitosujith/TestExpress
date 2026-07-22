import {
  DocumentTextIcon,
  DocumentDuplicateIcon,
  ClipboardDocumentCheckIcon,
  ClipboardDocumentListIcon,
  EnvelopeIcon
} from "@heroicons/react/24/outline";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./PatientPortal.css";
import {
  Typography,
  Breadcrumbs,
} from "@material-tailwind/react";

export default function DocumentCenter() {
  const navigate = useNavigate();
  const cards = [
    { title: "Documents", icon: <DocumentTextIcon className="h-8 w-8 text-purple-500" />, link: "#" },
    { title: "Payslips", icon: <DocumentDuplicateIcon className="h-8 w-8 text-orange-500" />, link: "#" },
    { title: "Form 16", icon: <ClipboardDocumentCheckIcon className="h-8 w-8 text-pink-500" />, link: "#" },
    { title: "Company Policies", icon: <ClipboardDocumentListIcon className="h-8 w-8 text-orange-500" />, link: "#" },
    { title: "Forms", icon: <ClipboardDocumentListIcon className="h-8 w-8 text-red-400" />, link: "#" },
  ];

  const [showProfileMenu, setShowProfileMenu] = useState(false);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">

      {/* Top-right User Badge */}
<div className="flex justify-end">
  <div
    className="user-badge"
    onClick={() => setShowProfileMenu(!showProfileMenu)}
  >
    <div className="user-icon">SS</div>
    <span className="username">Sujith S</span>

    {showProfileMenu && (
      <div className="profile-dropdown">
        <a href="/Profile">Edit Profile</a>
        <a href="/Settings">Settings</a>
        <a href="/Logout">Logout</a>
      </div>
    )}
  </div>
</div>

      {/* Breadcrumbs */}
      <Breadcrumbs className="mb-4">
        <Typography
          as="a"
          href="/Welcome"
          color="blue-gray"
          className="cursor-pointer hover:underline"
          onClick={() => navigate("/")}
        >
          Home
        </Typography>
        <Typography
          as="a"
          href="/PatientPortal"
          color="blue-gray"
          className="cursor-pointer hover:underline"
          onClick={() => navigate("/PatientPortal")}
        >
          Patient Portal
        </Typography>
        <Typography color="blue-gray">Doctor List</Typography>
      </Breadcrumbs>

      {/* Top Banner */}
      <div className="bg-white rounded-lg shadow p-8 flex justify-between items-center mt-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">
            We've got it sorted for you!
          </h2>
          <p className="text-gray-600">
            All Documents are now in one place. <br />
            You can now request a new letter if you don't find the one you were looking for.
          </p>
        </div>

      </div>

      {/* Document Cards */}
      <h3 className="text-lg font-semibold mt-10 mb-4">Documents</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {cards.map((card, index) => (
          <div
            key={index}
            className="bg-white p-6 rounded-lg shadow hover:shadow-md transition cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center space-x-3">
              {card.icon}
              <span className="text-gray-700 font-medium">{card.title}</span>
            </div>
            <a href={card.link} className="text-indigo-500 text-sm font-semibold">
              View All
            </a>
          </div>
        ))}
      </div>

      {/* Request Section */}
      <h3 className="text-lg font-semibold mt-10 mb-4">Request</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white p-6 rounded-lg shadow flex flex-col justify-between">
          <div className="flex items-center space-x-3">
            <EnvelopeIcon className="h-8 w-8 text-orange-500" />
            <span className="text-gray-700 font-medium">Letters</span>
          </div>

          <button type="button" className="text-indigo-500 text-sm font-semibold mt-2">View All</button>

          <div className="mt-4 text-sm text-gray-500">
            <p>Pending: 0</p>
            <p>Closed: 0</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-gray-400 text-sm mt-10">
        v6.3.0-prod-1642 | Privacy Policy | Terms of Service
      </div>
    </div>
  );
}
