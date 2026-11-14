import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import authorize from "../middleware/roleMiddleware.js";
import {
  createUser,
  disableUser,
  getEmployeeOptions,
  getAccountNumber,
  getProfilePhoto,
  removeProfilePhoto,
  saveProfilePhoto,
  getUserById,
  getUsers,
  importEmployeesCsv,
  updateUser,
} from "../controllers/user.controller.js";

const router = express.Router();
router.use(authMiddleware, authorize("HR"));

router.get("/all", getUsers);
router.get("/options", getEmployeeOptions);

router.put("/me/photo", saveProfilePhoto);
router.delete("/me/photo", removeProfilePhoto);

router.post("/", createUser);
router.post("/import", importEmployeesCsv);
router.get("/:id", getUserById);
router.get("/:id/account-number", getAccountNumber);
router.get("/:id/photo", getProfilePhoto);
router.patch("/:id", updateUser);
router.patch("/:id/disable", disableUser);

export default router;
