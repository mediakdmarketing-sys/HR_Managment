import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAttendanceCsv } from "../src/utils/attendanceCsv.js";

test("parses legacy CSV columns and defaults a missing date to local today", () => {
  const [record] = parseAttendanceCsv(
    "name,email,department,status,workingHours,totalBreakTime,monthlyTotalWorkingHours\n" +
      'Jane Doe,jane@example.com,HR,Present,8.5,1,240\n',
  );

  assert.equal(record.name, "Jane Doe");
  assert.equal(record.email, "jane@example.com");
  assert.equal(record.attendanceStatus, "Present");
  assert.equal(record.workingHours, "8.5");
  assert.match(record.date, /^\d{4}-\d{2}-\d{2}$/);
});

test("parses quoted commas, escaped quotes, and embedded newlines", () => {
  const [record] = parseAttendanceCsv(
    'employeeId,name,status,workingHours,attendanceDate\n' +
      '"EMP001","Doe, ""Jane""\nSmith",Present,7.5,2026-10-20\n',
  );

  assert.equal(record.employeeId, "EMP001");
  assert.equal(record.name, 'Doe, "Jane"\nSmith');
  assert.equal(record.date, "2026-10-20");
});

test("rejects CSVs without required identity, status, or hours headers", () => {
  assert.throws(
    () => parseAttendanceCsv("name,status,workingHours\nJane,Present,8\n"),
    /employee ID or email/,
  );
  assert.throws(
    () => parseAttendanceCsv("email,workingHours\njane@example.com,8\n"),
    /status column/,
  );
  assert.throws(
    () => parseAttendanceCsv("email,status\njane@example.com,Present\n"),
    /working hours column/,
  );
});

test("returns malformed row widths for server-side skipped-row reporting", () => {
  const [record] = parseAttendanceCsv(
    "employeeId,status,workingHours\nEMP001,Present,8,unexpected\n",
  );

  assert.match(record.invalidReason, /Expected 3 columns but found 4/);
});
