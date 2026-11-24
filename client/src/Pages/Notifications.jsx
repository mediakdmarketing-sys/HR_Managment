import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Check, CircleCheck } from "lucide-react";
import UserLayout from "../layouts/UserLayout";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../api/leaveApi";
import { getRecruitmentRecordRoute } from "../navigation/recruitmentRoutes";

const timeLabel = (value) => {
  if (!value) return "Time unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const Notifications = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [source, setSource] = useState("all");
  const [category, setCategory] = useState("all");
  const [readState, setReadState] = useState("all");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getNotifications()
      .then((response) => {
        if (active) setNotifications(response.data.data || []);
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || "Unable to load notifications.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => notifications.filter((notification) => {
    if (source !== "all" && notification.source !== source) return false;
    if (category !== "all" && (notification.category || notification.type) !== category) return false;
    if (readState === "unread" && notification.isRead) return false;
    if (readState === "read" && !notification.isRead) return false;
    return true;
  }), [notifications, source, category, readState]);
  const categories = [...new Set(notifications.map((notification) =>
    notification.category || notification.type || "general",
  ))].sort();

  const markRead = async (notification) => {
    try {
      await markNotificationRead(notification.id);
      setNotifications((current) => current.map((item) =>
        item.id === notification.id ? { ...item, isRead: true } : item,
      ));
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to update notification status.");
    }
  };

  const markAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to update notification status.");
    }
  };

  const open = async (notification) => {
    if (!notification.isRead) await markRead(notification);
    const recruitment = notification.source === "recruitment";
    const path = recruitment
      ? getRecruitmentRecordRoute(notification.type)
      : notification.type === "birthday_reminder"
        ? `/employees/${notification.entityId}`
        : "/leave";
    navigate(path);
  };

  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  return (
    <UserLayout>
      <main className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-teal-700">HRMS</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-800">Notifications</h1>
            <p className="mt-1 text-sm text-slate-500">
              HRMS and recruitment updates · {unreadCount} unread
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
            >
              <Check size={16} /> Mark all read
            </button>
          )}
        </header>

        {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}

        <section className="flex flex-wrap gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
          <label className="text-sm text-slate-600">
            Source
            <select value={source} onChange={(event) => setSource(event.target.value)} className="ml-2 rounded-lg border border-slate-200 px-3 py-2">
              <option value="all">All sources</option>
              <option value="hrms">HRMS</option>
              <option value="recruitment">Recruitment</option>
            </select>
          </label>
          <label className="text-sm text-slate-600">
            Category
            <select value={category} onChange={(event) => setCategory(event.target.value)} className="ml-2 rounded-lg border border-slate-200 px-3 py-2">
              <option value="all">All categories</option>
              {categories.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-600">
            Status
            <select value={readState} onChange={(event) => setReadState(event.target.value)} className="ml-2 rounded-lg border border-slate-200 px-3 py-2">
              <option value="all">All</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
            </select>
          </label>
        </section>

        <section className="space-y-3">
          {isLoading ? (
            <div className="rounded-2xl bg-white p-6 text-sm text-slate-500">Loading notifications...</div>
          ) : filtered.length ? filtered.map((notification) => (
            <article
              key={notification.id}
              className={`flex items-start gap-4 rounded-2xl p-4 shadow-sm ring-1 ring-slate-200/70 ${
                notification.isRead ? "bg-white" : "bg-teal-50/60"
              }`}
            >
              <div className={`grid h-10 w-10 shrink-0 place-content-center rounded-xl ${
                notification.isRead ? "bg-slate-100 text-slate-500" : "bg-teal-100 text-teal-800"
              }`}>
                {notification.isRead ? <CircleCheck size={19} /> : <Bell size={19} />}
              </div>
              <button type="button" onClick={() => open(notification)} className="min-w-0 flex-1 text-left">
                <span className="flex flex-wrap items-center gap-2">
                  <strong className="text-sm text-slate-800">{notification.title || "Notification"}</strong>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                    {notification.source === "recruitment" ? "Recruitment" : "HRMS"}
                  </span>
                </span>
                <span className="mt-1 block text-sm text-slate-600">{notification.message || ""}</span>
                <span className="mt-2 block text-xs text-slate-400">{timeLabel(notification.createdAt)}</span>
              </button>
              {!notification.isRead && (
                <button
                  type="button"
                  onClick={() => markRead(notification)}
                  aria-label="Mark notification as read"
                  className="rounded-lg p-2 text-teal-700 hover:bg-teal-100"
                >
                  <Check size={17} />
                </button>
              )}
            </article>
          )) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
              {isLoading ? "Loading..." : "No notifications match these filters."}
            </div>
          )}
        </section>
      </main>
    </UserLayout>
  );
};

export default Notifications;
