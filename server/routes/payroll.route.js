import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import authorize from "../middleware/roleMiddleware.js";
import { listPayroll, saveRecord, sharePayslip } from "../controllers/payroll.controller.js";

const router = express.Router();
router.use(authMiddleware, authorize("HR", "Finance"));
router.get("/", listPayroll);
router.put("/:employeeId/:period", saveRecord);
router.post("/:employeeId/:period/share", sharePayslip);
export default router;
