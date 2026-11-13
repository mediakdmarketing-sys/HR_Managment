import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import authorize from "../middleware/roleMiddleware.js";
import {
  importAttendance,
  listAttendance,
} from "../controllers/attendance.controller.js";

const router = express.Router();
router.use(authMiddleware, authorize("HR"));
router.get("/", listAttendance);
router.post("/import", importAttendance);

export default router;
