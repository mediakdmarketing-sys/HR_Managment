import {
  buildNewEmployeeRecord,
  employeeEmailIndexId,
  formatEmployeeId,
  nextEmployeeNumber,
  normalizeEmployeeEmail,
  parseEmployeeCsv,
  validateEmployeeInput,
} from "../utils/employeeDirectory.js";

export const makeEmployeeDirectoryPersistence = (database) => {
  const employees = database.collection("employees");
  const emailIndexes = database.collection("employeeEmailIndexes");
  const counters = database.collection("employeeCounters");
  const emailIndexFor = (email) =>
    emailIndexes.doc(employeeEmailIndexId(email));

  const create = async (input) => {
    const validated = validateEmployeeInput(input);
    const createdAt = new Date().toISOString();
    const counterReference = counters.doc("sequence");
    const emailIndexReference = emailIndexFor(validated.email);

    return database.runTransaction(async (transaction) => {
      const [emailIndexSnapshot, employeesSnapshot, counterSnapshot] =
        await Promise.all([
          transaction.get(emailIndexReference),
          transaction.get(employees),
          transaction.get(counterReference),
        ]);
      if (
        emailIndexSnapshot.exists ||
        employeesSnapshot.docs.some(
          (document) =>
            normalizeEmployeeEmail(document.data().email) === validated.email,
        )
      ) {
        throw duplicateEmployeeError();
      }

      const existingEmployees = counterSnapshot.exists
        ? []
        : employeesSnapshot.docs.map((document) => ({ id: document.id }));
      const firstAvailableNumber = nextEmployeeNumber(
        counterSnapshot.exists ? counterSnapshot.data()?.nextNumber : null,
        existingEmployees,
      );
      const suppliedIdNumber = validated.employeeId
        ? Number(validated.employeeId.slice(3))
        : null;
      const id = validated.employeeId || formatEmployeeId(firstAvailableNumber);
      const employeeReference = employees.doc(id);
      if ((await transaction.get(employeeReference)).exists) {
        throw duplicateEmployeeError();
      }

      const nextNumber = Math.max(
        firstAvailableNumber,
        suppliedIdNumber === null ? 1 : suppliedIdNumber + 1,
      );
      const employee = buildNewEmployeeRecord(
        { ...validated, employeeId: id },
        { id, createdAt },
      );
      const employeeData = { ...employee };
      delete employeeData.id;
      if (counterSnapshot.exists) {
        transaction.update(counterReference, {
          nextNumber: nextNumber + (validated.employeeId ? 0 : 1),
        });
      } else {
        transaction.create(counterReference, {
          nextNumber: nextNumber + (validated.employeeId ? 0 : 1),
        });
      }
      transaction.create(employeeReference, employeeData);
      transaction.create(emailIndexReference, { employeeId: id });
      return employee;
    });
  };

  const importCsv = async (content) => {
    const parsedRows = parseEmployeeCsv(content);
    const result = {
      imported: 0,
      duplicates: 0,
      skipped: 0,
      failed: 0,
      rows: [],
    };
    for (const row of parsedRows) {
      if (row.blank) {
        result.skipped += 1;
        result.rows.push({
          rowNumber: row.rowNumber,
          status: "skipped",
          message: "Blank row.",
        });
        continue;
      }
      if (row.error) {
        result.failed += 1;
        result.rows.push({
          rowNumber: row.rowNumber,
          status: "failed",
          message: row.error,
        });
        continue;
      }
      try {
        await create(row.input);
        result.imported += 1;
        result.rows.push({
          rowNumber: row.rowNumber,
          status: "imported",
          message: "Employee record created.",
        });
      } catch (error) {
        if (error.code === "already-exists" || error.statusCode === 409) {
          result.duplicates += 1;
          result.rows.push({
            rowNumber: row.rowNumber,
            status: "duplicate",
            message: "An employee with this ID or email already exists.",
          });
        } else {
          result.failed += 1;
          result.rows.push({
            rowNumber: row.rowNumber,
            status: "failed",
            message: error.statusCode
              ? error.message
              : "Unable to save this employee row.",
          });
        }
      }
    }
    return result;
  };

  return { create, importCsv };
};

const duplicateEmployeeError = () =>
  Object.assign(new Error("An employee with this ID or email already exists."), {
    statusCode: 409,
    code: "already-exists",
  });
