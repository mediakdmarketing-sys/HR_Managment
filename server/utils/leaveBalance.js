import { normalizeLeavePolicyName } from "./leavePolicy.js";

const leaveBalanceError = (statusCode, message) =>
  Object.assign(new Error(message), { statusCode });

const roundDays = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

const validDateYear = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1900 || month < 1 || month > 12) return null;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day >= 1 && day <= daysInMonth ? year : null;
};

const employmentStartYear = (employee, fallbackYear) => {
  for (const value of [employee.joiningDate, employee.createdAt]) {
    const date = typeof value === "string" ? value.slice(0, 10) : "";
    const year = validDateYear(date);
    if (year !== null) return year;
  }
  return fallbackYear;
};

const numericDays = (value, label, { allowZero = true } = {}) => {
  const days = Number(value);
  if (
    value === null ||
    value === undefined ||
    (typeof value === "string" && !value.trim()) ||
    !Number.isFinite(days) ||
    days < 0 ||
    (!allowZero && days === 0)
  ) {
    throw leaveBalanceError(422, `${label} must be a valid ${allowZero ? "non-negative" : "positive"} number of days.`);
  }
  return roundDays(days);
};

const getPaidDaysFromApprovedRequest = (request) => {
  const requestedDays = numericDays(
    request.days,
    `Approved leave request ${request.id || ""} days`,
    { allowZero: false },
  );
  const hasPaidDays = request.paidDays !== undefined && request.paidDays !== null;
  const hasUnpaidDays = request.unpaidDays !== undefined && request.unpaidDays !== null;
  if (!hasPaidDays && !hasUnpaidDays) return requestedDays;

  const paidDays = hasPaidDays
    ? numericDays(request.paidDays, "Previously approved paid days")
    : roundDays(requestedDays - numericDays(request.unpaidDays, "Previously approved unpaid days"));
  const unpaidDays = hasUnpaidDays
    ? numericDays(request.unpaidDays, "Previously approved unpaid days")
    : roundDays(requestedDays - paidDays);
  if (
    paidDays > requestedDays ||
    unpaidDays > requestedDays ||
    Math.abs(paidDays + unpaidDays - requestedDays) > 0.01
  ) {
    throw leaveBalanceError(
      422,
      `Approved leave request ${request.id || ""} has an inconsistent paid/unpaid allocation.`,
    );
  }
  return paidDays;
};

const policyMatchesRequest = (policy, requestType) => {
  const normalizedType = normalizeLeavePolicyName(requestType);
  return (
    normalizedType === normalizeLeavePolicyName(policy.name) ||
    normalizedType === normalizeLeavePolicyName(policy.id)
  );
};

export const getLeaveYearFromRequest = (request) => {
  const startYear = validDateYear(request.startDate);
  const endYear = validDateYear(request.endDate);
  if (startYear === null || endYear === null) {
    throw leaveBalanceError(422, "Leave dates must be valid YYYY-MM-DD dates.");
  }
  if (startYear !== endYear) {
    throw leaveBalanceError(
      422,
      "Requests crossing leave years must be split before paid leave can be calculated.",
    );
  }
  return startYear;
};

export const calculateEmployeeLeaveBalances = ({
  employee,
  policies,
  leaveRequests,
  leaveYear,
  excludeRequestId,
}) => {
  if (!Number.isInteger(leaveYear) || leaveYear < 1900) {
    throw leaveBalanceError(422, "Leave year is invalid.");
  }
  const approvedRequests = leaveRequests.filter(
    (request) =>
      request.employeeId === employee.id &&
      request.status === "Approved" &&
      request.id !== excludeRequestId,
  );
  const firstYear = Math.max(
    1900,
    employmentStartYear(employee, leaveYear),
  );

  return policies.map((policy) => {
    const annualAllowanceDays = numericDays(
      policy.days,
      `Policy "${policy.name}" allowance`,
    );
    const carryForwardLimitDays = numericDays(
      policy.carryForward ?? 0,
      `Policy "${policy.name}" carry-forward`,
    );
    const approvedForPolicy = approvedRequests.filter((request) =>
      policyMatchesRequest(policy, request.type),
    );
    const usedByYear = new Map();
    for (const request of approvedForPolicy) {
      const requestYear = validDateYear(request.startDate);
      if (requestYear === null) {
        throw leaveBalanceError(
          422,
          `Approved leave request ${request.id || ""} has an invalid start date.`,
        );
      }
      if (requestYear > leaveYear) continue;
      const used = getPaidDaysFromApprovedRequest(request);
      usedByYear.set(requestYear, (usedByYear.get(requestYear) || 0) + used);
    }

    let remainingFromPreviousYear = 0;
    let targetYearBalance = null;
    for (let year = firstYear; year <= leaveYear; year += 1) {
      const carriedForwardDays =
        year === firstYear
          ? 0
          : Math.min(remainingFromPreviousYear, carryForwardLimitDays);
      const availableDays = annualAllowanceDays + carriedForwardDays;
      const approvedPaidDays = roundDays(usedByYear.get(year) || 0);
      remainingFromPreviousYear = roundDays(
        Math.max(availableDays - approvedPaidDays, 0),
      );
      if (year === leaveYear) {
        targetYearBalance = {
          policyId: policy.id,
          leaveType: policy.name,
          leaveYear,
          annualAllowanceDays,
          carryForwardLimitDays,
          carriedForwardDays,
          approvedPaidDays,
          availablePaidDays: roundDays(availableDays),
          remainingPaidDays: remainingFromPreviousYear,
        };
      }
    }

    return (
      targetYearBalance || {
        policyId: policy.id,
        leaveType: policy.name,
        leaveYear,
        annualAllowanceDays: 0,
        carryForwardLimitDays,
        carriedForwardDays: 0,
        approvedPaidDays: 0,
        availablePaidDays: 0,
        remainingPaidDays: 0,
      }
    );
  });
};

export const calculateLeaveRequestAllocation = ({
  request,
  employee,
  policies,
  leaveRequests,
}) => {
  const leaveYear = getLeaveYearFromRequest(request);
  const requestedDays = numericDays(request.days, "Requested leave", {
    allowZero: false,
  });
  const policy = policies.find((candidate) =>
    policyMatchesRequest(candidate, request.type),
  );
  if (!policy) {
    throw leaveBalanceError(
      409,
      `No leave policy is configured for "${request.type}".`,
    );
  }

  const balances = calculateEmployeeLeaveBalances({
    employee,
    policies,
    leaveRequests,
    leaveYear,
    excludeRequestId: request.id,
  });
  const balance = balances.find((candidate) => candidate.policyId === policy.id);
  if (!balance) {
    throw leaveBalanceError(409, `No balance is available for "${request.type}".`);
  }

  const paidDays = roundDays(Math.min(requestedDays, balance.remainingPaidDays));
  const unpaidDays = roundDays(requestedDays - paidDays);
  return {
    requestId: request.id,
    employeeId: employee.id,
    leaveTypeId: policy.id,
    leaveType: policy.name,
    leaveYear,
    requestedDays,
    annualAllowanceDays: balance.annualAllowanceDays,
    carryForwardLimitDays: balance.carryForwardLimitDays,
    carriedForwardDays: balance.carriedForwardDays,
    approvedPaidDays: balance.approvedPaidDays,
    availablePaidDays: balance.remainingPaidDays,
    paidDays,
    unpaidDays,
    remainingPaidDays: roundDays(balance.remainingPaidDays - paidDays),
    balances,
  };
};
