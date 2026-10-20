import axios from "axios";
import { getUser } from "../utils/auth";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";
const API = `${API_BASE}/tickets`;

// Create Ticket
export const createTicket = (ticketData) => {
  return axios.post(`${API}/create`, ticketData, {
    withCredentials: true,
  });
};

//
export const getAllTickets = () => {
  return axios.get(`${API}/all`, {
    withCredentials: true,
  });
};

// Get Logged User Tickets
export const getMyTickets = (userId) => {
  const currentUser = getUser();
  const resolvedUserId = userId ?? currentUser?._id ?? currentUser?.id;

  if (!resolvedUserId) {
    return Promise.reject(new Error("User not found"));
  }

  return axios.get(`${API}/my/${resolvedUserId}`, {
    withCredentials: true,
  });
};

// Get Tickets Assigned To Agent
export const getAssignedTickets = (agentId) => {
  const currentUser = getUser();
  const resolvedAgentId = agentId ?? currentUser?._id ?? currentUser?.id;

  if (!resolvedAgentId) {
    return Promise.reject(new Error("User not found"));
  }

  return axios.get(`${API}/assigned/${resolvedAgentId}`, {
    withCredentials: true,
  });
};

// Get Single Ticket
export const getTicketById = (ticketId) => {
  return axios.get(`${API}/${ticketId}`, {
    withCredentials: true,
  });
};

// Update Ticket
export const updateTicket = (ticketId, ticketData) => {
  return axios.put(`${API}/${ticketId}`, ticketData, {
    withCredentials: true,
  });
};

// Delete Ticket
export const deleteTicket = (ticketId) => {
  return axios.delete(`${API}/${ticketId}`, {
    withCredentials: true,
  });
};
