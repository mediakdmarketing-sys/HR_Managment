/**
 * WorkReportSection — Monthly Work Reports UI
 * Rendered inside EmployeeDetails.jsx for HR users.
 */
import { useState, useEffect, useCallback } from "react";
import {
  FileText, Plus, ChevronDown, ChevronUp, Send, CheckCircle,
  XCircle, AlertCircle, Clock, Edit2, Trash2, RefreshCw
} from "lucide-react";
import { toast } from "react-toastify";
import {
  getWorkReports,
  createWorkReport,
  updateWorkReport,
  submitWorkReport,
  reviewWorkReport,
  deleteWorkReport,
} from "../api/workReportApi";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const STATUS_CONFIG = {
  Draft:         { color: "bg-slate-100 text-slate-600",   icon: Edit2 },
  Submitted:     { color: "bg-blue-100 text-blue-700",     icon: Send },
  "Under Review":{ color: "bg-amber-100 text-amber-700",   icon: Clock },
  Approved:      { color: "bg-emerald-100 text-emerald-700", icon: CheckCircle },
  "Needs Revision": { color: "bg-red-100 text-red-700",   icon: AlertCircle },
};

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - i);

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.Draft;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.color}`}>
      <Icon size={12} />
      {status}
    </span>
  );
}

function ReportCard({ report, employeeId, onRefresh }) {
  const [expanded, setExpanded] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [reviewStatus, setReviewStatus] = useState("Approved");
  const [reviewComments, setReviewComments] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    summary: report.summary || "",
    tasksCompleted: report.tasksCompleted || "",
    projectsWorkedOn: report.projectsWorkedOn || "",
    challengesFaced: report.challengesFaced || "",
    goalsNextMonth: report.goalsNextMonth || "",
    hoursWorked: report.hoursWorked || "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editForm.summary.trim()) {
      toast.error("Summary is required.", { theme: "dark" });
      return;
    }
    setSavingEdit(true);
    try {
      await updateWorkReport(report.id, editForm);
      toast.success("Work report updated.", { theme: "dark" });
      setIsEditing(false);
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update report.", { theme: "dark" });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleSubmit = async () => {
    if (!confirm("Submit this report for HR review?")) return;
    try {
      await submitWorkReport(report.id);
      toast.success("Report submitted.", { theme: "dark" });
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit.", { theme: "dark" });
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this draft report?")) return;
    try {
      await deleteWorkReport(report.id);
      toast.success("Report deleted.", { theme: "dark" });
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete.", { theme: "dark" });
    }
  };

  const handleReview = async () => {
    try {
      await reviewWorkReport(report.id, { status: reviewStatus, reviewComments });
      toast.success(`Report marked as ${reviewStatus}.`, { theme: "dark" });
      setReviewing(false);
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || "Review failed.", { theme: "dark" });
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((x) => !x)}
        className="flex w-full items-center justify-between gap-4 p-4 text-left hover:bg-slate-50 transition"
      >
        <div className="flex items-center gap-3">
          <FileText className="text-teal-600 shrink-0" size={18} />
          <div>
            <p className="font-semibold text-slate-800 text-sm">
              {MONTHS[report.month - 1]} {report.year}
            </p>
            {report.hoursWorked && (
              <p className="text-xs text-slate-500">{report.hoursWorked}h worked</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={report.status} />
          {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </div>
      </button>

      {/* Body */}
      {expanded && (
        <div className="border-t border-slate-100 p-4 space-y-4">
          {[
            ["Summary", report.summary],
            ["Tasks Completed", report.tasksCompleted],
            ["Projects Worked On", report.projectsWorkedOn],
            ["Challenges Faced", report.challengesFaced],
            ["Goals for Next Month", report.goalsNextMonth],
          ].map(([label, val]) =>
            val ? (
              <div key={label}>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">{label}</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{val}</p>
              </div>
            ) : null
          )}

          {report.reviewComments && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
              <p className="text-xs font-semibold text-amber-700 mb-1">HR Review Comments</p>
              <p className="text-sm text-amber-800">{report.reviewComments}</p>
              {report.reviewedBy && (
                <p className="mt-1 text-xs text-amber-600">By {report.reviewedBy} · {new Date(report.reviewedAt).toLocaleDateString()}</p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
            {["Draft", "Needs Revision"].includes(report.status) && (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditing((x) => !x)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
                >
                  <Edit2 size={12} /> {isEditing ? "Cancel Edit" : "Edit Report"}
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 transition"
                >
                  <Send size={12} /> Submit for Review
                </button>
                {report.status === "Draft" && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition"
                  >
                    <Trash2 size={12} /> Delete Draft
                  </button>
                )}
              </>
            )}
            {["Submitted", "Under Review"].includes(report.status) && (
              <button
                type="button"
                onClick={() => setReviewing((x) => !x)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition"
              >
                <CheckCircle size={12} /> Review / Approve
              </button>
            )}
          </div>

          {/* Edit Form */}
          {isEditing && (
            <form onSubmit={handleSaveEdit} className="rounded-xl border border-teal-200 bg-teal-50/40 p-4 space-y-3">
              <p className="text-sm font-semibold text-slate-700">Edit Work Report</p>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Summary *</label>
                <textarea
                  value={editForm.summary}
                  onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })}
                  className="min-h-16 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 bg-white"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Tasks Completed</label>
                <textarea
                  value={editForm.tasksCompleted}
                  onChange={(e) => setEditForm({ ...editForm, tasksCompleted: e.target.value })}
                  className="min-h-16 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Projects Worked On</label>
                <textarea
                  value={editForm.projectsWorkedOn}
                  onChange={(e) => setEditForm({ ...editForm, projectsWorkedOn: e.target.value })}
                  className="min-h-16 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Challenges Faced</label>
                <textarea
                  value={editForm.challengesFaced}
                  onChange={(e) => setEditForm({ ...editForm, challengesFaced: e.target.value })}
                  className="min-h-16 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Goals for Next Month</label>
                <textarea
                  value={editForm.goalsNextMonth}
                  onChange={(e) => setEditForm({ ...editForm, goalsNextMonth: e.target.value })}
                  className="min-h-16 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Hours Worked</label>
                <input
                  type="number"
                  min={0}
                  max={744}
                  value={editForm.hoursWorked}
                  onChange={(e) => setEditForm({ ...editForm, hoursWorked: e.target.value })}
                  className="w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 bg-white"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50 transition"
                >
                  {savingEdit ? "Saving..." : "Save Changes"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="rounded-lg bg-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-300 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Review Form */}
          {reviewing && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <p className="text-sm font-semibold text-slate-700">HR Review</p>
              <select
                value={reviewStatus}
                onChange={(e) => setReviewStatus(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500"
              >
                <option value="Under Review">Mark as Under Review</option>
                <option value="Approved">Approve</option>
                <option value="Needs Revision">Request Revision</option>
              </select>
              <textarea
                value={reviewComments}
                onChange={(e) => setReviewComments(e.target.value)}
                placeholder="Optional feedback / comments..."
                className="min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
              <div className="flex gap-2">
                <button type="button" onClick={handleReview}
                  className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 transition">
                  Confirm Review
                </button>
                <button type="button" onClick={() => setReviewing(false)}
                  className="rounded-lg bg-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-300 transition">
                  Cancel
                </button>
              </div>
            </div>
          )}

          <p className="text-xs text-slate-400">
            Created by {report.createdBy} · {new Date(report.createdAt).toLocaleDateString()}
            {report.updatedAt !== report.createdAt && ` · Updated ${new Date(report.updatedAt).toLocaleDateString()}`}
          </p>
        </div>
      )}
    </div>
  );
}

function CreateReportForm({ employeeId, employeeName, onCreated, onCancel }) {
  const thisMonth = new Date().getMonth() + 1;
  const thisYear = new Date().getFullYear();

  const [form, setForm] = useState({
    month: thisMonth,
    year: thisYear,
    summary: "",
    tasksCompleted: "",
    projectsWorkedOn: "",
    challengesFaced: "",
    goalsNextMonth: "",
    hoursWorked: "",
  });
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.summary.trim()) {
      toast.error("Summary is required.", { theme: "dark" });
      return;
    }
    try {
      setSaving(true);
      await createWorkReport({ ...form, employeeId, employeeName, month: Number(form.month), year: Number(form.year) });
      toast.success("Work report created.", { theme: "dark" });
      onCreated();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create report.", { theme: "dark" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-teal-200 bg-teal-50/40 p-5 space-y-4">
      <p className="font-semibold text-slate-800 text-sm">New Monthly Work Report</p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Month *</label>
          <select value={form.month} onChange={set("month")}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 bg-white">
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Year *</label>
          <select value={form.year} onChange={set("year")}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 bg-white">
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {[
        ["summary", "Summary *", "Overall performance and achievements this month..."],
        ["tasksCompleted", "Tasks Completed", "List the main tasks completed..."],
        ["projectsWorkedOn", "Projects Worked On", "Project names and your contributions..."],
        ["challengesFaced", "Challenges Faced", "Any blockers, issues or difficulties..."],
        ["goalsNextMonth", "Goals for Next Month", "What you plan to focus on..."],
      ].map(([key, label, placeholder]) => (
        <div key={key}>
          <label className="block text-xs font-semibold text-slate-500 mb-1">{label}</label>
          <textarea
            value={form[key]}
            onChange={set(key)}
            placeholder={placeholder}
            required={key === "summary"}
            className="min-h-16 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 bg-white"
          />
        </div>
      ))}

      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Hours Worked</label>
        <input
          type="number"
          min={0}
          max={744}
          value={form.hoursWorked}
          onChange={set("hoursWorked")}
          placeholder="e.g. 176"
          className="w-40 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 bg-white"
        />
      </div>

      <div className="flex gap-2 pt-2 border-t border-slate-100">
        <button type="submit" disabled={saving}
          className="rounded-xl bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50 transition">
          {saving ? "Saving..." : "Save Draft"}
        </button>
        <button type="button" onClick={onCancel}
          className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 transition">
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function WorkReportSection({ employeeId, employeeName }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getWorkReports({
        employeeId,
        month: filterMonth || undefined,
        year: filterYear || undefined,
      });
      setReports(res.data?.data || []);
    } catch (err) {
      toast.error("Failed to load work reports.", { theme: "dark" });
    } finally {
      setLoading(false);
    }
  }, [employeeId, filterMonth, filterYear]);

  useEffect(() => { load(); }, [load]);

  return (
    <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200/70 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="text-teal-600" size={22} />
            <h2 className="text-2xl font-bold text-slate-800">Monthly Work Reports</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">Track monthly performance, goals and HR review workflow.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((x) => !x)}
          className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 transition"
        >
          <Plus size={16} /> New Report
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <CreateReportForm
          employeeId={employeeId}
          employeeName={employeeName}
          onCreated={() => { setShowCreate(false); load(); }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500"
        >
          <option value="">All Months</option>
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select
          value={filterYear}
          onChange={(e) => setFilterYear(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500"
        >
          <option value="">All Years</option>
          {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <button type="button" onClick={load}
          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Report List */}
      {loading ? (
        <p className="text-sm text-slate-500">Loading reports...</p>
      ) : reports.length === 0 ? (
        <div className="rounded-2xl bg-slate-50 py-10 text-center">
          <FileText className="mx-auto text-slate-300 mb-3" size={40} />
          <p className="text-sm text-slate-500">No work reports found for this employee.</p>
          <button type="button" onClick={() => setShowCreate(true)}
            className="mt-3 text-sm text-teal-700 font-semibold hover:underline">
            Create the first report
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <ReportCard key={r.id} report={r} employeeId={employeeId} onRefresh={load} />
          ))}
        </div>
      )}
    </section>
  );
}
