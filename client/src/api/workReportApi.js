/**
 * Work Reports API client
 */
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";
const API = `${API_BASE}/work-reports`;

export const getWorkReports = (params = {}) => {
  const qs = new URLSearchParams();
  if (params.employeeId) qs.set("employeeId", params.employeeId);
  if (params.month) qs.set("month", params.month);
  if (params.year) qs.set("year", params.year);
  return axios.get(`${API}?${qs.toString()}`);
};

export const getWorkReport = (id) => axios.get(`${API}/${id}`);

export const createWorkReport = (data) => axios.post(API, data);

export const updateWorkReport = (id, data) => axios.patch(`${API}/${id}`, data);

export const submitWorkReport = (id) => axios.patch(`${API}/${id}/submit`);

export const reviewWorkReport = (id, data) => axios.patch(`${API}/${id}/review`, data);

export const deleteWorkReport = (id) => axios.delete(`${API}/${id}`);
