import express from "express";
import { downloadSharedPayslip } from "../controllers/payroll.controller.js";

// Public payslip links sent to employees on WhatsApp.
const router = express.Router();
router.get("/:token", downloadSharedPayslip);
export default router;
