/**
 * PersonnelBulkImport — Excel/CSV bulk import with preview and validation.
 * Uses the existing /api/users/import CSV endpoint (server/services/employeeDirectoryPersistence.js).
 */
import { useState, useRef } from "react";
import { Upload, Download, FileSpreadsheet, CheckCircle, XCircle, AlertCircle, X } from "lucide-react";
import { toast } from "react-toastify";
import { importEmployeesCsv } from "../api/userApi";

const CSV_TEMPLATE_HEADERS = [
  "employeeId", "name", "email", "role", "department",
  "countryOfEmployment", "countryCode", "phone", "personalEmail",
  "dateOfBirth", "nationalId", "bankName", "accountHolderName",
  "accountNumber", "bankBranch", "bankBranchCode", "ifscCode",
  "joiningDate", "designation", "assignedTeamLead", "title", "address",
  "city", "country", "postalCode", "pinCode",
];

function downloadTemplateCsv() {
  const header = CSV_TEMPLATE_HEADERS.join(",");
  const example = [
    "EMP099", "John Smith", "john.smith@company.com", "Developer", "Engineering",
    "India", "IN", "+91-9876543210", "john.personal@gmail.com",
    "1990-05-15", "", "HDFC Bank", "John Smith", "1234567890",
    "MG Road Branch", "", "HDFC0001234",
    "2024-01-10", "Senior Developer", "", "Mr", "123 Main St",
    "Bangalore", "India", "", "560001",
  ].join(",");
  const csv = `${header}\n${example}\n`;
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "employee_import_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows = lines.slice(1).map((line, idx) => {
    const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const row = {};
    headers.forEach((h, i) => { row[h] = values[i] || ""; });
    const errors = [];
    if (!row.name) errors.push("Missing name");
    if (!row.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) errors.push("Invalid email");
    if (!row.countryCode || !["IN", "LK"].includes(row.countryCode)) errors.push("countryCode must be IN or LK");
    if (!row.bankName) errors.push("Missing bank name");
    if (!row.accountHolderName) errors.push("Missing account holder name");
    if (!row.accountNumber) errors.push("Missing account number");
    return { rowNum: idx + 2, row, errors, valid: errors.length === 0 };
  });
  return { headers, rows };
}

export default function PersonnelBulkImport({ onImported, onClose }) {
  const [step, setStep] = useState("upload"); // upload | preview | done
  const [preview, setPreview] = useState(null);
  const [csvText, setCsvText] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef();

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      setCsvText(text);
      const parsed = parseCsv(text);
      setPreview(parsed);
      setStep("preview");
    };
    reader.readAsText(file);
  };

  const validRows = preview?.rows.filter((r) => r.valid) || [];
  const invalidRows = preview?.rows.filter((r) => !r.valid) || [];

  const handleImport = async () => {
    if (validRows.length === 0) {
      toast.error("No valid rows to import.", { theme: "dark" });
      return;
    }
    setImporting(true);
    try {
      // Build CSV with only valid rows
      const header = preview.headers.join(",");
      const validCsv = [header, ...validRows.map((r) =>
        preview.headers.map((h) => r.row[h] || "").join(",")
      )].join("\n");

      const res = await importEmployeesCsv(validCsv);
      const data = res.data?.data;
      setResult({
        imported: data?.imported ?? validRows.length,
        skipped: (data?.skipped ?? 0) + (data?.duplicates ?? 0),
        errors: (data?.rows?.filter((r) => r.status === "failed")?.map((r) => `Row ${r.rowNumber}: ${r.message}`)) || [],
      });
      setStep("done");
      toast.success(`Imported ${data?.imported ?? validRows.length} employees.`, { theme: "dark" });
      if (onImported) onImported();
    } catch (err) {
      toast.error(err.response?.data?.message || "Import failed.", { theme: "dark" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-xl ring-1 ring-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="text-teal-600" size={22} />
            <h3 className="text-lg font-bold text-slate-800">Bulk Employee Import</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {step === "upload" && (
          <div className="space-y-5">
            {/* Template download */}
            <div className="rounded-2xl bg-teal-50 border border-teal-200 p-4 flex items-start gap-3">
              <Download className="text-teal-600 mt-0.5 shrink-0" size={18} />
              <div>
                <p className="text-sm font-semibold text-slate-700">Step 1: Download the CSV template</p>
                <p className="text-xs text-slate-500 mb-2">Fill in employee data using the correct column headers.</p>
                <button type="button" onClick={downloadTemplateCsv}
                  className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 transition">
                  <Download size={14} /> Download Template
                </button>
              </div>
            </div>

            {/* File upload */}
            <div className="rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center hover:border-teal-400 transition cursor-pointer"
              onClick={() => fileInputRef.current?.click()}>
              <Upload className="mx-auto text-slate-400 mb-3" size={36} />
              <p className="text-sm font-semibold text-slate-700">Step 2: Upload your filled CSV file</p>
              <p className="text-xs text-slate-400 mt-1">Click here or drag & drop a .csv file</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleFile}
              />
            </div>

            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
              <p className="text-xs font-semibold text-amber-700 mb-1">Important Notes</p>
              <ul className="text-xs text-amber-700 space-y-0.5 list-disc list-inside">
                <li>Maximum 1,000 rows per import</li>
                <li>countryCode must be IN (India) or LK (Sri Lanka)</li>
                <li>email must be unique across all employees</li>
                <li>Existing employees with the same email will be skipped</li>
              </ul>
            </div>
          </div>
        )}

        {step === "preview" && preview && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-slate-50 p-3 text-center">
                <p className="text-2xl font-bold text-slate-800">{preview.rows.length}</p>
                <p className="text-xs text-slate-500">Total Rows</p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3 text-center">
                <p className="text-2xl font-bold text-emerald-700">{validRows.length}</p>
                <p className="text-xs text-emerald-600">Valid</p>
              </div>
              <div className="rounded-xl bg-red-50 p-3 text-center">
                <p className="text-2xl font-bold text-red-600">{invalidRows.length}</p>
                <p className="text-xs text-red-500">Errors</p>
              </div>
            </div>

            {/* Error rows */}
            {invalidRows.length > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 max-h-48 overflow-y-auto">
                <p className="text-xs font-semibold text-red-700 mb-2 flex items-center gap-1">
                  <AlertCircle size={12} /> Rows with errors (will be skipped)
                </p>
                {invalidRows.map((r) => (
                  <div key={r.rowNum} className="mb-1.5">
                    <span className="text-xs font-semibold text-red-600">Row {r.rowNum} ({r.row.email || r.row.name || "unnamed"}):</span>
                    <span className="text-xs text-red-600 ml-1">{r.errors.join("; ")}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Valid row preview */}
            {validRows.length > 0 && (
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                  <p className="text-xs font-semibold text-slate-600">{validRows.length} valid employees ready to import</p>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100">
                      <tr>
                        {["Row", "Name", "Email", "Role", "Department", "Country"].map((h) => (
                          <th key={h} className="px-3 py-2 text-left font-semibold text-slate-600">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {validRows.slice(0, 20).map((r) => (
                        <tr key={r.rowNum} className="hover:bg-slate-50">
                          <td className="px-3 py-2 text-slate-400">{r.rowNum}</td>
                          <td className="px-3 py-2 text-slate-700">{r.row.name}</td>
                          <td className="px-3 py-2 text-slate-600">{r.row.email}</td>
                          <td className="px-3 py-2 text-slate-600">{r.row.role}</td>
                          <td className="px-3 py-2 text-slate-600">{r.row.department}</td>
                          <td className="px-3 py-2 text-slate-600">{r.row.countryCode}</td>
                        </tr>
                      ))}
                      {validRows.length > 20 && (
                        <tr>
                          <td colSpan={6} className="px-3 py-2 text-xs text-slate-400 text-center">
                            … and {validRows.length - 20} more rows
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2 border-t border-slate-100">
              <button type="button" onClick={handleImport} disabled={importing || validRows.length === 0}
                className="rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50 transition inline-flex items-center gap-2">
                <Upload size={15} /> {importing ? "Importing..." : `Import ${validRows.length} Employees`}
              </button>
              <button type="button" onClick={() => { setStep("upload"); setPreview(null); setCsvText(""); }}
                className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 transition">
                Back
              </button>
            </div>
          </div>
        )}

        {step === "done" && result && (
          <div className="text-center py-8 space-y-4">
            <CheckCircle className="mx-auto text-emerald-500" size={48} />
            <h3 className="text-xl font-bold text-slate-800">Import Complete</h3>
            <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
              <div className="rounded-xl bg-emerald-50 p-4">
                <p className="text-3xl font-bold text-emerald-700">{result.imported}</p>
                <p className="text-xs text-emerald-600 mt-1">Employees Imported</p>
              </div>
              <div className="rounded-xl bg-amber-50 p-4">
                <p className="text-3xl font-bold text-amber-700">{result.skipped}</p>
                <p className="text-xs text-amber-600 mt-1">Skipped / Duplicate</p>
              </div>
            </div>
            {result.errors?.length > 0 && (
              <div className="text-left rounded-xl bg-red-50 p-4 max-w-sm mx-auto">
                <p className="text-xs font-semibold text-red-700 mb-1">Errors:</p>
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-600">{e}</p>
                ))}
              </div>
            )}
            <button type="button" onClick={onClose}
              className="rounded-xl bg-teal-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 transition">
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
