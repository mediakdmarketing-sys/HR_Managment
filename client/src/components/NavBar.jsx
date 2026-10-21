import { useState } from "react";
import {
  Bell,
  CalendarClock,
  Check,
  CircleAlert,
  FileCheck2,
  UserRoundPlus,
  X,
} from "lucide-react";

const initialNotifications = [
  {
    id: 1,
    title: "Leave request needs review",
    message: "A new annual leave request is waiting for approval.",
    time: "10 minutes ago",
    icon: FileCheck2,
    tone: "text-teal-700 bg-teal-50",
    unread: true,
  },
  {
    id: 2,
    title: "Upcoming probation review",
    message: "Three employee probation reviews are due this week.",
    time: "1 hour ago",
    icon: CalendarClock,
    tone: "text-blue-700 bg-blue-50",
    unread: true,
  },
  {
    id: 3,
    title: "New employee added",
    message: "A new employee profile was added to the HR portal.",
    time: "Yesterday",
    icon: UserRoundPlus,
    tone: "text-amber-700 bg-amber-50",
    unread: true,
  },
];

const NavBar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);
  const unreadCount = notifications.filter((notification) => notification.unread).length;

  const markAllAsRead = () => {
    setNotifications((current) =>
      current.map((notification) => ({ ...notification, unread: false })),
    );
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
              {unreadCount}
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
                    onClick={markAllAsRead}
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
              {notifications.map((notification) => {
                const Icon = notification.icon;

                return (
                  <div
                    key={notification.id}
                    className={`flex gap-3 px-4 py-4 transition hover:bg-slate-50 ${notification.unread ? "bg-teal-50/30" : ""}`}
                  >
                    <div className={`grid h-9 w-9 shrink-0 place-content-center rounded-xl ${notification.tone}`}>
                      <Icon size={17} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2">
                        <p className="text-sm font-semibold text-slate-800">{notification.title}</p>
                        {notification.unread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-teal-600" />}
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{notification.message}</p>
                      <p className="mt-2 text-[11px] font-medium text-slate-400">{notification.time}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500">
              <CircleAlert size={14} />
              Notifications are sample data for now.
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default NavBar;