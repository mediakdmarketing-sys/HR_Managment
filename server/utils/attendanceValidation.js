const EMPLOYEE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HOURS_PATTERN = /^\d{1,2}(?:\.\d+)?$/;
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
