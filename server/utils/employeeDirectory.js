import { createHash } from "node:crypto";

export const EMPLOYMENT_COUNTRIES = [
  {
    code: "LK",
    name: "Sri Lanka",
    banks: [
      "People's Bank",
      "National Savings Bank",
      "Hatton National Bank",
      "Bank of Ceylon",
      "Commercial Bank of Ceylon",
      "Sampath Bank",
      "Seylan Bank",
      "Nations Trust Bank",
      "DFCC Bank",
      "National Development Bank",
      "Pan Asia Banking Corporation",
      "Union Bank of Colombo",
    ],
  },
  {
    code: "IN",
    name: "India",
    banks: [
      "State Bank of India",
      "Bank of Baroda",
      "Punjab National Bank",
      "Canara Bank",
      "Union Bank of India",
      "Bank of India",
      "Indian Bank",
      "Central Bank of India",
      "HDFC Bank",
      "ICICI Bank",
      "Axis Bank",
      "Kotak Mahindra Bank",
      "IndusInd Bank",
      "IDFC FIRST Bank",
    ],
  },
];

export const EMPLOYEE_CSV_HEADERS = [
  "employeeId",
  "name",
  "email",
  "role",
  "department",
  "countryOfEmployment",
  "countryCode",
  "bankName",
  "accountHolderName",
  "accountNumber",
  "bankBranch",
  "bankBranchCode",
  "ifscCode",
  "joiningDate",
  "assignedTeamLead",
  "title",
  "designation",
];

const employeeError = (message, statusCode = 422) =>
  Object.assign(new Error(message), { statusCode });

export const normalizeEmployeeEmail = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

export const maskAccountNumber = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length <= 6) {
    return `${"*".repeat(Math.max(digits.length - 2, 0))}${digits.slice(-2)}`;
  }
  return `${digits.slice(0, 3)}${"*".repeat(digits.length - 6)}${digits.slice(-3)}`;
};

export const isRecentlyAuthenticated = (authTime, now = Date.now()) =>
  Number.isFinite(authTime) &&
  now / 1000 - authTime >= 0 &&
  now / 1000 - authTime <= 5 * 60;

export const isActiveHrRecord = (user) =>
  user?.role === "HR" && user?.status === "Active";

const normalizeCountry = ({ countryCode, countryOfEmployment }) => {
  const byCode = EMPLOYMENT_COUNTRIES.find(
    (country) => country.code === String(countryCode || "").trim().toUpperCase(),
  );
  const byName = EMPLOYMENT_COUNTRIES.find(
    (country) =>
      country.name.toLowerCase() ===
      String(countryOfEmployment || "").trim().toLowerCase(),
  );
  if (!byCode && !byName) {
    throw employeeError("Select Sri Lanka or India as the country of employment.");
  }
  if (byCode && byName && byCode.code !== byName.code) {
    throw employeeError("Country name and country code do not match.");
  }
  return byCode || byName;
};

const validIsoDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
};

const normalizeEmployeeId = (value) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return "";
  }
  const id = String(value).trim().toUpperCase();
  if (!/^EMP\d{3,}$/.test(id)) {
    throw employeeError("Employee ID must use the EMP prefix followed by at least three digits.");
  }
  const number = Number(id.slice(3));
  if (!Number.isSafeInteger(number) || number < 1) {
    throw employeeError("Employee ID number must be a positive safe integer.");
  }
  return id;
};

export const validateEmployeeInput = (input) => {
  const name = String(input.name || "").trim();
  const email = normalizeEmployeeEmail(input.email);
  const role = String(input.role || "Employee").trim();
  const department = String(input.department || "").trim();
  if (name.length < 2 || name.length > 100) {
    throw employeeError("Employee name must be between 2 and 100 characters.");
  }
  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw employeeError("Enter a valid employee email address.");
  }
  if (!role || role.length > 80) {
    throw employeeError("Employee role is required and must be 80 characters or fewer.");
  }
  if (!department || department.length > 100) {
    throw employeeError("Employee department is required and must be 100 characters or fewer.");
  }

  const country = normalizeCountry(input);
  const selectedBank = String(input.bankName || "").trim();
  const otherBankName = String(input.otherBankName || "").trim();
  const bankName =
    ["others", "other bank"].includes(selectedBank.toLowerCase())
      ? otherBankName
      : selectedBank;
  if (!bankName || bankName.length > 80) {
    throw employeeError("A valid bank name is required.");
  }

  const accountHolderName = String(input.accountHolderName || "").trim();
  if (accountHolderName.length < 2 || accountHolderName.length > 120) {
    throw employeeError("Account holder name is required and must be 120 characters or fewer.");
  }
  const accountNumber = String(input.accountNumber || "").replace(/[\s-]/g, "");
  if (!/^\d{6,20}$/.test(accountNumber)) {
    throw employeeError("Bank account number must contain 6 to 20 digits.");
  }

  const bankBranch = String(input.bankBranch || "").trim();
  const bankBranchCode = String(input.bankBranchCode || "").trim().toUpperCase();
  const ifscCode = String(input.ifscCode || "").trim().toUpperCase();
  if (bankBranch.length > 100) {
    throw employeeError("Bank branch must be 100 characters or fewer.");
  }
  if (bankBranchCode && !/^[A-Z0-9-]{1,20}$/.test(bankBranchCode)) {
    throw employeeError("Bank branch code is not valid.");
  }
  if (country.code === "IN" && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) {
    throw employeeError("A valid 11-character IFSC code is required for India.");
  }
  if (country.code === "LK" && ifscCode) {
    throw employeeError("IFSC codes are only used for India; use the Sri Lankan branch fields instead.");
  }

  const joiningDate = String(input.joiningDate || "").trim();
  if (joiningDate && !validIsoDate(joiningDate)) {
    throw employeeError("Joining date must be a valid YYYY-MM-DD date.");
  }

  return {
    employeeId: normalizeEmployeeId(input.employeeId),
    name,
    email,
    role,
    department,
    countryOfEmployment: country.name,
    countryCode: country.code,
    bankName,
    accountHolderName,
    accountNumber,
    bankBranch,
    bankBranchCode,
    ifscCode: country.code === "IN" ? ifscCode : "",
    joiningDate,
    assignedTeamLead: String(input.assignedTeamLead || "Not assigned").trim(),
    title: String(input.title || "").trim(),
    designation: String(input.designation || "").trim(),
  };
};

const BANK_FIELDS = [
  "countryOfEmployment",
  "countryCode",
  "bankName",
  "otherBankName",
  "accountHolderName",
  "accountNumber",
  "bankBranch",
  "bankBranchCode",
  "ifscCode",
];

const sameValue = (left, right) =>
  String(left ?? "").trim() === String(right ?? "").trim();

export const validateEmployeeUpdate = (current, input) => {
  if (Object.prototype.hasOwnProperty.call(input, "password")) {
    throw employeeError("Passwords cannot be changed through employee directory management.", 400);
  }
  if (Object.prototype.hasOwnProperty.call(input, "uid")) {
    throw employeeError("Authentication identity cannot be changed through employee directory management.", 400);
  }

  const allowedFields = [
    "name",
    "email",
    "role",
    "department",
    "status",
    "assignedTeamLead",
    "workingHours",
    "totalBreakHours",
    "monthlyTotalWorkingHours",
    "title",
    "designation",
    "address",
    "nationalId",
    "joiningDate",
    "lastWorkingDate",
    "personalEmail",
    "phone",
    "dateOfBirth",
    ...BANK_FIELDS.filter((field) => field !== "otherBankName"),
  ];
  const updates = Object.fromEntries(
    allowedFields
      .filter((field) => input[field] !== undefined)
      .map((field) => [field, input[field]]),
  );
  if (
    current.role === "HR" &&
    current.uid &&
    updates.role !== undefined &&
    updates.role !== "HR"
  ) {
    throw employeeError("An HR login record cannot be converted through employee directory management.", 403);
  }
  if (
    current.role !== "HR" &&
    current.uid &&
    updates.role?.toLowerCase() === "hr"
  ) {
    throw employeeError("HR login accounts must be provisioned separately from employee records.", 403);
  }
  if (
    current.role === "HR" &&
    current.uid &&
    updates.email !== undefined &&
    normalizeEmployeeEmail(updates.email) !== normalizeEmployeeEmail(current.email)
  ) {
    throw employeeError("An authentication-linked HR email cannot be changed in the employee directory.", 403);
  }
  if (
    current.uid &&
    updates.status !== undefined &&
    updates.status !== current.status
  ) {
    throw employeeError("Authentication-linked records cannot be deactivated through employee directory management.", 403);
  }

  const bankDetailsChanged = BANK_FIELDS.some(
    (field) =>
      input[field] !== undefined && !sameValue(input[field], current[field]),
  );
  if (bankDetailsChanged) {
    const merged = { ...current, ...input };
    const countryChanged =
      input.countryCode !== undefined ||
      input.countryOfEmployment !== undefined;
    if (countryChanged || !current.countryCode || !current.countryOfEmployment) {
      const country = normalizeCountry(merged);
      updates.countryCode = country.code;
      updates.countryOfEmployment = country.name;
    }

    const selectedBank = String(input.bankName ?? current.bankName ?? "").trim();
    const otherBankName = String(input.otherBankName || "").trim();
    if (input.bankName !== undefined) {
      const bankName = ["others", "other bank"].includes(selectedBank.toLowerCase())
        ? otherBankName
        : selectedBank;
      if (!bankName || bankName.length > 80) {
        throw employeeError("A valid bank name is required.");
      }
      updates.bankName = bankName;
    }

    if (input.accountHolderName !== undefined) {
      const accountHolderName = String(input.accountHolderName).trim();
      if (
        accountHolderName.length < 2 ||
        accountHolderName.length > 120
      ) {
        throw employeeError("Account holder name is required and must be 120 characters or fewer.");
      }
      updates.accountHolderName = accountHolderName;
    }
    if (input.accountNumber !== undefined) {
      const accountNumber = String(input.accountNumber).replace(/[\s-]/g, "");
      if (!/^\d{6,20}$/.test(accountNumber)) {
        throw employeeError("Bank account number must contain 6 to 20 digits.");
      }
      updates.accountNumber = accountNumber;
    }
    if (input.bankBranch !== undefined) {
      const bankBranch = String(input.bankBranch).trim();
      if (bankBranch.length > 100) {
        throw employeeError("Bank branch must be 100 characters or fewer.");
      }
      updates.bankBranch = bankBranch;
    }
    if (input.bankBranchCode !== undefined) {
      const bankBranchCode = String(input.bankBranchCode).trim().toUpperCase();
      if (bankBranchCode && !/^[A-Z0-9-]{1,20}$/.test(bankBranchCode)) {
        throw employeeError("Bank branch code is not valid.");
      }
      updates.bankBranchCode = bankBranchCode;
    }
    if (input.ifscCode !== undefined || countryChanged) {
      const country = normalizeCountry(merged);
      const ifscCode = String(input.ifscCode ?? current.ifscCode ?? "")
        .trim()
        .toUpperCase();
      if (country.code === "IN" && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) {
        throw employeeError("A valid 11-character IFSC code is required for India.");
      }
      if (country.code === "LK" && input.ifscCode && ifscCode) {
        throw employeeError("IFSC codes are only used for India; use the Sri Lankan branch fields instead.");
      }
      updates.ifscCode = country.code === "IN" ? ifscCode : "";
    }
  }
  if (updates.email !== undefined) {
    updates.email = normalizeEmployeeEmail(updates.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.email)) {
      throw employeeError("Enter a valid employee email address.");
    }
  }
  if (updates.role !== undefined) {
    updates.role = String(updates.role).trim();
    if (!updates.role || updates.role.length > 80) {
      throw employeeError("Employee role is required and must be 80 characters or fewer.");
    }
  }
  if (updates.department !== undefined) {
    updates.department = String(updates.department).trim();
    if (!updates.department || updates.department.length > 100) {
      throw employeeError("Employee department is required and must be 100 characters or fewer.");
    }
  }
  if (
    updates.status !== undefined &&
    !["Active", "Not Active"].includes(updates.status)
  ) {
    throw employeeError("Employee status must be Active or Not Active.");
  }
  if (updates.name !== undefined) {
    updates.name = String(updates.name).trim();
    if (updates.name.length < 2 || updates.name.length > 100) {
      throw employeeError("Employee name must be between 2 and 100 characters.");
    }
  }
  if (updates.joiningDate && !validIsoDate(updates.joiningDate)) {
    throw employeeError("Joining date must be a valid YYYY-MM-DD date.");
  }
  return updates;
};

export const employeeEmailIndexId = (email) =>
  createHash("sha256").update(normalizeEmployeeEmail(email)).digest("hex");

export const nextEmployeeNumber = (storedNextNumber, existingEmployees = []) => {
  if (storedNextNumber !== undefined && storedNextNumber !== null) {
    if (!Number.isSafeInteger(storedNextNumber) || storedNextNumber < 1) {
      throw new Error("The employee ID counter is invalid.");
    }
    return storedNextNumber;
  }
  const highestExistingNumber = existingEmployees.reduce((highest, employee) => {
    const match = String(employee.id || "").match(/^EMP(\d+)$/i);
    if (!match) return highest;
    const value = Number(match[1]);
    return Number.isSafeInteger(value) ? Math.max(highest, value) : highest;
  }, 0);
  return highestExistingNumber + 1;
};

export const formatEmployeeId = (number) => {
  if (!Number.isSafeInteger(number) || number < 1) {
    throw new Error("Employee ID number must be a positive safe integer.");
  }
  return `EMP${String(number).padStart(3, "0")}`;
};

const normalizeHeader = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

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
        throw employeeError(`Unexpected character after a quoted field on line ${line}.`, 400);
      }
    }
    if (character === '"') {
      if (value.trim()) throw employeeError(`Unexpected quote on line ${line}.`, 400);
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
  if (quoted) throw employeeError("The CSV contains an unclosed quoted field.", 400);
  if (value !== "" || values.length > 0 || closedQuote) finishRecord();
  return records;
};

const HEADER_ALIASES = {
  employeeId: ["employeeid", "employeeidentifier"],
  name: ["name", "employeename"],
  email: ["email", "employeeemail", "companyemail"],
  role: ["role", "jobrole"],
  department: ["department", "dept"],
  countryOfEmployment: ["countryofemployment", "country"],
  countryCode: ["countrycode"],
  bankName: ["bankname"],
  otherBankName: ["otherbankname"],
  accountHolderName: ["accountholdername", "bankaccountholder"],
  accountNumber: ["accountnumber", "bankaccountnumber"],
  bankBranch: ["bankbranch", "branch"],
  bankBranchCode: ["bankbranchcode", "branchcode"],
  ifscCode: ["ifsccode", "ifsc"],
  joiningDate: ["joiningdate", "datejoined"],
  assignedTeamLead: ["assignedteamlead", "teamlead"],
  title: ["title"],
  designation: ["designation"],
};

export const parseEmployeeCsv = (csvContent) => {
  if (typeof csvContent !== "string" || !csvContent.trim()) {
    throw employeeError("Choose a non-empty CSV file.", 400);
  }
  if (Buffer.byteLength(csvContent, "utf8") > 2 * 1024 * 1024) {
    throw employeeError("The CSV file must be 2 MB or smaller.", 400);
  }
  const records = parseCsvRecords(csvContent.replace(/^\uFEFF/, ""));
  if (records.length < 2) {
    throw employeeError("The CSV must include a header and at least one employee row.", 400);
  }
  const headerMap = new Map();
  records[0].values.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    if (!normalized) return;
    if (headerMap.has(normalized)) {
      throw employeeError(`The CSV contains a duplicate "${header}" column.`, 400);
    }
    headerMap.set(normalized, index);
  });
  if (
    [...headerMap.keys()].some((header) =>
      header.includes("password") || header === "uid" || header.includes("firebaseuid"),
    )
  ) {
    throw employeeError("Authentication columns are not accepted in employee imports.", 400);
  }
  const indexFor = (field) =>
    HEADER_ALIASES[field]
      .map((alias) => headerMap.get(alias))
      .find((index) => index !== undefined);
  for (const field of [
    "name",
    "email",
    "role",
    "department",
    "countryOfEmployment",
    "bankName",
    "accountHolderName",
    "accountNumber",
  ]) {
    if (indexFor(field) === undefined) {
      throw employeeError(`CSV must include a ${field} column.`, 400);
    }
  }
  const columnCount = records[0].values.length;
  const rows = records.slice(1).map(({ values, line }) => {
    const input = {};
    for (const field of Object.keys(HEADER_ALIASES)) {
      const index = indexFor(field);
      input[field] = index === undefined ? "" : values[index] || "";
    }
    return {
      rowNumber: line,
      blank: values.every((cell) => !cell),
      error:
        values.length === columnCount
          ? ""
          : `Expected ${columnCount} columns but found ${values.length}.`,
      input,
    };
  });
  if (rows.length > 1000) {
    throw employeeError("An import can contain at most 1,000 data rows.", 400);
  }
  return rows;
};

export const buildNewEmployeeRecord = (input, { id, createdAt }) => {
  const employee = validateEmployeeInput(input);
  return {
    id,
    ...employee,
    status: "Active",
    workingHours: 8,
    totalBreakHours: 1,
    monthlyTotalWorkingHours: 240,
    createdAt,
  };
};

export const employeeBankCompletionMissing = (employee) => {
  const missing = [];
  if (!employee.countryCode || !employee.countryOfEmployment) missing.push("country");
  if (!employee.bankName) missing.push("bank name");
  if (!employee.accountHolderName) missing.push("account holder");
  if (!employee.accountNumber) missing.push("account number");
  if (
    employee.countryCode === "IN" &&
    !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(String(employee.ifscCode || "").trim().toUpperCase())
  ) {
    missing.push("IFSC code");
  }
  return missing;
};
