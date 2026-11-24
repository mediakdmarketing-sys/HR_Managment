/**
 * IdentityDocSection — Aadhaar / NIC / Passport identity document management
 * Rendered inside EmployeeDetails.jsx for HR users only.
 * Full number reveal uses PasswordConfirmDialog (same pattern as AccountNumber).
 */
import { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck, Plus, Eye, EyeOff, Download, Trash2,
  CheckCircle, XCircle, Clock, Upload, X
} from "lucide-react";
import { toast } from "react-toastify";
import {
  getIdentityDocs,
  addIdentityDoc,
  getFullIdentityNumber,
  getIdentityDocDownloadUrl,
  updateIdentityVerification,
  deleteIdentityDoc,
} from "../api/identityDocApi";
import PasswordConfirmDialog from "./PasswordConfirmDialog";

const DOC_TYPES = {
  IN: { label: "Aadhaar Card", code: "IN", placeholder: "12-digit Aadhaar number" },
  LK: { label: "NIC (National ID)", code: "LK", placeholder: "9V / 9X / 12-digit NIC" },
  OTHER: { label: "Passport / Other ID", code: "OTHER", placeholder: "Document number" },
};

const VERIFY_STATUS_CONFIG = {
  Pending:  { color: "bg-amber-100 text-amber-700",   icon: Clock },
  Verified: { color: "bg-emerald-100 text-emerald-700", icon: CheckCircle },
  Rejected: { color: "bg-red-100 text-red-700",       icon: XCircle },
};

function VerifyBadge({ status }) {
  const cfg = VERIFY_STATUS_CONFIG[status] || VERIFY_STATUS_CONFIG.Pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${cfg.color}`}>
      <Icon size={11} /> {status}
    </span>
  );
}

function DocCard({ doc, employeeId, onRefresh }) {
  const [fullNumber, setFullNumber] = useState(null);
  const [revealing, setRevealing] = useState(false);
  const [timer, setTimer] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const handleReveal = async () => {
    try {
      const res = await getFullIdentityNumber(employeeId, doc.id);
      setFullNumber(res.data.data.fullNumber);
      const t = setTimeout(() => setFullNumber(null), 60000);
      setTimer(t);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to reveal number.", { theme: "dark" });
    }
    setRevealing(false);
  };

  useEffect(() => () => { if (timer) clearTimeout(timer); }, [timer]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await getIdentityDocDownloadUrl(employeeId, doc.id);
      window.open(res.data.data.url, "_blank");
    } catch (err) {
      toast.error("Failed to get download link.", { theme: "dark" });
    } finally {
      setDownloading(false);
    }
  };

  const handleVerify = async (status) => {
    try {
      await updateIdentityVerification(employeeId, doc.id, status);
      toast.success(`Marked as ${status}.`, { theme: "dark" });
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update.", { theme: "dark" });
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this identity document?")) return;
    try {
      await deleteIdentityDoc(employeeId, doc.id);
      toast.success("Identity document deleted.", { theme: "dark" });
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete.", { theme: "dark" });
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">{doc.typeLabel}</p>

          {/* Masked / Revealed Number */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-slate-800 text-sm tracking-wider">
              {fullNumber || doc.maskedNumber || "—"}
            </span>
            {doc.maskedNumber && (
              <button
                type="button"
                onClick={() => { if (fullNumber) { setFullNumber(null); clearTimeout(timer); } else setRevealing(true); }}
                title={fullNumber ? "Hide number" : "Reveal full number"}
                className="text-slate-400 hover:text-teal-600 transition"
              >
                {fullNumber ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            )}
          </div>
          {fullNumber && <p className="text-xs text-amber-600 mt-0.5">Auto-hides in 60 seconds</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <VerifyBadge status={doc.verificationStatus} />

          {/* HR: quick verify/reject buttons */}
          {doc.verificationStatus === "Pending" && (
            <>
              <button type="button" onClick={() => handleVerify("Verified")}
                className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition">
                Verify
              </button>
              <button type="button" onClick={() => handleVerify("Rejected")}
                className="rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-100 transition">
                Reject
              </button>
            </>
          )}

          {doc.hasDocument && (
            <button type="button" onClick={handleDownload} disabled={downloading}
              className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200 transition inline-flex items-center gap-1">
              <Download size={12} /> {downloading ? "..." : "View Doc"}
            </button>
          )}

          <button type="button" onClick={handleDelete}
            className="rounded-lg bg-red-50 p-1.5 text-red-500 hover:bg-red-100 transition">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <p className="mt-2 text-xs text-slate-400">
        Added by {doc.uploadedBy} · {new Date(doc.uploadedAt).toLocaleDateString()}
      </p>

      {/* Password confirm dialog for reveal */}
      {revealing && (
        <PasswordConfirmDialog
          description="Re-enter your password to view the full identity number."
          onClose={() => setRevealing(false)}
          onConfirmed={handleReveal}
        />
      )}
    </div>
  );
}

function AddDocModal({ employeeId, countryCode, onAdded, onClose }) {
  const [form, setForm] = useState({
    type: countryCode === "IN" ? "IN" : countryCode === "LK" ? "LK" : "OTHER",
    fullNumber: "",
  });
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.fullNumber.trim()) {
      toast.error("Identity number is required.", { theme: "dark" });
      return;
    }
    try {
      setSaving(true);
      let fileBase64 = null;
      let fileName = null;
      let fileContentType = null;
      if (file) {
        fileBase64 = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result);
          r.onerror = rej;
          r.readAsDataURL(file);
        });
        fileName = file.name;
        fileContentType = file.type;
      }
      await addIdentityDoc(employeeId, { ...form, fileBase64, fileName, fileContentType });
      toast.success("Identity document added.", { theme: "dark" });
      onAdded();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add document.", { theme: "dark" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl ring-1 ring-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <h3 className="text-lg font-bold text-slate-800">Add Identity Document</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Document Type *</label>
            <select value={form.type} onChange={set("type")}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500">
              {Object.entries(DOC_TYPES).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Document Number *</label>
            <input
              type="text"
              value={form.fullNumber}
              onChange={set("fullNumber")}
              placeholder={DOC_TYPES[form.type]?.placeholder || "ID number"}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono outline-none focus:border-teal-500"
              required
            />
            <p className="mt-1 text-xs text-slate-400">This number will be masked for display. Only the last 4 digits will be visible.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Document Image / Scan (optional)</label>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
            />
          </div>

          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <button type="submit" disabled={saving}
              className="rounded-xl bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50 transition">
              {saving ? "Saving..." : "Save Identity Doc"}
            </button>
            <button type="button" onClick={onClose}
              className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 transition">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function IdentityDocSection({ employeeId, countryCode }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getIdentityDocs(employeeId);
      setDocs(res.data?.data || []);
    } catch (err) {
      toast.error("Failed to load identity documents.", { theme: "dark" });
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => { load(); }, [load]);

  return (
    <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200/70 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-teal-600" size={22} />
            <h2 className="text-2xl font-bold text-slate-800">Identity Documents</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {countryCode === "IN" ? "Aadhaar / PAN" : countryCode === "LK" ? "NIC" : "Passport / ID"} · Numbers are masked. Full reveal requires password re-entry.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 transition"
        >
          <Plus size={16} /> Add Identity Doc
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading...</p>
      ) : docs.length === 0 ? (
        <div className="rounded-2xl bg-slate-50 py-8 text-center">
          <ShieldCheck className="mx-auto text-slate-300 mb-3" size={36} />
          <p className="text-sm text-slate-500">No identity documents on file.</p>
          <button type="button" onClick={() => setShowAdd(true)}
            className="mt-2 text-sm text-teal-700 font-semibold hover:underline">
            Add first document
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {docs.map((doc) => (
            <DocCard key={doc.id} doc={doc} employeeId={employeeId} onRefresh={load} />
          ))}
        </div>
      )}

      {showAdd && (
        <AddDocModal
          employeeId={employeeId}
          countryCode={countryCode}
          onAdded={() => { setShowAdd(false); load(); }}
          onClose={() => setShowAdd(false)}
        />
      )}
    </section>
  );
}
