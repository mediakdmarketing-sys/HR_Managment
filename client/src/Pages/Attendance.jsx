import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  CircleCheckBig,
  Coffee,
  FileUp,
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
  importAttendanceRecords,
} from "../api/attendanceApi";
import { parseAttendanceCsv } from "../utils/attendanceCsv";

const PAGE_SIZE = 10;
const REQUIRED_WORK_SECONDS = 8 * 60 * 60;
const SAMPLE_WORK_SECONDS = 4 * 60 * 60 + 34 * 60 + 12;
const inputClassName =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

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
  const fileInputRef = useRef(null);
  const [attendance, setAttendance] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [departmentFilter, setDepartmentFilter] = useState("All departments");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [importSummary, setImportSummary] = useState("");

  useEffect(() => {
    let active = true;
    const loadAttendance = async () => {
      try {
        const response = await getAttendanceRecords();
        const records = response.data?.data;
        if (!Array.isArray(records)) {
          throw new Error("The server returned an invalid attendance response.");
        }
        if (!active) return;
        setAttendance(records);
        setLoadError("");
      } catch (loadError) {
        if (!active) return;
        const message =
          loadError.response?.data?.message ||
          loadError.message ||
          "Saved attendance could not be loaded.";
        setLoadError(message);
        setError(message);
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

  const importCsv = async (event) => {
    const [file] = event.target.files;
    if (!file) return;

    setError("");
    setImportSummary("");
    setIsImporting(true);
    event.target.value = "";

    let importedRecords;
    try {
      importedRecords = parseAttendanceCsv(await file.text());
    } catch (parseError) {
      setError(parseError.message || "The CSV file could not be read.");
      setIsImporting(false);
      return;
    }

    const totals = { imported: 0, duplicates: 0, skipped: 0, failed: 0 };
    const issues = [];
    for (let start = 0; start < importedRecords.length; start += 500) {
      const batch = importedRecords.slice(start, start + 500);
      try {
        const response = await importAttendanceRecords(batch);
        const result = response.data?.data;
        for (const key of Object.keys(totals)) {
          totals[key] += Number(result?.[key]) || 0;
        }
        for (const row of result?.results || []) {
          if (row.status === "skipped" || row.status === "failed") {
            issues.push(`Row ${row.rowNumber}: ${row.reason}`);
          }
        }
      } catch (importError) {
        totals.failed += batch.length;
        const message =
          importError.response?.data?.message ||
          importError.message ||
          "The batch could not be submitted.";
        issues.push(`Rows ${batch[0].rowNumber}-${batch[batch.length - 1].rowNumber}: ${message}`);
      }
    }

    try {
      const response = await getAttendanceRecords();
      const records = response.data?.data;
      if (!Array.isArray(records)) {
        throw new Error("The server returned an invalid attendance response.");
      }
      setAttendance(records);
      setLoadError("");
    } catch (loadError) {
      setLoadError(
        loadError.response?.data?.message ||
          loadError.message ||
          "Saved attendance could not be reloaded.",
      );
      issues.push(
        `Saved records could not be reloaded: ${
          loadError.response?.data?.message || loadError.message
        }`,
      );
    }

    setImportSummary(
      `${totals.imported} imported, ${totals.duplicates} duplicates, ${totals.skipped} skipped, ${totals.failed} failed.`,
    );
    if (issues.length > 0) {
      const remaining = issues.length > 5 ? ` (and ${issues.length - 5} more)` : "";
      setError(`${issues.slice(0, 5).join(" · ")}${remaining}`);
    }
    setCurrentPage(1);
    clearFilters();
    setIsImporting(false);
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
              <option>Present</option>
              <option>Absent</option>
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

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={importCsv}
              disabled={isImporting || isLoading}
              className="hidden"
            />
            <button
              type="button"
              disabled={isImporting || isLoading}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-wait disabled:opacity-60"
            >
              <FileUp size={18} />
              {isImporting ? "Importing..." : "Import CSV"}
            </button>

          </div>
          <p className="mt-3 text-xs text-slate-400">
            Showing: <span className="font-semibold">Firestore</span>
            {isLoading && <span> · Loading saved records...</span>}
          </p>
          {importSummary && (
            <p className="mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800" role="status">
              Import results: {importSummary}
            </p>
          )}
          {error && (
            <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </p>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 text-center">
                <tr>
                  <th className="px-6 py-4 font-semibold">Employee ID</th>
                  <th className="px-6 py-4 font-semibold">Name</th>
                  <th className="px-6 py-4 font-semibold">Email</th>
                  <th className="px-6 py-4 font-semibold">Department</th>
                  <th className="px-6 py-4 font-semibold">Date</th>
                  <th className="px-6 py-4 font-semibold">Attendance</th>
                  <th className="px-6 py-4 font-semibold">Working hours</th>
                  <th className="px-6 py-4 font-semibold">Total break time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-center">
                {visibleAttendance.length > 0 ? (
                  visibleAttendance.map((employee) => (
                    <tr key={employee.id} className="transition hover:bg-slate-50">
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {employee.employeeId || employee.id}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-800 text-start">
                        {employee.name || employee.employeeName}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500 text-start">
                        {employee.email || employee.employeeEmail}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {employee.department}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {employee.date || "—"}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            employee.attendanceStatus === "Present"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {employee.attendanceStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {employee.workingHours}h
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {employee.totalBreakTime}h
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="8"
                      className="px-6 py-12 text-center text-sm text-slate-500"
                    >
                      {isLoading
                        ? "Loading attendance records..."
                        : loadError
                          ? "Attendance records could not be loaded."
                          : attendance.length === 0
                            ? "No attendance records have been imported yet."
                            : "No attendance records match your filters."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 px-6 py-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Page {displayedPage} of {totalPages} · {filteredAttendance.length}{" "}
              records
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={displayedPage === 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                className="rounded-lg px-3 py-2 font-medium transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
              >
                ← Previous
              </button>
              <button
                type="button"
                disabled={displayedPage === totalPages}
                onClick={() =>
                  setCurrentPage((page) => Math.min(totalPages, page + 1))
                }
                className="rounded-lg px-3 py-2 font-medium transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
              >
                Next →
              </button>
            </div>
          </div>
        </section>
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
