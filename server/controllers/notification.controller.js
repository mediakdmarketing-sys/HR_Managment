import * as leaveService from "../services/leaveService.js";
import { ensureBirthdayReminders } from "../services/birthdayService.js";

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
    const notifications = await leaveService.getNotifications(req.user.id);
    return res.json({ success: true, data: notifications });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const readNotification = async (req, res) => {
  try {
    await leaveService.markNotificationRead(req.params.id, req.user.id);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const readAllNotifications = async (req, res) => {
  try {
    await leaveService.markAllNotificationsRead(req.user.id);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
