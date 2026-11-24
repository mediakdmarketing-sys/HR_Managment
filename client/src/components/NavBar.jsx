import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import ThemeToggle from "./ThemeToggle";

const NavBar = ({ notifications = [] }) => {
  const navigate = useNavigate();
  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  return (
    <header className="fixed right-6 top-5 z-40 flex items-center justify-end gap-2 sm:right-8">
      <ThemeToggle />
      <button
        type="button"
        onClick={() => navigate("/notifications")}
        aria-label={`Open notification center${unreadCount ? `, ${unreadCount} unread` : ""}`}
        title="Open notification center"
        className="relative rounded-xl border border-slate-200 bg-white p-3 text-slate-600 shadow-sm transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-content-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
    </header>
  );
};

export default NavBar;
