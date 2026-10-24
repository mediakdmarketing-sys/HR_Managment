import { randomBytes, randomInt } from "node:crypto";
import { firestore } from "../config/firebase.js";

const employees = firestore.collection("employees");
// One document per employee per month, ID "<employeeId>_<YYYY-MM>".
const records = firestore.collection("payrollRecords");
// payslipNumbers/<employeeId> holds the employee's number; payslipCodes/<prefix> holds the
// 4-digit codes already used in that department, so two people never share one.
const payslipNumbers = firestore.collection("payslipNumbers");
const payslipCodes = firestore.collection("payslipCodes");
// Payslip PDFs shared over WhatsApp, keyed by an unguessable token used in the link.
const payslipShares = firestore.collection("payslipShares");
const SHARE_DAYS = 30;

export const COMPANY_CODE = process.env.PAYSLIP_COMPANY_CODE || "999";
export const DEFAULT_RATES = { fullDayRate: 1000, halfDayRate: 500, laggingHourRate: 100 };

export const calculateTotal = (entry) =>
  Math.round(
    (entry.fullDays * entry.fullDayRate +
      entry.halfDays * entry.halfDayRate +
      entry.laggingHours * entry.laggingHourRate +
      entry.increment) *
      100,
  ) / 100;

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
  const [employeeSnapshot, recordSnapshot, numberSnapshot] = await Promise.all([
    employees.get(),
    records.get(),
    payslipNumbers.get(),
  ]);
  const allRecords = recordSnapshot.docs.map((doc) => doc.data());
  const numbers = new Map(numberSnapshot.docs.map((doc) => [doc.id, doc.data().number]));

  return employeeSnapshot.docs
    .map(employeeSummary)
    .map((employee) => {
      const ownRecords = allRecords.filter((record) => record.employeeId === employee.id);
      const record = ownRecords.find((item) => item.period === period) || null;
      const previous = ownRecords
        .filter((item) => item.period < period)
        .sort((a, b) => b.period.localeCompare(a.period))[0];
      return {
        ...employee,
        payslipNumber: record?.payslipNumber || numbers.get(employee.id) || "",
        record,
        suggested: previous ? rateFields(previous) : { ...DEFAULT_RATES, increment: 0 },
      };
    })
    .filter((employee) => employee.status === "Active" || employee.record)
    .sort((a, b) => a.name.localeCompare(b.name));
};

export const saveRecord = async (employeeId, period, entry, user) => {
  const employeeSnapshot = await employees.doc(employeeId).get();
  if (!employeeSnapshot.exists) return null;
  const employee = employeeSummary(employeeSnapshot);
  const payslipNumber = await assignPayslipNumber(employee);

  const reference = records.doc(`${employeeId}_${period}`);
  const existing = await reference.get();
  const now = new Date().toISOString();
  const record = {
    ...entry,
    employeeId,
    period,
    payslipNumber,
    total: calculateTotal(entry),
    updatedBy: user.name || user.email || "",
    updatedAt: now,
    createdAt: existing.data()?.createdAt || now,
  };
  await reference.set(record);
  return record;
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
