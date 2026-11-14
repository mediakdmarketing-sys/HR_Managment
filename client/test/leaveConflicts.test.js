import assert from "node:assert/strict";
import { test } from "node:test";
import {
  findAllLeaveRequestConflicts,
  findLeaveRequestConflicts,
} from "../src/utils/leaveConflicts.js";

const request = (id, employeeId, status, startDate, endDate, employeeName = employeeId) => ({
  id,
  employeeId,
  employeeName,
  status,
  startDate,
  endDate,
});

test("does not report requests with no overlapping calendar dates", () => {
  const first = request("leave-1", "EMP001", "Pending", "2026-11-10", "2026-11-12");
  const adjacent = request("leave-2", "EMP002", "Approved", "2026-11-13", "2026-11-15");

  assert.deepEqual(findLeaveRequestConflicts(first, [first, adjacent]), []);
  assert.deepEqual(findAllLeaveRequestConflicts([first, adjacent]), []);
});

test("reports exact date overlaps and returns the inclusive overlap interval", () => {
  const first = request("leave-1", "EMP001", "Pending", "2026-11-10", "2026-11-12", "Alex");
  const second = request("leave-2", "EMP002", "Approved", "2026-11-10", "2026-11-12", "Sam");

  assert.deepEqual(findLeaveRequestConflicts(first, [first, second]), [
    {
      requestId: "leave-2",
      employeeId: "EMP002",
      employeeName: "Sam",
      status: "Approved",
      overlapStart: "2026-11-10",
      overlapEnd: "2026-11-12",
    },
  ]);
  assert.equal(findAllLeaveRequestConflicts([first, second]).length, 1);
});

test("calculates only the partially overlapping dates", () => {
  const first = request("leave-1", "EMP001", "Approved", "2026-11-10", "2026-11-15");
  const second = request("leave-2", "EMP002", "Pending", "2026-11-13", "2026-11-20");

  const [conflict] = findLeaveRequestConflicts(first, [first, second]);
  assert.equal(conflict.overlapStart, "2026-11-13");
  assert.equal(conflict.overlapEnd, "2026-11-15");
  assert.equal(conflict.status, "Pending");
});

test("includes pending and approved combinations but excludes rejected requests", () => {
  const pending = request("pending", "EMP001", "Pending", "2026-11-10", "2026-11-12");
  const approved = request("approved", "EMP002", "Approved", "2026-11-11", "2026-11-13");
  const rejected = request("rejected", "EMP003", "Rejected", "2026-11-10", "2026-11-12");

  assert.deepEqual(
    findLeaveRequestConflicts(pending, [pending, approved, rejected]).map((item) => item.status),
    ["Approved"],
  );
  assert.deepEqual(
    findLeaveRequestConflicts(approved, [pending, approved, rejected]).map((item) => item.status),
    ["Pending"],
  );
  assert.deepEqual(findLeaveRequestConflicts(rejected, [pending, approved, rejected]), []);
});

test("does not conflict a request with itself or another request by the same employee", () => {
  const first = request("leave-1", "EMP001", "Approved", "2026-11-10", "2026-11-12");
  const duplicate = request("leave-1", "EMP002", "Pending", "2026-11-10", "2026-11-12");
  const sameEmployee = request("leave-2", "EMP001", "Pending", "2026-11-10", "2026-11-12");

  assert.deepEqual(
    findLeaveRequestConflicts(first, [first, duplicate, sameEmployee]),
    [],
  );
});

test("safely ignores malformed, impossible and reversed historical date ranges", () => {
  const valid = request("leave-1", "EMP001", "Pending", "2026-11-10", "2026-11-12");
  const malformed = request("leave-2", "EMP002", "Approved", "not-a-date", "2026-11-12");
  const impossible = request("leave-3", "EMP003", "Approved", "2026-02-30", "2026-03-02");
  const reversed = request("leave-4", "EMP004", "Approved", "2026-11-20", "2026-11-19");

  assert.deepEqual(findLeaveRequestConflicts(valid, [valid, malformed, impossible, reversed]), []);
  assert.deepEqual(findLeaveRequestConflicts(malformed, [valid, malformed]), []);
});
