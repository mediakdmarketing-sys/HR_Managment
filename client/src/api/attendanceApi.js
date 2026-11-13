import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";
const API = `${API_BASE}/attendance`;

export const getAttendanceRecords = () => axios.get(API);
export const importAttendanceRecords = (records) =>
  axios.post(`${API}/import`, { records });
