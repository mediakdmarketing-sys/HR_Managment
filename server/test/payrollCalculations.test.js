import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateLegacyPayrollTotal,
  calculateWorkbookPayroll,
  workbookFieldsPresent,
} from "../utils/payrollCalculations.js";

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

test("legacy payroll total remains unchanged", () => {
  assert.equal(calculateLegacyPayrollTotal({
    fullDays: 2,
    fullDayRate: 100,
    halfDays: 1,
    halfDayRate: 50,
    laggingHours: 0.5,
    laggingHourRate: 20,
    increment: 10,
  }), 270);
});

test("workbook gross excludes incentive and leaves unconfirmed net unresolved", () => {
  const result = calculateWorkbookPayroll(workbookEntry());
  assert.equal(result.value.grossSalary, 2900);
  assert.equal(result.value.noPayLeaveDeduction, 200);
  assert.equal(result.value.missingLeadsDeduction, 100);
  assert.equal(result.value.netPay, null);
});

test("incentive net treatment is explicit", () => {
  assert.equal(calculateWorkbookPayroll(workbookEntry("include")).value.netPay, 2850);
  assert.equal(calculateWorkbookPayroll(workbookEntry("exclude")).value.netPay, 2600);
});

test("workbook calculation rejects invalid divisors and detects supplied fields", () => {
  assert.match(calculateWorkbookPayroll({ ...workbookEntry(), workingDayDivisor: 0 }).error, /greater than zero/);
  assert.equal(workbookFieldsPresent({ basicSalary: "" }), false);
  assert.equal(workbookFieldsPresent({ basicSalary: 0 }), true);
});
