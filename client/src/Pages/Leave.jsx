import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  FileText,
  Plus,
  Settings2,
  Upload,
  Users,
  X,
} from "lucide-react";
import UserLayout from "../layouts/UserLayout";
import { getUser } from "../utils/auth";
import { toast } from "react-toastify";
import {
  createLeavePolicy,
  createLeaveRequest,
  getLeaveAllocationPreview,
  getLeaveEmployees,
  getLeavePolicies,
  getLeaveRequests,
  importLeaveCsv,
  updateLeaveStatus,
} from "../api/leaveApi";
import {
  findAllLeaveRequestConflicts,
  findLeaveRequestConflicts,
} from "../utils/leaveConflicts";

const initialLeaveTypes = [
  { id: "annual", name: "Annual leave", days: 20, carryForward: 5 },
  { id: "casual", name: "Casual leave", days: 7, carryForward: 0 },
  { id: "medical", name: "Medical / sick leave", days: 14, carryForward: 0 },
  { id: "unpaid", name: "Unpaid leave", days: 0, carryForward: 0 },
];

const inputClassName =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

const formatDate = (date) => {
  if (
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(Date.parse(`${date}T00:00:00Z`)) ||
    new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date
  ) {
    return "Invalid date";
  }
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
};

const calculateCalendarDays = (startDate, endDate) => {
  if (!startDate || !endDate) return null;
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return Math.round((end - start) / 86_400_000) + 1;
};

const emptyManualForm = {
  employeeId: "",
  leaveType: "",
  startDate: "",
  endDate: "",
  days: "",
  reason: "",
  sourceReference: "",
};

const statusClass = {
  Pending: "bg-amber-100 text-amber-700",
  Approved: "bg-emerald-100 text-emerald-700",
  Rejected: "bg-red-100 text-red-700",
};

const leaveSourceLabel = (request) => {
  if (request.sourceType === "google_forms") return "Google Forms";
  if (request.sourceType === "csv") return "CSV import";
  if (request.sourceType === "hr_manual") return "HR entry";
  return "Historical";
};

const StatCard = ({ label, value, detail, icon: Icon, color }) => (
  <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="mt-2 text-3xl font-bold text-slate-800">{value}</p>
      </div>
      <div className={`rounded-xl p-3 ${color}`}>
        <Icon size={21} />
      </div>
    </div>
    <p className="mt-4 text-xs text-slate-500">{detail}</p>
  </div>
);

function Leave() {
  const user = getUser();
  const isHr = user?.role?.toLowerCase() === "hr";
  const currentEmployeeId = user?._id ?? user?.id;
  const [leaveTypes, setLeaveTypes] = useState(initialLeaveTypes);
  const [requests, setRequests] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [isPolicyLoading, setIsPolicyLoading] = useState(isHr);
  const [isPolicySaving, setIsPolicySaving] = useState(false);
  const [policyError, setPolicyError] = useState("");
  const [policySuccess, setPolicySuccess] = useState("");
  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const [newType, setNewType] = useState("");
  const [activeTab, setActiveTab] = useState("requests");
  const [decidingId, setDecidingId] = useState(null);
  const [previewingId, setPreviewingId] = useState(null);
  const [approvalPreview, setApprovalPreview] = useState(null);
  const [isAddRequestOpen, setIsAddRequestOpen] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [isEmployeeLoading, setIsEmployeeLoading] = useState(false);
  const [employeeLoadError, setEmployeeLoadError] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [manualForm, setManualForm] = useState(emptyManualForm);
  const [isRequestSaving, setIsRequestSaving] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importMode, setImportMode] = useState("csv");
  const [importDateFormat, setImportDateFormat] = useState("auto");
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importResult, setImportResult] = useState(null);
  const decidingRef = useRef(false);
  const requestSavingRef = useRef(false);
  const importingRef = useRef(false);

  useEffect(() => {
    let active = true;
    const loadRequests = () => getLeaveRequests()
      .then((response) => {
        if (active) {
          setRequests(response.data.data);
          setLoadError("");
        }
      })
      .catch((error) => {
        if (active) setLoadError(error.response?.data?.message || "Unable to load leave requests.");
      });
    loadRequests();
    window.addEventListener("leave-notification", loadRequests);
    return () => {
      active = false;
      window.removeEventListener("leave-notification", loadRequests);
    };
  }, []);

  const loadLeaveEmployees = async () => {
    if (isEmployeeLoading) return;
    setIsEmployeeLoading(true);
    setEmployeeLoadError("");
    try {
      const response = await getLeaveEmployees();
      const roster = response.data?.data;
      if (!Array.isArray(roster)) {
        throw new Error("The server returned an invalid employee list.");
      }
      setEmployees(roster);
    } catch (error) {
      setEmployeeLoadError(
        error.response?.data?.message || error.message || "Unable to load employees.",
      );
    } finally {
      setIsEmployeeLoading(false);
    }
  };

  useEffect(() => {
    if (!isHr) return undefined;
    let active = true;
    getLeavePolicies()
      .then((response) => {
        const policies = response.data?.data;
        if (!Array.isArray(policies)) {
          throw new Error("The server returned an invalid leave policies response.");
        }
        if (!active) return;
        setLeaveTypes(policies);
        setPolicyError("");
        setPolicySuccess("Leave policies loaded from Firebase.");
      })
      .catch((error) => {
        if (!active) return;
        setPolicyError(
          error.response?.data?.message || "Unable to load leave policies.",
        );
      })
      .finally(() => {
        if (active) setIsPolicyLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isHr]);

  // Preserve existing backend visibility rules; never assume the API returns every employee.
  const reviewRequests = requests.filter((request) => request.employeeId !== currentEmployeeId);
  const pendingRequests = reviewRequests.filter((request) => request.status === "Pending");
  const today = (() => {
    const date = new Date();
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  })();
  const month = today.slice(0, 7);
  const approvedThisMonth = reviewRequests.filter((request) =>
    request.status === "Approved" && (request.reviewedAt || request.createdAt || "").slice(0, 7) === month
  ).length;
  const employeesOnLeave = new Set(reviewRequests.filter((request) =>
    request.status === "Approved" && request.startDate <= today && request.endDate >= today
  ).map((request) => request.employeeId)).size;
  const activeCalendarRequests = requests.filter(
    (request) => request.status === "Pending" || request.status === "Approved",
  );
  const calendarConflicts = findAllLeaveRequestConflicts(activeCalendarRequests);
  const approvalRequest = approvalPreview
    ? requests.find((request) => request.id === approvalPreview.requestId)
    : null;
  const approvalConflicts = approvalRequest
    ? findLeaveRequestConflicts(approvalRequest, requests)
    : [];

  const updateRequestStatus = async (id, status, expectedAllocation) => {
    if (decidingRef.current) return false;
    decidingRef.current = true;
    setDecidingId(id);
    try {
      const response = await updateLeaveStatus(id, status, expectedAllocation);
      setRequests((current) => current.map((request) => request.id === id ? response.data.data : request));
      if (status === "Approved" && response.data.data.paidDays !== undefined) {
        toast.success(
          `Leave approved: ${response.data.data.paidDays} paid, ${response.data.data.unpaidDays} unpaid day(s).`,
          { theme: "dark" },
        );
      } else {
        toast.success(`Leave request ${status.toLowerCase()}`, { theme: "dark" });
      }
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to update leave request.", { theme: "dark" });
      if (error.response?.status === 409) setApprovalPreview(null);
      return false;
    } finally {
      decidingRef.current = false;
      setDecidingId(null);
    }
  };

  const previewLeaveApproval = async (request) => {
    if (previewingId !== null || decidingRef.current) return;
    setPreviewingId(request.id);
    try {
      const response = await getLeaveAllocationPreview(request.id);
      const preview = response.data?.data;
      if (!preview?.requestId || !Array.isArray(preview.balances)) {
        throw new Error("The server returned an invalid leave allocation.");
      }
      setApprovalPreview(preview);
    } catch (error) {
      toast.error(
        error.response?.data?.message || error.message || "Unable to calculate leave balance.",
        { theme: "dark" },
      );
    } finally {
      setPreviewingId(null);
    }
  };

  const confirmLeaveApproval = async () => {
    if (!approvalPreview) return;
    const approved = await updateRequestStatus(
      approvalPreview.requestId,
      "Approved",
      {
        leaveYear: approvalPreview.leaveYear,
        paidDays: approvalPreview.paidDays,
        unpaidDays: approvalPreview.unpaidDays,
      },
    );
    if (approved) setApprovalPreview(null);
  };

  const openAddRequest = () => {
    setManualForm(emptyManualForm);
    setEmployeeSearch("");
    setEmployeeLoadError("");
    setIsAddRequestOpen(true);
    if (isHr && employees.length === 0) void loadLeaveEmployees();
  };

  const addManualLeaveRequest = async (event) => {
    event.preventDefault();
    if (requestSavingRef.current) return;
    const duration = calculateCalendarDays(manualForm.startDate, manualForm.endDate);
    if (
      !manualForm.employeeId ||
      !manualForm.leaveType ||
      !duration ||
      !Number.isFinite(Number(manualForm.days)) ||
      Number(manualForm.days) <= 0 ||
      Number(manualForm.days) > duration ||
      !manualForm.reason.trim()
    ) {
      toast.error("Complete the employee, leave type, dates and reason.", { theme: "dark" });
      return;
    }

    requestSavingRef.current = true;
    setIsRequestSaving(true);
    try {
      const response = await createLeaveRequest({
        employeeId: manualForm.employeeId,
        leaveType: manualForm.leaveType,
        startDate: manualForm.startDate,
        endDate: manualForm.endDate,
        days: Number(manualForm.days),
        reason: manualForm.reason.trim(),
        sourceReference: manualForm.sourceReference.trim(),
      });
      const request = response.data?.data;
      if (!request?.id || request.status !== "Pending") {
        throw new Error("The server did not confirm a pending leave request.");
      }
      setRequests((current) => [request, ...current.filter((item) => item.id !== request.id)]);
      setIsAddRequestOpen(false);
      toast.success("Leave request added as Pending.", { theme: "dark" });
    } catch (error) {
      toast.error(
        error.response?.data?.message || error.message || "Unable to add leave request.",
        { theme: "dark" },
      );
    } finally {
      requestSavingRef.current = false;
      setIsRequestSaving(false);
    }
  };

  const submitLeaveCsv = async (event) => {
    event.preventDefault();
    if (importingRef.current) return;
    if (!importFile) {
      setImportError("Choose a CSV file to import.");
      return;
    }

    importingRef.current = true;
    setIsImporting(true);
    setImportError("");
    setImportResult(null);
    try {
      const response = await importLeaveCsv({
        content: await importFile.text(),
        sourceType: importMode,
        sourceName: importFile.name,
        dateFormat: importDateFormat,
      });
      const result = response.data?.data;
      if (
        !result ||
        !["imported", "duplicated", "skipped", "failed"].every(
          (count) => Number.isInteger(result[count]),
        ) ||
        !Array.isArray(result.rows)
      ) {
        throw new Error("The server returned an invalid import summary.");
      }
      setImportResult(result);
      const importedRequests = result.rows
        .filter((row) => row.status === "imported" && row.request?.id)
        .map((row) => row.request);
      if (importedRequests.length) {
        setRequests((current) => [
          ...importedRequests,
          ...current.filter(
            (request) => !importedRequests.some((imported) => imported.id === request.id),
          ),
        ]);
      }
      const summary =
        `Imported ${result.imported}; duplicates ${result.duplicated}; ` +
        `skipped ${result.skipped}; failed ${result.failed}.`;
      if (result.failed > 0) {
        toast.warn(summary, { theme: "dark" });
      } else {
        toast.success(summary, { theme: "dark" });
      }
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || "Unable to import leave CSV.";
      setImportError(message);
      toast.error(message, { theme: "dark" });
    } finally {
      importingRef.current = false;
      setIsImporting(false);
    }
  };

  const addLeaveType = async (event) => {
    event.preventDefault();
    const name = newType.trim().replace(/\s+/g, " ");
    if (!name || isPolicySaving) return;
    const normalizedName = name.toLowerCase();
    if (
      leaveTypes.some(
        (type) => type.name.trim().replace(/\s+/g, " ").toLowerCase() === normalizedName,
      )
    ) {
      toast.error("This leave type already exists.", { theme: "dark" });
      return;
    }

    setIsPolicySaving(true);
    setPolicyError("");
    setPolicySuccess("");
    try {
      const response = await createLeavePolicy({ name });
      const policy = response.data?.data;
      if (!policy?.id || !policy.name) {
        throw new Error("The server returned an invalid saved policy.");
      }
      setLeaveTypes((current) => [...current, policy]);
      setNewType("");
      setIsTypeOpen(false);
      setPolicySuccess("Leave type saved to Firebase.");
      toast.success("Leave type saved to Firebase.", { theme: "dark" });
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || "Unable to save leave type.";
      setPolicyError(message);
      toast.error(message, { theme: "dark" });
    } finally {
      setIsPolicySaving(false);
    }
  };

  const manualDatesCrossYear =
    Boolean(manualForm.startDate && manualForm.endDate) &&
    manualForm.startDate.slice(0, 4) !== manualForm.endDate.slice(0, 4);
  const manualDuration = manualDatesCrossYear
    ? null
    : calculateCalendarDays(manualForm.startDate, manualForm.endDate);
  const filteredEmployees = employees.filter((employee) => {
    const query = employeeSearch.trim().toLowerCase();
    return (
      !query ||
      [employee.name, employee.email, employee.id]
        .some((value) => String(value || "").toLowerCase().includes(query))
    );
  }).slice(0, 8);
  const selectedEmployee = employees.find(
    (employee) => employee.id === manualForm.employeeId,
  );

  return (
    <UserLayout>
      <div className="space-y-6">
        {loadError && <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{loadError}</p>}
        <section className="rounded-3xl bg-linear-to-r from-slate-900 to-teal-700 p-8 text-white shadow-lg">
          <p className="text-sm font-medium text-teal-200">HR operations</p>
          <h1 className="mt-2 text-4xl font-bold">Leave Management</h1>
          <p className="mt-3 text-slate-200">Review requests, manage leave policies and monitor team availability.</p>
        </section>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Pending requests" value={pendingRequests.length} detail="Waiting for review" icon={FileText} color="bg-amber-50 text-amber-700" />
          <StatCard label="Approved this month" value={approvedThisMonth} detail="Requests approved this month" icon={Check} color="bg-emerald-50 text-emerald-700" />
          <StatCard label="Employees on leave" value={employeesOnLeave} detail="Approved leave active today" icon={Users} color="bg-blue-50 text-blue-700" />
          <StatCard label="Leave types" value={leaveTypes.length} detail={isPolicyLoading ? "Loading saved policies" : policyError ? "Unable to load saved policies" : "Policy settings in Firebase"} icon={Settings2} color="bg-teal-50 text-teal-700" />
        </div>
        <div className="flex gap-2 border-b border-slate-200">
          {[["requests", "Requests"], ["calendar", "Team calendar"], ...(isHr ? [["policies", "Leave policies"]] : [])].map(([value, label]) => (
            <button key={value} type="button" onClick={() => setActiveTab(value)}
              className={`border-b-2 px-4 py-3 text-sm font-semibold ${activeTab === value ? "border-teal-700 text-teal-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
              {label}
            </button>
          ))}
        </div>
            {activeTab === "requests" && (
              <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70">
                <div className="flex items-center justify-between border-b border-slate-100 p-5">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">
                      Employee requests
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      HR review queue.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {isHr && (
                      <>
                        <button
                          type="button"
                          onClick={openAddRequest}
                          className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
                        >
                          <Plus size={17} /> Add Leave Request
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setImportError("");
                            setImportResult(null);
                            setIsImportOpen(true);
                          }}
                          className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-white px-4 py-2.5 text-sm font-semibold text-teal-800 hover:bg-teal-50"
                        >
                          <Upload size={17} /> Import Leave CSV
                        </button>
                      </>
                    )}
                    <FileText className="text-teal-600" size={22} />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[850px] text-left">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-5 py-4">Employee</th>
                        <th className="px-5 py-4">Leave type</th>
                        <th className="px-5 py-4">Dates</th>
                        <th className="px-5 py-4">Days</th>
                        <th className="px-5 py-4">Reason</th>
                        <th className="px-5 py-4">Status</th>
                        <th className="px-5 py-4">Decision</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reviewRequests.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-500">
                            No leave requests to review.
                          </td>
                        </tr>
                      )}
                      {reviewRequests.map((request) => (
                        <tr key={request.id} className="hover:bg-slate-50">
                          <td className="px-5 py-4">
                            <p className="font-semibold text-slate-800">
                              {request.employeeName}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {request.leaveNumber || "Historical"} ·{" "}
                              {leaveSourceLabel(request)}
                            </p>
                          </td>
                          <td className="px-5 py-4 text-sm text-slate-600">
                            {request.type}
                          </td>
                          <td className="px-5 py-4 text-sm text-slate-600">
                            {formatDate(request.startDate)} -{" "}
                            {formatDate(request.endDate)}
                          </td>
                          <td className="px-5 py-4 text-sm text-slate-600">
                            {request.days}
                            {request.status === "Approved" &&
                              request.paidDays !== undefined && (
                                <p className="mt-1 text-xs text-slate-500">
                                  Paid: {request.paidDays} · Unpaid: {request.unpaidDays}
                                </p>
                              )}
                          </td>
                          <td className="max-w-xs px-5 py-4 text-sm text-slate-600">
                            {request.reason || "—"}
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass[request.status]}`}
                            >
                              {request.status}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            {request.status === "Pending" ? (
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  disabled={decidingId !== null || previewingId !== null}
                                  onClick={() => previewLeaveApproval(request)}
                                  className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                                >
                                  {previewingId === request.id ? "Calculating..." : "Approve"}
                                </button>
                                <button
                                  type="button"
                                  disabled={decidingId !== null || previewingId !== null}
                                  onClick={() =>
                                    updateRequestStatus(request.id, "Rejected")
                                  }
                                  className="rounded-lg bg-red-100 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-200 disabled:opacity-50"
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">
                                Completed
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {activeTab === "calendar" && (
              <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">
                      Team leave calendar
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Approved and pending leave periods across the team.
                    </p>
                  </div>
                  <CalendarDays className="text-teal-600" size={22} />
                </div>
                {calendarConflicts.length === 0 ? (
                  <p className="mb-4 rounded-xl bg-emerald-50 p-4 text-sm font-medium text-emerald-800" role="status">
                    No scheduling conflicts detected.
                  </p>
                ) : (
                  <p className="mb-4 rounded-xl bg-amber-50 p-4 text-sm font-medium text-amber-800" role="status">
                    {calendarConflicts.length} overlapping leave pair(s) need review. Conflicts do not change request decisions.
                  </p>
                )}
                <div className="space-y-3">
                  {activeCalendarRequests.map((request) => {
                    const requestConflicts = findLeaveRequestConflicts(
                      request,
                      activeCalendarRequests,
                    );
                    return (
                      <div
                        key={request.id}
                        className="flex flex-col gap-2 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="font-semibold text-slate-800">
                            {request.employeeName}
                          </p>
                          <p className="text-sm text-slate-500">
                            {request.type} · {request.days} day(s)
                          </p>
                          <span
                            className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass[request.status] || "bg-slate-100 text-slate-600"}`}
                          >
                            {request.status}
                          </span>
                          {requestConflicts.length > 0 && (
                            <ul className="mt-2 space-y-1 text-xs text-amber-800">
                              {requestConflicts.map((conflict) => (
                                <li key={`${request.id}-${conflict.requestId}`}>
                                  Conflict with {conflict.employeeName} ({conflict.status}) ·{" "}
                                  {formatDate(conflict.overlapStart)} – {formatDate(conflict.overlapEnd)}
                                  <span className="sr-only">
                                    ; {request.employeeName}, {request.status}
                                  </span>
                                  <span aria-hidden="true"> · {request.status}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <span className="text-sm font-medium text-teal-700">
                          {formatDate(request.startDate)} -{" "}
                          {formatDate(request.endDate)}
                        </span>
                      </div>
                    );
                  })}
                  {activeCalendarRequests.length === 0 && (
                    <p className="rounded-xl border border-slate-200 p-4 text-sm text-slate-500">
                      No pending or approved leave requests to display.
                    </p>
                  )}
                </div>
              </section>
            )}

            {activeTab === "policies" && isHr && (
              <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">
                      Leave policies
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Configure leave types, accrual and carry-forward rules.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isPolicyLoading || isPolicySaving}
                    onClick={() => {
                      setPolicyError("");
                      setPolicySuccess("");
                      setIsTypeOpen(true);
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Plus size={17} /> Add type
                  </button>
                </div>
                {isPolicyLoading && (
                  <p className="mb-4 rounded-xl bg-blue-50 p-4 text-sm text-blue-700" role="status">
                    Loading saved leave policies...
                  </p>
                )}
                {policyError && (
                  <p className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700" role="alert">
                    {policyError}
                  </p>
                )}
                {policySuccess && (
                  <p className="mb-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700" role="status">
                    {policySuccess}
                  </p>
                )}
                <div className="grid gap-4 md:grid-cols-2">
                  {leaveTypes.map((type) => (
                    <div
                      key={type.id}
                      className="rounded-xl border border-slate-200 p-4"
                    >
                      <p className="font-semibold text-slate-800">
                        {type.name}
                      </p>
                      <p className="mt-2 text-sm text-slate-500">
                        {type.days} days accrued annually
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Carry forward: {type.carryForward} days
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

      </div>
      {isTypeOpen && isHr && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4">
          <form
            onSubmit={addLeaveType}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800">
                Add leave type
              </h2>
              <button
                type="button"
                disabled={isPolicySaving}
                onClick={() => setIsTypeOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>
            <label className="mt-5 block text-sm font-semibold text-slate-700">
              Leave type
              <input
                required
                value={newType}
                onChange={(event) => setNewType(event.target.value)}
                className={inputClassName}
                placeholder="Company wellness leave"
              />
            </label>
            <button
              type="submit"
              disabled={isPolicySaving}
              className="mt-5 w-full rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-wait disabled:opacity-60"
            >
              {isPolicySaving ? "Saving..." : "Add leave type"}
            </button>
          </form>
        </div>
      )}
      {isAddRequestOpen && isHr && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/50 p-4">
          <form
            onSubmit={addManualLeaveRequest}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Add Leave Request</h2>
                <p className="mt-1 text-sm text-slate-500">
                  New requests are saved as Pending for HR review.
                </p>
              </div>
              <button
                type="button"
                disabled={isRequestSaving}
                onClick={() => setIsAddRequestOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-50"
                aria-label="Close add leave request"
              >
                <X size={20} />
              </button>
            </div>
            {isEmployeeLoading && (
              <p className="mt-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-700" role="status">
                Loading active employees...
              </p>
            )}
            {employeeLoadError && (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">
                <span>{employeeLoadError}</span>
                <button
                  type="button"
                  onClick={() => void loadLeaveEmployees()}
                  className="shrink-0 font-semibold underline"
                >
                  Retry
                </button>
              </div>
            )}
            <label className="mt-5 block text-sm font-semibold text-slate-700">
              Employee
              <input
                required
                role="combobox"
                aria-expanded={Boolean(employeeSearch) && !manualForm.employeeId}
                aria-controls="leave-employee-options"
                autoComplete="off"
                value={employeeSearch}
                onChange={(event) => {
                  setEmployeeSearch(event.target.value);
                  setManualForm((current) => ({ ...current, employeeId: "" }));
                }}
                disabled={isEmployeeLoading || Boolean(employeeLoadError)}
                className={inputClassName}
                placeholder="Search by name, email or employee ID"
              />
            </label>
            {employeeSearch && !manualForm.employeeId && !isEmployeeLoading && !employeeLoadError && (
              <div
                id="leave-employee-options"
                role="listbox"
                className="mt-1 max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm"
              >
                {filteredEmployees.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-slate-500">No active employee matches.</p>
                ) : filteredEmployees.map((employee) => (
                  <button
                    key={employee.id}
                    type="button"
                    role="option"
                    aria-selected={manualForm.employeeId === employee.id}
                    onClick={() => {
                      setManualForm((current) => ({ ...current, employeeId: employee.id }));
                      setEmployeeSearch(`${employee.name} · ${employee.email} · ${employee.id}`);
                    }}
                    className="block w-full px-4 py-3 text-left hover:bg-teal-50"
                  >
                    <span className="block text-sm font-semibold text-slate-800">{employee.name}</span>
                    <span className="text-xs text-slate-500">{employee.email} · {employee.id}</span>
                  </button>
                ))}
              </div>
            )}
            {selectedEmployee && (
              <p className="mt-2 text-xs text-teal-700" role="status">
                Selected: {selectedEmployee.name} ({selectedEmployee.id})
              </p>
            )}
            <label className="mt-4 block text-sm font-semibold text-slate-700">
              Leave type
              <select
                required
                value={manualForm.leaveType}
                onChange={(event) => setManualForm((current) => ({
                  ...current,
                  leaveType: event.target.value,
                }))}
                disabled={isPolicyLoading || Boolean(policyError)}
                className={inputClassName}
              >
                <option value="">
                  {isPolicyLoading ? "Loading policies..." : "Select leave type"}
                </option>
                {leaveTypes.map((policy) => (
                  <option key={policy.id} value={policy.id}>{policy.name}</option>
                ))}
              </select>
              {policyError && <span className="mt-1 block text-xs text-red-600">{policyError}</span>}
            </label>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-700">
                Start date
                <input
                  type="date"
                  required
                  value={manualForm.startDate}
                  max={manualForm.endDate || undefined}
                  onChange={(event) => setManualForm((current) => {
                    const startDate = event.target.value;
                    const endDate = current.endDate && current.endDate < startDate
                      ? ""
                      : current.endDate;
                    const duration = calculateCalendarDays(startDate, endDate);
                    return {
                      ...current,
                      startDate,
                      endDate,
                      days: duration ? String(duration) : "",
                    };
                  })}
                  className={inputClassName}
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                End date
                <input
                  type="date"
                  required
                  min={manualForm.startDate || undefined}
                  max={manualForm.startDate
                    ? `${manualForm.startDate.slice(0, 4)}-12-31`
                    : undefined}
                  value={manualForm.endDate}
                  onChange={(event) => setManualForm((current) => {
                    const endDate = event.target.value;
                    const duration = calculateCalendarDays(current.startDate, endDate);
                    return {
                      ...current,
                      endDate,
                      days: duration ? String(duration) : "",
                    };
                  })}
                  className={inputClassName}
                />
              </label>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-700">
                Requested days
                <input
                  required
                  type="number"
                  min="0.01"
                  max={manualDuration || undefined}
                  step="0.01"
                  value={manualForm.days}
                  onChange={(event) => setManualForm((current) => ({
                    ...current,
                    days: event.target.value,
                  }))}
                  className={inputClassName}
                  placeholder="Calculated from the selected dates"
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Source/reference identifier (optional)
                <input
                  maxLength={200}
                  value={manualForm.sourceReference}
                  onChange={(event) => setManualForm((current) => ({
                    ...current,
                    sourceReference: event.target.value,
                  }))}
                  className={inputClassName}
                  placeholder="HR ticket or external reference"
                />
              </label>
            </div>
            <p className="mt-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              {manualDatesCrossYear
                ? "Requests crossing calendar leave years must be split."
                : `Calendar span: ${manualDuration ? `${manualDuration} day(s)` : "select valid dates"}.`}
              {!manualDatesCrossYear && " Requested days defaults to this span and may be lower to match company rules; weekends and public holidays are not recalculated."}
            </p>
            <label className="mt-4 block text-sm font-semibold text-slate-700">
              Reason
              <textarea
                required
                maxLength={2000}
                rows={3}
                value={manualForm.reason}
                onChange={(event) => setManualForm((current) => ({
                  ...current,
                  reason: event.target.value,
                }))}
                className={inputClassName}
                placeholder="Reason for leave"
              />
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={isRequestSaving}
                onClick={() => setIsAddRequestOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  isRequestSaving ||
                  isEmployeeLoading ||
                  Boolean(employeeLoadError) ||
                  isPolicyLoading ||
                  Boolean(policyError) ||
                  !manualDuration ||
                  !Number.isFinite(Number(manualForm.days)) ||
                  Number(manualForm.days) <= 0 ||
                  Number(manualForm.days) > manualDuration
                }
                className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-wait disabled:opacity-50"
              >
                {isRequestSaving ? "Adding..." : "Add as Pending"}
              </button>
            </div>
          </form>
        </div>
      )}
      {isImportOpen && isHr && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/50 p-4">
          <form
            onSubmit={submitLeaveCsv}
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Import Leave CSV</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Valid rows are created as Pending; existing requests are never overwritten.
                </p>
              </div>
              <button
                type="button"
                disabled={isImporting}
                onClick={() => setIsImportOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-50"
                aria-label="Close leave CSV import"
              >
                <X size={20} />
              </button>
            </div>
            <label className="mt-5 block text-sm font-semibold text-slate-700">
              Import format
              <select
                value={importMode}
                onChange={(event) => {
                  setImportMode(event.target.value);
                  setImportResult(null);
                }}
                disabled={isImporting}
                className={inputClassName}
              >
                <option value="csv">Standard leave CSV</option>
                <option value="google_forms">Google Forms / Sheets response CSV</option>
              </select>
            </label>
            <label className="mt-4 block text-sm font-semibold text-slate-700">
              CSV file
              <input
                required
                type="file"
                accept=".csv,text/csv"
                disabled={isImporting}
                onChange={(event) => {
                  setImportFile(event.target.files?.[0] || null);
                  setImportError("");
                  setImportResult(null);
                }}
                className={inputClassName}
              />
            </label>
            <label className="mt-4 block text-sm font-semibold text-slate-700">
              Slash-date format
              <select
                value={importDateFormat}
                onChange={(event) => setImportDateFormat(event.target.value)}
                disabled={isImporting}
                className={inputClassName}
              >
                <option value="auto">Auto; reject ambiguous dates</option>
                <option value="mdy">Month / day / year</option>
                <option value="dmy">Day / month / year</option>
              </select>
            </label>
            <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              {importMode === "google_forms" ? (
                <>
                  <p className="font-semibold text-slate-700">Google Forms / Sheets column mapping</p>
                  <p className="mt-1">
                    Timestamp → submission metadata only; Employee ID or Email Address → employee;
                    Leave Type, Start Date, End Date and Reason → request; Response ID → stable reference.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-slate-700">Required headers</p>
                  <p className="mt-1">
                    employeeId or employeeEmail, leaveType, startDate, endDate and reason.
                    Optional: days, externalRequestId, Timestamp.
                  </p>
                </>
              )}
              <p className="mt-2 text-xs">
                Dates support ISO YYYY-MM-DD, named months, and slash dates. Ambiguous slash dates need an explicit format.
                Rows with a supplied days value must match the inclusive calendar-date duration.
              </p>
            </div>
            {importError && (
              <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">
                {importError}
              </p>
            )}
            {importResult && (
              <div className="mt-4 rounded-xl border border-slate-200 p-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ["Imported", importResult.imported, "text-emerald-700"],
                    ["Duplicates", importResult.duplicated, "text-amber-700"],
                    ["Skipped", importResult.skipped, "text-slate-600"],
                    ["Failed", importResult.failed, "text-red-700"],
                  ].map(([label, count, color]) => (
                    <div key={label} className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">{label}</p>
                      <p className={`mt-1 text-lg font-bold ${color}`}>{count}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 max-h-48 space-y-2 overflow-y-auto" aria-live="polite">
                  {importResult.rows.map((row, index) => (
                    <p
                      key={`${row.rowNumber}-${index}`}
                      className={`rounded-lg px-3 py-2 text-xs ${
                        row.status === "failed"
                          ? "bg-red-50 text-red-700"
                          : row.status === "imported"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-50 text-slate-600"
                      }`}
                    >
                      Row {row.rowNumber}: {row.status} — {row.message}
                    </p>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={isImporting}
                onClick={() => setIsImportOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={isImporting || !importFile}
                className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-wait disabled:opacity-50"
              >
                {isImporting ? "Importing..." : "Import valid rows"}
              </button>
            </div>
          </form>
        </div>
      )}
      {approvalPreview && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-approval-title"
            className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl"
          >
            <h2 id="leave-approval-title" className="text-xl font-bold text-slate-800">
              Review leave allocation
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {approvalPreview.employeeName} · {approvalPreview.leaveType} ·{" "}
              {approvalPreview.leaveYear}
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Requested</p>
                <p className="mt-1 text-lg font-semibold text-slate-800">
                  {approvalPreview.requestedDays} days
                </p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-4">
                <p className="text-xs text-emerald-700">Paid</p>
                <p className="mt-1 text-lg font-semibold text-emerald-800">
                  {approvalPreview.paidDays} days
                </p>
              </div>
              <div className="rounded-xl bg-amber-50 p-4">
                <p className="text-xs text-amber-700">Excess unpaid</p>
                <p className="mt-1 text-lg font-semibold text-amber-800">
                  {approvalPreview.unpaidDays} days
                </p>
              </div>
            </div>
            {approvalPreview.unpaidDays > 0 && (
              <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm font-medium text-amber-800" role="alert">
                Warning: this request exceeds the available paid leave balance.
                If approved, {approvalPreview.unpaidDays} day(s) will be unpaid.
              </p>
            )}
            <section className="mt-5 rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-700">
                Scheduling conflicts
              </h3>
              {approvalConflicts.length === 0 ? (
                <p className="mt-2 text-sm text-emerald-700">
                  No scheduling conflicts detected.
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {approvalConflicts.map((conflict) => (
                    <li
                      key={`${approvalPreview.requestId}-${conflict.requestId}`}
                      className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900"
                    >
                      <span className="font-semibold">
                        {approvalPreview.employeeName} ({approvalRequest?.status || "Pending"}) ↔{" "}
                        {conflict.employeeName} ({conflict.status})
                      </span>
                      <span className="mt-1 block text-xs">
                        Overlapping dates: {formatDate(conflict.overlapStart)} –{" "}
                        {formatDate(conflict.overlapEnd)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {approvalConflicts.length > 0 && (
                <p className="mt-3 text-xs text-slate-600">
                  Conflicts are informational; approval or rejection remains an HR decision.
                </p>
              )}
            </section>
            <div className="mt-5">
              <h3 className="text-sm font-semibold text-slate-700">
                Remaining paid balance by leave type
              </h3>
              <div className="mt-2 max-h-40 space-y-2 overflow-y-auto">
                {approvalPreview.balances.map((balance) => (
                  <div
                    key={balance.policyId}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <span className="text-slate-600">{balance.leaveType}</span>
                    <span className="text-right">
                      <span className="block font-semibold text-slate-800">
                        {balance.remainingPaidDays} days remaining
                      </span>
                      <span className="text-xs text-slate-500">
                        Allowance {balance.annualAllowanceDays} · Carry{" "}
                        {balance.carriedForwardDays} · Used{" "}
                        {balance.approvedPaidDays}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={decidingId !== null}
                onClick={() => setApprovalPreview(null)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={decidingId !== null}
                onClick={confirmLeaveApproval}
                className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-50"
              >
                {decidingId !== null
                  ? "Approving..."
                  : `Approve (${approvalPreview.paidDays} paid, ${approvalPreview.unpaidDays} unpaid)`}
              </button>
            </div>
          </section>
        </div>
      )}
    </UserLayout>
  );
}

export default Leave;
