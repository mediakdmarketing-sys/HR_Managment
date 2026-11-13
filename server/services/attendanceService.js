import { firestore } from "../config/firebase.js";
import { validateAttendanceRecord } from "../utils/attendanceValidation.js";

const employees = firestore.collection("employees");
const attendanceRecords = firestore.collection("attendanceRecords");
const MAX_IMPORT_SIZE = 500;
const IMPORT_CONCURRENCY = 25;

const toAttendanceRecord = (snapshot) => ({
  id: snapshot.id,
  ...snapshot.data(),
});

const isAlreadyExistsError = (error) =>
  error.code === 6 || error.code === "6" || error.code === "already-exists";

export const getAttendanceRecords = async () => {
  const snapshot = await attendanceRecords.get();
  return snapshot.docs
    .map(toAttendanceRecord)
    .sort(
      (left, right) =>
        String(right.date).localeCompare(String(left.date)) ||
        String(left.employeeName).localeCompare(String(right.employeeName)),
    );
};

export const importAttendanceRecords = async (records, importedBy) => {
  if (!Array.isArray(records) || records.length === 0) {
    const error = new Error("Provide at least one attendance record.");
    error.statusCode = 400;
    throw error;
  }
  if (records.length > MAX_IMPORT_SIZE) {
    const error = new Error(`Import no more than ${MAX_IMPORT_SIZE} records at a time.`);
    error.statusCode = 400;
    throw error;
  }

  const employeeSnapshot = await employees.get();
  const employeeById = new Map(
    employeeSnapshot.docs.map((document) => [
      document.id,
      { id: document.id, ...document.data() },
    ]),
  );
  const employeesByEmail = new Map();
  for (const employee of employeeById.values()) {
    const email = String(employee.email || "").trim().toLowerCase();
    if (!email) continue;
    if (employeesByEmail.has(email)) {
      employeesByEmail.set(email, null);
    } else {
      employeesByEmail.set(email, employee);
    }
  }

  const results = new Array(records.length);
  const saveRecord = async (record, index) => {
    const rowNumber = Number.isSafeInteger(record?.rowNumber)
      ? record.rowNumber
      : index + 1;
    const validated = validateAttendanceRecord(record);
    if (validated.error) {
      results[index] = {
        rowNumber,
        status: "skipped",
        reason: validated.error,
      };
      return;
    }

    const { employeeId, email, date, attendanceStatus, workingHours, totalBreakTime, department } =
      validated.value;
    const employeeByProvidedId = employeeId ? employeeById.get(employeeId) : null;
    const employeeByProvidedEmail = email ? employeesByEmail.get(email) : null;
    if (employeeId && !employeeByProvidedId) {
      results[index] = { rowNumber, status: "skipped", reason: "Employee ID was not found." };
      return;
    }
    if (email && !employeeByProvidedEmail) {
      const emailExists = employeesByEmail.has(email);
      results[index] = {
        rowNumber,
        status: "skipped",
        reason: emailExists
          ? "Employee email matches more than one employee."
          : "Employee email was not found.",
      };
      return;
    }
    if (
      employeeByProvidedId &&
      employeeByProvidedEmail &&
      employeeByProvidedId.id !== employeeByProvidedEmail.id
    ) {
      results[index] = {
        rowNumber,
        status: "skipped",
        reason: "Employee ID and email refer to different employees.",
      };
      return;
    }

    const employee = employeeByProvidedId || employeeByProvidedEmail;
    if (!employee) {
      results[index] = { rowNumber, status: "skipped", reason: "Employee could not be resolved." };
      return;
    }

    const documentId = `${employee.id}_${date}`;
    const reference = attendanceRecords.doc(documentId);
    const data = {
      employeeId: employee.id,
      employeeName: String(employee.name || "").trim(),
      employeeEmail: String(employee.email || "").trim().toLowerCase(),
      department: department || String(employee.department || "").trim() || "Unassigned",
      date,
      attendanceStatus,
      workingHours,
      totalBreakTime,
      importedAt: new Date().toISOString(),
      importedBy,
    };

    try {
      const created = await firestore.runTransaction(async (transaction) => {
        const existing = await transaction.get(reference);
        if (existing.exists) return false;
        transaction.create(reference, data);
        return true;
      });
      results[index] = {
        rowNumber,
        status: created ? "imported" : "duplicate",
      };
    } catch (error) {
      if (isAlreadyExistsError(error)) {
        results[index] = { rowNumber, status: "duplicate" };
        return;
      }
      console.error("Attendance record could not be saved.", {
        employeeId: employee.id,
        date,
        error,
      });
      results[index] = {
        rowNumber,
        status: "failed",
        reason: "The record could not be saved to Firestore.",
      };
    }
  };

  for (let start = 0; start < records.length; start += IMPORT_CONCURRENCY) {
    const group = records.slice(start, start + IMPORT_CONCURRENCY);
    await Promise.all(group.map((record, offset) => saveRecord(record, start + offset)));
  }

  const counts = results.reduce(
    (total, result) => {
      total[result.status] += 1;
      return total;
    },
    { imported: 0, duplicate: 0, skipped: 0, failed: 0 },
  );
  return {
    imported: counts.imported,
    duplicates: counts.duplicate,
    skipped: counts.skipped,
    failed: counts.failed,
    results,
  };
};
