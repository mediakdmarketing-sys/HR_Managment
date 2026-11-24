import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CircleCheckBig,
  Coffee,
  History,
  LogIn,
  LogOut,
  Timer,
} from "lucide-react";
import UserLayout from "../layouts/UserLayout";
import mockEmployees from "../assets/mockEmployees";
import { getUser } from "../utils/auth";
import {
  getAttendanceRecords,
  getMonthlyAttendanceSummaries,
  importAttendanceRecords,
} from "../api/attendanceApi";
import { parseAttendanceCsv } from "../utils/attendanceCsv";
import CsvImportPanel from "../components/CsvImportPanel";

const PAGE_SIZE = 10;
const REQUIRED_WORK_SECONDS = 8 * 60 * 60;
const SAMPLE_WORK_SECONDS = 4 * 60 * 60 + 34 * 60 + 12;
const inputClassName =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

const legacyAttendanceColumns = [
  { key: "employeeId", header: "employeeId", requiredNote: "Employee ID or email is required" },
  { key: "name", header: "name" },
  { key: "email", header: "email", requiredNote: "Employee ID or email is required" },
  { key: "department", header: "department" },
  { key: "status", header: "status", required: true },
  { key: "workingHours", header: "workingHours", required: true },
  { key: "totalBreakTime", header: "totalBreakTime" },
];

const dailyAttendanceColumns = [
  { key: "employeeId", header: "Employee ID", requiredNote: "Employee ID or Email is required" },
  { key: "email", header: "Email", requiredNote: "Employee ID or Email is required" },
  { key: "name", header: "Employee" },
  { key: "department", header: "Department" },
  { key: "date", header: "Date", required: true },
  { key: "day", header: "Day", required: true },
  { key: "clockIn", header: "Clock In" },
  { key: "clockOut", header: "Clock Out" },
  { key: "status", header: "Status", required: true },
  { key: "leave", header: "Leave" },
  { key: "hours", header: "Hours" },
  { key: "break", header: "Break" },
  { key: "productive", header: "Productive" },
];

const monthlyAttendanceColumns = [
  { key: "employeeId", header: "Employee ID", requiredNote: "Employee ID or Email is required" },
  { key: "employee", header: "Employee" },
  { key: "email", header: "Email", requiredNote: "Employee ID or Email is required" },
  { key: "department", header: "Department" },
  { key: "month", header: "Month", required: true },
  { key: "daysPresent", header: "Days Present", required: true },
  { key: "totalHours", header: "Total Hours", required: true, requiredNote: "Required; preserved as source text without conversion" },
  { key: "worked", header: "Worked", required: true },
  { key: "break", header: "Break", required: true },
  { key: "idle", header: "Idle", required: true },
  { key: "flaggedDays", header: "Flagged Days", required: true },
  { key: "fullDays", header: "Full Days", required: true },
  { key: "halfDays", header: "Half Days", required: true },
  { key: "otherDays", header: "Other Days", required: true },
  { key: "otherHours", header: "Other Hours", required: true, requiredNote: "Required; preserved as source text without conversion" },
  { key: "basePayUsd", header: "Base Pay (USD)", required: true },
  { key: "bonusUsd", header: "Bonus (USD)", required: true },
  { key: "netPayUsd", header: "Net Pay (USD)", required: true },
  { key: "daysWithoutRate", header: "Days Without Rate", required: true },
  { key: "synced", header: "Synced", required: true },
];

const validateLegacyAttendanceRow = (row) => {
  const errors = [];
  if (!row.employeeid && !row.email) errors.push("Employee ID or email is required.");
  if (!row.status) errors.push("Status is required.");
  if (!row.workinghours) errors.push("Working hours are required.");
  return errors;
};

const validateDailyAttendanceRow = (row) => {
  const errors = [];
  if (!row.employeeid && !row.email) errors.push("Employee ID or email is required.");
  if (!row.date || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) errors.push("Date must use YYYY-MM-DD.");
  if (!row.day || !/^(mon|tue|wed|thu|fri|sat|sun)(?:day)?$/i.test(row.day)) errors.push("Day must be a weekday name.");
  if (!row.status && !row.leave) errors.push("Status or leave value is required.");
  for (const key of ["clockin", "clockout"]) {
    if (row[key] && !/^(?:(?:[01]?\d|2[0-3]):[0-5]\d|(?:0?[1-9]|1[0-2]):[0-5]\d\s?(?:AM|PM)|(?:0?[1-9]|1[0-2])\.[0-5]\d\s?(?:AM|PM))$/i.test(row[key])) {
      errors.push(`${key === "clockin" ? "Clock In" : "Clock Out"} must be a supported time (for example 08:30 or 8:30 AM).`);
    }
  }
  for (const key of ["hours", "break", "productive"]) {
    if (row[key] && !/^(?:\d+(?:\.\d+)?|\d{1,3}:[0-5]\d|\d+\s*h(?:\s*\d+\s*m)?|\d+\s*m|\d+\s*s)$/i.test(row[key])) {
      errors.push(`${key} must use a numeric source value, H:MM, or a duration such as 8h 30m.`);
    }
  }
  return errors;
};

const validateMonthlyAttendanceRow = (row) => {
  const errors = [];
  if (!row.employeeid && !row.email) errors.push("Employee ID or email is required.");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(row.month || "")) errors.push("Month must use YYYY-MM.");
  for (const key of ["dayspresent", "flaggeddays", "fulldays", "halfdays", "otherdays", "dayswithoutrate"]) {
    if (!/^\d+$/.test(row[key] || "") || Number(row[key]) > 366) errors.push(`${key} must be a whole number from 0 to 366.`);
  }
  for (const key of ["totalhours", "otherhours", "basepayusd", "bonususd", "netpayusd"]) {
    if (!/^\d+(?:\.\d+)?$/.test(row[key] || "")) errors.push(`${key} must be an unsigned numeric source value.`);
  }
  for (const key of ["worked", "break", "idle"]) {
    if (!/^(?:\d+h(?:\s*\d+m)?|\d+m|\d+s)$/i.test(row[key] || "")) errors.push(`${key} must use a duration format such as 8h 30m or 0s.`);
  }
  if (!/^(true|false)$/i.test(row.synced || "")) errors.push("Synced must be true or false.");
  return errors;
};

const breakRows = [
  { type: "Break", start: "10:15 AM", end: "10:30 AM", duration: "15m", status: "Completed" },
  { type: "Lunch", start: "12:30 PM", end: "01:00 PM", duration: "30m", status: "Completed" },
];

const historyRows = [
  { date: "Oct 20, 2026", in: "08:01 AM", out: "04:05 PM", work: "8h 4m", breaks: "45m", status: "On Time" },
  { date: "Oct 19, 2026", in: "08:05 AM", out: "04:10 PM", work: "8h 5m", breaks: "40m", status: "On Time" },
  { date: "Oct 18, 2026", in: "09:15 AM", out: "05:20 PM", work: "7h 5m", breaks: "35m", status: "Late" },
];

const formatDuration = (totalSeconds) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
};

function StatusBadge({ children, tone = "neutral" }) {
  const styles = {
    neutral: "bg-slate-100 text-slate-700",
    green: "bg-emerald-100 text-emerald-700",
    blue: "bg-blue-100 text-blue-700",
    red: "bg-red-100 text-red-700",
  };

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${styles[tone]}`}>
      {children}
    </span>
  );
}

function TableHeader({ columns }) {
  return (
    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
      <tr>
        {columns.map((column) => (
          <th key={column} className="whitespace-nowrap px-5 py-3 font-semibold">
            {column}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function EmployeeAttendance() {
  const user = getUser();
  const employee =
    mockEmployees.find(
      (item) => item.id === user?.id || item.email === user?.email,
    ) || mockEmployees.find((item) => item.role === "Employee");
  const [isPunchedIn, setIsPunchedIn] = useState(false);
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [workSeconds, setWorkSeconds] = useState(SAMPLE_WORK_SECONDS);
  const breakMinutes = 45;
  const remainingSeconds = Math.max(REQUIRED_WORK_SECONDS - workSeconds, 0);

  useEffect(() => {
    if (!isPunchedIn || isOnBreak || workSeconds >= REQUIRED_WORK_SECONDS) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setWorkSeconds((seconds) => Math.min(seconds + 1, REQUIRED_WORK_SECONDS));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isOnBreak, isPunchedIn, workSeconds]);

  const togglePunch = () => {
    setIsPunchedIn((current) => !current);
    setIsOnBreak(false);
  };

  const toggleBreak = () => {
    if (isPunchedIn) {
      setIsOnBreak((current) => !current);
    }
  };

  return (
    <UserLayout>
      <main className="space-y-6 text-slate-900">

        <div className="rounded-3xl bg-linear-to-r from-slate-900 to-teal-700 p-8 text-white shadow-lg">
          <h1 className="text-4xl font-bold">Attendance Management</h1>
          <p className="mt-3 text-slate-200">
            Track and manage your employee attendance and working hours.
          </p>
        </div>

        <div className="mx-auto flex max-w-7xl flex-col gap-6 mt-4">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="h-11 w-1 rounded-full bg-teal-600" />
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">My Time</h1>
                <p className="mt-1 text-sm text-slate-500">
                  {employee.name} · Track your work hours and breaks
                </p>
              </div>
            </div>
            <StatusBadge tone={isOnBreak ? "neutral" : isPunchedIn ? "blue" : "neutral"}>
              {isOnBreak ? "On Break" : isPunchedIn ? "Working" : "Not punched in"}
            </StatusBadge>
          </header>

          <section className="rounded-2xl border border-teal-200 bg-teal-50/70 p-8 text-center shadow-sm">
            <Timer className="mx-auto mb-4 h-8 w-8 text-teal-700" />
            <p className="font-mono text-4xl font-bold tracking-wider text-teal-700 sm:text-5xl">
              {formatDuration(workSeconds)}
            </p>
            <p className="mt-2 text-sm text-slate-500">Work Time Today</p>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-5">
              <Timer className="h-5 w-5 text-teal-700" />
              <h2 className="text-lg font-semibold">Today&apos;s Summary</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                  <p className="mb-1 text-sm text-slate-500">Required Work</p>
                  <p className="text-2xl font-bold">8h</p>
                </div>
                <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-center">
                  <p className="mb-1 text-sm text-slate-500">Work Time</p>
                  <p className="font-mono text-2xl font-bold text-teal-700">{formatDuration(workSeconds)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                  <p className="mb-1 text-sm text-slate-500">Break Time</p>
                  <p className="text-2xl font-bold">{breakMinutes}m</p>
                  <p className="mt-1 text-xs text-slate-500">Allowed: 60m</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                  <p className="mb-1 text-sm text-slate-500">Time Remaining</p>
                  <p className="font-mono text-2xl font-bold">{remainingSeconds ? formatDuration(remainingSeconds) : "Complete"}</p>
                </div>
              </div>

              <div className={`mt-4 flex items-start gap-3 rounded-xl border p-4 ${remainingSeconds ? "border-blue-200 bg-blue-50" : "border-emerald-200 bg-emerald-50"}`}>
                <CircleCheckBig className={`mt-0.5 h-5 w-5 shrink-0 ${remainingSeconds ? "text-blue-700" : "text-emerald-700"}`} />
                <div className="text-sm">
                  <p className={`font-semibold ${remainingSeconds ? "text-blue-800" : "text-emerald-800"}`}>
                    {remainingSeconds ? "Workday in progress" : "Work Hours Complete!"}
                  </p>
                  <p className={`mt-1 ${remainingSeconds ? "text-blue-700" : "text-emerald-700"}`}>
                    {remainingSeconds
                      ? `${formatDuration(remainingSeconds)} remaining to complete your required 8 hours.`
                      : "You have completed your required 8 hours of work for today."}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <button type="button" onClick={togglePunch} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-8 py-3 text-sm font-semibold text-white ${isPunchedIn ? "bg-red-600 hover:bg-red-700" : "bg-teal-700 hover:bg-teal-800"}`}>
              {isPunchedIn ? <LogOut className="h-5 w-5" /> : <LogIn className="h-5 w-5" />}
              {isPunchedIn ? "Punch Out" : "Punch In"}
            </button>
            <button type="button" disabled={!isPunchedIn} onClick={toggleBreak} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-8 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
              <Coffee className="h-5 w-5" />
              {isOnBreak ? "End Break" : "Start Break"}
            </button>
          </div>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-5"><Coffee className="h-5 w-5 text-teal-700" /><h2 className="text-lg font-semibold">Today&apos;s Breaks</h2></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-sm"><TableHeader columns={["Type", "Start Time", "End Time", "Duration", "Status"]} /><tbody className="divide-y divide-slate-100">{breakRows.map((row) => <tr key={`${row.type}-${row.start}`} className="hover:bg-slate-50"><td className="px-5 py-4 font-medium">{row.type}</td><td className="px-5 py-4 font-mono text-slate-600">{row.start}</td><td className="px-5 py-4 font-mono text-slate-600">{row.end}</td><td className="px-5 py-4 font-mono">{row.duration}</td><td className="px-5 py-4"><StatusBadge tone="green">{row.status}</StatusBadge></td></tr>)}</tbody></table></div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-5"><History className="h-5 w-5 text-teal-700" /><h2 className="text-lg font-semibold">Work History</h2></div>
            <div className="p-6"><div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2"><div><label className="mb-2 block text-sm font-medium text-slate-700">From Date</label><div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700"><CalendarDays className="h-4 w-4 text-slate-400" />October 13, 2026</div></div><div><label className="mb-2 block text-sm font-medium text-slate-700">To Date</label><div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700"><CalendarDays className="h-4 w-4 text-slate-400" />October 20, 2026</div></div></div><div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left text-sm"><TableHeader columns={["Date", "Clock In", "Clock Out", "Work Hours", "Break Time", "Status"]} /><tbody className="divide-y divide-slate-100">{historyRows.map((row) => <tr key={row.date} className="transition hover:bg-slate-50"><td className="whitespace-nowrap px-5 py-4 font-medium">{row.date}</td><td className="whitespace-nowrap px-5 py-4 font-mono text-slate-600">{row.in}</td><td className="whitespace-nowrap px-5 py-4 font-mono text-slate-600">{row.out}</td><td className="whitespace-nowrap px-5 py-4 font-mono">{row.work}</td><td className="whitespace-nowrap px-5 py-4 font-mono">{row.breaks}</td><td className="whitespace-nowrap px-5 py-4"><StatusBadge tone={row.status === "Late" ? "red" : "green"}>{row.status}</StatusBadge></td></tr>)}</tbody></table></div></div>
          </section>
        </div>
      </main>
    </UserLayout>
  );
}

function HrAttendance() {
  const [attendance, setAttendance] = useState([]);
  const [monthlySummaries, setMonthlySummaries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [departmentFilter, setDepartmentFilter] = useState("All departments");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [currentPage, setCurrentPage] = useState(1);
  const [loadError, setLoadError] = useState("");
  const [viewMode, setViewMode] = useState("daily");
  const [importFormat, setImportFormat] = useState("legacy");

  useEffect(() => {
    let active = true;
    const loadAttendance = async () => {
      try {
        const [dailyResponse, monthlyResponse] = await Promise.all([
          getAttendanceRecords(),
          getMonthlyAttendanceSummaries(),
        ]);
        const dailyRecords = dailyResponse.data?.data;
        const monthlyRecords = monthlyResponse.data?.data;
        if (!Array.isArray(dailyRecords) || !Array.isArray(monthlyRecords)) {
          throw new Error("The server returned an invalid attendance response.");
        }
        if (!active) return;
        setAttendance(dailyRecords);
        setMonthlySummaries(monthlyRecords);
        setLoadError("");
      } catch (loadError) {
        if (!active) return;
        const message =
          loadError.response?.data?.message ||
          loadError.message ||
          "Saved attendance could not be loaded.";
        setLoadError(message);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    loadAttendance();
    return () => {
      active = false;
    };
  }, []);

  const filteredAttendance = useMemo(
    () =>
      attendance.filter((employee) => {
        const matchesDepartment =
          departmentFilter === "All departments" ||
          employee.department === departmentFilter;
        const matchesStatus =
          statusFilter === "All statuses" ||
          employee.attendanceStatus === statusFilter;

        return matchesDepartment && matchesStatus;
      }),
    [attendance, departmentFilter, statusFilter]
  );

  const filteredMonthlySummaries = useMemo(
    () =>
      monthlySummaries.filter(
        (record) =>
          departmentFilter === "All departments" ||
          record.department === departmentFilter,
      ),
    [monthlySummaries, departmentFilter],
  );

  const totalPages = Math.max(
    1,
    Math.ceil(filteredAttendance.length / PAGE_SIZE)
  );
  const displayedPage = Math.min(currentPage, totalPages);
  const visibleAttendance = filteredAttendance.slice(
    (displayedPage - 1) * PAGE_SIZE,
    displayedPage * PAGE_SIZE
  );

  const departments = [
    ...new Set(attendance.map((employee) => employee.department)),
  ];

  const updateDepartment = (event) => {
    setDepartmentFilter(event.target.value);
    setCurrentPage(1);
  };

  const updateStatus = (event) => {
    setStatusFilter(event.target.value);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setDepartmentFilter("All departments");
    setStatusFilter("All statuses");
    setCurrentPage(1);
  };

  const importAttendanceContent = async (content) => {
    const importedRecords = parseAttendanceCsv(content, importFormat);
    const totals = { imported: 0, duplicates: 0, skipped: 0, failed: 0 };
    const results = [];
    for (let start = 0; start < importedRecords.length; start += 500) {
      const batch = importedRecords.slice(start, start + 500);
      try {
        const response = await importAttendanceRecords(batch);
        const result = response.data?.data;
        for (const key of Object.keys(totals)) {
          totals[key] += Number(result?.[key]) || 0;
        }
        for (const row of result?.results || []) {
          results.push({ ...row, message: row.reason || `Record ${row.status}.` });
        }
      } catch (importError) {
        totals.failed += batch.length;
        const message =
          importError.response?.data?.message ||
          importError.message ||
          "The batch could not be submitted.";
        results.push(...batch.map((record) => ({
          rowNumber: record.rowNumber,
          status: "failed",
          message,
        })));
      }
    }

    try {
      const [dailyResponse, monthlyResponse] = await Promise.all([
        getAttendanceRecords(),
        getMonthlyAttendanceSummaries(),
      ]);
      const dailyRecords = dailyResponse.data?.data;
      const monthlyRecords = monthlyResponse.data?.data;
      if (!Array.isArray(dailyRecords) || !Array.isArray(monthlyRecords)) {
        throw new Error("The server returned an invalid attendance response.");
      }
      setAttendance(dailyRecords);
      setMonthlySummaries(monthlyRecords);
      setLoadError("");
    } catch (loadError) {
      setLoadError(
        loadError.response?.data?.message ||
          loadError.message ||
          "Saved attendance could not be reloaded.",
      );
    }

    setCurrentPage(1);
    clearFilters();
    return { ...totals, results };
  };

  return (
    <UserLayout>
      <div className="space-y-6">
        <div className="rounded-3xl bg-linear-to-r from-slate-900 to-teal-700 p-8 text-white shadow-lg">
          <h1 className="text-4xl font-bold">Attendance Management</h1>
          <p className="mt-3 text-slate-200">
            Track and manage your employee attendance and working hours.
          </p>
        </div>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <select
              value={departmentFilter}
              onChange={updateDepartment}
              className={`${inputClassName} mt-0 lg:w-56`}
              aria-label="Filter attendance by department"
            >
              <option>All departments</option>
              {departments.map((department) => (
                <option key={department}>{department}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={updateStatus}
              className={`${inputClassName} mt-0 lg:w-44`}
              aria-label="Filter attendance by status"
            >
              <option>All statuses</option>
              {[...new Set(attendance.map((record) => record.attendanceStatus).filter(Boolean))].map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>

            <button
              type="button"
              onClick={clearFilters}
              disabled={
                departmentFilter === "All departments" &&
                statusFilter === "All statuses"
              }
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Clear
            </button>

          </div>
          <p className="mt-3 text-xs text-slate-400">
            Showing: <span className="font-semibold">Firestore</span>
            {isLoading && <span> · Loading saved records...</span>}
          </p>
          {loadError && (
            <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {loadError}
            </p>
          )}
        </section>

        <section className="space-y-4">
          <label className="block max-w-sm text-sm font-semibold text-slate-700">
            CSV document format
            <select
              value={importFormat}
              onChange={(event) => setImportFormat(event.target.value)}
              disabled={isLoading}
              className={inputClassName}
            >
              <option value="legacy">Existing attendance CSV</option>
              <option value="daily">HR Portal daily attendance</option>
              <option value="monthly">Payroll monthly summary CSV</option>
            </select>
          </label>
          <CsvImportPanel
            key={importFormat}
            title={
              importFormat === "monthly"
                ? "Import monthly attendance/payroll summary"
                : importFormat === "daily"
                  ? "Import HR Portal daily attendance"
                  : "Import existing attendance CSV"
            }
            description="Imports are HR-only. Daily records and monthly summaries are validated and saved separately; imported source hours are never converted or used to recalculate pay."
            columns={
              importFormat === "monthly"
                ? monthlyAttendanceColumns
                : importFormat === "daily"
                  ? dailyAttendanceColumns
                  : legacyAttendanceColumns
            }
            requiredHeaderGroups={
              importFormat === "monthly"
                ? [
                    ["employeeId", "employeeCode", "email", "employeeEmail"],
                    ["Employee"],
                    ["Email"],
                    ["Department"],
                    ...monthlyAttendanceColumns.slice(4).map((column) => [column.header]),
                  ]
                : importFormat === "daily"
                  ? [
                      ["employeeId", "employeeCode", "email", "employeeEmail"],
                      ...dailyAttendanceColumns.slice(4).map((column) => [column.header]),
                    ]
                  : [
                      ["employeeId", "employeeCode", "id", "email", "emailId", "employeeEmail"],
                      ["status", "attendanceStatus", "attendance"],
                      ["workingHours", "hoursWorked", "hours"],
                    ]
            }
            validateRow={
              importFormat === "monthly"
                ? validateMonthlyAttendanceRow
                : importFormat === "daily"
                  ? validateDailyAttendanceRow
                  : validateLegacyAttendanceRow
            }
            templateName={
              importFormat === "monthly"
                ? "payroll-monthly-summary-template.csv"
                : importFormat === "daily"
                  ? "hr-portal-daily-attendance-template.csv"
                  : "attendance-import-template.csv"
            }
            sampleRow={
              importFormat === "monthly"
                ? {
                    employeeId: "EXAMPLE-REMOVE",
                    employee: "Example Employee",
                    email: "example@example.test",
                    department: "Operations",
                    month: "2026-11",
                    daysPresent: "5",
                    totalHours: "37.15",
                    worked: "37h 8m",
                    break: "4h 1m",
                    idle: "0s",
                    flaggedDays: "0",
                    fullDays: "0",
                    halfDays: "0",
                    otherDays: "0",
                    otherHours: "0",
                    basePayUsd: "0",
                    bonusUsd: "0",
                    netPayUsd: "0",
                    daysWithoutRate: "0",
                    synced: "false",
                  }
                : importFormat === "daily"
                  ? {
                      employeeId: "EXAMPLE-REMOVE",
                      email: "example@example.test",
                      name: "Example Employee",
                      department: "Operations",
                      date: "2026-11-06",
                      day: "Fri",
                      clockIn: "08:30",
                      clockOut: "17:00",
                      status: "Full day",
                      leave: "",
                      hours: "8.5",
                      break: "1",
                      productive: "7.5",
                    }
                  : {
                      employeeId: "EXAMPLE-REMOVE",
                      name: "Example Employee",
                      email: "example@example.test",
                      department: "Operations",
                      status: "Present",
                      workingHours: "8",
                      totalBreakTime: "1",
                    }
            }
            disabled={isLoading}
            onImport={importAttendanceContent}
          />
        </section>

        <div className="flex gap-2">
          {[
            ["daily", `Daily records (${attendance.length})`],
            ["monthly", `Monthly summaries (${monthlySummaries.length})`],
          ].map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => {
                setViewMode(mode);
                setCurrentPage(1);
              }}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${viewMode === mode ? "bg-teal-700 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {viewMode === "daily" ? (
          <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1500px] text-left text-sm">
                <TableHeader columns={["Employee ID", "Name", "Email", "Department", "Date", "Day", "Clock In", "Clock Out", "Status", "Leave", "Hours (source)", "Break (source)", "Productive (source)"]} />
                <tbody className="divide-y divide-slate-100 text-center">
                  {visibleAttendance.length ? visibleAttendance.map((record) => {
                    const status = record.attendanceStatus || "—";
                    const tone = /present|full day/i.test(status) ? "bg-emerald-100 text-emerald-700" : /absent|leave/i.test(status) ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700";
                    const sourceValue = (value) => value || "—";
                    return (
                      <tr key={record.id} className="transition hover:bg-slate-50">
                        <td className="px-4 py-3 text-xs text-slate-600">{record.employeeId || record.id}</td>
                        <td className="px-4 py-3 text-start font-semibold text-slate-800">{record.name || record.employeeName || "—"}</td>
                        <td className="px-4 py-3 text-start text-slate-500">{record.email || record.employeeEmail || "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{record.department || "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{record.date || "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{record.day || "—"}</td>
                        <td className="px-4 py-3 font-mono text-slate-600">{record.clockIn || "—"}</td>
                        <td className="px-4 py-3 font-mono text-slate-600">{record.clockOut || "—"}</td>
                        <td className="px-4 py-3"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>{status}</span></td>
                        <td className="px-4 py-3 text-slate-600">{record.leave || "—"}</td>
                        <td className="px-4 py-3 font-mono text-slate-600">{record.recordType === "dailyDetailed" ? sourceValue(record.hoursSource) : record.workingHours === undefined ? "—" : `${record.workingHours}h`}</td>
                        <td className="px-4 py-3 font-mono text-slate-600">{record.recordType === "dailyDetailed" ? sourceValue(record.breakSource) : record.totalBreakTime === undefined ? "—" : `${record.totalBreakTime}h`}</td>
                        <td className="px-4 py-3 font-mono text-slate-600">{sourceValue(record.productiveSource)}</td>
                      </tr>
                    );
                  }) : (
                    <tr><td colSpan="13" className="px-6 py-12 text-center text-sm text-slate-500">
                      {isLoading ? "Loading attendance records..." : loadError ? "Attendance records could not be loaded." : attendance.length ? "No attendance records match your filters." : "No attendance records have been imported yet."}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 border-t border-slate-100 px-6 py-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <span>Page {displayedPage} of {totalPages} · {filteredAttendance.length} records</span>
              <div className="flex items-center gap-2">
                <button type="button" disabled={displayedPage === 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} className="rounded-lg px-3 py-2 font-medium transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300">← Previous</button>
                <button type="button" disabled={displayedPage === totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} className="rounded-lg px-3 py-2 font-medium transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300">Next →</button>
              </div>
            </div>
          </section>
        ) : (
          <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[2100px] text-left text-sm">
                <TableHeader columns={["Employee ID", "Employee", "Email", "Department", "Month", "Days Present", "Total Hours (source)", "Worked", "Break", "Idle", "Flagged Days", "Full Days", "Half Days", "Other Days", "Other Hours (source)", "Base Pay (USD)", "Bonus (USD)", "Net Pay (USD)", "Days Without Rate", "Synced"]} />
                <tbody className="divide-y divide-slate-100 text-center">
                  {filteredMonthlySummaries.length ? filteredMonthlySummaries.map((record) => (
                    <tr key={record.id} className="transition hover:bg-slate-50">
                      <td className="px-3 py-3 text-xs text-slate-600">{record.employeeId || record.id}</td>
                      <td className="px-3 py-3 font-semibold text-slate-800">{record.employeeName || record.name || "—"}</td>
                      <td className="px-3 py-3 text-slate-500">{record.employeeEmail || record.email || "—"}</td>
                      <td className="px-3 py-3 text-slate-600">{record.department || "—"}</td>
                      <td className="px-3 py-3 text-slate-600">{record.month}</td>
                      <td className="px-3 py-3 text-slate-600">{record.daysPresent}</td>
                      <td className="px-3 py-3 font-mono text-slate-600">{record.totalHoursSource}</td>
                      <td className="px-3 py-3 font-mono text-slate-600">{record.worked}</td>
                      <td className="px-3 py-3 font-mono text-slate-600">{record.breakSource}</td>
                      <td className="px-3 py-3 font-mono text-slate-600">{record.idle}</td>
                      <td className="px-3 py-3 text-slate-600">{record.flaggedDays}</td>
                      <td className="px-3 py-3 text-slate-600">{record.fullDays}</td>
                      <td className="px-3 py-3 text-slate-600">{record.halfDays}</td>
                      <td className="px-3 py-3 text-slate-600">{record.otherDays}</td>
                      <td className="px-3 py-3 font-mono text-slate-600">{record.otherHoursSource}</td>
                      <td className="px-3 py-3 text-slate-600">{record.basePayUsd}</td>
                      <td className="px-3 py-3 text-slate-600">{record.bonusUsd}</td>
                      <td className="px-3 py-3 text-slate-600">{record.netPayUsd}</td>
                      <td className="px-3 py-3 text-slate-600">{record.daysWithoutRate}</td>
                      <td className="px-3 py-3 text-slate-600">{record.synced ? "Yes" : "No"}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan="20" className="px-6 py-12 text-center text-sm text-slate-500">
                      {isLoading ? "Loading monthly summaries..." : monthlySummaries.length ? "No monthly summaries match your department filter." : "No monthly summaries have been imported yet."}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="border-t border-slate-100 px-6 py-4 text-sm text-slate-500">{filteredMonthlySummaries.length} monthly summary record(s). Source hours and USD payroll figures are displayed as imported; no conversion or recalculation is applied.</p>
          </section>
        )}
      </div>
    </UserLayout>
  );
}

function Attendance() {
  const user = getUser();
  const isHr = user?.role?.toLowerCase() === "hr";

  return isHr ? <HrAttendance /> : <EmployeeAttendance />;
}

export default Attendance;
