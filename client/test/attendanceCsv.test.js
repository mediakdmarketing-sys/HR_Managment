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

test("parses the HR Portal daily format without converting source hour values", () => {
  const [record] = parseAttendanceCsv(
    "Employee ID,Email,Employee,Department,Date,Day,Clock In,Clock Out,Status,Leave,Hours,Break,Productive\n" +
      "EMP001,jane@example.com,Jane,HR,2026-11-06,Fri,08:30 AM,5:00 PM,Full day,,10.32,1,9.32\n",
    "daily",
  );
  assert.equal(record.recordType, "dailyDetailed");
  assert.equal(record.clockIn, "08:30 AM");
  assert.equal(record.hoursSource, "10.32");
  assert.equal(record.productiveSource, "9.32");
  assert.equal(record.workingHours, undefined);
});

test("parses the payroll monthly summary as a separate source record", () => {
  const [record] = parseAttendanceCsv(
    "Employee ID,Employee,Email,Department,Month,Days Present,Total Hours,Worked,Break,Idle,Flagged Days,Full Days,Half Days,Other Days,Other Hours,Base Pay (USD),Bonus (USD),Net Pay (USD),Days Without Rate,Synced\n" +
      "EMP001,Jane,jane@example.com,HR,2026-11,5,37.15,37h 8m,4h 1m,0s,3,0,0,0,0,0,0,0,0,false\n",
    "monthly",
  );
  assert.equal(record.recordType, "monthlySummary");
  assert.equal(record.month, "2026-11");
  assert.equal(record.totalHoursSource, "37.15");
  assert.equal(record.worked, "37h 8m");
  assert.equal(record.netPayUsd, "0");
});
