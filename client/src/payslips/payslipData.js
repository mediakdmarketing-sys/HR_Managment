// Payslip figures. HR enters the counts (full days, half days, lagging hours) each month;
// each count is multiplied by its rate, and the monthly increment is added on top.
export const DEFAULT_RATES = { fullDayRate: 1000, halfDayRate: 500, laggingHourRate: 100 };

const number = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const calculateWorkbookPayrollPreview = (entry) => {
  const basicSalary = number(entry.basicSalary);
  const allowance = number(entry.allowance);
  const incentive = number(entry.incentive);
  const noPayLeaveDays = number(entry.noPayLeaveDays);
  const missingLeadsHours = number(entry.missingLeadsHours);
  const workingDayDivisor = number(entry.workingDayDivisor);
  const hoursPerDay = number(entry.hoursPerDay);
  if (workingDayDivisor <= 0 || hoursPerDay <= 0) return null;
  const grossSalary = Math.round((basicSalary + allowance) * 100) / 100;
  const noPayLeaveDeduction = Math.round((basicSalary / workingDayDivisor * noPayLeaveDays) * 100) / 100;
  const missingLeadsDeduction = Math.round((basicSalary / workingDayDivisor / hoursPerDay * missingLeadsHours) * 100) / 100;
  const incentiveNetTreatment = String(entry.incentiveNetTreatment || "unconfirmed");
  const netPay = incentiveNetTreatment === "unconfirmed"
    ? null
    : Math.round(
        (grossSalary - noPayLeaveDeduction - missingLeadsDeduction +
          (incentiveNetTreatment === "include" ? incentive : 0)) * 100,
      ) / 100;
  return { grossSalary, noPayLeaveDeduction, missingLeadsDeduction, netPay };
};

export const formatMoney = (amount, currency = "LKR") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(amount || 0);

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

export const getEarnings = (entry, currency = entry.currency || "LKR") => {
  const fullDays = number(entry.fullDays);
  const halfDays = number(entry.halfDays);
  const laggingHours = number(entry.laggingHours);
  const fullDayRate = number(entry.fullDayRate);
  const halfDayRate = number(entry.halfDayRate);
  const laggingHourRate = number(entry.laggingHourRate);
  const earnings = [
    { label: "Full days", rate: `${formatMoney(fullDayRate, currency)} / day`, count: plural(fullDays, "day"), amount: fullDays * fullDayRate },
    { label: "Half days", rate: `${formatMoney(halfDayRate, currency)} / half day`, count: plural(halfDays, "day"), amount: halfDays * halfDayRate },
    { label: "Lagging hours", rate: `${formatMoney(laggingHourRate, currency)} / hour`, count: plural(laggingHours, "hr"), amount: laggingHours * laggingHourRate },
    { label: "Increment", count: "—", amount: number(entry.increment) },
  ];
  return { earnings, total: earnings.reduce((sum, row) => sum + row.amount, 0) };
};

// Everything the payslip sheet and PDF show, from an employee row and its saved record.
export const buildPayslip = (employee, record) => {
  const currency = record.workbookBreakdown?.currency || record.currency || "LKR";
  const legacyCurrency = record.legacyCurrency || "LKR";
  const { earnings, total } = getEarnings(record, legacyCurrency);
  const workbookBreakdown = record.workbookBreakdown || null;
  const monthlyAttendance = employee.attendanceSummary || {};
  const attendanceBreakdown = {
    daysPresent: monthlyAttendance.daysPresent ?? "",
    totalHours: monthlyAttendance.totalHoursSource ?? "",
    worked: monthlyAttendance.worked ?? "",
    break: monthlyAttendance.breakSource ?? "",
    idle: monthlyAttendance.idle ?? "",
    flaggedDays: monthlyAttendance.flaggedDays ?? "",
    fullDays: monthlyAttendance.fullDays ?? record.fullDays ?? "",
    halfDays: monthlyAttendance.halfDays ?? record.halfDays ?? "",
    otherDays: monthlyAttendance.otherDays ?? "",
    otherHours: monthlyAttendance.otherHoursSource ?? "",
    daysWithoutRate: monthlyAttendance.daysWithoutRate ?? "",
    synced: monthlyAttendance.synced === undefined ? "" : monthlyAttendance.synced ? "Yes" : "No",
    laggingHours: record.laggingHours ?? "",
  };
  const summaryItems = [
    attendanceBreakdown.daysPresent !== "" && `${attendanceBreakdown.daysPresent} days present`,
    attendanceBreakdown.totalHours !== "" && `${attendanceBreakdown.totalHours} total hours (source)`,
    attendanceBreakdown.worked && `Worked ${attendanceBreakdown.worked}`,
    attendanceBreakdown.break && `Break ${attendanceBreakdown.break}`,
    attendanceBreakdown.idle && `Idle ${attendanceBreakdown.idle}`,
    attendanceBreakdown.flaggedDays !== "" && `${attendanceBreakdown.flaggedDays} flagged days`,
    `${attendanceBreakdown.fullDays || 0} full / ${attendanceBreakdown.halfDays || 0} half days`,
    attendanceBreakdown.otherDays !== "" && `${attendanceBreakdown.otherDays} other days`,
    attendanceBreakdown.otherHours && `${attendanceBreakdown.otherHours} other hours (source)`,
    attendanceBreakdown.daysWithoutRate !== "" && `${attendanceBreakdown.daysWithoutRate} days without rate`,
    attendanceBreakdown.synced && `Synced: ${attendanceBreakdown.synced}`,
    !employee.attendanceSummary && `${attendanceBreakdown.laggingHours || 0} lagging hours`,
  ].filter(Boolean);
  return {
    id: employee.id,
    name: employee.name,
    email: employee.email,
    phone: employee.phone || "",
    designation: employee.designation || employee.role || "Employee",
    department: employee.department || "Unassigned",
    employmentCountry: employee.countryOfEmployment || employee.countryCode || "",
    payPeriod: formatPeriod(record.period),
    payslipNumber: record.payslipNumber,
    paymentCurrency: currency,
    legacyCurrency,
    paymentStatus: record.paymentStatus || "Unpaid",
    attendanceBreakdown: { ...attendanceBreakdown, summaryText: summaryItems.join(" · ") },
    workbookBreakdown,
    earnings,
    total,
    netPay: workbookBreakdown?.netPay ?? null,
  };
};
