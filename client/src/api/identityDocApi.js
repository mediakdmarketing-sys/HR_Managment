/**
 * Identity Documents API client
 */
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";
const usersAPI = `${API_BASE}/users`;

export const getIdentityDocs = (employeeId) =>
  axios.get(`${usersAPI}/${employeeId}/identity`);

export const addIdentityDoc = (employeeId, data) =>
  axios.post(`${usersAPI}/${employeeId}/identity`, data);

export const getFullIdentityNumber = (employeeId, docId) =>
  axios.get(`${usersAPI}/${employeeId}/identity/${docId}/full`);

export const getIdentityDocDownloadUrl = (employeeId, docId) =>
  axios.get(`${usersAPI}/${employeeId}/identity/${docId}/download`);

export const updateIdentityVerification = (employeeId, docId, verificationStatus) =>
  axios.patch(`${usersAPI}/${employeeId}/identity/${docId}/verify`, { verificationStatus });

export const deleteIdentityDoc = (employeeId, docId) =>
  axios.delete(`${usersAPI}/${employeeId}/identity/${docId}`);
