import Ticket from "../models/ticket.model.js";

// Create Ticket
export const createTicketService = async (ticketData) => {
  const lastTicket = await Ticket.findOne().sort({
    createdAt: -1,
  });

  let nextNumber = 1;

  if (lastTicket) {
    nextNumber = parseInt(lastTicket.ticketNumber.split("-")[1]) + 1;
  }

  const ticketNumber = `TKT-${String(nextNumber).padStart(4, "0")}`;

  return await Ticket.create({
    ...ticketData,
    ticketNumber,
  });
};

// Get Logged-in User Tickets
export const getMyTicketsService = async (userId) => {
  if (!userId) {
    return [];
  }

  return await Ticket.find({ userId }).sort({
    createdAt: -1,
  });
};

// Get Tickets Assigned To Agent
export const getAssignedTicketsService = async (agentId) => {
  if (!agentId) {
    return [];
  }

  return await Ticket.find({
    $or: [{ "assignedTo.id": agentId }, { assignedTo: agentId }],
  }).sort({
    createdAt: -1,
  });
};

// Get All Tickets (Admin)
export const getAllTicketsService = async () => {
  return await Ticket.find().sort({
    createdAt: -1,
  });
};

// Update Ticket
export const updateTicketService = async (ticketId, data) => {
  const { comment, ...rest } = data;
  const updateData = { ...rest };

  if (updateData.assignedTo) {
    updateData.assignedTo = {
      id: updateData.assignedTo.id ?? null,
      name: updateData.assignedTo.name ?? "",
    };
  }

  const updateOperations = {};

  if (Object.keys(updateData).length > 0) {
    updateOperations.$set = updateData;
  }

  if (comment?.text?.trim()) {
    updateOperations.$push = {
      comments: {
        text: comment.text.trim(),
        createdBy: comment.createdBy,
        createdByName: comment.createdByName,
        createdAt: comment.createdAt || new Date(),
      },
    };
  }

  if (Object.keys(updateOperations).length === 0) {
    return await Ticket.findById(ticketId);
  }

  return await Ticket.findByIdAndUpdate(ticketId, updateOperations, {
    new: true,
    runValidators: true,
  });
};

// Delete Ticket
export const deleteTicketService = async (ticketId) => {
  return await Ticket.findByIdAndDelete(ticketId);
};
