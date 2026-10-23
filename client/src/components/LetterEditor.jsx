import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Eye, Loader2, PencilLine, X } from "lucide-react";
import { toast } from "react-toastify";
import { updateUser } from "../api/userApi";
import {
  PROFILE_FIELDS,
  TITLES,
  amountInWords,
  createOfferLetter,
  createServiceLetter,
} from "../letters/letterDefaults";

// The PDF library is large, so it is only downloaded when a letter is opened.
const loadPdfModule = () => import("../letters/renderLetterPdf.jsx");

const inputClassName =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-normal text-slate-700 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

const LIST_HINT = "One item per line";

const offerSections = [
  { title: "Letter", fields: [{ key: "date", label: "Letter date", type: "date" }] },
  {
    title: "To",
    fields: [
      { key: "title", label: "Title", type: "select", options: TITLES },
      { key: "fullName", label: "Full name", required: true },
      { key: "address", label: "Address", type: "textarea", rows: 3, hint: "Each line prints on its own line", span: 2 },
      { key: "nationalId", label: "National ID card no." },
    ],
  },
  {
    title: "1. Position & Start Date",
    fields: [
      { key: "designation", label: "Position", required: true },
      { key: "department", label: "Department" },
      { key: "joiningDate", label: "Start date", type: "date", required: true },
      { key: "reportingTo", label: "Reporting to" },
    ],
  },
  {
    title: "2. Compensation",
    fields: [
      { key: "currency", label: "Currency", type: "select", options: ["LKR", "USD", "INR", "GBP", "EUR"] },
      { key: "salaryAmount", label: "Monthly salary", required: true, inputMode: "numeric", placeholder: "40000" },
      { key: "salaryWords", label: "Amount in words", hint: "Filled in automatically; you can edit it", span: 2 },
      { key: "salaryNote", label: "Salary terms", type: "textarea", rows: 2, span: 2 },
      { key: "confidentiality", label: "Salary confidentiality", type: "textarea", rows: 4, span: 2, hint: "Leave empty to remove this paragraph" },
      { key: "paymentDay", label: "Payment day of month", placeholder: "10th" },
    ],
  },
  {
    title: "3. Working Hours",
    fields: [
      { key: "workDays", label: "Work schedule" },
      { key: "workHours", label: "Working hours" },
      { key: "breaks", label: "Breaks", span: 2 },
    ],
  },
  {
    title: "4. Job Responsibilities",
    fields: [
      { key: "responsibilities", label: "Responsibilities", type: "textarea", rows: 5, hint: LIST_HINT, span: 2 },
      { key: "responsibilitiesNote", label: "Closing note", type: "textarea", rows: 2, span: 2 },
    ],
  },
  {
    title: "5. Probation & Performance Review",
    fields: [{ key: "probationPeriod", label: "Probation period", hint: "e.g. six (6) months" }],
  },
  {
    title: "6. Leave Policy",
    fields: [{ key: "leavePolicy", label: "Leave policy", type: "textarea", rows: 4, hint: "Each line is a paragraph", span: 2 }],
  },
  {
    title: "7. Early Termination Clause",
    fields: [{ key: "noticePeriod", label: "Notice period", hint: "e.g. one (1) month's" }],
  },
  {
    title: "8. Employment Terms",
    fields: [{ key: "employmentTerms", label: "Employment terms", type: "textarea", rows: 4, hint: "Each line is a paragraph", span: 2 }],
  },
  {
    title: "9. Location & Work Requirements",
    fields: [
      { key: "workArrangement", label: "Work arrangement", span: 2 },
      { key: "workRequirements", label: "Requirements", type: "textarea", rows: 4, hint: LIST_HINT, span: 2 },
      { key: "workRequirementsNote", label: "Closing note", span: 2 },
    ],
  },
  {
    title: "Signature",
    fields: [
      { key: "signatoryName", label: "Signatory name", hint: "Optional" },
      { key: "signatoryTitle", label: "Signatory title" },
    ],
  },
];

const serviceSections = [
  {
    title: "Letter",
    fields: [
      { key: "date", label: "Letter date", type: "date" },
      { key: "referenceNo", label: "Reference no." },
    ],
  },
  {
    title: "Employee",
    fields: [
      { key: "title", label: "Title", type: "select", options: TITLES, hint: "Sets he / she / they in the letter" },
      { key: "fullName", label: "Full name", required: true },
      { key: "nationalId", label: "National ID card no." },
      { key: "employeeId", label: "Employee ID" },
    ],
  },
  {
    title: "1. Employment Details",
    fields: [
      { key: "designation", label: "Designation", required: true },
      { key: "department", label: "Department" },
      { key: "joiningDate", label: "Date joined", type: "date", required: true },
      { key: "currentlyEmployed", label: "Currently employed", type: "checkbox" },
      { key: "lastWorkingDate", label: "Last working day", type: "date", hiddenWhen: (letter) => letter.currentlyEmployed },
      { key: "employmentType", label: "Employment type", type: "select", options: ["Full-time", "Part-time", "Contract", "Internship"] },
      { key: "workArrangement", label: "Work arrangement" },
    ],
  },
  {
    title: "2. Duties & Responsibilities",
    fields: [{ key: "responsibilities", label: "Responsibilities", type: "textarea", rows: 5, hint: LIST_HINT, span: 2 }],
  },
  {
    title: "3. Conduct & Performance",
    fields: [
      {
        key: "conduct",
        label: "Conduct paragraph",
        type: "textarea",
        rows: 4,
        span: 2,
        hint: "{name}, {Subject}, {subject}, {object} and {possessive} are replaced automatically",
      },
      { key: "purpose", label: "Issued for", hint: "e.g. whatever purpose it may serve", span: 2 },
    ],
  },
  {
    title: "Signature",
    fields: [
      { key: "signatoryName", label: "Signatory name", hint: "Optional" },
      { key: "signatoryTitle", label: "Signatory title" },
    ],
  },
];

const Field = ({ field, letter, onChange }) => {
  if (field.hiddenWhen?.(letter)) return null;
  const value = letter[field.key] ?? "";
  const common = {
    name: field.key,
    required: field.required,
    value,
    onChange: (event) => onChange(field.key, event.target.value),
    className: inputClassName,
  };

  if (field.type === "checkbox") {
    return (
      <label className="flex items-center gap-2 self-end pb-3 text-sm font-semibold text-slate-700">
        <input
          type="checkbox"
          checked={Boolean(letter[field.key])}
          onChange={(event) => onChange(field.key, event.target.checked)}
          className="h-4 w-4 accent-teal-700"
        />
        {field.label}
      </label>
    );
  }

  return (
    <label className={`block text-sm font-semibold text-slate-700 ${field.span === 2 ? "sm:col-span-2" : ""}`}>
      {field.label}
      {field.required && <span className="text-red-600"> *</span>}
      {field.type === "textarea" ? (
        <textarea {...common} rows={field.rows || 3} className={`${inputClassName} leading-6`} />
      ) : field.type === "select" ? (
        <select {...common}>
          {field.options.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      ) : (
        <input
          {...common}
          type={field.type || "text"}
          inputMode={field.inputMode}
          placeholder={field.placeholder}
        />
      )}
      {field.hint && <span className="mt-1 block text-xs font-normal text-slate-400">{field.hint}</span>}
    </label>
  );
};

function LetterEditor({ type, employee, settings, onClose, onProfileSaved }) {
  const isOffer = type === "offer";
  const label = isOffer ? "Offer letter" : "Service letter";
  const sections = isOffer ? offerSections : serviceSections;
  const initialLetter = useMemo(
    () => (isOffer ? createOfferLetter : createServiceLetter)(employee, settings.company),
    [employee, isOffer, settings.company],
  );
  const [letter, setLetter] = useState(initialLetter);
  const [salaryWordsEdited, setSalaryWordsEdited] = useState(false);
  const [saveToProfile, setSaveToProfile] = useState(true);
  const [preview, setPreview] = useState({ url: "", error: "", props: null });
  const [isDownloading, setIsDownloading] = useState(false);
  const [mobileView, setMobileView] = useState("edit");
  const downloadingRef = useRef(false);

  const pdfProps = useMemo(
    () => ({ letter, company: settings.company, logo: settings.logo, signature: settings.signature }),
    [letter, settings],
  );

  // Re-render the PDF preview shortly after the user stops typing.
  useEffect(() => {
    let cancelled = false;
    let url = "";
    const timer = window.setTimeout(async () => {
      try {
        const { renderLetterPdf } = await loadPdfModule();
        const blob = await renderLetterPdf(type, pdfProps);
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setPreview({ url, error: "", props: pdfProps });
      } catch {
        if (!cancelled) {
          setPreview((current) => ({ ...current, error: "Unable to render the preview.", props: pdfProps }));
        }
      }
    }, 450);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (url) window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
  }, [pdfProps, type]);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const updateField = (key, value) => {
    setLetter((current) => {
      const next = { ...current, [key]: value };
      if ((key === "salaryAmount" || key === "currency") && !salaryWordsEdited) {
        next.salaryWords = amountInWords(next.currency, String(next.salaryAmount).replace(/,/g, ""));
      }
      return next;
    });
    if (key === "salaryWords") setSalaryWordsEdited(true);
  };

  const isRendering = preview.props !== pdfProps;
  const previewUrl = preview.url;
  const previewError = isRendering ? "" : preview.error;

  const missingFields = sections
    .flatMap((section) => section.fields)
    .filter((field) => field.required && !field.hiddenWhen?.(letter) && !String(letter[field.key] ?? "").trim())
    .map((field) => field.label);

  const saveProfileChanges = async () => {
    // Only fields HR actually changed are written back to the employee record.
    const fields = isOffer ? PROFILE_FIELDS : [...PROFILE_FIELDS, "lastWorkingDate"];
    const changes = Object.fromEntries(
      fields
        .filter((field) => letter[field] !== initialLetter[field])
        .map((field) => [field, letter[field]]),
    );
    if (!isOffer && letter.currentlyEmployed) delete changes.lastWorkingDate;
    if (!Object.keys(changes).length) return;
    try {
      const response = await updateUser(employee.id, changes);
      onProfileSaved?.(response.data.data);
    } catch {
      toast.error("The PDF was downloaded, but the employee details could not be saved.", { theme: "dark" });
    }
  };

  const download = async () => {
    if (missingFields.length) {
      toast.error(`Please fill in: ${missingFields.join(", ")}`, { theme: "dark" });
      return;
    }
    if (downloadingRef.current) return;
    downloadingRef.current = true;
    setIsDownloading(true);
    try {
      const { renderLetterPdf } = await loadPdfModule();
      const blob = await renderLetterPdf(type, pdfProps);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${letter.fullName || employee.name} - ${label}.pdf`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (saveToProfile) await saveProfileChanges();
      toast.success(`${label} downloaded`, { theme: "dark" });
    } catch {
      toast.error("Unable to generate the PDF.", { theme: "dark" });
    } finally {
      downloadingRef.current = false;
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex bg-slate-900/60 sm:p-4" role="dialog" aria-modal="true" aria-label={label}>
      <div className="app-bg mx-auto flex h-full w-full max-w-[1500px] flex-col overflow-hidden bg-slate-100 shadow-2xl sm:rounded-2xl">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-slate-800">
              {label} · {employee.name}
            </h2>
            <p className="text-xs text-slate-500">Edit the details on the left; the preview shows the exact PDF.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl border border-slate-200 p-1 lg:hidden">
              {[
                ["edit", "Edit", PencilLine],
                ["preview", "Preview", Eye],
              ].map(([value, text, Icon]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMobileView(value)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold ${
                    mobileView === value ? "bg-teal-700 text-white" : "text-slate-600"
                  }`}
                >
                  <Icon size={15} />
                  {text}
                </button>
              ))}
            </div>
            <label className="hidden items-center gap-2 text-sm text-slate-600 md:flex" title="Saves title, designation, address, national ID and dates to the employee record">
              <input
                type="checkbox"
                checked={saveToProfile}
                onChange={(event) => setSaveToProfile(event.target.checked)}
                className="h-4 w-4 accent-teal-700"
              />
              Save details to employee profile
            </label>
            <button
              type="button"
              onClick={download}
              disabled={isDownloading}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-wait disabled:opacity-60"
            >
              {isDownloading ? <Loader2 className="animate-spin" size={17} /> : <Download size={17} />}
              Download PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              aria-label="Close letter editor"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 lg:grid-cols-2">
          <form
            onSubmit={(event) => event.preventDefault()}
            className={`min-h-0 space-y-4 overflow-y-auto p-4 sm:p-6 ${mobileView === "edit" ? "block" : "hidden"} lg:block`}
          >
            {sections.map((section) => (
              <fieldset key={section.title} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
                <legend className="sr-only">{section.title}</legend>
                <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-teal-700">{section.title}</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  {section.fields.map((field) => (
                    <Field key={field.key} field={field} letter={letter} onChange={updateField} />
                  ))}
                </div>
              </fieldset>
            ))}
            <label className="flex items-center gap-2 rounded-2xl bg-white p-4 text-sm text-slate-600 ring-1 ring-slate-200/70 md:hidden">
              <input
                type="checkbox"
                checked={saveToProfile}
                onChange={(event) => setSaveToProfile(event.target.checked)}
                className="h-4 w-4 accent-teal-700"
              />
              Save details to employee profile
            </label>
          </form>

          <div className={`relative min-h-0 border-slate-200 bg-slate-50 p-3 sm:p-4 lg:border-l ${mobileView === "preview" ? "block" : "hidden"} lg:block`}>
            {previewUrl && (
              <iframe
                title={`${label} preview`}
                src={`${previewUrl}#toolbar=0&navpanes=0&view=FitH`}
                className="h-full w-full rounded-xl border border-slate-200 bg-white"
              />
            )}
            {(isRendering || previewError) && (
              <div className="absolute right-6 top-6 flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow ring-1 ring-slate-200/70">
                {previewError ? (
                  <span className="text-red-600">{previewError}</span>
                ) : (
                  <>
                    <Loader2 className="animate-spin text-teal-600" size={14} />
                    Updating preview…
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default LetterEditor;
