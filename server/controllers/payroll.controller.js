import * as payrollService from "../services/payrollService.js";
import { isRecentlyAuthenticated } from "../utils/employeeDirectory.js";

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
  if (body.workbookEnabled === true || body.workbookEnabled === "true") {
    const workbookFields = [
      ["basicSalary", "Basic salary", 10_000_000],
      ["allowance", "Allowance", 10_000_000],
      ["incentive", "Incentive", 10_000_000],
      ["noPayLeaveDays", "No-pay leave days", 31],
      ["missingLeadsHours", "Missing leads hours", 744],
      ["workingDayDivisor", "Working-day divisor", 366],
      ["hoursPerDay", "Hours per day", 24],
    ];
    for (const [key, label, max] of workbookFields) {
      if (body[key] === undefined || body[key] === null || String(body[key]).trim() === "") {
        return { error: `${label} is required` };
      }
      const value = Number(body[key]);
      if (!Number.isFinite(value) || value < 0 || value > max) {
        return { error: `${label} must be a non-negative number no greater than ${max}` };
      }
      entry[key] = Math.round(value * 100) / 100;
    }
    if (entry.workingDayDivisor <= 0 || entry.hoursPerDay <= 0) {
      return { error: "Working-day divisor and hours per day must be greater than zero" };
    }
    const currency = String(body.currency || "").trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) return { error: "Payment currency must be a three-letter ISO code" };
    const incentiveNetTreatment = String(body.incentiveNetTreatment || "");
    if (!["include", "exclude", "unconfirmed"].includes(incentiveNetTreatment)) {
      return { error: "Choose an incentive treatment for net pay" };
    }
    entry.currency = currency;
    entry.incentiveNetTreatment = incentiveNetTreatment;
  } else {
    entry.workbookEnabled = false;
  }
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
    const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
    return res.status(statusCode).json({
      success: false,
      message: statusCode === 500 ? "Could not load payroll records." : error.message,
    });
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
    const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
    return res.status(statusCode).json({
      success: false,
      message: statusCode === 500 ? "Could not save payroll record." : error.message,
    });
  }
};

export const confirmPayment = async (req, res) => {
  try {
    if (req.user.role !== "HR") {
      return res.status(403).json({ success: false, message: "Only HR can confirm payroll payments." });
    }
    const { employeeId, period } = req.params;
    if (!PERIOD_PATTERN.test(period)) {
      return res.status(400).json({ success: false, message: "Period must be YYYY-MM" });
    }
    const confirmed = req.body?.confirmActualPayment === true;
    if (!confirmed) {
      return res.status(400).json({ success: false, message: "Confirm that the external payment actually succeeded." });
    }
    const reference = String(req.body?.reference || "").trim();
    if (reference.length > 120) {
      return res.status(400).json({ success: false, message: "Payment reference must be 120 characters or fewer." });
    }
    const record = await payrollService.confirmPayment({
      employeeId,
      period,
      user: req.user,
      reference,
    });
    return res.json({ success: true, data: record });
  } catch (error) {
    const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
    if (statusCode === 500) console.error("Could not confirm payroll payment.", error);
    return res.status(statusCode).json({
      success: false,
      message: statusCode === 500 ? "Could not confirm payroll payment." : error.message,
    });
  }
};

export const getInternalBankExport = async (req, res) => {
  if (req.user.role !== "HR") {
    return res.status(403).json({ success: false, message: "Only HR can prepare bank payment exports." });
  }
  if (!isRecentlyAuthenticated(req.user.auth_time, Date.now())) {
    return res.status(403).json({
      success: false,
      code: "REAUTH_REQUIRED",
      message: "Please confirm your password to prepare an export containing bank account numbers.",
    });
  }
  try {
    const { period, countryCode } = req.query;
    if (!PERIOD_PATTERN.test(period || "")) {
      return res.status(400).json({ success: false, message: "Period must be YYYY-MM" });
    }
    if (!["LK", "IN"].includes(countryCode)) {
      return res.status(400).json({ success: false, message: "Choose Sri Lanka or India." });
    }
    const rows = await payrollService.prepareBankExport({ period, countryCode });
    res.setHeader("Cache-Control", "no-store");
    return res.json({
      success: true,
      data: {
        period,
        countryCode,
        workflow: countryCode === "LK" ? "BOC C Flex Corporate" : "Wise",
        bankReady: false,
        label: "INTERNAL DRAFT — NOT BANK-READY",
        rows,
      },
    });
  } catch (error) {
    console.error("Could not prepare internal payroll export.", error);
    return res.status(500).json({ success: false, message: "Could not prepare internal payroll export." });
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
