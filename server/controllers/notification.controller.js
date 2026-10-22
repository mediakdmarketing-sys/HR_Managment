import * as leaveService from "../services/leaveService.js";

export const listNotifications = async (req, res) => {
  try {
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
