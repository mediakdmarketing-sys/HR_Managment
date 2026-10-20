import express from "express";
import * as ticketController from "../controllers/ticket.controller.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/create", ticketController.createTicket);

router.get(
  "/my/:userId",

  ticketController.getMyTickets,
);

router.get(
  "/assigned/:agentId",

  ticketController.getAssignedTickets,
);

router.get("/all", ticketController.getAllTickets);

router.get("/:id", verifyToken, ticketController.getTicketById);

router.put("/:id", ticketController.updateTicket);

router.delete("/:id", verifyToken, ticketController.deleteTicket);

export default router;
