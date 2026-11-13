import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isValidAttendanceDate,
  validateAttendanceRecord,
} from "../utils/attendanceValidation.js";

const validRecord = {
  employeeId: "EMP001",
  date: "2026-10-20",
  attendanceStatus: "Present",
  workingHours: "8.5",
  totalBreakTime: "1",
};

test("accepts valid date, status, and decimal working hours", () => {
  const result = validateAttendanceRecord(validRecord);

  assert.equal(result.error, undefined);
  assert.equal(result.value.workingHours, 8.5);
  assert.equal(result.value.totalBreakTime, 1);
  assert.equal(result.value.attendanceStatus, "Present");
});

test("rejects impossible dates and non-ISO date formats", () => {
  assert.equal(isValidAttendanceDate("2026-02-29"), false);
  assert.equal(isValidAttendanceDate("10/20/2026"), false);
  assert.equal(isValidAttendanceDate("2024-02-29"), true);
});

test("rejects malformed identifiers, unsupported statuses, and invalid hours", () => {
  assert.match(
    validateAttendanceRecord({ ...validRecord, employeeId: "EMP/001" }).error,
    /invalid characters/,
  );
  assert.match(
    validateAttendanceRecord({ ...validRecord, attendanceStatus: "On Time" }).error,
    /Present.*Absent/,
  );
  assert.match(
    validateAttendanceRecord({ ...validRecord, workingHours: "25" }).error,
    /0 to 24/,
  );
  assert.match(
    validateAttendanceRecord({ ...validRecord, totalBreakTime: "-1" }).error,
    /0 to 24/,
  );
});

test("requires employee identification and reports parser-detected malformed rows", () => {
  assert.match(
    validateAttendanceRecord({ ...validRecord, employeeId: "" }).error,
    /Employee ID or email/,
  );
  assert.equal(
    validateAttendanceRecord({ ...validRecord, invalidReason: "Wrong column count" }).error,
    "Wrong column count",
  );
});
