import express from "express";
import {
  createUser,
  disableUser,
  getEmployeeOptions,
  getUserById,
  getUsers,
  updateUser,
} from "../controllers/user.controller.js";

const router = express.Router();


router.get(
  "/all",

  getUsers
);
router.get("/options", getEmployeeOptions);

router.post("/", createUser);
router.get("/:id", getUserById);
router.patch("/:id", updateUser);
router.patch("/:id/disable", disableUser);

export default router;