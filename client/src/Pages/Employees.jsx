import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Ban, Download, Eye, Pencil, Plus, Search, Upload, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import UserLayout from "../layouts/UserLayout";
import {
  createUser,
  disableUser,
  getEmployeeOptions,
  getUsers,
  importEmployeesCsv,
} from "../api/userApi";
import { getUser } from "../utils/auth";
import { OTHER_BANK, bankOptions, isEmployeeBankDetailsComplete } from "../utils/bank";

const PAGE_SIZE = 10;

const initialForm = {
  employeeId: "",
  name: "",
  email: "",
  role: "Employee",
  department: "Software",
  countryCode: "LK",
  countryOfEmployment: "Sri Lanka",
  bankName: "",
  otherBankName: "",
  accountHolderName: "",
  accountNumber: "",
  bankBranch: "",
  bankBranchCode: "",
  ifscCode: "",
  joiningDate: "",
};

const inputClassName =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

function Employees() {
  const user = getUser();
  const navigate = useNavigate();
  const canAddEmployee = user?.role === "HR";
  const [employees, setEmployees] = useState([]);
  const [employeeOptions, setEmployeeOptions] = useState({
    roles: [],
    departments: [],
    countries: [],
    banksByCountry: {},
  });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("All departments");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [isSaving, setIsSaving] = useState(false);
  const [disablingId, setDisablingId] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  // Refs block a second click that lands before React re-renders the disabled button.
  const savingRef = useRef(false);
  const disablingRef = useRef(false);
  const importInputRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const loadEmployees = async () => {
      try {
        const [response, optionsResponse] = await Promise.all([
          getUsers(1, "all", 1000),
          getEmployeeOptions(),
        ]);
        if (isMounted) {
          setEmployees(response.data.data.users);
          setEmployeeOptions(optionsResponse.data.data);
        }
      } catch (error) {
        if (isMounted) {
          setLoadError(
            error.response?.data?.message || "Unable to load employees.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadEmployees();
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredEmployees = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return employees.filter((employee) => {
      const matchesSearch =
        !search ||
      String(employee.name || "").toLowerCase().includes(search) ||
      String(employee.email || "").toLowerCase().includes(search);
      const matchesDepartment =
        departmentFilter === "All departments" ||
        employee.department === departmentFilter;
      const matchesStatus =
        statusFilter === "All statuses" || employee.status === statusFilter;

      return matchesSearch && matchesDepartment && matchesStatus;
    });
  }, [employees, searchTerm, departmentFilter, statusFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredEmployees.length / PAGE_SIZE),
  );
  const displayedPage = Math.min(currentPage, totalPages);
  const visibleEmployees = filteredEmployees.slice(
    (displayedPage - 1) * PAGE_SIZE,
    displayedPage * PAGE_SIZE,
  );

  const updateSearch = (event) => {
    setSearchTerm(event.target.value);
    setCurrentPage(1);
  };

  const updateDepartment = (event) => {
    setDepartmentFilter(event.target.value);
    setCurrentPage(1);
  };

  const updateStatus = (event) => {
    setStatusFilter(event.target.value);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setDepartmentFilter("All departments");
    setStatusFilter("All statuses");
    setCurrentPage(1);
  };

  const departmentBadgeClass = (department) => {
    const departmentColors = {
      Software: "bg-blue-100 text-blue-700",
      "Digital Marketing": "bg-purple-100 text-purple-700",
      HR: "bg-amber-100 text-amber-700",
    };

    return departmentColors[department] || "bg-slate-100 text-slate-600";
  };

  const updateForm = (event) => {
    const { name, value } = event.target;
    setForm((currentForm) => {
      if (name === "countryCode") {
        const country = employeeOptions.countries.find((item) => item.code === value);
        return {
          ...currentForm,
          countryCode: value,
          countryOfEmployment: country?.name || "",
          bankName: "",
          otherBankName: "",
          ifscCode: value === "IN" ? currentForm.ifscCode : "",
        };
      }
      if (name === "bankName") {
        return {
          ...currentForm,
          bankName: value,
          otherBankName: "",
        };
      }
      return { ...currentForm, [name]: value };
    });
  };

  const banks = bankOptions(
    form.countryCode,
    employeeOptions.banksByCountry?.[form.countryCode],
  );

  const addEmployee = async (event) => {
    event.preventDefault();
    if (!canAddEmployee || savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);

    try {
      const response = await createUser({
        ...form,
        employeeId: form.employeeId || undefined,
        bankName: form.bankName === OTHER_BANK ? OTHER_BANK : form.bankName,
      });
      setEmployees((currentEmployees) => [
        response.data.data,
        ...currentEmployees,
      ]);
      setForm(initialForm);
      setIsModalOpen(false);
      setCurrentPage(1);
      setLoadError("");
      toast.success("Employee added successfully", { theme: "dark" });
    } catch (error) {
      const message =
        error.response?.data?.message || "Unable to add employee.";
      toast.error(message, { theme: "dark" });
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const disableEmployee = async (employee) => {
    if (disablingRef.current) return;
    if (!window.confirm(`Mark ${employee.name}'s employee record as inactive?`)) return;
    disablingRef.current = true;
    setDisablingId(employee.id);

    try {
      const response = await disableUser(employee.id);
      setEmployees((currentEmployees) =>
        currentEmployees.map((item) =>
          item.id === employee.id ? response.data.data : item,
        ),
      );
      toast.success("Employee record marked inactive.", { theme: "dark" });
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to update employee record.", { theme: "dark" });
    } finally {
      disablingRef.current = false;
      setDisablingId(null);
    }
  };

  const downloadTemplate = () => {
    const headers = [
      "employeeId", "name", "email", "role", "department",
      "countryOfEmployment", "countryCode", "bankName", "otherBankName",
      "accountHolderName", "accountNumber", "bankBranch", "bankBranchCode",
      "ifscCode", "joiningDate", "assignedTeamLead", "title", "designation",
    ];
    const file = new Blob([`${headers.join(",")}\r\n`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = "employee-import-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const importCsvFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Choose a CSV file.", { theme: "dark" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("The CSV file must be 2 MB or smaller.", { theme: "dark" });
      return;
    }
    setIsImporting(true);
    setImportResult(null);
    try {
      const response = await importEmployeesCsv(await file.text());
      const result = response.data.data;
      setImportResult(result);
      toast.success(`Import finished: ${result.imported} employee record(s) added.`, { theme: "dark" });
      if (result.imported) {
        try {
          const employeesResponse = await getUsers(1, "all", 1000);
          setEmployees(employeesResponse.data.data.users);
        } catch {
          toast.info("Import completed, but the employee list could not be refreshed.", { theme: "dark" });
        }
      }
    } catch (error) {
      const message = error.response?.data?.message || "Unable to import employees.";
      toast.error(message, { theme: "dark" });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <UserLayout>
      <div className="space-y-6">
        <div className="bg-linear-to-r from-slate-900 to-teal-700 rounded-3xl p-8 text-white shadow-lg">
          <h1 className="text-4xl font-bold">Employee Management</h1>
          <p className="mt-3 text-slate-200">
            Search, filter and manage your employee directory.
          </p>
        </div>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search
                size={19}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="search"
                value={searchTerm}
                onChange={updateSearch}
                placeholder="Search by name or email..."
                className={`${inputClassName} mt-0 pl-11`}
              />
            </div>

            <select
              value={departmentFilter}
              onChange={updateDepartment}
              className={`${inputClassName} mt-0 lg:w-52`}
              aria-label="Filter by department"
            >
              <option>All departments</option>
              <option>Software</option>
              <option>Digital Marketing</option>
              <option>HR</option>
            </select>

            <select
              value={statusFilter}
              onChange={updateStatus}
              className={`${inputClassName} mt-0 lg:w-44`}
              aria-label="Filter by status"
            >
              <option>All statuses</option>
              <option>Active</option>
              <option>Not Active</option>
            </select>

            <button
              type="button"
              onClick={clearFilters}
              disabled={
                !searchTerm &&
                departmentFilter === "All departments" &&
                statusFilter === "All statuses"
              }
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Clear
            </button>

            {canAddEmployee && (
              <>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={importCsvFile}
                />
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                >
                  <Download size={17} />
                  CSV template
                </button>
                <button
                  type="button"
                  onClick={() => importInputRef.current?.click()}
                  disabled={isImporting}
                  className="flex items-center justify-center gap-2 rounded-xl border border-teal-200 px-4 py-3 text-sm font-semibold text-teal-800 transition hover:bg-teal-50 disabled:opacity-50"
                >
                  <Upload size={17} />
                  {isImporting ? "Importing..." : "Import CSV"}
                </button>
                <button
                  type="button"
                  disabled={!employeeOptions.countries.length}
                  onClick={() => setIsModalOpen(true)}
                  className="flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-800"
                >
                  <Plus size={18} />
                  Add employee
                </button>
              </>
            )}
          </div>
          {canAddEmployee && (
            <p className="mt-4 text-xs leading-5 text-slate-500">
              CSV columns are provided by the template. Employee ID may be blank for automatic assignment;
              dates must use YYYY-MM-DD. Country, bank, account holder and account number are required.
              Imports are limited to 2 MB and 1,000 data rows.
            </p>
          )}
        </section>

        {importResult && (
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
            <div className="grid gap-3 sm:grid-cols-4">
              {[
                ["Imported", importResult.imported, "text-emerald-700"],
                ["Duplicates", importResult.duplicates, "text-amber-700"],
                ["Skipped", importResult.skipped, "text-slate-600"],
                ["Failed", importResult.failed, "text-red-700"],
              ].map(([label, count, color]) => (
                <div key={label} className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">{label}</p>
                  <p className={`mt-1 text-2xl font-bold ${color}`}>{count}</p>
                </div>
              ))}
            </div>
            {importResult.rows.some((row) => row.status === "failed") && (
              <div className="mt-4 max-h-56 overflow-y-auto rounded-xl border border-red-100">
                {importResult.rows.filter((row) => row.status === "failed").map((row) => (
                  <p key={row.rowNumber} className="border-b border-red-50 px-4 py-2 text-sm text-red-700">
                    Row {row.rowNumber}: {row.message}
                  </p>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 text-center">
                <tr>
                  <th className="px-6 py-4 font-semibold">Name</th>
                  <th className="px-6 py-4 font-semibold">Email</th>
                  <th className="px-6 py-4 font-semibold">Role</th>
                  <th className="px-6 py-4 font-semibold">Department</th>
                  <th className="px-6 py-4 font-semibold">Actions</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-center">
                {isLoading ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-sm text-slate-500">
                      Loading employees...
                    </td>
                  </tr>
                ) : loadError ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-sm text-red-600">
                      {loadError}
                    </td>
                  </tr>
                ) : visibleEmployees.length > 0 ? (
                  visibleEmployees.map((employee) => (
                    <tr
                      key={employee.id}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="px-6 py-4 font-semibold text-slate-800">
                        {employee.name}
                        {!isEmployeeBankDetailsComplete(employee) && (
                          <span className="mt-1 flex items-center justify-center gap-1 text-xs font-medium text-amber-700">
                            <AlertTriangle size={13} /> Bank details incomplete
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {employee.email}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {employee.role}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${departmentBadgeClass(
                            employee.department,
                          )}`}
                        >
                          {employee.department}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center gap-2">
                          <button
                            type="button"
                            title="View employee"
                            onClick={() => navigate(`/employees/${employee.id}`)}
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-teal-700"
                          >
                            <Eye size={17} />
                          </button>
                          <button
                            type="button"
                            title="Edit employee"
                            onClick={() => navigate(`/employees/${employee.id}/edit`)}
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-blue-700"
                          >
                            <Pencil size={17} />
                          </button>
                          <button
                            type="button"
                            title="Mark employee record inactive"
                            disabled={employee.status !== "Active" || disablingId === employee.id || employee.isAuthenticationLinked}
                            onClick={() => disableEmployee(employee)}
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-30"
                            aria-label="Mark employee record inactive"
                          >
                            <Ban size={17} />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            employee.status === "Active"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {employee.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="6"
                      className="px-6 py-12 text-center text-sm text-slate-500"
                    >
                      No employees match your search or filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 px-6 py-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Page {displayedPage} of {totalPages} · {filteredEmployees.length}{" "}
              records
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={displayedPage === 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                className="rounded-lg px-3 py-2 font-medium transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
              >
                ← Previous
              </button>
              <button
                type="button"
                disabled={displayedPage === totalPages}
                onClick={() =>
                  setCurrentPage((page) => Math.min(totalPages, page + 1))
                }
                className="rounded-lg px-3 py-2 font-medium transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
              >
                Next →
              </button>
            </div>
          </div>
        </section>
      </div>

      {isModalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsModalOpen(false);
            }
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-employee-title"
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2
                  id="add-employee-title"
                  className="text-2xl font-bold text-slate-800"
                >
                  Add employee
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Add a new employee to this directory.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close add employee dialog"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={addEmployee} className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-700">
                Employee ID (optional)
                <input
                  name="employeeId"
                  value={form.employeeId}
                  onChange={updateForm}
                  className={inputClassName}
                  placeholder="EMP001"
                />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Name
                <input
                  required
                  name="name"
                  value={form.name}
                  onChange={updateForm}
                  className={inputClassName}
                  placeholder="Employee name"
                />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Email
                <input
                  required
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={updateForm}
                  className={inputClassName}
                  placeholder="employee@example.com"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Role
                  <select
                    name="role"
                    value={form.role}
                    onChange={updateForm}
                    className={inputClassName}
                  >
                    {[...new Set(["Employee", ...employeeOptions.roles])].map((role) => (
                      <option key={role}>{role}</option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm font-semibold text-slate-700">
                  Department
                  <select
                    name="department"
                    value={form.department}
                    onChange={updateForm}
                    className={inputClassName}
                  >
                    {[...new Set([form.department, ...employeeOptions.departments].filter(Boolean))].map((department) => (
                      <option key={department}>{department}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="sm:col-span-2">
                <h3 className="font-semibold text-slate-800">Employment and bank details</h3>
                <p className="mt-1 text-xs text-slate-500">Bank information is required for new employee records.</p>
              </div>

              <label className="block text-sm font-semibold text-slate-700">
                Country of employment
                <select
                  required
                  name="countryCode"
                  value={form.countryCode}
                  onChange={updateForm}
                  className={inputClassName}
                >
                  {employeeOptions.countries.map((country) => (
                    <option key={country.code} value={country.code}>{country.name}</option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Bank
                <select
                  required
                  name="bankName"
                  value={form.bankName}
                  onChange={updateForm}
                  className={inputClassName}
                >
                  <option value="">Select a bank</option>
                  {banks.map((bank) => <option key={bank}>{bank}</option>)}
                  <option value={OTHER_BANK}>{OTHER_BANK}</option>
                </select>
              </label>

              {form.bankName === OTHER_BANK && (
                <label className="block text-sm font-semibold text-slate-700">
                  Other bank name
                  <input
                    required
                    maxLength={80}
                    name="otherBankName"
                    value={form.otherBankName}
                    onChange={updateForm}
                    className={inputClassName}
                    placeholder="Enter the bank name"
                  />
                </label>
              )}

              <label className="block text-sm font-semibold text-slate-700">
                Account holder name
                <input
                  required
                  maxLength={120}
                  name="accountHolderName"
                  value={form.accountHolderName}
                  onChange={updateForm}
                  className={inputClassName}
                />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Account number
                <input
                  required
                  inputMode="numeric"
                  autoComplete="off"
                  pattern="[0-9 -]{6,24}"
                  title="6 to 20 digits"
                  name="accountNumber"
                  value={form.accountNumber}
                  onChange={updateForm}
                  className={inputClassName}
                />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Bank branch
                <input
                  maxLength={100}
                  name="bankBranch"
                  value={form.bankBranch}
                  onChange={updateForm}
                  className={inputClassName}
                />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                {form.countryCode === "IN" ? "Branch code" : "Branch code (if applicable)"}
                <input
                  maxLength={20}
                  name="bankBranchCode"
                  value={form.bankBranchCode}
                  onChange={updateForm}
                  className={inputClassName}
                />
              </label>

              {form.countryCode === "IN" && (
                <label className="block text-sm font-semibold text-slate-700">
                  IFSC code
                  <input
                    required
                    maxLength={11}
                    name="ifscCode"
                    value={form.ifscCode}
                    onChange={updateForm}
                    className={inputClassName}
                    placeholder="e.g. HDFC0001234"
                  />
                </label>
              )}

              <label className="block text-sm font-semibold text-slate-700">
                Joining date
                <input
                  type="date"
                  name="joiningDate"
                  value={form.joiningDate}
                  onChange={updateForm}
                  className={inputClassName}
                />
              </label>

              <div className="flex justify-end gap-3 pt-3 sm:col-span-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-wait disabled:opacity-60"
                >
                  {isSaving ? "Adding..." : "Add employee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </UserLayout>
  );
}

export default Employees;
