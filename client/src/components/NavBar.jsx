import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  BellOff,
  Check,
  CircleCheck,
  CircleX,
  FileCheck2,
  X,
} from "lucide-react";

const notificationStyles = {
  leave_request: { icon: FileCheck2, tone: "text-teal-700 bg-teal-50", path: "/leave" },
  leave_approved: { icon: CircleCheck, tone: "text-emerald-700 bg-emerald-50", path: "/leave" },
  leave_rejected: { icon: CircleX, tone: "text-red-700 bg-red-50", path: "/leave" },
};
const defaultStyle = { icon: Bell, tone: "text-blue-700 bg-blue-50" };

const timeAgo = (date) => {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(date));
};

const NavBar = ({ notifications = [], onRead, onReadAll }) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  const openNotification = (notification) => {
    if (!notification.isRead) onRead?.(notification.id);
    const path = notificationStyles[notification.type]?.path;
    if (path) {
      setIsOpen(false);
      navigate(path);
    }
  };

  return (
    <header className="fixed right-6 top-5 z-40 flex justify-end sm:right-8">
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
          aria-expanded={isOpen}
          className="relative rounded-xl border border-slate-200 bg-white p-3 text-slate-600 shadow-sm transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-content-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-3 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div>
                <h2 className="font-semibold text-slate-800">Notifications</h2>
                <p className="text-xs text-slate-500">
                  {unreadCount ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}` : "All caught up"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={onReadAll}
                    className="rounded-lg p-2 text-teal-700 transition hover:bg-teal-50"
                    title="Mark all as read"
                    aria-label="Mark all notifications as read"
                  >
                    <Check size={17} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Close notifications"
                >
                  <X size={17} />
                </button>
              </div>
            </div>

            <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-slate-500">
                  <BellOff className="text-slate-300" size={28} />
                  No notifications yet
                </div>
              ) : (
                notifications.map((notification) => {
                  const style = notificationStyles[notification.type] || defaultStyle;
                  const Icon = style.icon;
                  const unread = !notification.isRead;

                  return (
                    <button
                      type="button"
                      key={notification.id}
                      onClick={() => openNotification(notification)}
                      className={`flex w-full gap-3 px-4 py-4 text-left transition hover:bg-slate-50 ${unread ? "bg-teal-50/30" : ""}`}
                    >
                      <div className={`grid h-9 w-9 shrink-0 place-content-center rounded-xl ${style.tone}`}>
                        <Icon size={17} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-2">
                          <p className="text-sm font-semibold text-slate-800">{notification.title}</p>
                          {unread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-teal-600" />}
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{notification.message}</p>
                        <p className="mt-2 text-[11px] font-medium text-slate-400">{timeAgo(notification.createdAt)}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default NavBar;
