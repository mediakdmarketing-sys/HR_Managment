import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  FileText,
  Paperclip,
  Plus,
  Settings2,
  Users,
  X,
} from "lucide-react";
import UserLayout from "../layouts/UserLayout";
import { getUser } from "../utils/auth";
import { toast } from "react-toastify";
import {
  createLeaveRequest,
  getLeaveAttachment,
  getLeaveRequests,
  updateLeaveStatus,
} from "../api/leaveApi";

const initialLeaveTypes = [
  { id: "annual", name: "Annual leave", days: 20, carryForward: 5 },
  { id: "casual", name: "Casual leave", days: 7, carryForward: 0 },
  { id: "medical", name: "Medical / sick leave", days: 14, carryForward: 0 },
  { id: "unpaid", name: "Unpaid leave", days: 0, carryForward: 0 },
];

const initialForm = {
  type: "Annual leave",
  startDate: "",
  endDate: "",
  reason: "",
  attachment: "",
  attachmentData: "",
  attachmentMime: "",
};

const inputClassName =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

const formatDate = (date) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));

const daysBetween = (startDate, endDate) => {
  if (!startDate || !endDate) return 0;
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  return Math.max(0, Math.floor((end - start) / 86400000) + 1);
};

const statusClass = {
  Pending: "bg-amber-100 text-amber-700",
  Approved: "bg-emerald-100 text-emerald-700",
  Rejected: "bg-red-100 text-red-700",
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

const openAttachment = async (request) => {
  // Open the tab synchronously so popup blockers allow it, then load the file into it.
  const preview = window.open("", "_blank");
  try {
    const response = await getLeaveAttachment(request.id);
    const url = URL.createObjectURL(response.data);
    if (preview) preview.location.href = url;
    else window.location.assign(url);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch {
    preview?.close();
    toast.error("Unable to open attachment.", { theme: "dark" });
  }
};

const AttachmentLink = ({ request }) => {
  if (!request.attachment) return "None";
  if (!request.attachmentChunks && !request.attachmentPath)
    return request.attachment;
  return (
    <button
      type="button"
      onClick={() => openAttachment(request)}
      className="inline-flex items-center gap-1 font-semibold text-teal-700 hover:underline"
    >
      <Paperclip size={14} />
      {request.attachment}
    </button>
  );
};

function Leave() {
  const user = getUser();
  const isHr = user?.role?.toLowerCase() === "hr";
  const isTeamLead = user?.role === "Team Lead";
  const isManager = user?.role === "Manager";
  // Reviewers also submit their own leave: HR leave is reviewed by Managers.
  const isReviewer = isHr || isTeamLead || isManager;
  const currentEmployeeId = user?._id ?? user?.id;

  const [leaveTypes, setLeaveTypes] = useState(initialLeaveTypes);
  const [requests, setRequests] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState(initialForm);
  const [isRequestOpen, setIsRequestOpen] = useState(false);
  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const [newType, setNewType] = useState("");
  const [activeTab, setActiveTab] = useState("requests");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [decidingId, setDecidingId] = useState(null);
  // Refs block a second click that lands before React re-renders the disabled button.
  const submittingRef = useRef(false);
  const decidingRef = useRef(false);

  useEffect(() => {
    let active = true;
    const loadRequests = () =>
      getLeaveRequests()
        .then((response) => {
          if (active) setRequests(response.data.data);
        })
        .catch((error) => {
          if (active) {
            setLoadError(
              error.response?.data?.message || "Unable to load leave requests.",
            );
          }
        });
    loadRequests();
    // UserLayout fires this when a leave notification arrives, so statuses stay current.
    window.addEventListener("leave-notification", loadRequests);
    return () => {
      active = false;
      window.removeEventListener("leave-notification", loadRequests);
    };
  }, []);

  const employeeRequests = requests.filter(
    (request) => request.employeeId === currentEmployeeId,
  );
  const reviewRequests = requests.filter(
    (request) => request.employeeId !== currentEmployeeId,
  );
  const pendingRequests = reviewRequests.filter(
    (request) => request.status === "Pending",
  );
  const approvedDays = employeeRequests
    .filter((request) => request.status === "Approved")
    .reduce((total, request) => total + request.days, 0);
  const requestDays = daysBetween(form.startDate, form.endDate);

  const conflicts = useMemo(() => {
    return requests.filter(
      (request) =>
        request.status === "Approved" &&
        request.startDate <= form.endDate &&
        request.endDate >= form.startDate &&
        form.startDate &&
        form.endDate,
    );
  }, [form.endDate, form.startDate, requests]);

  const updateForm = (event) => {
    const { name, value, files } = event.target;
    if (!files) {
      setForm((current) => ({ ...current, [name]: value }));
      return;
    }

    const file = files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Attachment must be 5 MB or smaller", { theme: "dark" });
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((current) => ({
        ...current,
        attachment: file.name,
        attachmentData: String(reader.result).split(",")[1] || "",
        attachmentMime: file.type || "application/octet-stream",
      }));
    };
    reader.readAsDataURL(file);
  };

  const submitRequest = async (event) => {
    event.preventDefault();
    if (!form.startDate || !form.endDate || requestDays === 0) return;
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);

    try {
      const response = await createLeaveRequest({
        type: form.type,
        startDate: form.startDate,
        endDate: form.endDate,
        days: requestDays,
        reason: form.reason,
        attachment: form.attachment,
        attachmentData: form.attachmentData,
        attachmentMime: form.attachmentMime,
      });
      setRequests((current) => [response.data.data, ...current]);
      setForm(initialForm);
      setIsRequestOpen(false);
      toast.success("Leave request submitted successfully", { theme: "dark" });
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Unable to submit leave request.",
        { theme: "dark" },
      );
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const updateRequestStatus = async (id, status) => {
    if (decidingRef.current) return;
    decidingRef.current = true;
    setDecidingId(id);
    try {
      const response = await updateLeaveStatus(id, status);
      setRequests((current) =>
        current.map((request) =>
          request.id === id ? response.data.data : request,
        ),
      );
      toast.success(`Leave request ${status.toLowerCase()}`, { theme: "dark" });
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Unable to update leave request.",
        { theme: "dark" },
      );
    } finally {
      decidingRef.current = false;
      setDecidingId(null);
    }
  };

  const addLeaveType = (event) => {
    event.preventDefault();
    if (!newType.trim()) return;
    setLeaveTypes((current) => [
      ...current,
      {
        id: newType.toLowerCase().replace(/\s+/g, "-"),
        name: newType.trim(),
        days: 0,
        carryForward: 0,
      },
    ]);
    setNewType("");
    setIsTypeOpen(false);
  };

  return (
    <UserLayout>
      <div className="space-y-6">
        {loadError && (
          <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {loadError}
          </p>
        )}
        <section className="rounded-3xl bg-linear-to-r from-slate-900 to-teal-700 p-8 text-white shadow-lg">
          <p className="text-sm font-medium text-teal-200">
            {isHr ? "HR operations" : isReviewer ? "Team management" : "Employee self-service"}
          </p>
          <h1 className="mt-2 text-4xl font-bold">Leave Management</h1>
          <p className="mt-3 text-slate-200">
            {isHr
              ? "Review requests, manage leave policies and monitor team availability."
              : isManager
                ? "Review HR and team leave requests, and submit your own leave."
                : isTeamLead
                  ? "Review your team requests, approve leave and monitor team availability."
                  : "Request leave and track the status of your requests."}
          </p>
        </section>

        {isReviewer ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Pending requests"
                value={pendingRequests.length}
                detail="Waiting for review"
                icon={FileText}
                color="bg-amber-50 text-amber-700"
              />
              <StatCard
                label="Approved this month"
                value={
                  reviewRequests.filter((request) => request.status === "Approved")
                    .length
                }
                detail="Approved leave requests"
                icon={Check}
                color="bg-emerald-50 text-emerald-700"
              />
              <StatCard
                label="Employees on leave"
                value={
                  reviewRequests.filter(
                    (request) =>
                      request.status === "Approved" &&
                      request.startDate <= "2026-10-21" &&
                      request.endDate >= "2026-10-21",
                  ).length
                }
                detail="Based on today's mock calendar"
                icon={Users}
                color="bg-blue-50 text-blue-700"
              />
              <StatCard
                label="Leave types"
                value={leaveTypes.length}
                detail="Configured policies"
                icon={Settings2}
                color="bg-teal-50 text-teal-700"
              />
            </div>

            <div className="flex gap-2 border-b border-slate-200">
              {[
                ["requests", "Requests"],
                ["my-leave", "My leave"],
                ["calendar", "Team calendar"],
                ["policies", "Leave policies"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setActiveTab(value)}
                  className={`border-b-2 px-4 py-3 text-sm font-semibold ${activeTab === value ? "border-teal-700 text-teal-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {activeTab === "requests" && (
              <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70">
                <div className="flex items-center justify-between border-b border-slate-100 p-5">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">
                      {isHr
                        ? "Employee requests"
                        : isManager
                          ? "HR & team leave requests"
                          : "Team leave requests"}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {isHr
                        ? "Manager decision and HR review queue."
                        : isManager
                          ? "Approve or reject leave requests from HR and your assigned team."
                          : "Review leave requests from your assigned team."}
                    </p>
                  </div>
                  <FileText className="text-teal-600" size={22} />
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
                        <th className="px-5 py-4">Attachment</th>
                        <th className="px-5 py-4">Status</th>
                        <th className="px-5 py-4">Decision</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reviewRequests.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-500">
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
                            <p className="text-xs text-slate-500">
                              {request.id}
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
                          </td>
                          <td className="max-w-xs px-5 py-4 text-sm text-slate-600">
                            {request.reason || "—"}
                          </td>
                          <td className="px-5 py-4 text-sm text-slate-500">
                            <AttachmentLink request={request} />
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
                                  disabled={decidingId !== null}
                                  onClick={() =>
                                    updateRequestStatus(request.id, "Approved")
                                  }
                                  className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  disabled={decidingId !== null}
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
                <div className="space-y-3">
                  {requests
                    .filter((request) => request.status !== "Rejected")
                    .map((request) => (
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
                        </div>
                        <span className="text-sm font-medium text-teal-700">
                          {formatDate(request.startDate)} -{" "}
                          {formatDate(request.endDate)}
                        </span>
                      </div>
                    ))}
                </div>
                <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-700">
                  Conflict warning: review overlapping requests before approving
                  multiple team members for the same dates.
                </p>
              </section>
            )}

            {activeTab === "policies" && (
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
                    onClick={() => setIsTypeOpen(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
                  >
                    <Plus size={17} /> Add type
                  </button>
                </div>
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

            {activeTab === "my-leave" && (
              <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">
                      My leave requests
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Submit and track your own leave requests.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsRequestOpen(true)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800"
                  >
                    <Plus size={18} />
                    Request leave
                  </button>
                </div>
                <div className="mt-5 space-y-3">
                  {employeeRequests.length ? (
                    employeeRequests.map((request) => (
                      <div
                        key={request.id}
                        className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="font-semibold text-slate-800">
                            {request.type} · {request.days} day(s)
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            {formatDate(request.startDate)} -{" "}
                            {formatDate(request.endDate)} ·{" "}
                            {request.reason || "No reason provided"}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            Attachment: <AttachmentLink request={request} />
                          </p>
                        </div>
                        <span
                          className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusClass[request.status]}`}
                        >
                          {request.status}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">
                      No leave requests yet.
                    </p>
                  )}
                </div>
              </section>
            )}
          </>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Available annual leave"
                value="20 days"
                detail="Accrued this year"
                icon={CalendarDays}
                color="bg-teal-50 text-teal-700"
              />
              <StatCard
                label="Casual leave"
                value="7 days"
                detail="Available balance"
                icon={CalendarDays}
                color="bg-blue-50 text-blue-700"
              />
              <StatCard
                label="Approved days"
                value={approvedDays}
                detail="Used from approved requests"
                icon={Check}
                color="bg-emerald-50 text-emerald-700"
              />
              <StatCard
                label="Pending requests"
                value={
                  employeeRequests.filter(
                    (request) => request.status === "Pending",
                  ).length
                }
                detail="Waiting for a decision"
                icon={FileText}
                color="bg-amber-50 text-amber-700"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setIsRequestOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800"
              >
                <Plus size={18} /> Request leave
              </button>
            </div>
            <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">
                    My leave history
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Your requests, decisions and attachments.
                  </p>
                </div>
                <FileText className="text-teal-600" size={22} />
              </div>
              <div className="space-y-3">
                {employeeRequests.length ? (
                  employeeRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-semibold text-slate-800">
                          {request.type} · {request.days} day(s)
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {formatDate(request.startDate)} -{" "}
                          {formatDate(request.endDate)} ·{" "}
                          {request.reason || "No reason provided"}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          Attachment: <AttachmentLink request={request} />
                        </p>
                      </div>
                      <span
                        className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusClass[request.status]}`}
                      >
                        {request.status}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">
                    No leave requests yet.
                  </p>
                )}
              </div>
            </section>
          </>
        )}
      </div>

      {isRequestOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">
                  Request leave
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Submit your request for manager review.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsRequestOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
                aria-label="Close leave request"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={submitRequest} className="space-y-4">
              <label className="block text-sm font-semibold text-slate-700">
                Leave type
                <select
                  required
                  name="type"
                  value={form.type}
                  onChange={updateForm}
                  className={inputClassName}
                >
                  {leaveTypes.map((type) => (
                    <option key={type.id}>{type.name}</option>
                  ))}
                </select>
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Start date
                  <input
                    required
                    type="date"
                    name="startDate"
                    value={form.startDate}
                    onChange={updateForm}
                    className={inputClassName}
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  End date
                  <input
                    required
                    type="date"
                    name="endDate"
                    value={form.endDate}
                    min={form.startDate}
                    onChange={updateForm}
                    className={inputClassName}
                  />
                </label>
              </div>
              <p className="text-sm text-slate-500">
                Requested duration:{" "}
                <span className="font-semibold text-slate-700">
                  {requestDays} day(s)
                </span>
              </p>
              {conflicts.length > 0 && (
                <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-700">
                  Conflict warning: an approved leave already overlaps these
                  dates.
                </p>
              )}
              <label className="block text-sm font-semibold text-slate-700">
                Reason
                <textarea
                  required
                  name="reason"
                  value={form.reason}
                  onChange={updateForm}
                  rows="3"
                  className={inputClassName}
                  placeholder="Reason for leave"
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Attachment{" "}
                <span className="font-normal text-slate-400">(optional)</span>
                <input
                  type="file"
                  name="attachment"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={updateForm}
                  className={`${inputClassName} file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2`}
                />
              </label>
              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsRequestOpen(false)}
                  className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-wait disabled:opacity-60"
                >
                  {isSubmitting ? "Submitting..." : "Submit request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isTypeOpen && (
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
                onClick={() => setIsTypeOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
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
              className="mt-5 w-full rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800"
            >
              Add leave type
            </button>
          </form>
        </div>
      )}
    </UserLayout>
  );
}

export default Leave;
