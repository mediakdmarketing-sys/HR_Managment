import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import authorize from "../middleware/roleMiddleware.js";
import {
  addLeavePolicy,
  changeLeaveStatus,
  createLeave,
  downloadLeaveAttachment,
  listLeavePolicies,
  listLeaves,
} from "../controllers/leave.controller.js";

const router = express.Router();
router.use(authMiddleware);
router.get("/policies", authorize("HR"), listLeavePolicies);
router.post("/policies", authorize("HR"), addLeavePolicy);
router.get("/", listLeaves);
router.post("/", createLeave);
router.get("/:id/attachment", downloadLeaveAttachment);
router.patch("/:id/status", changeLeaveStatus);
export default router;
