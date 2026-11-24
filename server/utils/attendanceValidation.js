const EMPLOYEE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HOURS_PATTERN = /^\d{1,2}(?:\.\d+)?$/;
const SOURCE_TIME_PATTERN =
  /^(?:\d+(?:\.\d+)?|\d{1,3}:[0-5]\d|\d+\s*h(?:\s*\d+\s*m)?|\d+\s*m|\d+\s*s)$/i;
const CLOCK_TIME_PATTERN =
  /^(?:(?:[01]?\d|2[0-3]):[0-5]\d|(?:0?[1-9]|1[0-2]):[0-5]\d\s?(?:AM|PM)|(?:0?[1-9]|1[0-2])\.[0-5]\d\s?(?:AM|PM))$/i;
const ALLOWED_STATUSES = new Map([
  ["present", "Present"],
  ["absent", "Absent"],
]);

export const isValidAttendanceDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1900 || month < 1 || month > 12) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day >= 1 && day <= daysInMonth;
};

const parseHours = (value, label) => {
  if (
    (typeof value !== "string" && typeof value !== "number") ||
    !HOURS_PATTERN.test(String(value).trim())
  ) {
    return { error: `${label} must be a number from 0 to 24.` };
  }
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours < 0 || hours > 24) {
    return { error: `${label} must be a number from 0 to 24.` };
  }
  return { value: hours };
};

export const validateAttendanceRecord = (record) => {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return { error: "The row is not a valid attendance record." };
  }
  if (record.invalidReason) return { error: String(record.invalidReason) };

  if (record.recordType === "monthlySummary") {
    return validateMonthlyAttendanceSummary(record);
  }
  if (record.recordType === "dailyDetailed") {
    return validateDetailedDailyAttendance(record);
  }

  const employeeId =
    typeof record.employeeId === "string" ? record.employeeId.trim() : "";
  const email = typeof record.email === "string" ? record.email.trim().toLowerCase() : "";
  if (employeeId && !EMPLOYEE_ID_PATTERN.test(employeeId)) {
    return { error: "Employee ID contains invalid characters." };
  }
  if (email && !EMAIL_PATTERN.test(email)) {
    return { error: "Employee email is not valid." };
  }
  if (!employeeId && !email) {
    return { error: "Employee ID or email is required." };
  }
  if (!isValidAttendanceDate(record.date)) {
    return { error: "Date must be a valid YYYY-MM-DD date." };
  }

  const rawStatus =
    typeof record.attendanceStatus === "string"
      ? record.attendanceStatus.trim().toLowerCase()
      : "";
  const attendanceStatus = ALLOWED_STATUSES.get(rawStatus);
  if (!attendanceStatus) {
    return { error: 'Status must be "Present" or "Absent".' };
  }

  const workingHours = parseHours(record.workingHours, "Working hours");
  if (workingHours.error) return workingHours;
  const totalBreakTime = parseHours(record.totalBreakTime ?? 0, "Break time");
  if (totalBreakTime.error) return totalBreakTime;

  const department =
    typeof record.department === "string" ? record.department.trim() : "";
  if (department.length > 120) {
    return { error: "Department must be 120 characters or fewer." };
  }

  return {
    value: {
      employeeId,
      email,
      date: record.date,
      attendanceStatus,
      workingHours: workingHours.value,
      totalBreakTime: totalBreakTime.value,
      department,
    },
  };
};

const validateIdentity = (record) => {
  const employeeId = typeof record.employeeId === "string" ? record.employeeId.trim() : "";
  const email = typeof record.email === "string" ? record.email.trim().toLowerCase() : "";
  if (employeeId && !EMPLOYEE_ID_PATTERN.test(employeeId)) {
    return { error: "Employee ID contains invalid characters." };
  }
  if (email && !EMAIL_PATTERN.test(email)) return { error: "Employee email is not valid." };
  if (!employeeId && !email) return { error: "Employee ID or email is required." };
  return { employeeId, email };
};

const validateDetailedDailyAttendance = (record) => {
  const identity = validateIdentity(record);
  if (identity.error) return identity;
  if (!isValidAttendanceDate(record.date)) {
    return { error: "Date must be a valid YYYY-MM-DD date." };
  }
  const attendanceStatus = String(record.attendanceStatus || "").trim();
  const leave = String(record.leave || "").trim();
  if (!attendanceStatus && !leave) {
    return { error: "Status or leave value is required." };
  }
  if (attendanceStatus.length > 80 || leave.length > 120) {
    return { error: "Status or leave value is too long." };
  }
  const day = String(record.day || "").trim();
  if (day && !/^(mon|tue|wed|thu|fri|sat|sun)(?:day)?$/i.test(day)) {
    return { error: "Day must be a weekday name." };
  }
  for (const [field, label] of [["clockIn", "Clock In"], ["clockOut", "Clock Out"]]) {
    const value = String(record[field] || "").trim();
    if (value && !CLOCK_TIME_PATTERN.test(value)) {
      return { error: `${label} must use a supported clock format such as 08:30 or 8:30 AM.` };
    }
  }
  for (const [field, label] of [
    ["hoursSource", "Hours"],
    ["breakSource", "Break"],
    ["productiveSource", "Productive"],
  ]) {
    const value = String(record[field] || "").trim();
    if (value && (value.length > 40 || !SOURCE_TIME_PATTERN.test(value))) {
      return { error: `${label} must use a numeric source value, H:MM, or an explicit duration such as 8h 30m.` };
    }
  }
  const department = String(record.department || "").trim();
  if (department.length > 120) return { error: "Department must be 120 characters or fewer." };
  return {
    value: {
      recordType: "dailyDetailed",
      ...identity,
      name: String(record.name || "").trim().slice(0, 100),
      department,
      date: record.date,
      day,
      clockIn: String(record.clockIn || "").trim(),
      clockOut: String(record.clockOut || "").trim(),
      attendanceStatus,
      leave,
      hoursSource: String(record.hoursSource || "").trim(),
      breakSource: String(record.breakSource || "").trim(),
      productiveSource: String(record.productiveSource || "").trim(),
    },
  };
};

const validateMonthlyAttendanceSummary = (record) => {
  const identity = validateIdentity(record);
  if (identity.error) return identity;
  if (typeof record.month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(record.month)) {
    return { error: "Month must use YYYY-MM format." };
  }
  const department = String(record.department || "").trim();
  if (department.length > 120) return { error: "Department must be 120 characters or fewer." };
  const integerFields = [
    ["daysPresent", "Days Present"],
    ["flaggedDays", "Flagged Days"],
    ["fullDays", "Full Days"],
    ["halfDays", "Half Days"],
    ["otherDays", "Other Days"],
    ["daysWithoutRate", "Days Without Rate"],
  ];
  const counts = {};
  for (const [field, label] of integerFields) {
    const value = String(record[field] ?? "").trim();
    if (!/^\d+$/.test(value) || Number(value) > 366) {
      return { error: `${label} must be a whole number from 0 to 366.` };
    }
    counts[field] = Number(value);
  }
  const numericSource = (field, label) => {
    const value = String(record[field] ?? "").trim();
    if (!/^\d+(?:\.\d+)?$/.test(value)) {
      return { error: `${label} must be an unsigned numeric source value.` };
    }
    return { value };
  };
  const durationSource = (field, label) => {
    const value = String(record[field] ?? "").trim();
    if (!/^(?:\d+h(?:\s*\d+m)?|\d+m|\d+s)$/i.test(value)) {
      return { error: `${label} must use a duration format such as 8h 30m or 0s.` };
    }
    return { value };
  };
  const totalHoursSource = numericSource("totalHoursSource", "Total Hours");
  if (totalHoursSource.error) return totalHoursSource;
  const otherHoursSource = numericSource("otherHoursSource", "Other Hours");
  if (otherHoursSource.error) return otherHoursSource;
  const basePayUsd = numericSource("basePayUsd", "Base Pay (USD)");
  if (basePayUsd.error) return basePayUsd;
  const bonusUsd = numericSource("bonusUsd", "Bonus (USD)");
  if (bonusUsd.error) return bonusUsd;
  const netPayUsd = numericSource("netPayUsd", "Net Pay (USD)");
  if (netPayUsd.error) return netPayUsd;
  const worked = durationSource("worked", "Worked");
  if (worked.error) return worked;
  const breakSource = durationSource("breakSource", "Break");
  if (breakSource.error) return breakSource;
  const idle = durationSource("idle", "Idle");
  if (idle.error) return idle;
  const syncedText = String(record.synced || "").trim().toLowerCase();
  if (!["true", "false"].includes(syncedText)) {
    return { error: "Synced must be true or false." };
  }
  return {
    value: {
      recordType: "monthlySummary",
      ...identity,
      name: String(record.name || "").trim().slice(0, 100),
      department,
      month: record.month,
      ...counts,
      totalHoursSource: totalHoursSource.value,
      worked: worked.value,
      breakSource: breakSource.value,
      idle: idle.value,
      otherHoursSource: otherHoursSource.value,
      basePayUsd: basePayUsd.value,
      bonusUsd: bonusUsd.value,
      netPayUsd: netPayUsd.value,
      synced: syncedText === "true",
    },
  };
};
