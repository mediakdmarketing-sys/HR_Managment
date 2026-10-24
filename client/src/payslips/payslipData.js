// Payslip figures. HR enters the counts (full days, half days, lagging hours) each month;
// each count is multiplied by its rate, and the monthly increment is added on top.
export const DEFAULT_RATES = { fullDayRate: 1000, halfDayRate: 500, laggingHourRate: 100 };

const number = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const formatMoney = (amount) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "LKR", minimumFractionDigits: 2 }).format(amount || 0);

export const currentPeriod = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
};

// "2026-10" -> "October 2026"
export const formatPeriod = (period) => {
  const [year, month] = period.split("-").map(Number);
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
};

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

export const getEarnings = (entry) => {
  const fullDays = number(entry.fullDays);
  const halfDays = number(entry.halfDays);
  const laggingHours = number(entry.laggingHours);
  const fullDayRate = number(entry.fullDayRate);
  const halfDayRate = number(entry.halfDayRate);
  const laggingHourRate = number(entry.laggingHourRate);
  const earnings = [
    { label: "Full days", rate: `${formatMoney(fullDayRate)} / day`, count: plural(fullDays, "day"), amount: fullDays * fullDayRate },
    { label: "Half days", rate: `${formatMoney(halfDayRate)} / half day`, count: plural(halfDays, "day"), amount: halfDays * halfDayRate },
    { label: "Lagging hours", rate: `${formatMoney(laggingHourRate)} / hour`, count: plural(laggingHours, "hr"), amount: laggingHours * laggingHourRate },
    { label: "Increment", count: "—", amount: number(entry.increment) },
  ];
  return { earnings, total: earnings.reduce((sum, row) => sum + row.amount, 0) };
};

// Everything the payslip sheet and PDF show, from an employee row and its saved record.
export const buildPayslip = (employee, record) => {
  const { earnings, total } = getEarnings(record);
  return {
    id: employee.id,
    name: employee.name,
    email: employee.email,
    phone: employee.phone || "",
    designation: employee.designation || employee.role || "Employee",
    department: employee.department || "Unassigned",
    payPeriod: formatPeriod(record.period),
    payslipNumber: record.payslipNumber,
    earnings,
    total,
  };
};
