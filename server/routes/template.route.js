import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import authorize from "../middleware/roleMiddleware.js";
import {
  getLetterhead,
  getSettings,
  removeImage,
  saveCompany,
  saveImage,
} from "../controllers/template.controller.js";

const router = express.Router();
router.use(authMiddleware);
router.get("/letterhead", getLetterhead);
router.use(authorize("HR"));
router.get("/settings", getSettings);
router.put("/logo", saveImage("logo"));
router.put("/signature", saveImage("signature"));
router.delete("/signature", removeImage("signature"));
router.put("/company", saveCompany);
export default router;
