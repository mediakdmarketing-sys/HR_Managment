import { randomBytes, randomInt } from "node:crypto";
import { firestore } from "../config/firebase.js";
import {
  calculateLegacyPayrollTotal,
  calculateWorkbookPayroll,
  workbookFieldsPresent,
} from "../utils/payrollCalculations.js";
import { maskAccountNumber } from "../utils/employeeDirectory.js";

const employees = firestore.collection("employees");
// One document per employee per month, ID "<employeeId>_<YYYY-MM>".
const records = firestore.collection("payrollRecords");
const attendanceMonthlySummaries = firestore.collection("attendanceMonthlySummaries");
// payslipNumbers/<employeeId> holds the employee's number; payslipCodes/<prefix> holds the
// 4-digit codes already used in that department, so two people never share one.
const payslipNumbers = firestore.collection("payslipNumbers");
const payslipCodes = firestore.collection("payslipCodes");
// Payslip PDFs shared over WhatsApp, keyed by an unguessable token used in the link.
const payslipShares = firestore.collection("payslipShares");
const SHARE_DAYS = 30;

export const COMPANY_CODE = process.env.PAYSLIP_COMPANY_CODE || "999";
export const DEFAULT_RATES = { fullDayRate: 1000, halfDayRate: 500, laggingHourRate: 100 };

export const calculateTotal = calculateLegacyPayrollTotal;

const departmentLetters = (department) =>
  String(department || "").replace(/[^a-z]/gi, "").slice(0, 2).toUpperCase().padEnd(2, "X");

const employeeSummary = (snapshot) => {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    name: data.name,
    email: data.email,
    phone: data.phone || "",
    role: data.role || "Employee",
    designation: data.designation || data.role || "Employee",
    department: data.department || "Unassigned",
    status: data.status,
    countryCode: data.countryCode || "",
    countryOfEmployment: data.countryOfEmployment || "",
  };
};

// Format <company code><first 2 letters of department><4 random digits>, e.g. 999DI4821.
// The number is kept for later months; it changes only if the employee changes department.
const assignPayslipNumber = (employee) => {
  const prefix = `${COMPANY_CODE}${departmentLetters(employee.department)}`;
  const numberRef = payslipNumbers.doc(employee.id);
  const codesRef = payslipCodes.doc(prefix);
  return firestore.runTransaction(async (transaction) => {
    const [numberSnapshot, codesSnapshot] = await Promise.all([
      transaction.get(numberRef),
      transaction.get(codesRef),
    ]);
    const current = numberSnapshot.data()?.number;
    if (current?.startsWith(prefix)) return current;

    const used = codesSnapshot.data()?.codes || {};
    if (Object.keys(used).length >= 10000) {
      throw new Error(`No payslip numbers left for prefix ${prefix}`);
    }
    let code;
    do {
      code = String(randomInt(10000)).padStart(4, "0");
    } while (used[code]);

    const number = `${prefix}${code}`;
    transaction.set(codesRef, { codes: { [code]: employee.id } }, { merge: true });
    transaction.set(numberRef, { number, assignedAt: new Date().toISOString() });
    return number;
  });
};

const rateFields = (entry) => ({
  fullDayRate: entry.fullDayRate,
  halfDayRate: entry.halfDayRate,
  laggingHourRate: entry.laggingHourRate,
  increment: entry.increment,
});

// Every active employee (plus anyone with a record for the month), each with that month's
// record and the rates and increment to start from: the employee's most recent earlier
// month, so a raise carries into the following months, or the company defaults.
export const listPayroll = async (period) => {
  const [employeeSnapshot, recordSnapshot, numberSnapshot, attendanceSnapshot] = await Promise.all([
    employees.get(),
    records.get(),
    payslipNumbers.get(),
    attendanceMonthlySummaries.get(),
  ]);
  const allRecords = recordSnapshot.docs.map((doc) => doc.data());
  const numbers = new Map(numberSnapshot.docs.map((doc) => [doc.id, doc.data().number]));
  const attendanceSummaries = attendanceSnapshot.docs.map((doc) => doc.data());

  return employeeSnapshot.docs
    .map(employeeSummary)
    .map((employee) => {
      const ownRecords = allRecords.filter((record) => record.employeeId === employee.id);
      const record = ownRecords.find((item) => item.period === period) || null;
      const attendanceSummary = attendanceSummaries.find(
        (summary) => summary.employeeId === employee.id && summary.month === period,
      ) || null;
      const previous = ownRecords
        .filter((item) => item.period < period)
        .sort((a, b) => b.period.localeCompare(a.period))[0];
      return {
        ...employee,
        payslipNumber: record?.payslipNumber || numbers.get(employee.id) || "",
        record,
        attendanceSummary,
        suggested: previous ? rateFields(previous) : { ...DEFAULT_RATES, increment: 0 },
      };
    })
    .filter((employee) => employee.status === "Active" || employee.record)
    .sort((a, b) => a.name.localeCompare(b.name));
};

export const saveRecord = async (employeeId, period, entry, user) => {
  const recordData = {
    ...entry,
    employeeId,
    period,
    legacyCurrency: "LKR",
    total: calculateTotal(entry),
    updatedBy: user.name || user.email || "",
    updatedAt: new Date().toISOString(),
  };
  if (workbookFieldsPresent(entry)) {
    const breakdown = calculateWorkbookPayroll(entry);
    if (breakdown.error) {
      const error = new Error(breakdown.error);
      error.statusCode = 400;
      throw error;
    }
    recordData.workbookBreakdown = breakdown.value;
  } else {
    delete recordData.workbookBreakdown;
  }

  const employeeSnapshot = await employees.doc(employeeId).get();
  if (!employeeSnapshot.exists) return null;
  const employee = employeeSummary(employeeSnapshot);
  const reference = records.doc(`${employeeId}_${period}`);
  const existing = await reference.get();
  if (existing.data()?.paymentStatus === "Paid") {
    const error = new Error("Paid payroll records cannot be edited.");
    error.statusCode = 409;
    throw error;
  }
  const payslipNumber = await assignPayslipNumber(employee);
  recordData.payslipNumber = payslipNumber;
  const now = recordData.updatedAt;
  await firestore.runTransaction(async (transaction) => {
    const existing = await transaction.get(reference);
    const existingRecord = existing.data() || {};
    if (existingRecord.paymentStatus === "Paid") {
      const error = new Error("Paid payroll records cannot be edited.");
      error.statusCode = 409;
      throw error;
    }
    transaction.set(reference, {
      ...existingRecord,
      ...recordData,
      paymentStatus: existingRecord.paymentStatus || "Unpaid",
      paymentHistory: existingRecord.paymentHistory || [],
      createdAt: existingRecord.createdAt || now,
    });
  });
  const record = { ...recordData, paymentStatus: "Unpaid" };
  return record;
};

export const confirmPayment = async ({ employeeId, period, user, reference = "" }) => {
  const document = records.doc(`${employeeId}_${period}`);
  const now = new Date().toISOString();
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(document);
    if (!snapshot.exists) {
      const error = new Error("Payroll must be created before payment can be confirmed.");
      error.statusCode = 404;
      throw error;
    }
    const current = snapshot.data();
    if (current.paymentStatus === "Paid") {
      const error = new Error("This payroll is already marked Paid; duplicate payment confirmation is blocked.");
      error.statusCode = 409;
      throw error;
    }
    const paymentEvent = {
      status: "Paid",
      confirmedAt: now,
      confirmedBy: user.name || user.email || user.id || "HR",
      reference: String(reference || "").trim(),
      method: "Manual external confirmation",
    };
    const next = {
      ...current,
      paymentStatus: "Paid",
      paymentHistory: [...(Array.isArray(current.paymentHistory) ? current.paymentHistory : []), paymentEvent],
      paymentUpdatedAt: now,
      paymentUpdatedBy: paymentEvent.confirmedBy,
    };
    transaction.set(document, next);
    return next;
  });
};

export const prepareBankExport = async ({ period, countryCode }) => {
  const employeeSnapshot = await employees.get();
  const payrollSnapshot = await records.get();
  const employeesById = new Map(
    employeeSnapshot.docs.map((document) => [document.id, { id: document.id, ...document.data() }]),
  );
  const payrollRows = payrollSnapshot.docs
    .map((document) => ({ id: document.id, ...document.data() }))
    .filter((record) => record.period === period && (record.paymentStatus || "Unpaid") === "Unpaid");
  return payrollRows
    .filter((record) => employeesById.get(record.employeeId)?.countryCode === countryCode)
    .map((record) => {
      const employee = employeesById.get(record.employeeId);
      const accountNumber = String(employee.accountNumber || "").replace(/[\s-]/g, "");
      const errors = [];
      if (!employee.bankName) errors.push("Bank name is missing.");
      if (!employee.accountHolderName) errors.push("Account holder name is missing.");
      if (!/^\d{6,20}$/.test(accountNumber)) errors.push("Account number is missing or invalid.");
      if (countryCode === "IN" && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(String(employee.ifscCode || "").trim().toUpperCase())) {
        errors.push("A valid IFSC code is required.");
      }
      const currency = record.workbookBreakdown?.currency || record.currency || record.legacyCurrency || "";
      if (!/^[A-Z]{3}$/.test(currency)) errors.push("Payroll currency is missing or invalid.");
      const amount = record.workbookBreakdown
        ? record.workbookBreakdown.netPay
        : record.total;
      if (record.workbookBreakdown && (amount === null || amount === undefined)) {
        errors.push("Net pay is pending an HR policy decision.");
      }
      if (amount === null || amount === undefined || !Number.isFinite(Number(amount))) {
        errors.push("Payroll amount is unavailable.");
      }
      return {
        employeeId: employee.id,
        employeeName: employee.name || "",
        employmentCountry: employee.countryOfEmployment || "",
        currency,
        period,
        amount: amount ?? "",
        paymentStatus: "Unpaid",
        bankName: employee.bankName || "",
        bankBranch: employee.bankBranch || "",
        bankCode: employee.bankCode || "",
        branchCode: employee.bankBranchCode || "",
        ifscCode: countryCode === "IN" ? String(employee.ifscCode || "").trim().toUpperCase() : "",
        accountHolderName: employee.accountHolderName || "",
        accountNumber: errors.some((error) => error.includes("Account number"))
          ? ""
          : accountNumber,
        accountNumberMasked: maskAccountNumber(accountNumber),
        validationStatus: errors.length ? "Needs review" : "Internal field checks passed; not bank-ready",
        validationErrors: errors,
        paymentReference: "",
      };
    });
};

// Stores the PDF behind a new random link, replacing any earlier link for the same month.
export const sharePayslip = async (employeeId, period, pdfBase64) => {
  const record = (await records.doc(`${employeeId}_${period}`).get()).data();
  if (!record) return null;
  const earlier = await payslipShares.where("employeeId", "==", employeeId).where("period", "==", period).get();
  await Promise.all(earlier.docs.map((doc) => doc.ref.delete()));

  const token = randomBytes(24).toString("base64url");
  const now = Date.now();
  await payslipShares.doc(token).set({
    employeeId,
    period,
    payslipNumber: record.payslipNumber,
    pdf: pdfBase64,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SHARE_DAYS * 24 * 60 * 60 * 1000).toISOString(),
  });
  return { token, expiresInDays: SHARE_DAYS };
};

export const getSharedPayslip = async (token) => {
  const snapshot = await payslipShares.doc(token).get();
  const share = snapshot.data();
  if (!share) return null;
  if (share.expiresAt < new Date().toISOString()) {
    await snapshot.ref.delete();
    return null;
  }
  return share;
};
