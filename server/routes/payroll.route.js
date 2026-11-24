import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import authorize from "../middleware/roleMiddleware.js";
import {
  confirmPayment,
  getInternalBankExport,
  listPayroll,
  saveRecord,
  sharePayslip,
} from "../controllers/payroll.controller.js";

const router = express.Router();
router.use(authMiddleware, authorize("HR", "Finance"));
router.get("/", listPayroll);
router.put("/:employeeId/:period", saveRecord);
router.post("/:employeeId/:period/share", sharePayslip);
router.post("/:employeeId/:period/payment", confirmPayment);
router.get("/bank-export", getInternalBankExport);
export default router;
