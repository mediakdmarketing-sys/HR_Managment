import * as userService
from "../services/userService.js";
import { logAudit } from "../services/auditService.js";
import { resetBirthdayReminderCheck } from "../services/birthdayService.js";
import {
  isRecentlyAuthenticated,
  maskAccountNumber,
} from "../utils/employeeDirectory.js";

// Account numbers leave the server in full only through the reauthenticated HR endpoint.
const canSeeBank = (employeeId, viewer) => viewer.role === "HR" || employeeId === viewer.id;

// Firebase sets auth_time when the user last entered their password (login or re-auth).
const recentlyAuthenticated = (viewer) =>
  isRecentlyAuthenticated(viewer.auth_time, Date.now());

const reauthRequired = (res) =>
  res.status(403).json({
    success: false,
    code: "REAUTH_REQUIRED",
    message: "Please confirm your password to continue.",
  });

const forViewer = (employee, viewer) => {
  if (!employee) return employee;
  const { accountNumber, uid, ...visible } = employee;
  visible.isAuthenticationLinked = Boolean(uid);
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
    if (
      Object.prototype.hasOwnProperty.call(req.body || {}, "password") ||
      Object.prototype.hasOwnProperty.call(req.body || {}, "uid")
    ) {
      return res.status(400).json({
        success: false,
        message: "Authentication credentials are not accepted for employee directory records.",
      });
    }

    const user = await userService.createUserService(req.body || {});
    return res.status(201).json({
      success: true,
      data: forViewer(user, req.user),
    });
  } catch (error) {
    const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
    if (statusCode === 500) console.error("Could not create employee directory record.");
    return res.status(statusCode).json({
      success: false,
      message: statusCode === 500 ? "Could not create employee directory record." : error.message,
    });
  }
};

export const importEmployeesCsv = async (req, res) => {
  try {
    const result = await userService.importEmployeesCsvService(req.body?.content);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
    if (statusCode === 500) console.error("Could not import employee directory CSV.");
    return res.status(statusCode).json({
      success: false,
      message: statusCode === 500 ? "Could not import employee directory CSV." : error.message,
    });
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
    await logAudit({
      action: "ACCOUNT_NUMBER_REVEALED",
      employeeId: req.params.id,
      performedBy: req.user.name || req.user.email,
    });
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ success: true, data: { accountNumber: user.accountNumber || "" } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateUser = async (req, res) => {
  try {
    const body = { ...(req.body || {}) };
    if (body.accountNumber !== undefined && !recentlyAuthenticated(req.user)) {
      return reauthRequired(res);
    }
    // Account numbers are stored as digits only, without spaces or dashes.
    if (typeof body.accountNumber === "string") {
      body.accountNumber = body.accountNumber.replace(/[\s-]/g, "");
    }
    if (typeof body.bankName === "string") body.bankName = body.bankName.trim();
    const validationError = personalDetailsError(body) || bankDetailsError(body);
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }
    const user = await userService.updateUserService(req.params.id, body, req.user.name || req.user.email);
    if (!user) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }
    if (body.dateOfBirth !== undefined) resetBirthdayReminderCheck();
    return res.status(200).json({ success: true, data: forViewer(user, req.user) });
  } catch (error) {
    const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
    if (statusCode === 500) console.error("Could not update employee directory record.");
    return res.status(statusCode).json({
      success: false,
      message: statusCode === 500 ? "Could not update employee directory record." : error.message,
    });
  }
};

export const disableUser = async (req, res) => {
  try {
    const user = await userService.disableUserService(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }
    return res.status(200).json({ success: true, data: forViewer(user, req.user) });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message });
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

// Profile photo operations remain available only to authenticated HR sessions.
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

// ==========================================
// Employee Personnel Documents Handlers
// ==========================================

export const listEmployeeDocuments = async (req, res) => {
  try {
    const { id } = req.params;
    const docs = await userService.listEmployeeDocumentsService(id);
    return res.status(200).json({ success: true, data: docs });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

export const uploadEmployeeDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { category, title, fileName, fileType, fileData, fileBase64, fileSize, notes } = req.body;
    if (!category || !title) {
      return res.status(400).json({ success: false, message: "Category and title are required" });
    }
    const doc = await userService.uploadEmployeeDocumentService({
      employeeId: id,
      category,
      title,
      fileName,
      fileType,
      // accept both old `fileData` key and new `fileBase64` key
      fileBase64: fileBase64 || fileData || null,
      fileSize,
      notes,
      uploadedBy: req.user.name || "HR Administrator",
    });
    return res.status(201).json({ success: true, data: doc });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

export const deleteEmployeeDocument = async (req, res) => {
  try {
    const { docId } = req.params;
    await userService.deleteEmployeeDocumentService(docId, req.user.name || req.user.email);
    return res.status(200).json({ success: true, message: "Document deleted" });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

export const downloadEmployeeDocument = async (req, res) => {
  try {
    const { docId } = req.params;
    const doc = await userService.getEmployeeDocumentService(docId);
    if (!doc) {
      return res.status(404).json({ success: false, message: "Document not found" });
    }
    return res.status(200).json({ success: true, data: doc });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};
