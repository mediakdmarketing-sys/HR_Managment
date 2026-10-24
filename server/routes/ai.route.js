import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import authorize from "../middleware/roleMiddleware.js";
import { chat } from "../controllers/ai.controller.js";

const router = express.Router();
router.use(authMiddleware, authorize("HR"));
router.post("/chat", chat);
export default router;
