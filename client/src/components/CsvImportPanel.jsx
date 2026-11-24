import { useMemo, useRef, useState } from "react";
import { Download, FileUp, Plus, Trash2 } from "lucide-react";
import { normalizeCsvHeader, parseDelimitedText, serializeCsv } from "../utils/csvImport";

const EMPTY_ROW = (length) => Array.from({ length }, () => "");
const inputClassName =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

const countResult = (result, key, fallback) =>
  Number.isInteger(result?.[key]) ? result[key] : fallback;

function CsvImportPanel({
  title,
  description,
  columns,
  requiredHeaderGroups = [],
  validateRow,
  sampleRow,
  templateName,
  disabled = false,
  onImport,
}) {
  const fileInput = useRef(null);
  const [method, setMethod] = useState("file");
  const [pasteText, setPasteText] = useState("");
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState(templateName || "import.csv");
  const [parseError, setParseError] = useState("");
  const [importError, setImportError] = useState("");
  const [result, setResult] = useState(null);
  const [isImporting, setIsImporting] = useState(false);

  const errors = useMemo(() => {
    if (!headers.length) return [];
    const normalizedHeaders = headers.map(normalizeCsvHeader);
    const missingGroups = requiredHeaderGroups.filter(
      (group) => !group.some((header) => normalizedHeaders.includes(normalizeCsvHeader(header))),
    );
    const output = [];
    if (missingGroups.length) {
      output.push(`Missing required column(s): ${missingGroups.map((group) => group.join(" or ")).join("; ")}.`);
    }
    rows.forEach((row, index) => {
      const rowNumber = row.rowNumber ?? index + 2;
      if (row.cells.length !== headers.length) {
        output.push(`Row ${rowNumber}: expected ${headers.length} columns, found ${row.cells.length}.`);
        return;
      }
      if (row.cells.every((cell) => !String(cell).trim())) return;
      const values = Object.fromEntries(headers.map((header, cellIndex) => [normalizeCsvHeader(header), row.cells[cellIndex]]));
      const rowErrors = validateRow?.(values) || [];
      rowErrors.forEach((message) => output.push(`Row ${rowNumber}: ${message}`));
    });
    return output;
  }, [headers, requiredHeaderGroups, rows, validateRow]);

  const loadContent = (content, name) => {
    try {
      if (new Blob([content]).size > 2 * 1024 * 1024) {
        throw new Error("CSV content must be 2 MB or smaller.");
      }
      const parsed = parseDelimitedText(content);
      if (parsed.records.length < 2) throw new Error("Provide a header and at least one data row.");
      setHeaders(parsed.records[0].cells);
      setRows(parsed.records.slice(1).map(({ cells, line }) => ({ cells, rowNumber: line })));
      setFileName(name || templateName || "import.csv");
      setParseError("");
      setImportError("");
      setResult(null);
    } catch (error) {
      setHeaders([]);
      setRows([]);
      setParseError(error.message || "The delimited content could not be read.");
    }
  };

  const prepareManualEntry = () => {
    setHeaders(columns.map((column) => column.header));
    setRows([{ cells: EMPTY_ROW(columns.length), rowNumber: 2 }]);
    setFileName(templateName || "manual-entry.csv");
    setParseError("");
    setImportError("");
    setResult(null);
  };

  const updateCell = (rowIndex, columnIndex, value) => {
    setRows((current) =>
      current.map((row, index) =>
        index === rowIndex
          ? {
              ...row,
              cells: Array.from({ length: headers.length }, (_, cellIndex) =>
                cellIndex === columnIndex ? value : row.cells[cellIndex] || "",
              ),
            }
          : row,
      ),
    );
    setResult(null);
  };

  const downloadTemplate = () => {
    const example = columns.map((column) => sampleRow?.[column.key] ?? "");
    const content = serializeCsv(
      columns.map((column) => column.header),
      [example],
    );
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = templateName || "import-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const submit = async () => {
    setImportError("");
    setResult(null);
    if (!headers.length || !rows.some((row) => row.cells.some((cell) => String(cell).trim()))) {
      setImportError("Add at least one non-empty data row.");
      return;
    }
    if (errors.length) {
      setImportError("Correct the listed format and required-field errors before importing.");
      return;
    }
    setIsImporting(true);
    try {
      const csv = serializeCsv(headers, rows.map((row) => row.cells));
      const importResult = await onImport(csv, fileName);
      setResult(importResult);
    } catch (error) {
      setImportError(error.response?.data?.message || error.message || "The import could not be completed.");
    } finally {
      setIsImporting(false);
    }
  };

  const importedRows = result?.rows || result?.results || [];
  const imported = countResult(result, "imported", 0);
  const duplicates = countResult(result, "duplicates", countResult(result, "duplicated", 0));
  const skipped = countResult(result, "skipped", 0);
  const failed = countResult(result, "failed", 0);

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <button type="button" onClick={downloadTemplate} disabled={disabled || isImporting} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
          <Download size={16} /> Download CSV template
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="CSV input method">
        {[
          ["file", "Upload CSV file"],
          ["paste", "Paste CSV content"],
          ["manual", "Enter records manually"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={method === value}
            disabled={disabled || isImporting}
            onClick={() => {
              setMethod(value);
              if (value === "manual" && !headers.length) prepareManualEntry();
            }}
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${method === value ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {method === "file" && (
        <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600 hover:border-teal-500">
          <FileUp size={19} className="text-teal-700" />
          <span>{fileName === templateName ? "Choose a CSV file" : `Selected: ${fileName}`}</span>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,text/csv,text/tab-separated-values"
            className="hidden"
            disabled={disabled || isImporting}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              if (file.size > 2 * 1024 * 1024) {
                setParseError("The file must be 2 MB or smaller.");
                return;
              }
              loadContent(await file.text(), file.name);
            }}
          />
        </label>
      )}

      {method === "paste" && (
        <div className="mt-4 space-y-3">
          <textarea
            value={pasteText}
            onChange={(event) => setPasteText(event.target.value)}
            rows={5}
            disabled={disabled || isImporting}
            placeholder="Paste comma-separated CSV or tab-separated spreadsheet cells here."
            className={inputClassName}
          />
          <button type="button" disabled={disabled || isImporting || !pasteText.trim()} onClick={() => loadContent(pasteText, "pasted-data.csv")} className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
            Preview pasted data
          </button>
        </div>
      )}

      {method === "manual" && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-600">Fields marked required are validated before submission.</p>
          <button type="button" onClick={() => setRows((current) => [...current, { cells: EMPTY_ROW(headers.length), rowNumber: current.length + 2 }])} disabled={disabled || isImporting} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600">
            <Plus size={16} /> Add row
          </button>
        </div>
      )}

      {columns.length > 0 && (
        <details className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
          <summary className="cursor-pointer font-semibold">CSV format: required and optional columns (in order)</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full text-left">
              <thead><tr>{columns.map((column) => <th key={column.key} className="whitespace-nowrap px-2 py-1 font-semibold">{column.header}</th>)}</tr></thead>
              <tbody><tr>{columns.map((column) => <td key={column.key} className={`px-2 py-1 ${column.required ? "font-bold text-teal-800" : ""}`}>{column.required ? "Required" : column.requiredNote || "Optional"}</td>)}</tr></tbody>
              <tbody><tr>{columns.map((column) => <td key={column.key} className="max-w-40 px-2 py-1">{sampleRow?.[column.key] || "—"}</td>)}</tr></tbody>
            </table>
          </div>
          <p className="mt-2">Example row only; it is fictitious and should be replaced. The template includes the header and this safe sample.</p>
        </details>
      )}

      {parseError && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{parseError}</p>}

      {headers.length > 0 && (
        <>
          <div className="mt-4 flex items-center justify-between gap-2">
            <h3 className="font-semibold text-slate-800">Editable data preview ({rows.length} row(s))</h3>
            <button type="button" onClick={() => setRows((current) => [...current, { cells: EMPTY_ROW(headers.length), rowNumber: current.length + 2 }])} disabled={disabled || isImporting} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">
              <Plus size={14} /> Add row
            </button>
          </div>
          {errors.length > 0 && (
            <div className="mt-2 max-h-32 overflow-y-auto rounded-lg bg-amber-50 p-3 text-xs text-amber-900" role="status">
              {errors.slice(0, 20).map((error, index) => <p key={`${index}-${error}`}>{error}</p>)}
              {errors.length > 20 && <p>And {errors.length - 20} more validation issue(s).</p>}
            </div>
          )}
          <div className="mt-3 max-h-80 overflow-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-2 py-2">Row</th>
                  {headers.map((header, index) => <th key={`${header}-${index}`} className="whitespace-nowrap px-2 py-2">{header}</th>)}
                  {method === "manual" && <th className="px-2 py-2">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.slice(0, 100).map((row, rowIndex) => (
                  <tr key={`${row.rowNumber}-${rowIndex}`}>
                    <td className="px-2 py-1 text-slate-500">{row.rowNumber}</td>
                    {headers.map((header, columnIndex) => {
                      const definition = columns.find((column) => normalizeCsvHeader(column.header) === normalizeCsvHeader(header));
                      return (
                        <td key={`${header}-${columnIndex}`} className="min-w-36 px-1 py-1">
                          <input
                            type={definition?.sensitive ? "password" : "text"}
                            autoComplete="off"
                            value={row.cells[columnIndex] ?? ""}
                            onChange={(event) => updateCell(rowIndex, columnIndex, event.target.value)}
                            disabled={disabled || isImporting}
                            aria-label={`Row ${row.rowNumber} ${header}`}
                            className={inputClassName}
                          />
                        </td>
                      );
                    })}
                    {method === "manual" && (
                      <td className="px-2 py-1">
                        <button type="button" aria-label={`Remove row ${row.rowNumber}`} onClick={() => setRows((current) => current.filter((_, index) => index !== rowIndex))} className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-700">
                          <Trash2 size={15} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 100 && <p className="mt-1 text-xs text-slate-500">Showing the first 100 rows; all rows will be imported.</p>}
        </>
      )}

      {importError && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{importError}</p>}
      {result && (
        <div className="mt-4 rounded-xl border border-slate-200 p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Imported", imported, "text-emerald-700"],
              ["Duplicate", duplicates, "text-amber-700"],
              ["Skipped", skipped, "text-slate-600"],
              ["Failed", failed, "text-red-700"],
            ].map(([label, count, color]) => <div key={label} className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className={`mt-1 text-lg font-bold ${color}`}>{count}</p></div>)}
          </div>
          {importedRows.length > 0 && (
            <div className="mt-3 max-h-48 space-y-1 overflow-y-auto" aria-live="polite">
              {importedRows.map((row, index) => (
                <p key={`${row.rowNumber}-${index}`} className={`rounded px-3 py-2 text-xs ${row.status === "failed" ? "bg-red-50 text-red-700" : row.status === "imported" ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-600"}`}>
                  Row {row.rowNumber}: {row.status} — {row.message || row.reason || "No details returned."}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <button type="button" onClick={submit} disabled={disabled || isImporting || !headers.length} className="rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50">
          {isImporting ? "Importing…" : "Validate and import"}
        </button>
      </div>
    </section>
  );
}

export default CsvImportPanel;
