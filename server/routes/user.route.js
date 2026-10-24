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
  updateUser,
} from "../controllers/user.controller.js";

const directoryRoles = ["HR", "Manager", "Team Lead", "Recruiter"];

// Everyone may read their own record; directory roles may read anyone's.
const selfOrDirectory = (req, res, next) => {
  if (req.params.id === req.user.id || directoryRoles.includes(req.user.role)) {
    return next();
  }
  return res.status(403).json({ success: false, message: "Access denied" });
};

const router = express.Router();
router.use(authMiddleware);

router.get("/all", authorize(...directoryRoles), getUsers);
router.get("/options", authorize(...directoryRoles), getEmployeeOptions);

router.put("/me/photo", saveProfilePhoto);
router.delete("/me/photo", removeProfilePhoto);

router.post("/", authorize("HR"), createUser);
router.get("/:id", selfOrDirectory, getUserById);
router.get("/:id/account-number", getAccountNumber);
router.get("/:id/photo", selfOrDirectory, getProfilePhoto);
router.patch("/:id", authorize("HR"), updateUser);
router.patch("/:id/disable", authorize("HR"), disableUser);

export default router;
