import * as payrollService from "../services/payrollService.js";

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

// Counts are entered by HR each month; rates and the increment are editable too.
const parseEntry = (body) => {
  const entry = {};
  const fields = {
    fullDays: ["Full days", 31],
    halfDays: ["Half days", 31],
    laggingHours: ["Lagging hours", 744],
    fullDayRate: ["Full day rate", 10_000_000],
    halfDayRate: ["Half day rate", 10_000_000],
    laggingHourRate: ["Lagging hour rate", 10_000_000],
    increment: ["Increment", 10_000_000],
  };
  for (const [key, [label, max]] of Object.entries(fields)) {
    const value = Number(body[key] ?? 0);
    if (!Number.isFinite(value) || value < 0) return { error: `${label} must be zero or more` };
    if (value > max) return { error: `${label} is too large` };
    entry[key] = Math.round(value * 100) / 100;
  }
  if (!Number.isInteger(entry.fullDays) || !Number.isInteger(entry.halfDays)) {
    return { error: "Full days and half days must be whole numbers" };
  }
  if (entry.fullDays + entry.halfDays > 31) return { error: "Full and half days together cannot exceed 31" };
  return { value: entry };
};

const currentPeriod = () => new Date().toISOString().slice(0, 7);

export const listPayroll = async (req, res) => {
  try {
    const period = req.query.period || currentPeriod();
    if (!PERIOD_PATTERN.test(period)) {
      return res.status(400).json({ success: false, message: "Period must be YYYY-MM" });
    }
    const employees = await payrollService.listPayroll(period);
    return res.json({ success: true, data: { period, employees } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const saveRecord = async (req, res) => {
  try {
    const { employeeId, period } = req.params;
    if (!PERIOD_PATTERN.test(period)) {
      return res.status(400).json({ success: false, message: "Period must be YYYY-MM" });
    }
    const { value, error } = parseEntry(req.body);
    if (error) return res.status(400).json({ success: false, message: error });
    const data = await payrollService.saveRecord(employeeId, period, value, req.user);
    if (!data) return res.status(404).json({ success: false, message: "Employee not found" });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Base64 PDF of at most ~700 KB (payslips are far smaller; Firestore documents max out at 1 MB).
const MAX_PDF_BASE64 = 950_000;

export const sharePayslip = async (req, res) => {
  try {
    const { employeeId, period } = req.params;
    const pdf = String(req.body.pdf || "");
    if (!PERIOD_PATTERN.test(period)) {
      return res.status(400).json({ success: false, message: "Period must be YYYY-MM" });
    }
    if (!pdf || pdf.length > MAX_PDF_BASE64 || !Buffer.from(pdf.slice(0, 8), "base64").toString().startsWith("%PDF")) {
      return res.status(400).json({ success: false, message: "A payslip PDF is required" });
    }
    const data = await payrollService.sharePayslip(employeeId, period, pdf);
    if (!data) return res.status(404).json({ success: false, message: "Add this month's payroll first" });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Public: opened by the employee from the WhatsApp message, so no login is needed.
export const downloadSharedPayslip = async (req, res) => {
  try {
    const share = /^[A-Za-z0-9_-]{32}$/.test(req.params.token)
      ? await payrollService.getSharedPayslip(req.params.token)
      : null;
    if (!share) return res.status(404).send("This payslip link is invalid or has expired. Please ask HR for a new one.");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="Payslip-${share.payslipNumber}-${share.period}.pdf"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Robots-Tag", "noindex");
    return res.send(Buffer.from(share.pdf, "base64"));
  } catch (error) {
    return res.status(500).send(error.message);
  }
};
