import axios from "axios";
import { configureApiAuth } from "../config/axiosAuth";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";
const attendance = axios.create({ baseURL: `${API_BASE}/attendance` });
configureApiAuth(attendance);

export const getAttendanceRecords = () => attendance.get("/");
export const getMonthlyAttendanceSummaries = () => attendance.get("/monthly");
export const importAttendanceRecords = (records) =>
  attendance.post("/import", { records });
