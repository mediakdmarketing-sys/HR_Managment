import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import authorize from "../middleware/roleMiddleware.js";
import { getLogo, saveLogo } from "../controllers/template.controller.js";

const router = express.Router();
router.use(authMiddleware, authorize("HR"));
router.get("/logo", getLogo);
router.put("/logo", saveLogo);
export default router;
