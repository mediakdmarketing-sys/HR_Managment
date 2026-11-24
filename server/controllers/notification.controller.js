import * as leaveService from "../services/leaveService.js";
import { ensureBirthdayReminders } from "../services/birthdayService.js";
import { recruitmentFirestore } from "../services/recruitmentFirebaseService.js";

// Recruitment Hiring Alerts are HR information; only HR users see or change them here.
const isHr = (user) => user?.role === "HR";

export const listNotifications = async (req, res) => {
  try {
    if (req.user.role === "HR") {
      try {
        await ensureBirthdayReminders();
      } catch (error) {
        // A failed reminder check must not stop notifications from loading.
        console.error("Birthday reminder check failed:", error.message);
      }
    }
    const [hrmsNotifications, recruitmentNotifications] = await Promise.all([
      leaveService.getNotifications(req.user.id),
      isHr(req.user) ? recruitmentFirestore.list("recruitmentNotifications", { limit: 1000 }) : [],
    ]);
    const merged = [
      ...hrmsNotifications.map((notification) => ({ ...notification, source: "hrms" })),
      ...recruitmentNotifications.map((notification) => ({
        ...notification,
        id: `recruitment:${notification.id}`,
        source: "recruitment",
        category: notification.category || notification.type || "recruitment",
        isRead: notification.isRead ?? notification.is_read ?? false,
        createdAt: notification.createdAt || notification.created_at || null,
        type: notification.type || "recruitment_update",
      })),
    ].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return res.json({ success: true, data: merged });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const readNotification = async (req, res) => {
  try {
    if (req.params.id.startsWith("recruitment:")) {
      if (!isHr(req.user)) return res.status(403).json({ success: false, message: "Only HR can update recruitment notifications" });
      await recruitmentFirestore.update(
        "recruitmentNotifications",
        req.params.id.slice("recruitment:".length),
        { isRead: true, is_read: true },
      );
      return res.json({ success: true });
    }
    await leaveService.markNotificationRead(req.params.id, req.user.id);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const readAllNotifications = async (req, res) => {
  try {
    await leaveService.markAllNotificationsRead(req.user.id);
    if (!isHr(req.user)) return res.json({ success: true });
    const recruitmentNotifications = await recruitmentFirestore.list(
      "recruitmentNotifications",
      { limit: 1000 },
    );
    await Promise.all(
      recruitmentNotifications
        .filter((notification) => !(notification.isRead ?? notification.is_read))
        .map((notification) =>
          recruitmentFirestore.update(
            "recruitmentNotifications",
            notification.id,
            { isRead: true, is_read: true },
          ),
        ),
    );
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
