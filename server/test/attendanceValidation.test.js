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

test("validates detailed daily attendance clocks and preserves source hour text", () => {
  const record = {
    recordType: "dailyDetailed",
    employeeId: "EMP001",
    date: "2026-11-06",
    day: "Fri",
    clockIn: "08:30 AM",
    clockOut: "17:00",
    attendanceStatus: "Full day",
    leave: "",
    hoursSource: "10.32",
    breakSource: "1",
    productiveSource: "9.32",
  };
  const result = validateAttendanceRecord(record);
  assert.equal(result.error, undefined);
  assert.equal(result.value.hoursSource, "10.32");
  assert.equal(result.value.workingHours, undefined);
  assert.match(
    validateAttendanceRecord({ ...record, clockIn: "0.28125" }).error,
    /supported clock format/,
  );
  assert.match(
    validateAttendanceRecord({ ...record, day: "Tuesdayish" }).error,
    /weekday name/,
  );
});

test("validates monthly summaries independently and keeps time source values unconverted", () => {
  const record = {
    recordType: "monthlySummary",
    employeeId: "EMP001",
    email: "jane@example.test",
    name: "Jane",
    department: "HR",
    month: "2026-11",
    daysPresent: "5",
    totalHoursSource: "37.15",
    worked: "37h 8m",
    breakSource: "4h 1m",
    idle: "0s",
    flaggedDays: "3",
    fullDays: "0",
    halfDays: "0",
    otherDays: "0",
    otherHoursSource: "0",
    basePayUsd: "0",
    bonusUsd: "0",
    netPayUsd: "0",
    daysWithoutRate: "0",
    synced: "false",
  };
  const result = validateAttendanceRecord(record);
  assert.equal(result.error, undefined);
  assert.equal(result.value.totalHoursSource, "37.15");
  assert.equal(result.value.synced, false);
  assert.match(
    validateAttendanceRecord({ ...record, month: "November 2026" }).error,
    /YYYY-MM/,
  );
  assert.match(
    validateAttendanceRecord({ ...record, worked: "37.15" }).error,
    /duration format/,
  );
  assert.match(
    validateAttendanceRecord({ ...record, synced: "pending" }).error,
    /true or false/,
  );
});
