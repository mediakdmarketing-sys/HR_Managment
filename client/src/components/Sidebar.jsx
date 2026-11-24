
import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
  SquareDashedKanban,
  Timer,
  FolderOutput,
  FileSignature,
  Wallet,
  CreditCard,
  IdCardLanyard,
  BriefcaseBusiness,
  SearchCheck,
  MessageSquare,
  CalendarDays,
  Inbox,
  Upload,
  ListChecks,
  Send,
  Mail,
  Bell,
  Settings,
} from "lucide-react";

import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { logoutUser } from "../api/authApi";
import { clearSession, getUser } from "../utils/auth";
import { useMyPhoto } from "../utils/profilePhoto";
import Avatar from "./Avatar";
import {
  getRecruitmentGroupForPath,
  RECRUITMENT_NAVIGATION,
} from "../navigation/recruitmentRoutes";

// HR-only navigation - Organized logically with Notifications & Settings at the bottom
const HR_NAV_ITEMS = [
  ["/recruitment", BriefcaseBusiness, "Recruitment"],
  ["/employees", IdCardLanyard, "Employee Management"],
  ["/attendance", Timer, "Attendance & Work Hours"],
  ["/leave", FolderOutput, "Leave Management"],
  ["/payslip", CreditCard, "Payroll & Payslips"],
  ["/templates", FileSignature, "Letter Templates"],
  ["/expenses", Wallet, "Expense Tracker"],
  ["/notifications", Bell, "Notifications"],
  ["/settings", Settings, "Settings"],
];

const Sidebar = () => {
  const user = getUser();

  const location = useLocation();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] =
    useState(false);
  const [recruitmentExpansion, setRecruitmentExpansion] = useState(() => ({
    pathname: location.pathname,
    expanded: location.pathname.startsWith("/recruitment"),
  }));
  const [groupExpansion, setGroupExpansion] = useState(() => {
    const activeGroup = getRecruitmentGroupForPath(location.pathname);
    return {
      pathname: location.pathname,
      groups: activeGroup ? new Set([activeGroup]) : new Set(),
    };
  });
  const recruitmentExpanded = recruitmentExpansion.pathname === location.pathname
    ? recruitmentExpansion.expanded
    : location.pathname.startsWith("/recruitment");
  const activeGroup = getRecruitmentGroupForPath(location.pathname);
  const expandedGroups = groupExpansion.pathname === location.pathname
    ? groupExpansion.groups
    : activeGroup ? new Set([activeGroup]) : new Set();

  const photo = useMyPhoto();

  const logout = async () => {
    try {
      await logoutUser();
    } catch (error) {
      console.log(error);
    } finally {
      await clearSession();
      setIsOpen(false);
      navigate("/login");
    }
  };

  const requestLogout = () => setIsLogoutDialogOpen(true);
  const cancelLogout = () => setIsLogoutDialogOpen(false);

  const closeSidebar = () => setIsOpen(false);

  const linkClassName = (path) =>
    `flex items-center gap-3 p-3 rounded-xl ${
      location.pathname === path
        ? "bg-teal-50 text-teal-700"
        : ""
    } hover:bg-teal-50`;

  const recruitmentLinkClassName = ({ isActive }) =>
    `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
      isActive ? "bg-teal-50 font-semibold text-teal-800" : "text-slate-600"
    } hover:bg-teal-50`;

  const toggleGroup = (label) => {
    const next = new Set(expandedGroups);
    if (next.has(label)) next.delete(label);
    else next.add(label);
    setGroupExpansion({ pathname: location.pathname, groups: next });
  };

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
          fixed inset-y-0 left-0 h-[100dvh]
          w-[min(16rem,calc(100vw-1rem))]
          rounded-r-3xl p-2 bg-white shadow-lg z-50
          transform transition-transform duration-300
          ${
            isOpen
              ? "translate-x-0"
              : "-translate-x-full sm:translate-x-0"
          }
          flex flex-col overflow-hidden
        `}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-content-center rounded-2xl bg-linear-to-br from-slate-800 to-teal-600 shadow-lg shadow-teal-600/20">
              <SquareDashedKanban className="text-white w-6 h-6" />
            </div>

            <h2 className="text-2xl font-bold text-slate-800">
              HRMS
            </h2>
          </div>

          <button
            onClick={closeSidebar}
            className="sm:hidden"
          >
            <X size={24} />
          </button>
        </div>

        {/* HR Navigation */}
        <nav className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          <Link
            to="/dashboard"
            onClick={closeSidebar}
            className={linkClassName("/dashboard")}
          >
            <LayoutDashboard />
            Dashboard
          </Link>

          {user?.role === "HR" &&
            HR_NAV_ITEMS.map(([path, Icon, label]) => path === "/recruitment" ? (
              <div key={path} className="space-y-1">
                <button
                  type="button"
                  aria-expanded={recruitmentExpanded}
                  onClick={() => setRecruitmentExpansion({
                    pathname: location.pathname,
                    expanded: !recruitmentExpanded,
                  })}
                  className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition ${
                    location.pathname.startsWith("/recruitment")
                      ? "bg-teal-50 font-semibold text-teal-800"
                      : "text-slate-700"
                  } hover:bg-teal-50`}
                >
                  <Icon />
                  <span className="flex-1">{label}</span>
                  {recruitmentExpanded ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
                </button>

                {recruitmentExpanded && (
                  <div className="ml-4 space-y-1 border-l border-slate-200 pl-3">
                    {RECRUITMENT_NAVIGATION.map((item) => {
                      const GroupIcon = item.label === "Recruitment Overview"
                        ? LayoutDashboard
                        : item.label === "Jobs"
                          ? BriefcaseBusiness
                          : item.label === "Candidates"
                            ? IdCardLanyard
                            : item.label === "Applications"
                              ? ListChecks
                              : item.label === "Interviews" || item.label === "Schedule Management"
                                ? CalendarDays
                                : item.label === "Conversations / Messages" || item.label === "Conversations"
                                  ? MessageSquare
                                  : item.label === "Hiring Alerts" || item.label === "Notifications"
                                    ? Bell
                                    : item.label === "Email Settings"
                                      ? Mail
                                      : item.label === "AI Analysis"
                                        ? SearchCheck
                                        : Settings;
                      const groupExpanded = expandedGroups.has(item.label);
                      const activeChild = item.children?.some(
                        (child) => child.path === location.pathname,
                      );
                      if (item.children) {
                        return (
                          <div key={item.label}>
                            <button
                              type="button"
                              aria-expanded={groupExpanded}
                              onClick={() => toggleGroup(item.label)}
                              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                                activeChild ? "font-semibold text-teal-800" : "text-slate-600"
                              } hover:bg-teal-50`}
                            >
                              <GroupIcon size={16} />
                              <span className="flex-1 text-left">{item.label}</span>
                              {groupExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                            </button>
                            {groupExpanded && (
                              <div className="ml-3 space-y-1 border-l border-slate-200 pl-2">
                                {item.children.map((child) => (
                                  <NavLink
                                    key={child.path}
                                    to={child.path}
                                    onClick={closeSidebar}
                                    className={recruitmentLinkClassName}
                                  >
                                    {child.page === "resume-upload" ? <Upload size={15} /> :
                                      child.page === "ai-results" ? <ListChecks size={15} /> :
                                        child.page === "chats" ? <MessageSquare size={15} /> :
                                          child.page === "bulk-send" ? <Send size={15} /> :
                                            child.page === "send-history" ? <Mail size={15} /> :
                                              child.page === "mail-inbox" ? <Inbox size={15} /> :
                                                child.page === "schedule-interview" ? <CalendarDays size={15} /> :
                                                  <ListChecks size={15} />}
                                    {child.label}
                                  </NavLink>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      }
                      return (
                        <NavLink
                          key={item.path}
                          to={item.path}
                          onClick={closeSidebar}
                          className={recruitmentLinkClassName}
                        >
                          <GroupIcon size={16} />
                          {item.label}
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
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
        </nav>

        {/* Profile and Logout */}
        <div className="mx-4 mb-2 shrink-0 rounded-xl border border-slate-200 bg-slate-50 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Link
            to="/profile"
            onClick={closeSidebar}
            title="My profile"
            className={`-m-1 flex items-center gap-3 rounded-lg p-1 transition hover:bg-slate-100 ${
              location.pathname === "/profile"
                ? "bg-teal-50"
                : ""
            }`}
          >
            <Avatar name={user?.name} photo={photo} />

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-700">
                {user?.name || "User"}
              </p>

              {user?.role && (
                <p className="truncate text-xs font-medium text-teal-700">
                  {user.role}
                </p>
              )}
            </div>

            <ChevronRight
              size={18}
              className="shrink-0 text-slate-400"
            />
          </Link>

          <button
            onClick={requestLogout}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 p-3 text-white transition hover:bg-teal-700"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </div>

      {/* Logout Confirmation Dialog */}
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