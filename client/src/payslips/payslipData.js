// Payslip figures. Counts (full days, half days, other hours) come from the mock data or an
// imported CSV; each count is multiplied by its rate. Rates can be set per row in the CSV.
export const DEFAULT_RATES = {
  fullDayRate: 1500,
  otherHourRate: 250,
};

const number = (value) => {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

export const formatMoney = (amount) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "LKR", minimumFractionDigits: 2 }).format(amount || 0);

export const getPayslip = (employee) => {
  const basicSalary = number(employee.basicSalary);
  const fullDays = number(employee.fullDays);
  const halfDays = number(employee.halfDays);
  const otherHours = number(employee.otherHours);
  const fullDayRate = number(employee.fullDayRate) || DEFAULT_RATES.fullDayRate;
  const halfDayRate = number(employee.halfDayRate) || fullDayRate / 2;
  const otherHourRate = number(employee.otherHourRate) || DEFAULT_RATES.otherHourRate;

  const earnings = [
    { label: "Basic salary", count: "—", amount: basicSalary },
    { label: "Full day", rate: `${formatMoney(fullDayRate)} / day`, count: `${fullDays} day${fullDays === 1 ? "" : "s"}`, amount: fullDays * fullDayRate },
    { label: "Half day", rate: `${formatMoney(halfDayRate)} / half day`, count: `${halfDays} day${halfDays === 1 ? "" : "s"}`, amount: halfDays * halfDayRate },
    { label: "Other hours", rate: `${formatMoney(otherHourRate)} / hour`, count: `${otherHours} hr${otherHours === 1 ? "" : "s"}`, amount: otherHours * otherHourRate },
  ];

  return {
    id: employee.id,
    name: employee.name,
    email: employee.email,
    phone: employee.phone || "",
    role: employee.role || "Employee",
    designation: employee.designation || employee.role || "Employee",
    department: employee.department || "Unassigned",
    payPeriod: employee.payPeriod || "October 2026",
    payslipNumber: `PS-${new Date().getFullYear()}-${employee.id}`,
    fullDays,
    halfDays,
    otherHours,
    earnings,
    grossPay: earnings.reduce((total, row) => total + row.amount, 0),
  };
};

const normaliseHeader = (header) => header.toLowerCase().replace(/[^a-z0-9]/g, "");

const parseCsvRow = (row) => {
  const values = [];
  let value = "";
  let insideQuotes = false;

  for (let index = 0; index < row.length; index += 1) {
    const character = row[index];
    const nextCharacter = row[index + 1];

    if (character === '"' && insideQuotes && nextCharacter === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      insideQuotes = !insideQuotes;
    } else if (character === "," && !insideQuotes) {
      values.push(value.trim());
      value = "";
    } else {
      value += character;
    }
  }

  values.push(value.trim());
  return values;
};

// Accepted columns (case and spacing are ignored): id, name, email, phone, role, designation,
// department, payPeriod, basicSalary, fullDays, fullDayRate, halfDays, halfDayRate,
// otherHours, otherHourRate.
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

export const parsePayslipCsv = (content) => {
  const rows = (content.startsWith(BYTE_ORDER_MARK) ? content.slice(1) : content)
    .split(/\r?\n/)
    .filter((row) => row.trim());

  if (rows.length < 2) {
    throw new Error("The CSV file must include a header and at least one record.");
  }

  const headers = parseCsvRow(rows[0]);
  const headerMap = new Map(headers.map((header, index) => [normaliseHeader(header), index]));
  const getValue = (values, names) => {
    const header = names.find((name) => headerMap.has(normaliseHeader(name)));
    return header ? values[headerMap.get(normaliseHeader(header))] || "" : "";
  };

  const hasColumn = (names) => names.some((name) => headerMap.has(normaliseHeader(name)));
  if (!hasColumn(["name", "employeeName"]) || !hasColumn(["email", "companyEmail", "emailId"])) {
    throw new Error("CSV must contain name and email columns.");
  }

  return rows
    .slice(1)
    .map((row, index) => {
      const values = parseCsvRow(row);
      return getPayslip({
        id: getValue(values, ["id", "employeeId"]) || `CSV-${index + 1}`,
        name: getValue(values, ["name", "employeeName"]),
        email: getValue(values, ["email", "companyEmail", "emailId"]),
        phone: getValue(values, ["phone", "phoneNo", "phoneNumber", "mobile"]),
        role: getValue(values, ["role"]),
        designation: getValue(values, ["designation", "position"]),
        department: getValue(values, ["department", "dept"]),
        payPeriod: getValue(values, ["payPeriod", "period"]),
        basicSalary: getValue(values, ["basicSalary", "basic", "basicPay"]),
        fullDays: getValue(values, ["fullDays", "fullDay"]),
        fullDayRate: getValue(values, ["fullDayRate"]),
        halfDays: getValue(values, ["halfDays", "halfDay"]),
        halfDayRate: getValue(values, ["halfDayRate"]),
        otherHours: getValue(values, ["otherHours", "overtimeHours", "overtime"]),
        otherHourRate: getValue(values, ["otherHourRate", "overtimeRate", "hourlyRate"]),
      });
    })
    .filter((payslip) => payslip.name && payslip.email);
};
