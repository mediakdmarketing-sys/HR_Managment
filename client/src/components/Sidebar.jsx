import { useState } from "react";
import {
  LayoutDashboard,
  PlusCircle,
  Ticket,
  User,
  LogOut,
  Menu,
  X,
  SquareDashedKanban,Timer,ChartSpline ,FolderOutput ,CreditCard ,IdCardLanyard  
} from "lucide-react";

import { Link, useLocation, useNavigate } from "react-router-dom";
import { logoutUser } from "../api/authApi";
import { getUser } from "../utils/auth";

const Sidebar = () => {
  const user = getUser();

  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  const logout = async () => {
    try {
      await logoutUser();
    } catch (error) {
      console.log(error);
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      setIsOpen(false);
      navigate("/login");
    }
  };

  const closeSidebar = () => setIsOpen(false);
  const linkClassName = (path) =>
    `flex items-center gap-3 p-3 rounded-xl ${
      location.pathname === path ? "bg-teal-50 text-teal-700" : ""
    } hover:bg-teal-50`;

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="sm:hidden fixed top-4 left-4 z-50 bg-white p-2 rounded-lg shadow-md"
      >
        <Menu size={24} />
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 sm:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed top-0 left-0 h-screen rounded-3xl p-2
          w-64 bg-white shadow-lg z-50
          transform transition-transform duration-300
          ${isOpen ? "translate-x-0" : "-translate-x-full sm:translate-x-0"}
          flex flex-col
        `}
      >
        {/* Header */}
        <div className="p-6  flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-content-center rounded-2xl bg-linear-to-br from-slate-800 to-teal-600 shadow-lg shadow-teal-600/20">
              <SquareDashedKanban  className="text-white w-6 h-6" />
            </div>

            <h2 className="text-2xl font-bold text-slate-800">HRMS</h2>
          </div>
          <button onClick={closeSidebar} className="sm:hidden">
            <X size={24} />
          </button>
        </div>

        {/* Navigation */}

        {user?.role === "admin" ? (
          <nav className="flex-1 p-4 space-y-3">
            <Link
              to="/dashboard"
              onClick={closeSidebar}
              className={linkClassName("/dashboard")}
            >
              <LayoutDashboard />
              Dashboard
            </Link>

            <Link
              to="/all-tickets"
              onClick={closeSidebar}
              className={linkClassName("/all-tickets")}
            >
              <PlusCircle />
              All Tickets
            </Link>
            <Link
              to="/all-users"
              onClick={closeSidebar}
              className={linkClassName("/all-users")}
            >
              <PlusCircle />
              All Users
            </Link>

            <Link
              to="/profile"
              onClick={closeSidebar}
              className={linkClassName("/profile")}
            >
              <User />
              Profile
            </Link>
          </nav>
        ) : user?.role === "user" ? (
          <nav className="flex-1 p-4 space-y-3">
            <Link
              to="/dashboard"
              onClick={closeSidebar}
              className={linkClassName("/dashboard")}
            >
              <LayoutDashboard />
              Dashboard
            </Link>

            <Link
              to="/create-ticket"
              onClick={closeSidebar}
              className={linkClassName("/create-ticket")}
            >
              <PlusCircle />
              Create Ticket
            </Link>

            <Link
              to="/my-tickets"
              onClick={closeSidebar}
              className={linkClassName("/my-tickets")}
            >
              <Ticket />
              My Tickets
            </Link>

            <Link
              to="/profile"
              onClick={closeSidebar}
              className={linkClassName("/profile")}
            >
              <User />
              Profile
            </Link>
          </nav>
        ) : (
          <nav className="flex-1 p-4 space-y-3">
            <Link
              to="/dashboard"
              onClick={closeSidebar}
              className={linkClassName("/dashboard")}
            >
              <LayoutDashboard />
              Dashboard
            </Link>

            <Link
              to="/attendance"
              onClick={closeSidebar}
              className={linkClassName("/attendance")}
            >
              <Timer  />
              Attendance & Work Hours
            </Link>

            <Link
              to="/employees"
              onClick={closeSidebar}
              className={linkClassName("/employees")}
            >
              <IdCardLanyard  />
              Employee Management
            </Link>

            <Link
              to="/payslip"
              onClick={closeSidebar}
              className={linkClassName("/payslip")}
            >
              <CreditCard  />
              Payroll & Payslips
            </Link>

            <Link
              to="/leave"
              onClick={closeSidebar}
              className={linkClassName("/leave")}
            >
              <FolderOutput  />
              Leave Management
            </Link>

            <Link
              to="/performance"
              onClick={closeSidebar}
              className={linkClassName("/performance")}
            >
              <ChartSpline  />
              Performance & Training
            </Link>
          </nav>
        )}

        {/* Logout */}
        <button
          onClick={logout}
          className="m-4 bg-slate-800 text-white p-3 rounded-xl flex items-center justify-center gap-2 hover:bg-teal-700 transition"
        >
          <LogOut />
          Logout
        </button>
      </div>
    </>
  );
};

export default Sidebar;
