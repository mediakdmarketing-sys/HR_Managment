import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculateEmployeeLeaveBalances,
  calculateLeaveRequestAllocation,
} from "../utils/leaveBalance.js";
import { DEFAULT_LEAVE_POLICIES } from "../utils/leavePolicy.js";

const employee = { id: "EMP001", joiningDate: "2024-01-15" };

const request = (id, type, status, days, startDate, allocation = {}) => ({
  id,
  employeeId: employee.id,
  type,
  status,
  days,
  startDate,
  endDate: startDate,
  ...allocation,
});

test("carries forward only unused paid balance up to the policy limit", () => {
  const result = calculateLeaveRequestAllocation({
    request: request("current", "Annual leave", "Pending", 8, "2025-03-10"),
    employee,
    policies: DEFAULT_LEAVE_POLICIES,
    leaveRequests: [
      request("approved-2024", "Annual leave", "Approved", 18, "2024-03-10"),
      request("pending-2025", "Annual leave", "Pending", 10, "2025-02-01"),
      request("rejected-2025", "Annual leave", "Rejected", 10, "2025-02-02"),
    ],
  });

  assert.equal(result.carriedForwardDays, 2);
  assert.equal(result.availablePaidDays, 22);
  assert.equal(result.paidDays, 8);
  assert.equal(result.unpaidDays, 0);
});

test("caps carry-forward at the stored policy limit", () => {
  const result = calculateLeaveRequestAllocation({
    request: request("current", "Annual leave", "Pending", 1, "2025-03-10"),
    employee,
    policies: DEFAULT_LEAVE_POLICIES,
    leaveRequests: [
      request("approved-2024", "Annual leave", "Approved", 10, "2024-03-10"),
    ],
  });

  assert.equal(result.carriedForwardDays, 5);
  assert.equal(result.availablePaidDays, 25);
});

test("splits a request into paid and unpaid days and excludes the current request", () => {
  const result = calculateLeaveRequestAllocation({
    request: request("current", "Annual leave", "Pending", 8, "2025-03-10"),
    employee,
    policies: DEFAULT_LEAVE_POLICIES,
    leaveRequests: [
      request("approved-2024", "Annual leave", "Approved", 20, "2024-03-10"),
      request("approved-2025", "Annual leave", "Approved", 17, "2025-02-01"),
      request("current", "Annual leave", "Approved", 8, "2025-03-10"),
    ],
  });

  assert.equal(result.availablePaidDays, 3);
  assert.equal(result.paidDays, 3);
  assert.equal(result.unpaidDays, 5);
  assert.equal(result.remainingPaidDays, 0);
});

test("only previously approved paid days consume balance after a partial approval", () => {
  const balances = calculateEmployeeLeaveBalances({
    employee: { id: employee.id, joiningDate: "2025-01-01" },
    policies: DEFAULT_LEAVE_POLICIES,
    leaveRequests: [
      request("partial", "Annual leave", "Approved", 10, "2025-04-01", {
        paidDays: 4,
        unpaidDays: 6,
      }),
    ],
    leaveYear: 2025,
  });

  test("treats legacy approved requests without an allocation as fully paid", () => {
    const balances = calculateEmployeeLeaveBalances({
      employee: { id: employee.id, joiningDate: "2025-01-01" },
      policies: DEFAULT_LEAVE_POLICIES,
      leaveRequests: [
        request("legacy", "Casual leave", "Approved", 3, "2025-04-01"),
      ],
      leaveYear: 2025,
    });

    assert.equal(
      balances.find((balance) => balance.leaveType === "Casual leave").remainingPaidDays,
      4,
    );
  });

  assert.equal(
    balances.find((balance) => balance.leaveType === "Annual leave").remainingPaidDays,
    16,
  );
});

test("treats a zero-allowance policy as fully unpaid without consuming another type", () => {
  const result = calculateLeaveRequestAllocation({
    request: request("unpaid", "Unpaid leave", "Pending", 2, "2025-03-10"),
    employee: { id: employee.id, joiningDate: "2025-01-01" },
    policies: DEFAULT_LEAVE_POLICIES,
    leaveRequests: [],
  });

  assert.equal(result.paidDays, 0);
  assert.equal(result.unpaidDays, 2);
  assert.equal(
    result.balances.find((balance) => balance.leaveType === "Annual leave").remainingPaidDays,
    20,
  );
});

test("requires a configured policy and a single calendar leave year", () => {
  assert.throws(
    () =>
      calculateLeaveRequestAllocation({
        request: request("unknown", "Other leave", "Pending", 1, "2025-03-10"),
        employee,
        policies: DEFAULT_LEAVE_POLICIES,
        leaveRequests: [],
      }),
    /No leave policy is configured/,
  );
  assert.throws(
    () =>
      calculateLeaveRequestAllocation({
        request: {
          ...request("cross-year", "Annual leave", "Pending", 1, "2025-12-30"),
          endDate: "2026-01-02",
        },
        employee,
        policies: DEFAULT_LEAVE_POLICIES,
        leaveRequests: [],
      }),
    /crossing leave years/,
  );
});
