import express from "express";
import * as authController from "../controllers/auth.controller.js";
import { requestPasswordReset } from "../controllers/passwordReset.controller.js";

const router = express.Router();

//router.post("/register", authController.register);

router.post("/login", authController.login);

router.post("/logout", authController.logout);

router.post("/forgot-password", requestPasswordReset);

export default router;
