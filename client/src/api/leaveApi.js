import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";
const authConfig = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
});

export const getLeaveRequests = () => axios.get(`${API_BASE}/leaves`, authConfig());
export const createLeaveRequest = (data) => axios.post(`${API_BASE}/leaves`, data, authConfig());
export const updateLeaveStatus = (id, status) =>
  axios.patch(`${API_BASE}/leaves/${id}/status`, { status }, authConfig());
export const getLeaveAttachment = (id) =>
  axios.get(`${API_BASE}/leaves/${id}/attachment`, {
    ...authConfig(),
    responseType: "blob",
  });
export const getNotifications = () => axios.get(`${API_BASE}/notifications`, authConfig());
export const markNotificationRead = (id) =>
  axios.patch(`${API_BASE}/notifications/${id}/read`, {}, authConfig());
export const markAllNotificationsRead = () =>
  axios.patch(`${API_BASE}/notifications/read-all`, {}, authConfig());
