import assert from "node:assert/strict";
import { test } from "node:test";
import authorize from "../middleware/roleMiddleware.js";
import { makeEmployeeDirectoryPersistence } from "../services/employeeDirectoryPersistence.js";
import {
  EMPLOYEE_CSV_HEADERS,
  isActiveHrRecord,
  isRecentlyAuthenticated,
  maskAccountNumber,
  parseEmployeeCsv,
  validateEmployeeInput,
  validateEmployeeUpdate,
} from "../utils/employeeDirectory.js";

const employeeInput = (overrides = {}) => ({
  employeeId: "",
  name: "Ravi Perera",
  email: "ravi@example.test",
  role: "Employee",
  department: "Operations",
  countryCode: "LK",
  countryOfEmployment: "Sri Lanka",
  address: "12 Main Street",
  city: "Colombo",
  country: "Sri Lanka",
  postalCode: "00100",
  pinCode: "",
  phone: "+94 77 123 4567",
  personalEmail: "",
  dateOfBirth: "",
  nationalId: "",
  bankName: "People's Bank",
  accountHolderName: "Ravi Perera",
  accountNumber: "1234567890",
  bankBranch: "Colombo",
  bankCode: "",
  bankBranchCode: "001",
  micrCode: "",
  ifscCode: "",
  joiningDate: "2025-01-15",
  lastWorkingDate: "",
  designation: "HR Associate",
  ...overrides,
});

const createMemoryFirestore = () => {
  const collections = new Map();
  const getCollection = (name) => {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name);
  };
  const documentSnapshot = (id, value) => ({
    id,
    exists: value !== undefined,
    data: () => (value === undefined ? undefined : { ...value }),
  });
  const firestore = {
    collections,
    collection(name) {
      return {
        kind: "collection",
        name,
        doc(id) {
          return { kind: "document", collectionName: name, id };
        },
      };
    },
    async runTransaction(work) {
      const writes = [];
      const transaction = {
        async get(reference) {
          const documents = getCollection(reference.name || reference.collectionName);
          if (reference.kind === "collection") {
            const docs = [...documents.entries()].map(([id, value]) =>
              documentSnapshot(id, value),
            );
            return { docs, empty: docs.length === 0 };
          }
          return documentSnapshot(reference.id, documents.get(reference.id));
        },
        create(reference, value) {
          writes.push({ kind: "create", reference, value });
        },
        update(reference, value) {
          writes.push({ kind: "update", reference, value });
        },
        delete(reference) {
          writes.push({ kind: "delete", reference });
        },
      };
      const result = await work(transaction);
      for (const write of writes) {
        const documents = getCollection(write.reference.collectionName);
        if (write.kind === "create") {
          if (documents.has(write.reference.id)) {
            throw new Error("Document already exists.");
          }
          documents.set(write.reference.id, { ...write.value });
        } else if (write.kind === "update") {
          documents.set(write.reference.id, {
            ...documents.get(write.reference.id),
            ...write.value,
          });
        } else {
          documents.delete(write.reference.id);
        }
      }
      return result;
    },
  };
  return firestore;
};

const validCsvHeaders = EMPLOYEE_CSV_HEADERS.join(",");

const csvEmployee = (overrides = {}) => ({
  employeeId: "",
  name: "Ravi Perera",
  email: "ravi@example.test",
  role: "Employee",
  department: "Operations",
  countryOfEmployment: "Sri Lanka",
  countryCode: "LK",
  address: "12 Main Street",
  city: "Colombo",
  country: "Sri Lanka",
  postalCode: "00100",
  pinCode: "",
  phone: "+94 77 123 4567",
  personalEmail: "",
  dateOfBirth: "",
  nationalId: "",
  bankName: "People's Bank",
  otherBankName: "",
  accountHolderName: "Ravi Perera",
  accountNumber: "1234567890",
  bankBranch: "",
  bankCode: "",
  bankBranchCode: "",
  micrCode: "",
  ifscCode: "",
  joiningDate: "2025-01-15",
  lastWorkingDate: "",
  designation: "HR Associate",
  ...overrides,
});

const csvRow = (employee) =>
  EMPLOYEE_CSV_HEADERS.map((header) => employee[header] || "")
    .map((value) => {
      const text = String(value ?? "");
      return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
    })
    .join(",");

test("manual directory creation is transactional and never creates an Auth account", async () => {
  const database = createMemoryFirestore();
  const persistence = makeEmployeeDirectoryPersistence(database);
  const created = await persistence.create(employeeInput());

  assert.equal(created.id, "EMP001");
  assert.equal(created.status, "Active");
  assert.equal(created.uid, undefined);
  assert.equal(database.collections.get("employees").get("EMP001").accountNumber, "1234567890");
  assert.equal(database.collections.get("employees").get("EMP001").postalCode, "00100");
  assert.deepEqual(
    [...database.collections.keys()].sort(),
    ["employeeCounters", "employeeEmailIndexes", "employees"],
  );
});

test("validates employee IDs and rejects duplicate IDs and case-insensitive email addresses", async () => {
  const database = createMemoryFirestore();
  const persistence = makeEmployeeDirectoryPersistence(database);
  await persistence.create(employeeInput({ employeeId: "EMP042" }));
  await assert.rejects(
    persistence.create(employeeInput({ employeeId: "EMP042", email: "another@example.test" })),
    { statusCode: 409 },
  );
  await assert.rejects(
    persistence.create(employeeInput({ employeeId: "EMP043", email: "RAVI@EXAMPLE.TEST" })),
    { statusCode: 409 },
  );
  assert.throws(
    () => validateEmployeeInput(employeeInput({ employeeId: "0042" })),
    /EMP prefix/,
  );
  assert.throws(
    () => validateEmployeeInput(employeeInput({ employeeId: "EMP000" })),
    /positive safe integer/,
  );
  assert.throws(
    () => validateEmployeeInput(employeeInput({ employeeId: "EMP999999999999999999" })),
    /positive safe integer/,
  );
});

test("rejects invalid personal, joining-date, country and country-specific bank details", () => {
  assert.throws(() => validateEmployeeInput(employeeInput({ email: "not-an-email" })), /valid employee email/);
  assert.throws(() => validateEmployeeInput(employeeInput({ joiningDate: "2025-02-30" })), /valid YYYY-MM-DD/);
  assert.throws(
    () => validateEmployeeInput(employeeInput({ countryCode: "IN", countryOfEmployment: "India", postalCode: "", pinCode: "560001", ifscCode: "" })),
    /IFSC code is required/,
  );
  assert.throws(
    () => validateEmployeeInput(employeeInput({ countryCode: "LK", countryOfEmployment: "Sri Lanka", ifscCode: "HDFC0001234" })),
    /only used for India/,
  );
  assert.throws(
    () => validateEmployeeInput(employeeInput({ countryCode: "IN", countryOfEmployment: "Sri Lanka" })),
    /do not match/,
  );
  assert.throws(
    () => validateEmployeeInput(employeeInput({ postalCode: "" })),
    /five-digit Sri Lankan postal code/,
  );
  assert.throws(
    () => validateEmployeeInput(employeeInput({ pinCode: "11000", countryCode: "IN", countryOfEmployment: "India", postalCode: "", ifscCode: "HDFC0001234" })),
    /six-digit Indian PIN code/,
  );
  assert.equal(
    validateEmployeeInput(employeeInput({ bankCode: "", bankBranchCode: "", micrCode: "" })).bankBranchCode,
    "",
  );
  assert.throws(() => validateEmployeeInput(employeeInput({ phone: "" })), /phone number is required/);
  assert.throws(() => validateEmployeeInput(employeeInput({ designation: "" })), /Designation is required/);
});

test("CSV import supports quoted commas, partial success, duplicate detection and safe row errors", async () => {
  const database = createMemoryFirestore();
  const persistence = makeEmployeeDirectoryPersistence(database);
  const first = csvEmployee({ name: "Ravi, Perera", email: "ravi@example.test" });
  const second = csvEmployee({ name: "Anika Jay", email: "anika@example.test" });
  const duplicate = csvEmployee({
    employeeId: "EMP009",
    email: "RAVI@EXAMPLE.TEST",
  });
  const invalid = csvEmployee({
    employeeId: "EMP010",
    email: "invalid@example.test",
    accountNumber: "SENSITIVE123456",
    joiningDate: "2025-02-30",
  });
  const csv = [
    validCsvHeaders,
    csvRow(first),
    csvRow(second),
    csvRow(duplicate),
    csvRow(invalid),
    "",
  ].join("\r\n") + "\r\n";
  const result = await persistence.importCsv(csv);

  assert.deepEqual(
    {
      imported: result.imported,
      duplicates: result.duplicates,
      skipped: result.skipped,
      failed: result.failed,
    },
    { imported: 2, duplicates: 1, skipped: 1, failed: 1 },
  );
  assert.equal(database.collections.get("employees").get("EMP001").name, "Ravi, Perera");
  assert.equal(database.collections.get("employees").get("EMP002").name, "Anika Jay");
  assert.equal(database.collections.get("employees").get("EMP002").uid, undefined);
  assert.equal(result.rows.find((row) => row.status === "failed").message.includes("SENSITIVE123456"), false);
  assert.equal(result.rows.find((row) => row.status === "imported").status, "imported");

  const repeated = await persistence.importCsv([validCsvHeaders, csvRow(first)].join("\n"));
  assert.equal(repeated.duplicates, 1);
});

test("CSV rejects authentication columns and enforces byte and row limits", () => {
  assert.throws(
    () => parseEmployeeCsv(`${validCsvHeaders},temporaryPassword\n${csvRow(csvEmployee())}`),
    /Authentication columns/,
  );
  assert.throws(
    () => parseEmployeeCsv(`${validCsvHeaders}\n${"あ".repeat(800_000)}`),
    /2 MB or smaller/,
  );
});

test("existing employee edits preserve bank information unless explicitly changed", () => {
  const original = {
    ...employeeInput(),
    id: "EMP001",
    accountNumber: "1234567890",
    accountNumberMasked: "123****890",
  };
  const ordinaryEdit = validateEmployeeUpdate(original, { department: "People" });
  assert.deepEqual(ordinaryEdit, { department: "People" });

  assert.throws(
    () => validateEmployeeUpdate(original, { password: "new-password" }),
    /Passwords cannot be changed/,
  );
  assert.throws(
    () => validateEmployeeUpdate({ ...original, uid: "legacy-auth-uid" }, { status: "Not Active" }),
    /Authentication-linked records cannot be deactivated/,
  );
  assert.throws(
    () => validateEmployeeUpdate(original, { accountNumber: "" }),
    /6 to 20 digits/,
  );
});

test("bank masking and reauthentication checks are safe and time-bounded", () => {
  assert.equal(maskAccountNumber("123456789012"), "123******012");
  assert.equal(maskAccountNumber(""), "");
  const now = 1_750_000_000_000;
  assert.equal(isRecentlyAuthenticated(now / 1000 - 60, now), true);
  assert.equal(isRecentlyAuthenticated(now / 1000 - 301, now), false);
  assert.equal(isRecentlyAuthenticated(now / 1000 + 1, now), false);
});

test("login records and employee APIs require active HR authorization", () => {
  assert.equal(isActiveHrRecord({ role: "HR", status: "Active" }), true);
  assert.equal(isActiveHrRecord({ role: "Employee", status: "Active" }), false);
  assert.equal(isActiveHrRecord({ role: "HR", status: "Not Active" }), false);

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
