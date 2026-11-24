import test from "node:test";
import assert from "node:assert/strict";
import { calculateWorkbookPayrollPreview, buildPayslip, getEarnings } from "../src/payslips/payslipData.js";

const workbookEntry = (incentiveNetTreatment = "unconfirmed") => ({
  basicSalary: 2600,
  allowance: 300,
  incentive: 250,
  noPayLeaveDays: 2,
  missingLeadsHours: 9,
  workingDayDivisor: 26,
  hoursPerDay: 9,
  currency: "USD",
  incentiveNetTreatment,
});

test("workbook payslip preview shows pending net until HR configures incentive treatment", () => {
  const pending = calculateWorkbookPayrollPreview(workbookEntry());
  assert.equal(pending.grossSalary, 2900);
  assert.equal(pending.noPayLeaveDeduction, 200);
  assert.equal(pending.missingLeadsDeduction, 100);
  assert.equal(pending.netPay, null);
  assert.equal(calculateWorkbookPayrollPreview(workbookEntry("include")).netPay, 2850);
});

test("payslip preserves legacy total and carries currency, country and payment status", () => {
  const record = {
    period: "2026-11",
    fullDays: 2,
    halfDays: 1,
    laggingHours: 0,
    fullDayRate: 100,
    halfDayRate: 50,
    laggingHourRate: 20,
    increment: 10,
    currency: "USD",
    legacyCurrency: "LKR",
    paymentStatus: "Paid",
    payslipNumber: "999DI0001",
    workbookBreakdown: {
      basicSalary: 2600,
      allowance: 300,
      incentive: 250,
      grossSalary: 2900,
      noPayLeaveDays: 0,
      missingLeadsHours: 0,
      noPayLeaveDeduction: 0,
      missingLeadsDeduction: 0,
      netPay: null,
      currency: "USD",
    },
  };
  assert.equal(getEarnings(record).total, 260);
  const payslip = buildPayslip(
    {
      id: "EMP-1",
      name: "Example",
      countryCode: "IN",
      department: "Design",
      attendanceSummary: { daysPresent: 5, totalHoursSource: "37.15", worked: "36h 20m" },
    },
    record,
  );
  assert.equal(payslip.paymentCurrency, "USD");
  assert.equal(payslip.legacyCurrency, "LKR");
  assert.equal(payslip.employmentCountry, "IN");
  assert.equal(payslip.paymentStatus, "Paid");
  assert.equal(payslip.total, 260);
  assert.match(payslip.attendanceBreakdown.summaryText, /37\.15 total hours \(source\)/);
  assert.match(payslip.attendanceBreakdown.summaryText, /Worked 36h 20m/);
});
