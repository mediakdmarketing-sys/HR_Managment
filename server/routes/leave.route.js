import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import authorize from "../middleware/roleMiddleware.js";
import {
  addLeavePolicy,
  changeLeaveStatus,
  createLeave,
  downloadLeaveAttachment,
  importLeaveCsv,
  listLeaveEmployees,
  listLeavePolicies,
  listLeaves,
  previewLeaveAllocation,
} from "../controllers/leave.controller.js";

const router = express.Router();
router.use(authMiddleware);
router.get("/policies", authorize("HR"), listLeavePolicies);
router.post("/policies", authorize("HR"), addLeavePolicy);
router.get("/employees", authorize("HR"), listLeaveEmployees);
router.post("/import", authorize("HR"), importLeaveCsv);
router.get("/:id/allocation", previewLeaveAllocation);
router.get("/", listLeaves);
router.post("/", authorize("HR"), createLeave);
router.get("/:id/attachment", downloadLeaveAttachment);
router.patch("/:id/status", changeLeaveStatus);
export default router;
