import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Landmark,
  LockKeyhole,
  FileText,
  Upload,
  Trash2,
  Download,
  ShieldCheck,
  Plus,
  X,
  Folder,
  Calendar,
  Tag,
  Clock,
  Eye,
} from "lucide-react";
import { toast } from "react-toastify";
import { useNavigate, useParams } from "react-router-dom";
import UserLayout from "../layouts/UserLayout";
import {
  getAccountNumber,
  getUserById,
  getEmployeeDocuments,
  uploadEmployeeDocument,
  deleteEmployeeDocument,
} from "../api/userApi";
import PasswordConfirmDialog from "../components/PasswordConfirmDialog";
import { getUser } from "../utils/auth";
import { isEmployeeBankDetailsComplete } from "../utils/bank";
import WorkReportSection from "../components/WorkReportSection";
import IdentityDocSection from "../components/IdentityDocSection";

const DOCUMENT_CATEGORIES = [
  "CV / Resume",
  "Offer Letter",
  "Employment Contract",
  "Salary Slips",
  "Bank Details / Proof",
  "Service / Experience Letters",
  "Other HR Documents",
];

const fields = [
  ["name", "Name"],
  ["email", "Company Email"],
  ["role", "Role"],
  ["department", "Department"],
  ["status", "Status"],
  ["assignedTeamLead", "Assigned team lead"],
  ["personalEmail", "Personal email"],
  ["phone", "Phone number"],
  ["dateOfBirth", "Date of birth"],
];

const formatValue = (key, value) => {
  if (!value) return "—";
  if (key === "dateOfBirth") {
    return new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric" }).format(
      new Date(`${value}T00:00:00`),
    );
  }
  return value;
};

const REVEAL_SECONDS = 60;

// Masked by default. Clicking it always asks for the viewer's password first (the server also
// checks the login is recent); the full number goes back to masked after a minute.
const AccountNumber = ({ employeeId, masked }) => {
  const [fullNumber, setFullNumber] = useState(null);
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    if (!fullNumber) return undefined;
    const timer = window.setTimeout(() => setFullNumber(null), REVEAL_SECONDS * 1000);
    return () => window.clearTimeout(timer);
  }, [fullNumber]);

  if (!masked) return <p className="mt-2 font-medium text-slate-800">—</p>;
  if (fullNumber) return <p className="mt-2 font-mono font-medium tracking-wider text-slate-800">{fullNumber}</p>;
  return (
    <>
      <button
        type="button"
        onClick={() => setIsConfirming(true)}
        title="Enter your password to see the full number"
        className="mt-2 inline-flex items-center gap-2 rounded-lg font-mono font-medium tracking-wider text-slate-800 transition hover:text-teal-700"
      >
        {masked}
        <LockKeyhole className="text-slate-400" size={15} />
      </button>
      {isConfirming && (
        <PasswordConfirmDialog
          description="Re-enter your password to view this account number."
          onClose={() => setIsConfirming(false)}
          onConfirmed={async () => {
            try {
              const response = await getAccountNumber(employeeId);
              setFullNumber(response.data.data.accountNumber);
            } catch (error) {
              toast.error(error.response?.data?.message || "Unable to show the account number.", { theme: "dark" });
            }
            setIsConfirming(false);
          }}
        />
      )}
    </>
  );
};

export default function EmployeeDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);
  const [error, setError] = useState("");
  const viewer = getUser();
  // The server only sends bank details to HR and to the employee themselves.
  const canSeeBank = viewer?.role === "HR" || (viewer?._id ?? viewer?.id) === id;

  // Personnel File State
  const [documents, setDocuments] = useState([]);
  const [docLoading, setDocLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadCategory, setUploadCategory] = useState(DOCUMENT_CATEGORIES[0]);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadNotes, setUploadNotes] = useState("");
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const loadDocuments = async () => {
    try {
      setDocLoading(true);
      const res = await getEmployeeDocuments(id);
      setDocuments(res.data?.data || []);
    } catch (err) {
      console.error("Failed to load documents:", err);
    } finally {
      setDocLoading(false);
    }
  };

  useEffect(() => {
    if (viewer?.role === "HR") {
      loadDocuments();
    }
  }, [id, viewer?.role]);

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!uploadTitle.trim() || !uploadCategory) {
      toast.error("Please provide a document title and select a category.", { theme: "dark" });
      return;
    }

    try {
      setUploading(true);
      let fileData = null;
      let fileName = uploadTitle.trim();
      let fileType = "application/pdf";
      let fileSize = 0;

      if (uploadFile) {
        fileName = uploadFile.name;
        fileType = uploadFile.type || "application/octet-stream";
        fileSize = uploadFile.size;
        fileData = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(uploadFile);
        });
      }

      await uploadEmployeeDocument(id, {
        category: uploadCategory,
        title: uploadTitle.trim(),
        fileName,
        fileType,
        fileData,
        fileSize,
        notes: uploadNotes.trim(),
      });

      toast.success("Document uploaded to personnel file.", { theme: "dark" });
      setIsUploadOpen(false);
      setUploadTitle("");
      setUploadNotes("");
      setUploadFile(null);
      loadDocuments();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to upload document.", { theme: "dark" });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (docId) => {
    if (!window.confirm("Are you sure you want to delete this document from the personnel file?")) return;
    try {
      await deleteEmployeeDocument(id, docId);
      toast.success("Document removed.", { theme: "dark" });
      loadDocuments();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete document.", { theme: "dark" });
    }
  };

  const filteredDocs = activeCategory === "All"
    ? documents
    : documents.filter((d) => d.category === activeCategory);

  useEffect(() => {
    getUserById(id)
      .then((response) => setEmployee(response.data.data))
      .catch((requestError) =>
        setError(requestError.response?.data?.message || "Unable to load employee."),
      );
  }, [id]);

  return (
    <UserLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        <button
          type="button"
          onClick={() => navigate("/employees")}
          className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-teal-700"
        >
          <ArrowLeft size={18} /> Back to employees
        </button>
        <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200/70">
          <h1 className="text-3xl font-bold text-slate-800">Employee details</h1>
          {error && <p className="mt-6 text-red-600">{error}</p>}
          {!employee && !error && <p className="mt-6 text-slate-500">Loading...</p>}
          {employee && (
            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              {fields.map(([key, label]) => (
                <div key={key} className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                  <p className="mt-2 font-medium text-slate-800">{formatValue(key, employee[key])}</p>
                </div>
              ))}
              {canSeeBank && (
                <>
                  <div className="flex items-center gap-2 border-t border-slate-200 pt-5 sm:col-span-2">
                    <Landmark className="text-teal-600" size={18} />
                    <h2 className="text-lg font-bold text-slate-800">Bank details</h2>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Country of employment</p>
                    <p className="mt-2 font-medium text-slate-800">{employee.countryOfEmployment || "—"}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bank name</p>
                    <p className="mt-2 font-medium text-slate-800">{employee.bankName || "—"}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Account holder</p>
                    <p className="mt-2 font-medium text-slate-800">{employee.accountHolderName || "—"}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Account number</p>
                    <AccountNumber employeeId={id} masked={employee.accountNumberMasked} />
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bank branch</p>
                    <p className="mt-2 font-medium text-slate-800">{employee.bankBranch || "—"}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {employee.countryCode === "IN" ? "IFSC code" : "Branch code"}
                    </p>
                    <p className="mt-2 font-medium text-slate-800">
                      {employee.countryCode === "IN"
                        ? employee.ifscCode || "—"
                        : employee.bankBranchCode || "—"}
                    </p>
                  </div>
                  {!isEmployeeBankDetailsComplete(employee) && (
                    <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800 sm:col-span-2">
                      Bank details are incomplete. HR should review and complete the required fields.
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </section>

        {/* ========================================== */}
        {/* Secure Personnel File & Document Repository */}
        {/* ========================================== */}
        {viewer?.role === "HR" && (
          <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200/70 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="text-teal-600" size={22} />
                  <h2 className="text-2xl font-bold text-slate-800">Personnel File & Documents</h2>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Confidential employee records repository · Restricted to authorized HR personnel.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsUploadOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 transition"
              >
                <Plus size={16} /> Upload Document
              </button>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveCategory("All")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  activeCategory === "All"
                    ? "bg-teal-700 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                All Documents ({documents.length})
              </button>
              {DOCUMENT_CATEGORIES.map((cat) => {
                const count = documents.filter((d) => d.category === cat).length;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      activeCategory === cat
                        ? "bg-teal-700 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {cat} ({count})
                  </button>
                );
              })}
            </div>

            {/* Document List */}
            {docLoading ? (
              <p className="py-8 text-center text-sm text-slate-400">Loading personnel documents...</p>
            ) : filteredDocs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center">
                <Folder className="mx-auto h-10 w-10 text-slate-300" />
                <p className="mt-2 text-sm font-medium text-slate-600">No documents found in this category</p>
                <p className="text-xs text-slate-400 mt-0.5">Click "Upload Document" to add verified employee records.</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {filteredDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50/50 p-4 hover:border-teal-300 hover:bg-white transition"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <FileText className="text-teal-600 shrink-0" size={18} />
                          <h4 className="font-semibold text-slate-800 text-sm leading-snug">{doc.title}</h4>
                        </div>
                        <span className="shrink-0 rounded-full bg-slate-200/70 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                          v{doc.version || 1}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded-md bg-teal-50 px-2 py-0.5 font-medium text-teal-700 border border-teal-200">
                          {doc.category}
                        </span>
                        {doc.fileSize > 0 && (
                          <span className="text-slate-400">
                            {(doc.fileSize / 1024).toFixed(1)} KB
                          </span>
                        )}
                      </div>
                      {doc.notes && (
                        <p className="text-xs text-slate-500 italic mt-1 line-clamp-2">{doc.notes}</p>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-200/70 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                        <Clock size={12} />
                        <span>{doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : "Recent"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {(doc.fileData || doc.downloadUrl) && (
                          <a
                            href={doc.downloadUrl || doc.fileData}
                            download={!doc.downloadUrl ? (doc.fileName || "document") : undefined}
                            target={doc.downloadUrl ? "_blank" : undefined}
                            rel={doc.downloadUrl ? "noopener noreferrer" : undefined}
                            className="inline-flex items-center gap-1 font-semibold text-teal-700 hover:text-teal-800"
                            title="Download document"
                          >
                            <Download size={14} /> Download
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteDocument(doc.id)}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Delete document"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ==========================================
            Identity Documents Section
            ========================================== */}
        {viewer?.role === "HR" && employee && (
          <IdentityDocSection
            employeeId={id}
            countryCode={employee.countryCode}
          />
        )}

        {/* ==========================================
            Monthly Work Reports Section
            ========================================== */}
        {viewer?.role === "HR" && employee && (
          <WorkReportSection
            employeeId={id}
            employeeName={employee.name}
          />
        )}

        {/* Upload Modal */}
        {isUploadOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl ring-1 ring-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <h3 className="text-lg font-bold text-slate-800">Upload Personnel Document</h3>
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  className="rounded-lg p-1 text-slate-400 hover:text-slate-600"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleFileUpload} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Document Category *
                  </label>
                  <select
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500"
                  >
                    {DOCUMENT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Document Title *
                  </label>
                  <input
                    type="text"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="e.g. Signed Employment Contract 2026"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    File Attachment (PDF, DOC, DOCX, Image)
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Notes / Version Remarks
                  </label>
                  <textarea
                    value={uploadNotes}
                    onChange={(e) => setUploadNotes(e.target.value)}
                    placeholder="Optional details about this document version..."
                    className="min-h-16 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsUploadOpen(false)}
                    className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploading}
                    className="rounded-xl bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                  >
                    {uploading ? "Uploading..." : "Save Document"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </UserLayout>
  );
}
