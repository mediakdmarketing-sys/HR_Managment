import assert from "node:assert/strict";
import { test } from "node:test";
import authorize from "../middleware/roleMiddleware.js";
import {
  calculateInclusiveLeaveDays,
  createValidatedLeaveRequest,
  formatLeaveNumber,
  isDuplicateLeaveRequest,
  leaveRequestIdentity,
  normalizeLeaveDate,
  nextLeaveNumber,
  parseLeaveCsv,
  processLeaveCsv,
} from "../utils/leaveRequestImport.js";
import { calculateLeaveRequestAllocation } from "../utils/leaveBalance.js";
import { DEFAULT_LEAVE_POLICIES } from "../utils/leavePolicy.js";

const employees = [
  { id: "EMP001", name: "Alex Rivera", email: "alex@example.test", status: "Active" },
  { id: "EMP002", name: "Sam Lee", email: "sam@example.test", status: "Active" },
];

const baseRequest = {
  employeeId: "EMP001",
  leaveType: "annual",
  startDate: "2026-11-18",
  endDate: "2026-11-18",
  days: 1,
  reason: "Personal appointment",
};

const createMemoryStore = () => {
  const saved = new Map();
  return {
    saved,
    async createRequestIfAbsent(candidate) {
      const { identityKey, documentId } = leaveRequestIdentity(candidate);
      if (saved.has(documentId)) return { duplicate: true };
      const duplicate = [...saved.values()].some((existing) =>
        isDuplicateLeaveRequest(existing, candidate),
      );
      if (duplicate) return { duplicate: true };
      const request = {
        id: documentId,
        ...candidate,
        status: "Pending",
        idempotencyKey: identityKey,
      };
      saved.set(documentId, request);
      return { duplicate: false, request };
    },
  };
};

const importCsv = (store, content, options = {}) =>
  processLeaveCsv({
    content,
    employees,
    policies: DEFAULT_LEAVE_POLICIES,
    sourceType: options.sourceType || "csv",
    sourceName: options.sourceName || "leave.csv",
    dateFormat: options.dateFormat || "auto",
    createRequestIfAbsent: store.createRequestIfAbsent,
  });

test("creates a valid manual request as pending from verified employee and policy data", async () => {
  const store = createMemoryStore();
  const created = await createValidatedLeaveRequest({
    input: baseRequest,
    employees,
    policies: DEFAULT_LEAVE_POLICIES,
    createRequestIfAbsent: store.createRequestIfAbsent,
  });

  test("formats persistent leave numbers and seeds the counter above historical numbered requests", () => {
    assert.equal(formatLeaveNumber(1), "LV-0001");
    assert.equal(formatLeaveNumber(12345), "LV-12345");
    assert.equal(nextLeaveNumber(undefined, [
      { leaveNumber: "LV-0008" },
      { leaveNumber: "LV-0003" },
      { id: "legacy-firebase-id" },
    ]), 9);
    assert.equal(nextLeaveNumber(24), 24);
    assert.throws(() => nextLeaveNumber(0), /counter is invalid/);
  });

  assert.equal(created.employeeId, "EMP001");
  assert.equal(created.employeeName, "Alex Rivera");
  assert.equal(created.type, "Annual leave");
  assert.equal(created.days, 1);
  assert.equal(created.status, "Pending");
});

test("rejects unknown employee, leave type, invalid dates, and mismatched supplied days", async () => {
  const create = (input) =>
    createValidatedLeaveRequest({
      input,
      employees,
      policies: DEFAULT_LEAVE_POLICIES,
      createRequestIfAbsent: async () => {
        throw new Error("The write callback must not run for invalid input.");
      },
    });

  await assert.rejects(create({ ...baseRequest, employeeId: "EMP999" }), {
    statusCode: 422,
  });
  await assert.rejects(
    create({ ...baseRequest, employeeId: "EMP001", employeeEmail: "sam@example.test" }),
    { statusCode: 422 },
  );
  await assert.rejects(create({ ...baseRequest, leaveType: "Not configured" }), {
    statusCode: 422,
  });
  await assert.rejects(create({ ...baseRequest, startDate: "2026-02-30" }), {
    statusCode: 422,
  });
  await assert.rejects(
    create({
      ...baseRequest,
      startDate: "2026-12-31",
      endDate: "2027-01-01",
      days: 1,
    }),
    /split before submission/,
  );
  await assert.rejects(create({ ...baseRequest, endDate: "2026-11-17" }), {
    statusCode: 422,
  });
  await assert.rejects(create({ ...baseRequest, days: 2 }), {
    statusCode: 422,
  });
  await assert.rejects(create({ ...baseRequest, days: undefined }), {
    statusCode: 422,
  });
});

test("keeps supplied requested days authoritative when within the date span", async () => {
  const store = createMemoryStore();
  const created = await createValidatedLeaveRequest({
    input: {
      ...baseRequest,
      endDate: "2026-11-19",
      days: 0.5,
    },
    employees,
    policies: DEFAULT_LEAVE_POLICIES,
    createRequestIfAbsent: store.createRequestIfAbsent,
  });

  assert.equal(created.days, 0.5);
});

test("prevents a repeated manual source reference without changing the saved request", async () => {
  const store = createMemoryStore();
  const input = { ...baseRequest, sourceReference: "HR-CASE-17" };
  await createValidatedLeaveRequest({
    input,
    employees,
    policies: DEFAULT_LEAVE_POLICIES,
    createRequestIfAbsent: store.createRequestIfAbsent,
  });
  await assert.rejects(
    createValidatedLeaveRequest({
      input,
      employees,
      policies: DEFAULT_LEAVE_POLICIES,
      createRequestIfAbsent: store.createRequestIfAbsent,
    }),
    { statusCode: 409 },
  );
  assert.equal(store.saved.size, 1);
});

test("imports valid requests for multiple employees and counts invalid rows", async () => {
  const store = createMemoryStore();
  const csv = [
    "employeeId,leaveType,startDate,endDate,days,reason",
    "EMP001,annual,2026-11-18,2026-11-18,1,Appointment",
    "EMP999,annual,2026-11-18,2026-11-18,1,Unknown employee",
    "EMP002,annual,2026-11-20,2026-11-21,3,Wrong day count",
    "EMP002,annual,2026-11-22,2026-11-22,,Personal",
  ].join("\n");
  const result = await importCsv(store, csv);

  assert.deepEqual(
    {
      imported: result.imported,
      duplicated: result.duplicated,
      skipped: result.skipped,
      failed: result.failed,
    },
    { imported: 2, duplicated: 0, skipped: 0, failed: 2 },
  );
  assert.equal(result.rows[0].request.status, "Pending");
  assert.equal(result.rows[3].request.employeeId, "EMP002");
});

test("supports quoted commas and reports blank rows as skipped", async () => {
  const store = createMemoryStore();
  const csv = [
    "Employee ID,Leave Type,Start Date,End Date,Reason",
    'EMP001,Annual leave,2026-11-18,2026-11-18,"Personal, family appointment"',
    "",
  ].join("\r\n") + "\r\n";
  const result = await importCsv(store, csv);

  assert.equal(result.imported, 1);
  assert.equal(result.skipped, 1);
  assert.equal(result.rows[0].request.reason, "Personal, family appointment");
});

test("reimporting the same CSV is idempotent and distinct external identities may repeat dates", async () => {
  const store = createMemoryStore();
  const csv = [
    "employeeId,leaveType,startDate,endDate,reason,externalRequestId",
    "EMP001,annual,2026-11-18,2026-11-18,Appointment,CSV-1",
    "EMP001,annual,2026-11-18,2026-11-18,Appointment,CSV-2",
  ].join("\n");
  const first = await importCsv(store, csv);
  const second = await importCsv(store, csv);

  assert.equal(first.imported, 2);
  assert.equal(second.duplicated, 2);
  assert.equal(store.saved.size, 2);
});

test("deduplicates standard CSV rows by employee, leave type and exact dates when no source ID exists", async () => {
  const store = createMemoryStore();
  const csv = [
    "employeeId,leaveType,startDate,endDate,reason",
    "EMP001,annual,2026-11-18,2026-11-18,Appointment",
  ].join("\n");
  const first = await importCsv(store, csv);
  const second = await importCsv(store, csv);

  assert.equal(first.imported, 1);
  assert.equal(second.duplicated, 1);
  assert.equal(store.saved.size, 1);
});

test("does not overwrite an existing approved request found by the fallback identity", async () => {
  const store = createMemoryStore();
  const approved = {
    id: "historical-approval",
    employeeId: "EMP001",
    type: "Annual leave",
    startDate: "2026-11-18",
    endDate: "2026-11-18",
    days: 1,
    status: "Approved",
    paidDays: 1,
    unpaidDays: 0,
  };
  store.saved.set(approved.id, approved);
  const result = await importCsv(
    store,
    [
      "employeeId,leaveType,startDate,endDate,reason",
      "EMP001,annual,2026-11-18,2026-11-18,Appointment",
    ].join("\n"),
  );

  assert.equal(result.duplicated, 1);
  assert.equal(store.saved.get(approved.id).status, "Approved");
  assert.equal(store.saved.get(approved.id).paidDays, 1);
  assert.equal(store.saved.size, 1);
});

test("maps Google Forms fields without treating Timestamp as a leave date", async () => {
  const store = createMemoryStore();
  const csv = [
    "Timestamp,Employee ID,Leave Type,Start Date,End Date,Reason,Response ID",
    "11/14/2026 9:20 AM,EMP002,Annual leave,11/18/2026,11/19/2026,\"Family, event\",response-42",
  ].join("\n");
  const result = await importCsv(store, csv, {
    sourceType: "google_forms",
    sourceName: "Form responses.csv",
  });
  const imported = result.rows.find((row) => row.status === "imported").request;

  assert.equal(result.imported, 1);
  assert.equal(imported.startDate, "2026-11-18");
  assert.equal(imported.sourceSubmittedAt, "11/14/2026 9:20 AM");
  assert.equal(imported.externalRequestId, "response-42");
  assert.equal(imported.sourceName, "Form responses.csv");
  assert.equal(imported.sourceType, "google_forms");
});

test("deduplicates Google Forms response IDs and safely handles ambiguous dates", async () => {
  const store = createMemoryStore();
  const csv = [
    "Timestamp,Email Address,Leave Type,Start Date,End Date,Reason,Response ID",
    "11/14/2026,alex@example.test,Annual leave,11/18/2026,11/18/2026,Appointment,resp-1",
  ].join("\n");
  const first = await importCsv(store, csv, { sourceType: "google_forms" });
  const second = await importCsv(store, csv, { sourceType: "google_forms" });

  assert.equal(first.imported, 1);
  assert.equal(second.duplicated, 1);
  assert.throws(() => normalizeLeaveDate("04/05/2026"), /ambiguous/i);
  assert.equal(normalizeLeaveDate("04/05/2026", "mdy"), "2026-04-05");
  assert.equal(normalizeLeaveDate("04/05/2026", "dmy"), "2026-05-04");
  assert.equal(normalizeLeaveDate("14/05/2026"), "2026-05-14");
});

test("pending imported requests do not reduce the paid balance used by approval preview", async () => {
  const store = createMemoryStore();
  const result = await importCsv(
    store,
    [
      "employeeId,leaveType,startDate,endDate,days,reason",
      "EMP001,annual,2026-11-18,2026-11-18,1,Appointment",
    ].join("\n"),
  );
  const pendingRequest = result.rows[0].request;
  const preview = calculateLeaveRequestAllocation({
    request: { ...pendingRequest, id: pendingRequest.id },
    employee: employees[0],
    policies: DEFAULT_LEAVE_POLICIES,
    leaveRequests: [pendingRequest],
  });

  assert.equal(preview.paidDays, 1);
  assert.equal(preview.unpaidDays, 0);
  assert.equal(preview.availablePaidDays, 20);
});

test("HR authorization middleware denies non-HR callers and permits HR", () => {
  const gate = authorize("HR");
  const denied = {};
  const response = {
    status(code) {
      denied.statusCode = code;
      return this;
    },
    json(body) {
      denied.body = body;
      return this;
    },
  };
  let nextCalled = false;

  gate({ user: { role: "Manager" } }, response, () => {
    nextCalled = true;
  });
  assert.equal(denied.statusCode, 403);
  assert.equal(nextCalled, false);

  gate({ user: { role: "HR" } }, response, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
});

test("counts all calendar dates inclusively", () => {
  assert.equal(calculateInclusiveLeaveDays("2026-11-14", "2026-11-16"), 3);
  assert.equal(normalizeLeaveDate("November 14, 2026"), "2026-11-14");
  assert.equal(normalizeLeaveDate("14-Nov-2026"), "2026-11-14");
  assert.throws(() => parseLeaveCsv('employeeId,leaveType,startDate,endDate,reason\n"EMP001'));
});
