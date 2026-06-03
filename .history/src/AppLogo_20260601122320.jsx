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

        /
      </aside>

      {/* PAGE CONTENT */}
      <main className="flex-1 p-6">
        <Outlet />
      </main>

    </div>
  );
}