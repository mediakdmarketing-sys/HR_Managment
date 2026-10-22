import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";
const authConfig = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
});

export const getTemplateLogo = () => axios.get(`${API_BASE}/templates/logo`, authConfig());
export const saveTemplateLogo = (data) =>
  axios.put(`${API_BASE}/templates/logo`, data, authConfig());
