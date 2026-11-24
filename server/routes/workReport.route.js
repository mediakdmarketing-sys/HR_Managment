/**
 * Work Reports Route — /api/work-reports
 */
import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import authorize from "../middleware/roleMiddleware.js";
import {
  listWorkReportsService,
  getWorkReportService,
  createWorkReportService,
  updateWorkReportService,
  submitWorkReportService,
  reviewWorkReportService,
  deleteWorkReportService,
} from "../services/workReportService.js";

const router = express.Router();
router.use(authMiddleware, authorize("HR"));

// GET /api/work-reports?employeeId=X&month=Y&year=Z
router.get("/", async (req, res) => {
  try {
    const { employeeId, month, year } = req.query;
    const reports = await listWorkReportsService({ employeeId, month, year });
    res.json({ success: true, data: reports });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

// GET /api/work-reports/:id
router.get("/:id", async (req, res) => {
  try {
    const report = await getWorkReportService(req.params.id);
    if (!report) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

// POST /api/work-reports
router.post("/", async (req, res) => {
  try {
    const report = await createWorkReportService({ ...req.body, createdBy: req.user.name || req.user.email });
    res.status(201).json({ success: true, data: report });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

// PATCH /api/work-reports/:id
router.patch("/:id", async (req, res) => {
  try {
    const report = await updateWorkReportService(req.params.id, req.body, req.user.name || req.user.email);
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

// PATCH /api/work-reports/:id/submit
router.patch("/:id/submit", async (req, res) => {
  try {
    const report = await submitWorkReportService(req.params.id, req.user.name || req.user.email);
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

// PATCH /api/work-reports/:id/review
router.patch("/:id/review", async (req, res) => {
  try {
    const { status, reviewComments } = req.body;
    const report = await reviewWorkReportService(req.params.id, { status, reviewComments }, req.user.name || req.user.email);
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

// DELETE /api/work-reports/:id
router.delete("/:id", async (req, res) => {
  try {
    await deleteWorkReportService(req.params.id, req.user.name || req.user.email);
    res.json({ success: true, message: "Work report deleted" });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

export default router;
