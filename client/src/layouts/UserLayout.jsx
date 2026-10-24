import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import Sidebar from "../components/Sidebar";
import { getUser } from "../utils/auth";
import NavBar from "../components/NavBar";
import AiAssistant from "../components/AiAssistant";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../api/leaveApi";

// Kept outside the component so moving between pages does not toast the same notification again.
const toastedNotifications = new Set();
let pollingUserId = null;

const UserLayout = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    let active = true;
    const pollNotifications = async () => {
      try {
        const response = await getNotifications();
        if (!active) return;
        const latest = response.data.data || [];
        setNotifications(latest);

        // On the first load only remember what exists; toast only what arrives afterwards.
        const fresh = latest.filter(
          (notification) =>
            !notification.isRead && !toastedNotifications.has(notification.id),
        );
        latest.forEach((notification) => toastedNotifications.add(notification.id));
        const userId = getUser()?._id ?? getUser()?.id;
        if (pollingUserId !== userId) {
          pollingUserId = userId;
          return;
        }

        if (fresh.some((notification) => notification.type?.startsWith("leave_"))) {
          window.dispatchEvent(new Event("leave-notification"));
        }
        for (const notification of fresh) {
          const showToast =
            notification.type === "leave_approved"
              ? toast.success
              : notification.type === "leave_rejected"
                ? toast.error
                : toast.info;
          showToast(`${notification.title}: ${notification.message}`, {
            theme: "dark",
            autoClose: 7000,
          });
          if ("Notification" in window) {
            let permission = Notification.permission;
            if (permission === "default") {
              permission = await Notification.requestPermission();
            }
            if (permission === "granted") {
              new Notification(notification.title, {
                body: notification.message,
              });
            }
          }
        }
      } catch {
        // Notification polling must not interrupt the current page.
      }
    };

    pollNotifications();
    const timer = window.setInterval(pollNotifications, 10000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const markRead = useCallback(async (id) => {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id ? { ...notification, isRead: true } : notification,
      ),
    );
    try {
      await markNotificationRead(id);
    } catch {
      // The next poll restores the server state if this failed.
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications((current) =>
      current.map((notification) => ({ ...notification, isRead: true })),
    );
    try {
      await markAllNotificationsRead();
    } catch {
      // The next poll restores the server state if this failed.
    }
  }, []);

  return (
    <div className="app-bg h-screen overflow-hidden bg-slate-100 flex">
      <Sidebar />

      <div className="min-w-0 flex-1 h-screen overflow-y-auto p-6 sm:ml-64">
        <NavBar
          notifications={notifications}
          onRead={markRead}
          onReadAll={markAllRead}
        />
        {children}
      </div>
      {getUser()?.role === "HR" && <AiAssistant />}
    </div>
  );
};

export default UserLayout;
