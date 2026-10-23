import { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  FileBadge,
  FileSignature,
  ImagePlus,
  Loader2,
  PenLine,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { toast } from "react-toastify";
import UserLayout from "../layouts/UserLayout";
import LetterEditor from "../components/LetterEditor";
import { getUser } from "../utils/auth";
import { getEmployeeOptions, getUsers } from "../api/userApi";
import { DEFAULT_COMPANY } from "../letters/companyDefaults";
import {
  getLetterSettings,
  removeTemplateSignature,
  saveCompanyDetails,
  saveTemplateLogo,
  saveTemplateSignature,
} from "../api/templateApi";

const MAX_IMAGE_BYTES = 500 * 1024;
const PAGE_SIZE = 10;

const inputClassName =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-normal text-slate-700 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

// Used when the letter settings cannot be loaded, so letters can still be created.
const DEFAULT_SETTINGS = { logo: null, signature: null, company: DEFAULT_COMPANY };

const companyFields = [
  ["name", "Letterhead name", "KD Associates INC (Buffalo)"],
  ["legalName", "Legal name (used in the letter text)", "KD Associates Buffalo INC"],
  ["address", "Address", "9950 County Rd, Clarence Center, NY 14032, USA"],
  ["phone", "Phone", "+1 716 400 9006"],
  ["email", "Email", "hr@company.com"],
  ["signatoryTitle", "Default signatory title", "HR Manager / Director"],
];

const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value))
    : "—";

const readImage = (file) =>
  new Promise((resolve, reject) => {
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      reject(new Error("Image must be a PNG or JPEG"));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      reject(new Error("Image must be 500 KB or smaller"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      resolve({ fileName: file.name, mime: file.type, data: String(reader.result).split(",")[1] || "" });
    reader.onerror = () => reject(new Error("Unable to read the image"));
    reader.readAsDataURL(file);
  });

const ImageCard = ({ title, description, image, isBusy, onUpload, onRemove, icon: Icon }) => {
  const inputRef = useRef(null);
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 p-4">
      <div className="flex items-center gap-2">
        <Icon className="text-teal-600" size={18} />
        <h3 className="font-semibold text-slate-800">{title}</h3>
      </div>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
      <div className="mt-4 grid h-24 place-content-center rounded-xl border border-dashed border-slate-300 bg-[#ffffff] p-2">
        {image ? (
          <img src={`data:${image.mime};base64,${image.data}`} alt={title} className="max-h-20 max-w-44 object-contain" />
        ) : (
          <span className="text-xs text-[#94a3b8]">No image</span>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onUpload(file);
        }}
      />
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={isBusy}
          onClick={() => inputRef.current?.click()}
          className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${
            image ? "border border-slate-200 text-slate-700 hover:bg-slate-50" : "bg-teal-700 text-white hover:bg-teal-800"
          }`}
        >
          {isBusy ? <Loader2 className="animate-spin" size={16} /> : image ? <RefreshCw size={16} /> : <ImagePlus size={16} />}
          {image ? "Replace" : "Add"}
        </button>
        {image && onRemove && (
          <button
            type="button"
            disabled={isBusy}
            onClick={onRemove}
            className="rounded-xl border border-slate-200 px-3 text-slate-500 transition hover:bg-red-50 hover:text-red-700"
            aria-label={`Remove ${title.toLowerCase()}`}
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

function Templates() {
  const user = getUser();
  const isHr = user?.role === "HR";
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [company, setCompany] = useState(DEFAULT_SETTINGS.company);
  const [isSettingsLoading, setIsSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState("");
  const [busyImage, setBusyImage] = useState("");
  const [isSavingCompany, setIsSavingCompany] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [options, setOptions] = useState({ departments: [], roles: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("All departments");
  const [role, setRole] = useState("All roles");
  const [status, setStatus] = useState("All statuses");
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState(null);

  // The employee table and the letterhead settings load independently, so one failing
  // request does not block the other.
  useEffect(() => {
    if (!isHr) return;
    let active = true;
    Promise.all([getUsers(1, "all", 1000), getEmployeeOptions()])
      .then(([usersResponse, optionsResponse]) => {
        if (!active) return;
        setEmployees(usersResponse.data.data.users);
        setOptions(optionsResponse.data.data);
      })
      .catch((error) => {
        if (active) setLoadError(error.response?.data?.message || "Unable to load employees.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isHr]);

  useEffect(() => {
    if (!isHr) return;
    let active = true;
    getLetterSettings()
      .then((response) => {
        if (!active) return;
        const loaded = response.data.data;
        const merged = { ...DEFAULT_SETTINGS, ...loaded, company: { ...DEFAULT_SETTINGS.company, ...loaded.company } };
        setSettings(merged);
        setCompany(merged.company);
      })
      .catch((error) => {
        if (active) {
          setSettingsError(
            error.response?.status === 404
              ? "The server does not support letter settings yet. Deploy the latest backend; letters use the default company details until then."
              : error.response?.data?.message || "Unable to load the letterhead settings.",
          );
        }
      })
      .finally(() => {
        if (active) setIsSettingsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isHr]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return employees.filter(
      (employee) =>
        (!term ||
          employee.name?.toLowerCase().includes(term) ||
          employee.email?.toLowerCase().includes(term) ||
          employee.id?.toLowerCase().includes(term)) &&
        (department === "All departments" || employee.department === department) &&
        (role === "All roles" || employee.role === role) &&
        (status === "All statuses" || employee.status === status),
    );
  }, [employees, search, department, role, status]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const uploadImage = async (kind, file) => {
    setBusyImage(kind);
    try {
      const image = await readImage(file);
      const save = kind === "logo" ? saveTemplateLogo : saveTemplateSignature;
      const response = await save(image);
      const hadImage = Boolean(settings[kind]);
      setSettings((current) => ({ ...current, [kind]: response.data.data }));
      toast.success(`${kind === "logo" ? "Logo" : "Signature"} ${hadImage ? "replaced" : "added"}`, { theme: "dark" });
    } catch (error) {
      toast.error(error.response?.data?.message || error.message, { theme: "dark" });
    } finally {
      setBusyImage("");
    }
  };

  const removeSignature = async () => {
    setBusyImage("signature");
    try {
      await removeTemplateSignature();
      setSettings((current) => ({ ...current, signature: null }));
      toast.success("Signature removed", { theme: "dark" });
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to remove the signature.", { theme: "dark" });
    } finally {
      setBusyImage("");
    }
  };

  const saveCompany = async (event) => {
    event.preventDefault();
    if (isSavingCompany) return;
    setIsSavingCompany(true);
    try {
      const response = await saveCompanyDetails(company);
      setSettings((current) => ({ ...current, company: response.data.data }));
      setCompany(response.data.data);
      toast.success("Company details saved", { theme: "dark" });
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to save company details.", { theme: "dark" });
    } finally {
      setIsSavingCompany(false);
    }
  };

  const updateEmployee = (updated) =>
    setEmployees((current) => current.map((employee) => (employee.id === updated.id ? updated : employee)));

  if (!isHr) {
    return (
      <UserLayout>
        <div className="flex flex-col items-center rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200/70">
          <ShieldAlert className="text-red-500" size={36} />
          <h1 className="mt-4 text-2xl font-bold text-slate-800">Access denied</h1>
          <p className="mt-2 text-sm text-slate-500">Letter templates are available to HR only.</p>
        </div>
      </UserLayout>
    );
  }

  const companyChanged =
    !settingsError && companyFields.some(([key]) => (company[key] || "") !== (settings.company[key] || ""));

  return (
    <UserLayout>
      <div className="space-y-6">
        <section className="rounded-3xl bg-linear-to-r from-slate-900 to-teal-700 p-8 text-white shadow-lg">
          <p className="text-sm font-medium text-teal-200">HR operations</p>
          <h1 className="mt-2 text-4xl font-bold">Letter Templates</h1>
          <p className="mt-3 text-slate-200">
            Create offer and service letters for any employee and download them as PDF.
          </p>
        </section>

        {loadError && <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{loadError}</p>}

        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
          <div className="mb-5 flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-content-center rounded-xl bg-teal-50 text-teal-700">
              <Building2 size={19} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Letterhead</h2>
              <p className="text-sm text-slate-500">Shown at the top of every letter and in the signature block.</p>
            </div>
          </div>

          {settingsError && (
            <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-700">{settingsError}</p>
          )}
          {isSettingsLoading ? (
            <div className="grid h-40 place-content-center">
              <Loader2 className="animate-spin text-slate-400" size={24} />
            </div>
          ) : (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)]">
              <ImageCard
                title="Company logo"
                description="PNG or JPEG, up to 500 KB."
                icon={ImagePlus}
                image={settings.logo}
                isBusy={busyImage === "logo"}
                onUpload={(file) => uploadImage("logo", file)}
              />
              <ImageCard
                title="Authorised signature"
                description="Optional. Placed above “Authorized Person”."
                icon={PenLine}
                image={settings.signature}
                isBusy={busyImage === "signature"}
                onUpload={(file) => uploadImage("signature", file)}
                onRemove={removeSignature}
              />
              <form onSubmit={saveCompany} className="rounded-2xl border border-slate-200 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {companyFields.map(([key, label, placeholder]) => (
                    <label
                      key={key}
                      className={`block text-sm font-semibold text-slate-700 ${key === "address" ? "sm:col-span-2" : ""}`}
                    >
                      {label}
                      <input
                        required={key === "name"}
                        value={company?.[key] || ""}
                        placeholder={placeholder}
                        onChange={(event) => setCompany((current) => ({ ...current, [key]: event.target.value }))}
                        className={inputClassName}
                      />
                    </label>
                  ))}
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={!companyChanged || isSavingCompany}
                    className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                  >
                    {isSavingCompany && <Loader2 className="animate-spin" size={16} />}
                    Save company details
                  </button>
                </div>
              </form>
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70">
          <div className="border-b border-slate-100 p-5">
            <h2 className="text-lg font-bold text-slate-800">Employees</h2>
            <p className="text-sm text-slate-500">Choose an employee to prepare their offer or service letter.</p>
            <div className="mt-4 flex flex-col gap-3 lg:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search by name, email or employee ID"
                  className={`${inputClassName} mt-0 pl-10`}
                />
              </div>
              <select
                value={department}
                onChange={(event) => {
                  setDepartment(event.target.value);
                  setPage(1);
                }}
                className={`${inputClassName} mt-0 lg:w-52`}
              >
                <option>All departments</option>
                {options.departments.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
              <select
                value={role}
                onChange={(event) => {
                  setRole(event.target.value);
                  setPage(1);
                }}
                className={`${inputClassName} mt-0 lg:w-44`}
              >
                <option>All roles</option>
                {options.roles.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
                className={`${inputClassName} mt-0 lg:w-44`}
              >
                <option>All statuses</option>
                {(options.statuses || ["Active", "Not Active"]).map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Employee</th>
                  <th className="px-5 py-3.5">Employee ID</th>
                  <th className="px-5 py-3.5">Department</th>
                  <th className="px-5 py-3.5">Role</th>
                  <th className="px-5 py-3.5">Joined</th>
                  <th className="px-5 py-3.5 text-right">Letters</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center">
                      <Loader2 className="mx-auto animate-spin text-slate-400" size={22} />
                    </td>
                  </tr>
                ) : pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-500">
                      No employees match your search.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((employee) => (
                    <tr key={employee.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="grid h-9 w-9 shrink-0 place-content-center rounded-full bg-teal-50 text-sm font-bold text-teal-700">
                            {employee.name?.charAt(0)?.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-800">{employee.name}</p>
                            <p className="truncate text-xs text-slate-500">{employee.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">{employee.id}</td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">{employee.department || "—"}</td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">{employee.designation || employee.role}</td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">
                        {formatDate(employee.joiningDate || employee.createdAt)}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditor({ type: "offer", employee })}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                          >
                            <FileSignature size={15} />
                            Offer letter
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditor({ type: "service", employee })}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700 disabled:opacity-50"
                          >
                            <FileBadge size={15} />
                            Service letter
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm text-slate-500">
            <span>
              {filtered.length} employee{filtered.length === 1 ? "" : "s"}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setPage(currentPage - 1)}
                className="rounded-lg px-3 py-1.5 font-medium transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
              >
                ← Previous
              </button>
              <span className="px-2">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setPage(currentPage + 1)}
                className="rounded-lg px-3 py-1.5 font-medium transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
              >
                Next →
              </button>
            </div>
          </div>
        </section>
      </div>

      {editor && (
        <LetterEditor
          key={`${editor.type}-${editor.employee.id}`}
          type={editor.type}
          employee={editor.employee}
          settings={settings}
          onClose={() => setEditor(null)}
          onProfileSaved={updateEmployee}
        />
      )}
    </UserLayout>
  );
}

export default Templates;
