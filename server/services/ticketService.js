import { firestore } from "../config/firebase.js";

const tickets = firestore.collection("tickets");

const serialize = (doc) => ({ id: doc.id, ...doc.data() });

export const createTicketService = async (ticketData) => {
  const reference = tickets.doc();
  const existing = await tickets.get();
  const number = String(existing.size + 1).padStart(4, "0");
  const ticket = {
    ...ticketData,
    ticketNumber: `TKT-${number}`,
    createdAt: new Date().toISOString(),
  };
  await reference.set(ticket);
  return { id: reference.id, ...ticket };
};

export const getMyTicketsService = async (userId) => {
  const snapshot = await tickets.where("userId", "==", String(userId)).get();
  return snapshot.docs.map(serialize).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
};

export const getAssignedTicketsService = async (agentId) => {
  const snapshot = await tickets.get();
  return snapshot.docs
    .map(serialize)
    .filter((ticket) => ticket.assignedTo?.id === String(agentId) || ticket.assignedTo === String(agentId))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
};

export const getAllTicketsService = async () => {
  const snapshot = await tickets.get();
  return snapshot.docs.map(serialize).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
};

export const getTicketByIdService = async (id) => {
  const snapshot = await tickets.doc(String(id)).get();
  return snapshot.exists ? serialize(snapshot) : null;
};

export const updateTicketService = async (id, data) => {
  const existing = await getTicketByIdService(id);
  if (!existing) return null;
  const { comment, ...updates } = data;
  if (updates.assignedTo) {
    updates.assignedTo = {
      id: updates.assignedTo.id ?? null,
      name: updates.assignedTo.name ?? "",
    };
  }
  const next = { ...updates };
  if (comment?.text?.trim()) {
    next.comments = [...(existing.comments || []), {
      text: comment.text.trim(),
      createdBy: comment.createdBy,
      createdByName: comment.createdByName,
      createdAt: comment.createdAt || new Date().toISOString(),
    }];
  }
  await tickets.doc(String(id)).update(next);
  return getTicketByIdService(id);
};

export const deleteTicketService = async (id) => {
  const reference = tickets.doc(String(id));
  const snapshot = await reference.get();
  if (!snapshot.exists) return null;
  await reference.delete();
  return { id: String(id) };
};
