import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";
const API = `${API_BASE}/expenses`;

export const getTransactions = () => axios.get(API);
export const createTransaction = (data) => axios.post(API, data);
export const updateTransaction = (id, data) => axios.patch(`${API}/${id}`, data);
export const deleteTransaction = (id) => axios.delete(`${API}/${id}`);
