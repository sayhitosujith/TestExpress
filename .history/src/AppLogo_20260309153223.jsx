import { Outlet, useNavigate } from "react-router-dom";
import { FaUsers, FaClipboardList } from "react-icons/fa";
import logo from "./assets/DutyDentist.png";

export default function AppLayout() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen bg-gray-100">

      {/* LEFT SIDEBAR */}
      <aside className="w-64 bg-[#ebe8e8] text-black flex flex-col shadow-md">

        {/* Logo */}
        <div className="text-center py-6 border-b">
          <img
            src={logo}
            alt="logo"
            className="w-32 mx-auto object-contain"
          />
        </div>

        {/* Navigation */}
        <ul className="mt-4 px-4 space-y-2">

          <li>
            <button
              onClick={() => navigate("/Customer_home")}
              className="flex items-center gap-2 w-full p-3 hover:bg-gray-200 rounded"
            >
              <FaClipboardList /> Home
            </button>
          </li>

          <li>
            <button
              onClick={() => navigate("/DoctorList")}
              className="flex items-center gap-2 w-full p-3 hover:bg-gray-200 rounded"
            >
              <FaUsers /> Doctors
            </button>
          </li>

          <li>
            <button
              onClick={() => navigate("/PatientPortal")}
              className="flex items-center gap-2 w-full p-3 hover:bg-gray-200 rounded"
            >
              <FaUsers /> Patients
            </button>
          </li>

        </ul>
      </aside>

      {/* PAGE CONTENT */}
      <main className="flex-1 p-6">
        <Outlet />
      </main>

    </div>
  );
}