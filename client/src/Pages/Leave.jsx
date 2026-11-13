import { useEffect, useRef, useState } from "react";
import { CalendarDays, Check, FileText, Plus, Settings2, Users, X } from "lucide-react";
import UserLayout from "../layouts/UserLayout";
import { getUser } from "../utils/auth";
import { toast } from "react-toastify";
import {
  createLeavePolicy,
  getLeavePolicies,
  getLeaveRequests,
  updateLeaveStatus,
} from "../api/leaveApi";

const initialLeaveTypes = [
  { id: "annual", name: "Annual leave", days: 20, carryForward: 5 },
  { id: "casual", name: "Casual leave", days: 7, carryForward: 0 },
  { id: "medical", name: "Medical / sick leave", days: 14, carryForward: 0 },
  { id: "unpaid", name: "Unpaid leave", days: 0, carryForward: 0 },
];

const inputClassName =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

const formatDate = (date) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));

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
  const decidingRef = useRef(false);

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

  const updateRequestStatus = async (id, status) => {
    if (decidingRef.current) return;
    decidingRef.current = true;
    setDecidingId(id);
    try {
      const response = await updateLeaveStatus(id, status);
      setRequests((current) => current.map((request) => request.id === id ? response.data.data : request));
      toast.success(`Leave request ${status.toLowerCase()}`, { theme: "dark" });
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to update leave request.", { theme: "dark" });
    } finally {
      decidingRef.current = false;
      setDecidingId(null);
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
    </UserLayout>
  );
}

export default Leave;
