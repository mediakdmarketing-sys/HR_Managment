export const LEGACY_DEFAULT_RATES = {
  fullDayRate: 1000,
  halfDayRate: 500,
  laggingHourRate: 100,
};

const rounded = (value) => Math.round(value * 100) / 100;

export const calculateLegacyPayrollTotal = (entry) =>
  rounded(
    entry.fullDays * entry.fullDayRate +
      entry.halfDays * entry.halfDayRate +
      entry.laggingHours * entry.laggingHourRate +
      entry.increment,
  );

export const calculateWorkbookPayroll = (entry) => {
  const basicSalary = Number(entry.basicSalary);
  const allowance = Number(entry.allowance);
  const incentive = Number(entry.incentive);
  const noPayLeaveDays = Number(entry.noPayLeaveDays);
  const missingLeadsHours = Number(entry.missingLeadsHours);
  const workingDayDivisor = Number(entry.workingDayDivisor);
  const hoursPerDay = Number(entry.hoursPerDay);
  const currency = String(entry.currency || "").trim().toUpperCase();
  const incentiveNetTreatment = String(entry.incentiveNetTreatment || "").trim();

  const values = [
    basicSalary,
    allowance,
    incentive,
    noPayLeaveDays,
    missingLeadsHours,
    workingDayDivisor,
    hoursPerDay,
  ];
  if (!values.every(Number.isFinite) || values.some((value) => value < 0)) {
    return { error: "Workbook payroll fields must be finite non-negative numbers." };
  }
  if (workingDayDivisor <= 0 || hoursPerDay <= 0) {
    return { error: "Working-day divisor and hours per day must be greater than zero." };
  }
  if (!/^[A-Z]{3}$/.test(currency)) return { error: "Choose a three-letter payment currency." };
  if (!["include", "exclude", "unconfirmed"].includes(incentiveNetTreatment)) {
    return { error: "Select an incentive treatment for net pay." };
  }

  const grossSalary = rounded(basicSalary + allowance);
  const noPayLeaveDeduction = rounded((basicSalary / workingDayDivisor) * noPayLeaveDays);
  const missingLeadsDeduction = rounded(
    (basicSalary / workingDayDivisor / hoursPerDay) * missingLeadsHours,
  );
  const netPay = incentiveNetTreatment === "unconfirmed"
    ? null
    : rounded(
        grossSalary -
          noPayLeaveDeduction -
          missingLeadsDeduction +
          (incentiveNetTreatment === "include" ? incentive : 0),
      );

  return {
    value: {
      basicSalary: rounded(basicSalary),
      allowance: rounded(allowance),
      incentive: rounded(incentive),
      grossSalary,
      noPayLeaveDays: rounded(noPayLeaveDays),
      missingLeadsHours: rounded(missingLeadsHours),
      workingDayDivisor: rounded(workingDayDivisor),
      hoursPerDay: rounded(hoursPerDay),
      noPayLeaveDeduction,
      missingLeadsDeduction,
      incentiveNetTreatment,
      netPay,
      currency,
      formula: {
        gross: "basicSalary + allowance; incentive excluded per workbook",
        noPayLeave: "basicSalary / workingDayDivisor * noPayLeaveDays",
        missingLeads: "basicSalary / workingDayDivisor / hoursPerDay * missingLeadsHours",
        net: incentiveNetTreatment === "unconfirmed"
          ? "unconfirmed"
          : "grossSalary - deductions + incentive when configured to include",
      },
    },
  };
};

export const workbookFieldsPresent = (entry) =>
  [
    "basicSalary",
    "allowance",
    "incentive",
    "noPayLeaveDays",
    "missingLeadsHours",
    "workingDayDivisor",
    "hoursPerDay",
  ].some((field) => entry[field] !== undefined && entry[field] !== null && entry[field] !== "");
