import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  listNotifications,
  readAllNotifications,
  readNotification,
} from "../controllers/notification.controller.js";

const router = express.Router();
router.use(authMiddleware);
router.get("/", listNotifications);
router.patch("/read-all", readAllNotifications);
router.patch("/:id/read", readNotification);
export default router;
