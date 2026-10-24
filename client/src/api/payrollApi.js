import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";
const API = `${API_BASE}/payroll`;

// Employees with their payroll record for the month (period = "YYYY-MM").
export const getPayroll = (period) => axios.get(API, { params: { period } });
export const savePayrollRecord = (employeeId, period, data) => axios.put(`${API}/${employeeId}/${period}`, data);
// Stores the payslip PDF behind a private link; returns { token }.
export const sharePayslip = (employeeId, period, pdf) => axios.post(`${API}/${employeeId}/${period}/share`, { pdf });
export const sharedPayslipUrl = (token) => `${API_BASE}/payslips/${token}`;
