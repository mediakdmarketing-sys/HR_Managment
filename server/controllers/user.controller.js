import * as userService
from "../services/userService.js";
import { resetBirthdayReminderCheck } from "../services/birthdayService.js";

// Account numbers never leave the server in full except through getAccountNumber, which
// requires a password confirmed within the last few minutes. HR and the employee themselves
// see the bank name and a masked number; other roles see no bank details at all.
const REAUTH_WINDOW_SECONDS = 5 * 60;

const maskAccountNumber = (value) => {
  const digits = String(value || "");
  if (!digits) return "";
  if (digits.length <= 6) return `${"*".repeat(Math.max(digits.length - 2, 0))}${digits.slice(-2)}`;
  return `${digits.slice(0, 3)}${"*".repeat(digits.length - 6)}${digits.slice(-3)}`;
};

const canSeeBank = (employeeId, viewer) => viewer.role === "HR" || employeeId === viewer.id;

// Firebase sets auth_time when the user last entered their password (login or re-auth).
const recentlyAuthenticated = (viewer) =>
  Number.isFinite(viewer.auth_time) && Date.now() / 1000 - viewer.auth_time <= REAUTH_WINDOW_SECONDS;

const reauthRequired = (res) =>
  res.status(403).json({
    success: false,
    code: "REAUTH_REQUIRED",
    message: "Please confirm your password to continue.",
  });

const forViewer = (employee, viewer) => {
  if (!employee) return employee;
  const { accountNumber, ...visible } = employee;
  if (!canSeeBank(employee.id, viewer)) {
    delete visible.bankName;
    return visible;
  }
  return { ...visible, accountNumberMasked: maskAccountNumber(accountNumber) };
};
export const getUsers = async (
  req,
  res
) => {

  try {

    const page =
      parseInt(req.query.page) || 1;

    const limit =
      parseInt(req.query.limit) || 10;

    const role =
      req.query.role || "all";

    const data =
      await userService.getUsersService(
        page,
        limit,
        role
      );

    res.status(200).json({
      success: true,
      data: { ...data, users: data.users.map((user) => forViewer(user, req.user)) },
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};

export const getEmployeeOptions = async (req, res) => {
  try {
    const options = await userService.getEmployeeOptionsService();
    return res.status(200).json({ success: true, data: options });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createUser = async (req, res) => {
  try {
    const { name, email, password, role, department } = req.body;
    if (!name || !email || !password || !role || !department) {
      return res.status(400).json({
        success: false,
        message: "Name, email, password, role and department are required",
      });
    }

    const user = await userService.createUserService({
      name,
      email,
      password,
      role,
      department,
    });
    return res.status(201).json({ success: true, data: user });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "An employee with this email already exists",
      });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getUserById = async (req, res) => {
  try {
    const user = await userService.getUserByIdService(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }
    return res.status(200).json({ success: true, data: forViewer(user, req.user) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Personal details are optional; when present they must be well formed.
const personalDetailsError = ({ personalEmail, phone, dateOfBirth }) => {
  if (personalEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalEmail)) {
    return "Personal email is not valid";
  }
  if (phone && !/^\+?[0-9\s()-]{7,20}$/.test(phone)) return "Phone number is not valid";
  if (dateOfBirth) {
    const date = new Date(`${dateOfBirth}T00:00:00`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || Number.isNaN(date.getTime()) || date > new Date()) {
      return "Date of birth is not valid";
    }
  }
  return null;
};

const bankDetailsError = ({ bankName, accountNumber }) => {
  if (bankName !== undefined && String(bankName).trim().length > 80) return "Bank name is too long";
  if (accountNumber && !/^[0-9]{6,20}$/.test(String(accountNumber))) {
    return "Account number must be 6 to 20 digits";
  }
  return null;
};

export const getAccountNumber = async (req, res) => {
  try {
    if (!canSeeBank(req.params.id, req.user)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    if (!recentlyAuthenticated(req.user)) return reauthRequired(res);
    const user = await userService.getUserByIdService(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ success: true, data: { accountNumber: user.accountNumber || "" } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateUser = async (req, res) => {
  try {
    if (req.body.accountNumber !== undefined && !recentlyAuthenticated(req.user)) {
      return reauthRequired(res);
    }
    // Account numbers are stored as digits only, without spaces or dashes.
    if (typeof req.body.accountNumber === "string") {
      req.body.accountNumber = req.body.accountNumber.replace(/[\s-]/g, "");
    }
    if (typeof req.body.bankName === "string") req.body.bankName = req.body.bankName.trim();
    const validationError = personalDetailsError(req.body) || bankDetailsError(req.body);
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }
    const user = await userService.updateUserService(req.params.id, req.body);
    if (!user) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }
    if (req.body.dateOfBirth !== undefined) resetBirthdayReminderCheck();
    if (req.body.bankName) await userService.rememberBankName(req.body.bankName);
    return res.status(200).json({ success: true, data: forViewer(user, req.user) });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "An employee with this email already exists",
      });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const disableUser = async (req, res) => {
  try {
    const user = await userService.disableUserService(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }
    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
// Photos are resized in the browser (256 px JPEG), so they are only a few tens of KB.
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTO_BASE64 = 400_000;

export const getProfilePhoto = async (req, res) => {
  try {
    const photo = await userService.getProfilePhotoService(req.params.id);
    return res.status(200).json({ success: true, data: photo });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Everyone manages only their own photo.
export const saveProfilePhoto = async (req, res) => {
  try {
    const { mime, data } = req.body;
    if (!PHOTO_TYPES.includes(mime) || typeof data !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
      return res.status(400).json({ success: false, message: "Upload a JPEG, PNG or WebP image" });
    }
    if (data.length > MAX_PHOTO_BASE64) {
      return res.status(400).json({ success: false, message: "The image is too large" });
    }
    await userService.saveProfilePhotoService(req.user.id, { mime, data });
    return res.status(200).json({ success: true, data: { mime, data } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const removeProfilePhoto = async (req, res) => {
  try {
    await userService.removeProfilePhotoService(req.user.id);
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
