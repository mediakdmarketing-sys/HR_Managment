import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";
const authConfig = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
});

export const getLetterhead = () => axios.get(`${API_BASE}/templates/letterhead`, authConfig());
export const getLetterSettings = () => axios.get(`${API_BASE}/templates/settings`, authConfig());
export const saveTemplateLogo = (data) =>
  axios.put(`${API_BASE}/templates/logo`, data, authConfig());
export const saveTemplateSignature = (data) =>
  axios.put(`${API_BASE}/templates/signature`, data, authConfig());
export const removeTemplateSignature = () =>
  axios.delete(`${API_BASE}/templates/signature`, authConfig());
export const saveCompanyDetails = (data) =>
  axios.put(`${API_BASE}/templates/company`, data, authConfig());
