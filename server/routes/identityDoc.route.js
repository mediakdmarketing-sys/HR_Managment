/**
 * Identity Documents Route — /api/users/:id/identity
 * All routes require HR authentication.
 */
import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import authorize from "../middleware/roleMiddleware.js";
import { isRecentlyAuthenticated } from "../utils/employeeDirectory.js";
import {
  listIdentityDocsService,
  addIdentityDocService,
  getFullIdentityNumberService,
  getIdentityDocDownloadUrlService,
  updateIdentityVerificationService,
  deleteIdentityDocService,
} from "../services/identityDocService.js";

const router = express.Router({ mergeParams: true });
router.use(authMiddleware, authorize("HR"));

const recentlyAuthenticated = (viewer) =>
  isRecentlyAuthenticated(viewer?.auth_time, Date.now());

const reauthRequired = (res) =>
  res.status(403).json({
    success: false,
    code: "REAUTH_REQUIRED",
    message: "Please confirm your password to continue.",
  });

// GET /api/users/:id/identity — list identity docs (masked)
router.get("/", async (req, res) => {
  try {
    const docs = await listIdentityDocsService(req.params.id);
    res.json({ success: true, data: docs });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

// POST /api/users/:id/identity — add new identity doc (JSON with optional base64 file)
router.post("/", async (req, res) => {
  try {
    const { type, fullNumber, fileBase64, fileName, fileContentType } = req.body;
    const fileBuffer = fileBase64 ? Buffer.from(fileBase64.replace(/^data:[^;]+;base64,/, ""), "base64") : null;
    const doc = await addIdentityDocService({
      employeeId: req.params.id,
      type,
      fullNumber,
      fileBuffer,
      fileName,
      fileContentType,
      uploadedBy: req.user.name || req.user.email,
    });
    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

// GET /api/users/:id/identity/:docId/full — reveal full number (HR only, re-auth confirmed by recent token)
router.get("/:docId/full", async (req, res) => {
  try {
    if (!recentlyAuthenticated(req.user)) {
      return reauthRequired(res);
    }
    const result = await getFullIdentityNumberService(req.params.docId, req.user.name || req.user.email);
    res.setHeader("Cache-Control", "no-store");
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

// GET /api/users/:id/identity/:docId/download — signed URL for identity image
router.get("/:docId/download", async (req, res) => {
  try {
    const url = await getIdentityDocDownloadUrlService(req.params.docId);
    res.json({ success: true, data: { url } });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

// PATCH /api/users/:id/identity/:docId/verify — update verification status
router.patch("/:docId/verify", async (req, res) => {
  try {
    const { verificationStatus } = req.body;
    const result = await updateIdentityVerificationService(req.params.docId, verificationStatus, req.user.name || req.user.email);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

// DELETE /api/users/:id/identity/:docId
router.delete("/:docId", async (req, res) => {
  try {
    await deleteIdentityDocService(req.params.docId, req.user.name || req.user.email);
    res.json({ success: true, message: "Identity document deleted" });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

export default router;
