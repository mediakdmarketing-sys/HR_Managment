import { useState } from "react";
import {
  LayoutDashboard,
  LogOut,
  Menu,
  X,
  SquareDashedKanban,
  Timer,
  ChartSpline,
  FolderOutput,
  CreditCard,
  IdCardLanyard,
  UserRoundCog,
  UserRoundSearch,
  UsersRound,
} from "lucide-react";

import { Link, useLocation, useNavigate } from "react-router-dom";
import { logoutUser } from "../api/authApi";
import { getUser } from "../utils/auth";

const Sidebar = () => {
  const user = getUser();

  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);

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

  const requestLogout = () => setIsLogoutDialogOpen(true);
  const cancelLogout = () => setIsLogoutDialogOpen(false);

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

        <nav className="flex-1 space-y-3 p-4">
          <Link
            to="/dashboard"
            onClick={closeSidebar}
            className={linkClassName("/dashboard")}
          >
            <LayoutDashboard />
            Dashboard
          </Link>

          {[
            ...(user?.role === "HR"
              ? [
                  ["/employees", IdCardLanyard, "Employee Management"],
                  ["/attendance", Timer, "Attendance & Work Hours"],
                  ["/leave", FolderOutput, "Leave Management"],
                  ["/payslip", CreditCard, "Payroll & Payslips"],
                  ["/performance", ChartSpline, "Performance & Training"],
                ]
              : []),
            ...(user?.role === "Managers" || user?.role === "Team Lead"
              ? [
                  ["/employees", UsersRound, "Team Employees"],
                  ["/attendance", Timer, "Attendance & Work Hours"],
                  ["/leave", FolderOutput, "Leave Management"],
                  ["/performance", ChartSpline, "Performance & Training"],
                ]
              : []),
            ...(user?.role === "Recruiters"
              ? [[
                  "/employees",
                  UserRoundSearch,
                  "Employee Management",
                ]]
              : []),
            ...(user?.role === "Finance"
              ? [[
                  "/payslip",
                  CreditCard,
                  "Payroll & Payslips",
                ]]
              : []),
            ...(user?.role === "Employees"
              ? [
                  ["/attendance", Timer, "My Attendance"],
                  ["/leave", FolderOutput, "My Leave"],
                  ["/payslip", CreditCard, "My Payslips"],
                  ["/performance", ChartSpline, "My Performance"],
                ]
              : []),
          ].map(([path, Icon, label]) => (
            <Link
              key={path}
              to={path}
              onClick={closeSidebar}
              className={linkClassName(path)}
            >
              <Icon />
              {label}
            </Link>
          ))}

          <Link
            to="/profile"
            onClick={closeSidebar}
            className={linkClassName("/profile")}
          >
            <UserRoundCog />
            Profile
          </Link>
        </nav>

        {/* Logout */}
        <button
          onClick={requestLogout}
          className="m-4 bg-slate-800 text-white p-3 rounded-xl flex items-center justify-center gap-2 hover:bg-teal-700 transition"
        >
          <LogOut />
          Logout
        </button>
      </div>

      {isLogoutDialogOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              cancelLogout();
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-dialog-title"
          >
            <h2
              id="logout-dialog-title"
              className="text-xl font-bold text-slate-800 text-center"
            >
              Are you sure you want to log out?
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              You will need to sign in again to access your workspace.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={cancelLogout}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={logout}
                className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                Yes, log out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
