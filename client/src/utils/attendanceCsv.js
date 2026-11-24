const normaliseHeader = (header) =>
  header.toLowerCase().replace(/[^a-z0-9]/g, "");

const parseCsvRows = (content) => {
  const rows = [];
  let values = [];
  let value = "";
  let insideQuotes = false;
  let line = 1;
  let rowLine = 1;

  const finishField = () => {
    values.push(value.trim());
    value = "";
  };
  const finishRow = () => {
    finishField();
    if (values.some((item) => item !== "")) rows.push({ values, line: rowLine });
    values = [];
    rowLine = line + 1;
  };

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    const nextCharacter = content[index + 1];

    if (character === '"' && insideQuotes && nextCharacter === '"') {
      value += '"';
      index += 1;
    } else if (character === '"' && (!insideQuotes ? value.trim() === "" : true)) {
      insideQuotes = !insideQuotes;
    } else if (character === "," && !insideQuotes) {
      finishField();
    } else if ((character === "\n" || character === "\r") && !insideQuotes) {
      if (character === "\r" && nextCharacter === "\n") index += 1;
      finishRow();
      line += 1;
      rowLine = line;
    } else if (insideQuotes && (character === "\n" || character === "\r")) {
      value += "\n";
      if (character === "\r" && nextCharacter === "\n") index += 1;
      line += 1;
    } else {
      value += character;
    }
  }

  if (insideQuotes) throw new Error("The CSV file contains an unclosed quoted field.");
  if (value !== "" || values.length > 0) finishRow();
  return rows;
};

const todayLocal = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const findHeader = (headerMap, names) =>
  names.find((name) => headerMap.has(normaliseHeader(name)));

const getValue = (row, headerMap, names) => {
  const header = findHeader(headerMap, names);
  return header ? row[headerMap.get(normaliseHeader(header))] || "" : "";
};

const fieldIndex = (headerMap, names) =>
  names.map((name) => headerMap.get(normaliseHeader(name))).find((index) => index !== undefined);

const requireAnyHeader = (headerMap, names, message) => {
  if (fieldIndex(headerMap, names) === undefined) throw new Error(message);
};

const parseMonthlySummary = (rows, headerMap, headers) => {
  requireAnyHeader(headerMap, ["employeeId", "employeeCode", "email", "employeeEmail"], "Monthly CSV must contain an Employee ID or email column.");
  for (const header of [
    "Month", "Days Present", "Total Hours", "Worked", "Break", "Idle", "Flagged Days",
    "Full Days", "Half Days", "Other Days", "Other Hours", "Base Pay (USD)",
    "Bonus (USD)", "Net Pay (USD)", "Days Without Rate", "Synced",
  ]) {
    if (!headerMap.has(normaliseHeader(header))) throw new Error(`Monthly CSV must contain the "${header}" column.`);
  }
  const expectedColumnCount = headers.length;
  return rows.map(({ values, line }) => ({
    recordType: "monthlySummary",
    rowNumber: line,
    invalidReason:
      values.length === expectedColumnCount
        ? undefined
        : `Expected ${expectedColumnCount} columns but found ${values.length}.`,
    employeeId: getValue(values, headerMap, ["employeeId", "employeeCode"]),
    email: getValue(values, headerMap, ["email", "employeeEmail"]),
    name: getValue(values, headerMap, ["employee", "employeeName", "name"]),
    department: getValue(values, headerMap, ["department"]),
    month: getValue(values, headerMap, ["month"]),
    daysPresent: getValue(values, headerMap, ["daysPresent"]),
    totalHoursSource: getValue(values, headerMap, ["totalHours"]),
    worked: getValue(values, headerMap, ["worked"]),
    breakSource: getValue(values, headerMap, ["break"]),
    idle: getValue(values, headerMap, ["idle"]),
    flaggedDays: getValue(values, headerMap, ["flaggedDays"]),
    fullDays: getValue(values, headerMap, ["fullDays"]),
    halfDays: getValue(values, headerMap, ["halfDays"]),
    otherDays: getValue(values, headerMap, ["otherDays"]),
    otherHoursSource: getValue(values, headerMap, ["otherHours"]),
    basePayUsd: getValue(values, headerMap, ["basePayUsd"]),
    bonusUsd: getValue(values, headerMap, ["bonusUsd"]),
    netPayUsd: getValue(values, headerMap, ["netPayUsd"]),
    daysWithoutRate: getValue(values, headerMap, ["daysWithoutRate"]),
    synced: getValue(values, headerMap, ["synced"]),
  }));
};

const parseDetailedDaily = (rows, headerMap, headers) => {
  requireAnyHeader(headerMap, ["employeeId", "employeeCode", "email", "employeeEmail"], "Daily CSV must contain an Employee ID or email column.");
  for (const header of ["date", "day", "clockIn", "clockOut", "status", "leave", "hours", "break", "productive"]) {
    if (!headerMap.has(normaliseHeader(header))) throw new Error(`Daily CSV must contain the "${header}" column.`);
  }
  const expectedColumnCount = headers.length;
  return rows.map(({ values, line }) => ({
    recordType: "dailyDetailed",
    rowNumber: line,
    invalidReason:
      values.length === expectedColumnCount
        ? undefined
        : `Expected ${expectedColumnCount} columns but found ${values.length}.`,
    employeeId: getValue(values, headerMap, ["employeeId", "employeeCode"]),
    name: getValue(values, headerMap, ["name", "employeeName"]),
    email: getValue(values, headerMap, ["email", "employeeEmail"]),
    department: getValue(values, headerMap, ["department"]),
    date: getValue(values, headerMap, ["date"]),
    day: getValue(values, headerMap, ["day"]),
    clockIn: getValue(values, headerMap, ["clockIn"]),
    clockOut: getValue(values, headerMap, ["clockOut"]),
    attendanceStatus: getValue(values, headerMap, ["status"]),
    leave: getValue(values, headerMap, ["leave"]),
    hoursSource: getValue(values, headerMap, ["hours"]),
    breakSource: getValue(values, headerMap, ["break"]),
    productiveSource: getValue(values, headerMap, ["productive"]),
  }));
};

export const parseAttendanceCsv = (content, format = "legacy") => {
  const rows = parseCsvRows(String(content).replace(/^\uFEFF/, ""));
  if (rows.length < 2) {
    throw new Error("The CSV file must include a header and at least one record.");
  }

  const headers = rows[0].values;
  const headerMap = new Map();
  for (const [index, header] of headers.entries()) {
    const normalized = normaliseHeader(header);
    if (!normalized) continue;
    if (headerMap.has(normalized)) {
      throw new Error(`The CSV contains a duplicate "${header}" column.`);
    }
    headerMap.set(normalized, index);
  }

  const employeeIdHeaders = ["employeeId", "employeeID", "employeeCode", "id"];
  const emailHeaders = ["email", "emailId", "employeeEmail"];
  const statusHeaders = ["status", "attendanceStatus", "attendance"];
  const hoursHeaders = ["workingHours", "hoursWorked", "hours"];
  if (format === "monthly") {
    return parseMonthlySummary(rows.slice(1), headerMap, headers);
  }
  if (format === "daily") {
    return parseDetailedDaily(rows.slice(1), headerMap, headers);
  }
  if (format !== "legacy") throw new Error("Choose a supported attendance CSV format.");
  if (
    !employeeIdHeaders.some((name) => headerMap.has(normaliseHeader(name))) &&
    !emailHeaders.some((name) => headerMap.has(normaliseHeader(name)))
  ) throw new Error("CSV must contain an employee ID or email column.");
  if (!statusHeaders.some((name) => headerMap.has(normaliseHeader(name)))) {
    throw new Error("CSV must contain a status column.");
  }
  if (!hoursHeaders.some((name) => headerMap.has(normaliseHeader(name)))) {
    throw new Error("CSV must contain a working hours column.");
  }

  const dateHeaders = ["date", "attendanceDate", "workDate"];
  const hasDateColumn = dateHeaders.some((name) =>
    headerMap.has(normaliseHeader(name)),
  );
  const expectedColumnCount = headers.length;

  return rows.slice(1).map(({ values, line }) => ({
    rowNumber: line,
    invalidReason:
      values.length === expectedColumnCount
        ? undefined
        : `Expected ${expectedColumnCount} columns but found ${values.length}.`,
    employeeId: getValue(values, headerMap, employeeIdHeaders),
    name: getValue(values, headerMap, ["name", "employeeName"]),
    email: getValue(values, headerMap, emailHeaders),
    department: getValue(values, headerMap, ["department", "dept"]),
    date: hasDateColumn
      ? getValue(values, headerMap, dateHeaders)
      : todayLocal(),
    attendanceStatus: getValue(values, headerMap, statusHeaders),
    workingHours: getValue(values, headerMap, hoursHeaders),
    totalBreakTime:
      getValue(values, headerMap, ["totalBreakTime", "totalBreakHours", "breakTime"]) ||
      "0",
  }));
};
