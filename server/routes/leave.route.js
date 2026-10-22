import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  changeLeaveStatus,
  createLeave,
  downloadLeaveAttachment,
  listLeaves,
} from "../controllers/leave.controller.js";

const router = express.Router();
router.use(authMiddleware);
router.get("/", listLeaves);
router.post("/", createLeave);
router.get("/:id/attachment", downloadLeaveAttachment);
router.patch("/:id/status", changeLeaveStatus);
export default router;
