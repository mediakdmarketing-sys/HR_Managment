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

export const createUser = (userData) => {
  return axios.post(API, userData);
};

export const getUserById = (id) => axios.get(`${API}/${id}`);

export const getEmployeeOptions = () => axios.get(`${API}/options`);

export const updateUser = (id, userData) => axios.patch(`${API}/${id}`, userData);

export const disableUser = (id) => axios.patch(`${API}/${id}/disable`);
// Full account number; the server requires a recently confirmed password.
export const getAccountNumber = (id) => axios.get(`${API}/${id}/account-number`);
export const getProfilePhoto = (id) => axios.get(`${API}/${id}/photo`);
export const saveProfilePhoto = (photo) => axios.put(`${API}/me/photo`, photo);
export const removeProfilePhoto = () => axios.delete(`${API}/me/photo`);
