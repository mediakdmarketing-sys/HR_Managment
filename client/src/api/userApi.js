import axios from "axios";


const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";
const API = `${API_BASE}/users`;

export const getUsers = (
  page,
  role,
  limit = 10
) => {

  return axios.get(
    `${API}/all?page=${page}&role=${role}&limit=${limit}`
  );

};