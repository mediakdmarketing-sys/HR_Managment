import { createHash } from "node:crypto";
import { normalizeLeavePolicyName } from "./leavePolicy.js";

const MAX_CSV_LENGTH = 2 * 1024 * 1024;
const MAX_IMPORT_ROWS = 1000;
const DATE_FORMATS = new Set(["auto", "mdy", "dmy"]);

const csvError = (message) => Object.assign(new Error(message), { statusCode: 400 });
const validationError = (message) => Object.assign(new Error(message), { statusCode: 422 });

export const nextLeaveNumber = (storedNextNumber, existingRequests = []) => {
  if (storedNextNumber !== undefined && storedNextNumber !== null) {
    if (!Number.isSafeInteger(storedNextNumber) || storedNextNumber < 1) {
      throw new Error("The leave request number counter is invalid.");
    }
    return storedNextNumber;
  }
  const highestExistingNumber = existingRequests.reduce((highest, request) => {
    const match = String(request.leaveNumber || "").match(/^LV-(\d+)$/);
    if (!match) return highest;
    const value = Number(match[1]);
    return Number.isSafeInteger(value) ? Math.max(highest, value) : highest;
  }, 0);
  return highestExistingNumber + 1;
};

export const formatLeaveNumber = (number) => {
  if (!Number.isSafeInteger(number) || number < 1) {
    throw new Error("Leave number must be a positive safe integer.");
  }
  return `LV-${String(number).padStart(4, "0")}`;
};

const normalizeHeader = (header) =>
  header.toLowerCase().replace(/[^a-z0-9]/g, "");

const parseCsvRecords = (content) => {
  const records = [];
  let values = [];
  let value = "";
  let quoted = false;
  let closedQuote = false;
  let line = 1;
  let recordLine = 1;

  const finishField = () => {
    values.push(value.trim());
    value = "";
    closedQuote = false;
  };
  const finishRecord = () => {
    finishField();
    records.push({ values, line: recordLine });
    values = [];
    recordLine = line + 1;
  };

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    const next = content[index + 1];

    if (quoted) {
      if (character === '"' && next === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
        closedQuote = true;
      } else if (character === "\r" || character === "\n") {
        value += "\n";
        if (character === "\r" && next === "\n") index += 1;
        line += 1;
      } else {
        value += character;
      }
      continue;
    }

    if (closedQuote) {
      if (character === " " || character === "\t") continue;
      if (character !== "," && character !== "\r" && character !== "\n") {
        throw csvError(`Unexpected character after a quoted field on line ${line}.`);
      }
    }

    if (character === '"') {
      if (value.trim()) {
        throw csvError(`Unexpected quote on line ${line}.`);
      }
      value = "";
      quoted = true;
    } else if (character === ",") {
      finishField();
    } else if (character === "\r" || character === "\n") {
      finishRecord();
      if (character === "\r" && next === "\n") index += 1;
      line += 1;
      recordLine = line;
    } else {
      value += character;
    }
  }

  if (quoted) throw csvError("The CSV file contains an unclosed quoted field.");
  if (value !== "" || values.length > 0 || closedQuote) finishRecord();
  return records;
};

const HEADER_ALIASES = {
  employeeId: ["employeeid", "employeecode", "employeeidentifier"],
  employeeEmail: ["employeeemail", "email", "emailaddress"],
  leaveType: ["leavetype", "type"],
  startDate: ["startdate", "leavestartdate"],
  endDate: ["enddate", "leaveenddate"],
  days: ["days", "requesteddays"],
  reason: ["reason", "leavereason", "reasonforleave"],
  externalRequestId: ["externalrequestid", "responseid", "formresponseid"],
  sourceSubmittedAt: [
    "timestamp",
    "submissiontimestamp",
    "submittimestamp",
    "submittedat",
  ],
};

export const parseLeaveCsv = (csvContent) => {
  if (typeof csvContent !== "string" || !csvContent.trim()) {
    throw csvError("Choose a non-empty CSV file.");
  }
  if (csvContent.length > MAX_CSV_LENGTH) {
    throw csvError("The CSV file must be 2 MB or smaller.");
  }

  const records = parseCsvRecords(csvContent.replace(/^\uFEFF/, ""));
  if (records.length < 2) {
    throw csvError("The CSV must include a header and at least one data row.");
  }

  const headers = records[0].values;
  const headerMap = new Map();
  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    if (!normalized) return;
    if (headerMap.has(normalized)) {
      throw csvError(`The CSV contains a duplicate "${header}" column.`);
    }
    headerMap.set(normalized, index);
  });

  const indexFor = (field) =>
    HEADER_ALIASES[field]
      .map((alias) => headerMap.get(alias))
      .find((index) => index !== undefined);
  const employeeIdIndex = indexFor("employeeId");
  const employeeEmailIndex = indexFor("employeeEmail");
  if (employeeIdIndex === undefined && employeeEmailIndex === undefined) {
    throw csvError("CSV must contain an Employee ID or employee email column.");
  }

  for (const field of ["leaveType", "startDate", "endDate", "reason"]) {
    if (indexFor(field) === undefined) {
      throw csvError(`CSV must contain a ${field} column.`);
    }
  }

  const columnCount = headers.length;
  const rows = records.slice(1).map(({ values: row, line }) => ({
    rowNumber: line,
    isBlank: row.every((cell) => !cell.trim()),
    invalidReason:
      row.length === columnCount
        ? undefined
        : `Expected ${columnCount} columns but found ${row.length}.`,
    employeeId: employeeIdIndex === undefined ? "" : row[employeeIdIndex] || "",
    employeeEmail:
      employeeEmailIndex === undefined ? "" : row[employeeEmailIndex] || "",
    leaveType: row[indexFor("leaveType")] || "",
    startDate: row[indexFor("startDate")] || "",
    endDate: row[indexFor("endDate")] || "",
    days: indexFor("days") === undefined ? "" : row[indexFor("days")] || "",
    reason: row[indexFor("reason")] || "",
    externalRequestId:
      indexFor("externalRequestId") === undefined
        ? ""
        : row[indexFor("externalRequestId")] || "",
    sourceSubmittedAt:
      indexFor("sourceSubmittedAt") === undefined
        ? ""
        : row[indexFor("sourceSubmittedAt")] || "",
  }));
  if (rows.length > MAX_IMPORT_ROWS) {
    throw csvError(`A single import can contain at most ${MAX_IMPORT_ROWS} data rows.`);
  }
  return rows;
};

const validDateParts = (year, month, day) => {
  if (year < 1900 || month < 1 || month > 12) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const toIsoDate = (year, month, day) => {
  if (!validDateParts(year, month, day)) {
    throw validationError("Date is not a valid calendar date.");
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

export const normalizeLeaveDate = (input, dateFormat = "auto") => {
  if (!DATE_FORMATS.has(dateFormat)) {
    throw validationError("Choose a supported date format.");
  }
  const value = typeof input === "string" ? input.trim() : "";
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return toIsoDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  const slashMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const first = Number(slashMatch[1]);
    const second = Number(slashMatch[2]);
    const year = Number(slashMatch[3]);
    let month;
    let day;
    if (dateFormat === "mdy") {
      month = first;
      day = second;
    } else if (dateFormat === "dmy") {
      day = first;
      month = second;
    } else if (first > 12 && second <= 12) {
      day = first;
      month = second;
    } else if (second > 12 && first <= 12) {
      month = first;
      day = second;
    } else {
      throw validationError(
        "Date is ambiguous. Select Month / day / year or Day / month / year.",
      );
    }
    return toIsoDate(year, month, day);
  }

  const monthNames = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
  ];
  const namedValue = value.replace(/-/g, " ");
  const namedMonth =
    namedValue.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/) ||
    namedValue.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (namedMonth) {
    const monthFirst = /^[A-Za-z]/.test(namedMonth[1]);
    const monthName = (monthFirst ? namedMonth[1] : namedMonth[2]).toLowerCase();
    const month = monthNames.findIndex(
      (name) =>
        name === monthName ||
        (monthName.length === 3 && name.slice(0, 3) === monthName),
    ) + 1;
    const day = Number(monthFirst ? namedMonth[2] : namedMonth[1]);
    const year = Number(namedMonth[3]);
    if (month > 0) return toIsoDate(year, month, day);
  }
  throw validationError("Date must be ISO YYYY-MM-DD or a supported Sheets date.");
};

export const calculateInclusiveLeaveDays = (startDate, endDate) => {
  const start = normalizeLeaveDate(startDate);
  const end = normalizeLeaveDate(endDate);
  const startTime = Date.parse(`${start}T00:00:00Z`);
  const endTime = Date.parse(`${end}T00:00:00Z`);
  if (endTime < startTime) {
    throw validationError("End date must be on or after start date.");
  }
  return Math.round((endTime - startTime) / 86_400_000) + 1;
};

export const validateLeaveRequestInput = ({
  input,
  employees,
  policies,
  sourceType,
  sourceName,
  dateFormat = "auto",
}) => {
  if (!["hr_manual", "csv", "google_forms"].includes(sourceType)) {
    throw validationError("Leave request source is not supported.");
  }
  const employeeId = String(input.employeeId || "").trim();
  const employeeEmail = String(input.employeeEmail || "").trim().toLowerCase();
  if (!employeeId && !employeeEmail) {
    throw validationError("Choose an employee by ID or email.");
  }
  const byId = employeeId
    ? employees.find((employee) => employee.id === employeeId)
    : null;
  const emailMatches = employeeEmail
    ? employees.filter(
        (employee) => String(employee.email || "").trim().toLowerCase() === employeeEmail,
      )
    : [];
  const byEmail = emailMatches[0] || null;
  if ((employeeId && !byId) || (employeeEmail && emailMatches.length === 0)) {
    throw validationError("Employee ID or email does not match an existing employee.");
  }
  if (emailMatches.length > 1) {
    throw validationError("Employee email matches multiple employee records.");
  }
  if (byId && byEmail && byId.id !== byEmail.id) {
    throw validationError("Employee ID and email refer to different employees.");
  }
  const employee = byId || byEmail;
  if (!employee || employee.status !== "Active") {
    throw validationError("The selected employee is not active.");
  }

  const requestedType = String(input.leaveType || input.type || "").trim();
  if (!requestedType) throw validationError("Leave type is required.");
  const matchingPolicies = policies.filter(
    (policy) =>
      normalizeLeavePolicyName(policy.id) === normalizeLeavePolicyName(requestedType) ||
      normalizeLeavePolicyName(policy.name) === normalizeLeavePolicyName(requestedType),
  );
  if (matchingPolicies.length === 0) {
    throw validationError("Leave type does not match a saved leave policy.");
  }
  if (matchingPolicies.length > 1) {
    throw validationError("Leave type matches more than one saved policy.");
  }
  const policy = matchingPolicies[0];

  const startDate = normalizeLeaveDate(input.startDate, dateFormat);
  const endDate = normalizeLeaveDate(input.endDate, dateFormat);
  if (startDate.slice(0, 4) !== endDate.slice(0, 4)) {
    throw validationError(
      "Requests crossing calendar leave years must be split before submission.",
    );
  }
  const duration = calculateInclusiveLeaveDays(startDate, endDate);
  const hasSuppliedDays =
    input.days !== undefined &&
    input.days !== null &&
    String(input.days).trim() !== "";
  if (sourceType === "hr_manual" && !hasSuppliedDays) {
    throw validationError("Requested days are required.");
  }
  let days = duration;
  if (hasSuppliedDays) {
    const suppliedDays = Number(input.days);
    if (!Number.isFinite(suppliedDays) || suppliedDays <= 0) {
      throw validationError("Requested days must be a positive number.");
    }
    if (Math.abs(suppliedDays * 100 - Math.round(suppliedDays * 100)) > 0.001) {
      throw validationError("Requested days must have no more than two decimal places.");
    }
    if (suppliedDays > duration) {
      throw validationError(
        `Requested days cannot exceed the ${duration}-day inclusive date span.`,
      );
    }
    days = suppliedDays;
  }

  const reason = String(input.reason || "").trim();
  if (!reason) throw validationError("Reason is required.");
  if (reason.length > 2000) throw validationError("Reason must be 2,000 characters or fewer.");
  const externalRequestId = String(
    input.externalRequestId || input.sourceReference || "",
  ).trim();
  if (externalRequestId.length > 200) {
    throw validationError("Source reference must be 200 characters or fewer.");
  }
  const normalizedSourceName =
    String(sourceName || (sourceType === "hr_manual" ? "HR manual entry" : "")).trim();
  if (!normalizedSourceName) throw validationError("Source name is required.");
  if (normalizedSourceName.length > 250) {
    throw validationError("Source name must be 250 characters or fewer.");
  }
  const sourceSubmittedAt = String(input.sourceSubmittedAt || "").trim();
  if (sourceSubmittedAt.length > 200) {
    throw validationError("Source submission timestamp is too long.");
  }

  return {
    employeeId: employee.id,
    employeeName: String(employee.name || ""),
    employeeEmail: String(employee.email || "").trim().toLowerCase(),
    type: policy.name,
    policyId: policy.id,
    startDate,
    endDate,
    days,
    reason,
    sourceType,
    sourceName: normalizedSourceName,
    sourceSubmittedAt,
    externalRequestId,
  };
};

export const leaveRequestIdentity = (request) => {
  const externalRequestId = String(request.externalRequestId || "").trim();
  const value = externalRequestId
    ? `external:${request.sourceType}:${externalRequestId}`
    : `composite:${request.employeeId}:${normalizeLeavePolicyName(request.type)}:${request.startDate}:${request.endDate}`;
  const hash = createHash("sha256").update(value).digest("hex");
  return { identityKey: hash, documentId: `leave_${hash}` };
};

export const isDuplicateLeaveRequest = (existing, candidate) => {
  const existingExternalId = String(existing.externalRequestId || "").trim();
  const candidateExternalId = String(candidate.externalRequestId || "").trim();
  if (existingExternalId && candidateExternalId) {
    return (
      existing.sourceType === candidate.sourceType &&
      existingExternalId === candidateExternalId
    );
  }
  const existingTypes = new Set(
    [existing.leavePolicyId, existing.type]
      .filter(Boolean)
      .map(normalizeLeavePolicyName),
  );
  const candidateTypes = [candidate.policyId, candidate.type]
    .filter(Boolean)
    .map(normalizeLeavePolicyName);
  return (
    existing.employeeId === candidate.employeeId &&
    candidateTypes.some((type) => existingTypes.has(type)) &&
    existing.startDate === candidate.startDate &&
    existing.endDate === candidate.endDate
  );
};

export const createValidatedLeaveRequest = async ({
  input,
  employees,
  policies,
  sourceType = "hr_manual",
  sourceName = "HR manual entry",
  dateFormat = "auto",
  createRequestIfAbsent,
}) => {
  const request = validateLeaveRequestInput({
    input,
    employees,
    policies,
    sourceType,
    sourceName,
    dateFormat,
  });
  const result = await createRequestIfAbsent(request);
  if (result.duplicate) {
    throw Object.assign(new Error("This leave request has already been imported or created."), {
      statusCode: 409,
    });
  }
  return result.request;
};

export const processLeaveCsv = async ({
  content,
  employees,
  policies,
  sourceType = "csv",
  sourceName,
  dateFormat = "auto",
  createRequestIfAbsent,
}) => {
  if (!["csv", "google_forms"].includes(sourceType)) {
    throw csvError("Choose CSV or Google Forms import mode.");
  }
  const rows = parseLeaveCsv(content);
  const result = {
    imported: 0,
    duplicated: 0,
    skipped: 0,
    failed: 0,
    rows: [],
  };

  for (const row of rows) {
    if (row.isBlank) {
      result.skipped += 1;
      result.rows.push({ rowNumber: row.rowNumber, status: "skipped", message: "Blank row." });
      continue;
    }
    try {
      if (row.invalidReason) throw validationError(row.invalidReason);
      const request = validateLeaveRequestInput({
        input: row,
        employees,
        policies,
        sourceType,
        sourceName,
        dateFormat,
      });
      const created = await createRequestIfAbsent(request);
      if (created.duplicate) {
        result.duplicated += 1;
        result.rows.push({
          rowNumber: row.rowNumber,
          status: "duplicated",
          message: "Matching request or source reference already exists.",
        });
      } else {
        result.imported += 1;
        result.rows.push({
          rowNumber: row.rowNumber,
          status: "imported",
          message: "Created as Pending.",
          request: created.request,
        });
      }
    } catch (error) {
      result.failed += 1;
      result.rows.push({
        rowNumber: row.rowNumber,
        status: "failed",
        message: error.statusCode ? error.message : "Unable to save this row; no existing request was changed.",
      });
    }
  }
  return result;
};
