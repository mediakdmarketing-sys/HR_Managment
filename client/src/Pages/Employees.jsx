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
import CsvImportPanel from "../components/CsvImportPanel";
import PersonnelBulkImport from "../components/PersonnelBulkImport";

const PAGE_SIZE = 10;

const initialForm = {
  employeeId: "EXAMPLE-REMOVE",
  name: "",
  email: "",
  role: "Employee",
  department: "Software",
  countryCode: "LK",
  countryOfEmployment: "Sri Lanka",
  address: "",
  city: "",
  country: "Sri Lanka",
  postalCode: "",
  pinCode: "",
  phone: "",
  personalEmail: "",
  dateOfBirth: "",
  nationalId: "",
  bankName: "",
  otherBankName: "",
  accountHolderName: "",
  accountNumber: "",
  bankBranch: "",
  bankCode: "",
  bankBranchCode: "",
  micrCode: "",
  ifscCode: "",
  joiningDate: "",
  lastWorkingDate: "",
  assignedTeamLead: "Not assigned",
  title: "",
  designation: "",
};

const inputClassName =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

const employeeImportColumns = [
  ["employeeId", false], ["name", true], ["email", true], ["role", true], ["department", true],
  ["countryOfEmployment", true], ["countryCode", false], ["address", true], ["city", true],
  ["country", true], ["postalCode", false, "Required for Sri Lanka"], ["pinCode", false, "Required for India"],
  ["phone", true], ["personalEmail", false], ["dateOfBirth", false], ["nationalId", false],
  ["bankName", true], ["otherBankName", false], ["accountHolderName", true], ["accountNumber", true, null, true],
  ["bankBranch", false], ["bankCode", false], ["bankBranchCode", false], ["micrCode", false], ["ifscCode", false, "Required for India"],
  ["joiningDate", true], ["lastWorkingDate", false], ["assignedTeamLead", false], ["title", false], ["designation", true],
].map(([key, required, requiredNote, sensitive]) => ({
  key,
  header: key,
  required,
  requiredNote,
  sensitive,
}));

const employeeImportRequiredHeaders = [
  ["name"], ["email"], ["role"], ["department"], ["countryOfEmployment"], ["address"],
  ["city"], ["country"], ["phone"], ["designation"], ["joiningDate"], ["bankName"],
  ["accountHolderName"], ["accountNumber"],
];

const validateEmployeeImportRow = (row) => {
  const errors = [];
  const required = [
    ["name", "Name"], ["email", "Email"], ["role", "Role"], ["department", "Department"],
    ["countryofemployment", "Country of employment"], ["address", "Address"], ["city", "City"],
    ["country", "Country"], ["phone", "Phone"], ["designation", "Designation"],
    ["joiningdate", "Joining date"], ["bankname", "Bank name"],
    ["accountholdername", "Account holder name"], ["accountnumber", "Account number"],
  ];
  required.forEach(([key, label]) => {
    if (!String(row[key] || "").trim()) errors.push(`${label} is required.`);
  });
  if (row.employeeid && !/^EMP\d{3,}$/i.test(row.employeeid.trim())) errors.push("Employee ID must use EMP followed by at least three digits.");
  const country = String(row.countrycode || row.countryofemployment || "").trim().toLowerCase();
  if ((country === "lk" || country === "sri lanka") && !/^\d{5}$/.test(row.postalcode || "")) {
    errors.push("Sri Lankan postal code must contain five digits.");
  }
  if ((country === "in" || country === "india") && !/^\d{6}$/.test(row.pincode || "")) {
    errors.push("Indian PIN code must contain six digits.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(row.email || "").trim())) errors.push("Email is not valid.");
  if (!/^\+?[0-9\s()-]{7,20}$/.test(String(row.phone || "").trim())) errors.push("Phone number is not valid.");
  if (!/^\d{6,20}$/.test(String(row.accountnumber || "").replace(/[\s-]/g, ""))) errors.push("Account number must contain 6 to 20 digits.");
  if ((country === "in" || country === "india") && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(String(row.ifsccode || "").trim().toUpperCase())) {
    errors.push("Indian employees require a valid IFSC code.");
  }
  return errors;
};

const FieldError = ({ errors, name }) =>
  errors[name] ? (
    <p id={`${name}-error`} className="mt-1 text-xs font-medium text-red-600">
      {errors[name]}
    </p>
  ) : null;

const validateNewEmployee = (form) => {
  const errors = {};
  const requireText = (field, label) => {
    if (!String(form[field] || "").trim()) errors[field] = `${label} is required.`;
  };
  if (form.employeeId && !/^EMP\d{3,}$/i.test(form.employeeId.trim())) {
    errors.employeeId = "Employee ID must use EMP followed by at least three digits.";
  }
  requireText("name", "Name");
  if (String(form.name || "").trim().length < 2) errors.name = "Enter at least 2 characters.";
  requireText("email", "Company email");
  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  requireText("phone", "Phone number");
  if (form.phone && !/^\+?[0-9\s()-]{7,20}$/.test(form.phone.trim())) {
    errors.phone = "Enter a valid phone number.";
  }
  requireText("role", "Role");
  requireText("department", "Department");
  requireText("designation", "Designation");
  requireText("joiningDate", "Joining date");
  if (form.joiningDate && !isValidIsoDate(form.joiningDate)) {
    errors.joiningDate = "Enter a valid joining date.";
  }
  if (form.lastWorkingDate && !isValidIsoDate(form.lastWorkingDate)) {
    errors.lastWorkingDate = "Enter a valid last working date.";
  }
  if (form.dateOfBirth && (!isValidIsoDate(form.dateOfBirth) || form.dateOfBirth > new Date().toISOString().slice(0, 10))) {
    errors.dateOfBirth = "Enter a valid date of birth.";
  }
  requireText("address", "Address");
  requireText("city", "City");
  requireText("country", "Country");
  if (!form.countryCode) errors.countryCode = "Select a country of employment.";
  if (form.countryCode === "LK" && !/^\d{5}$/.test(form.postalCode || "")) {
    errors.postalCode = "Enter a valid five-digit postal code.";
  }
  if (form.countryCode === "IN" && !/^\d{6}$/.test(form.pinCode || "")) {
    errors.pinCode = "Enter a valid six-digit PIN code.";
  }
  if (!form.bankName) errors.bankName = "Select a bank.";
  if (form.bankName === OTHER_BANK && !String(form.otherBankName || "").trim()) {
    errors.otherBankName = "Enter the bank name.";
  }
  requireText("accountHolderName", "Account holder name");
  if (String(form.accountHolderName || "").trim().length < 2) {
    errors.accountHolderName = "Enter at least 2 characters.";
  }
  if (!/^\d{6,20}$/.test(String(form.accountNumber || "").replace(/[\s-]/g, ""))) {
    errors.accountNumber = "Account number must contain 6 to 20 digits.";
  }
  if (form.countryCode === "IN" && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(String(form.ifscCode || "").trim().toUpperCase())) {
    errors.ifscCode = "Enter a valid 11-character IFSC code.";
  }
  if (form.personalEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.personalEmail.trim())) {
    errors.personalEmail = "Enter a valid personal email address.";
  }
  return errors;
};

const isValidIsoDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

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
    assignedTeamLeads: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("All departments");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [formErrors, setFormErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [disablingId, setDisablingId] = useState(null);
  // Refs block a second click that lands before React re-renders the disabled button.
  const savingRef = useRef(false);
  const disablingRef = useRef(false);

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
        const previousCountry = currentForm.countryOfEmployment;
        return {
          ...currentForm,
          countryCode: value,
          countryOfEmployment: country?.name || "",
          country: currentForm.country === previousCountry ? country?.name || "" : currentForm.country,
          postalCode: "",
          pinCode: "",
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
    setFormErrors((current) => {
      const next = { ...current };
      delete next[name];
      if (name === "countryCode") {
        delete next.countryCode;
        delete next.postalCode;
        delete next.pinCode;
        delete next.bankName;
        delete next.ifscCode;
      }
      if (name === "bankName") {
        delete next.otherBankName;
      }
      return next;
    });
  };

  const fieldClass = (name) =>
    `${inputClassName} ${formErrors[name] ? "border-red-500 focus:border-red-500 focus:ring-red-100" : ""}`;

  const banks = bankOptions(
    form.countryCode,
    employeeOptions.banksByCountry?.[form.countryCode],
  );

  const addEmployee = async (event) => {
    event.preventDefault();
    if (!canAddEmployee || savingRef.current) return;
    const errors = validateNewEmployee(form);
    setFormErrors(errors);
    if (Object.keys(errors).length) return;
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
      setFormErrors({});
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

  const importEmployeeContent = async (content) => {
    const response = await importEmployeesCsv(content);
    const result = response.data.data;
    toast.success(`Import finished: ${result.imported} imported, ${result.duplicates} duplicates, ${result.skipped} skipped, ${result.failed} failed.`, { theme: "dark" });
    if (result.imported) {
      try {
        const employeesResponse = await getUsers(1, "all", 1000);
        setEmployees(employeesResponse.data.data.users);
      } catch {
        toast.info("Import completed, but the employee list could not be refreshed.", { theme: "dark" });
      }
    }
    return result;
  };

  const refreshEmployees = async () => {
    try {
      const employeesResponse = await getUsers(1, "all", 1000);
      setEmployees(employeesResponse.data.data.users);
    } catch {
      toast.info("Could not refresh employee list.", { theme: "dark" });
    }
  };

  return (
    <>
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
                <button
                  type="button"
                  onClick={() => setIsImportOpen(true)}
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                >
                  <Download size={17} />
                  CSV template
                </button>
                <button
                  type="button"
                  onClick={() => setIsImportOpen(true)}
                  className="flex items-center justify-center gap-2 rounded-xl border border-teal-200 px-4 py-3 text-sm font-semibold text-teal-800 transition hover:bg-teal-50 disabled:opacity-50"
                >
                  <Upload size={17} />
                  Import CSV
                </button>
                <button
                  type="button"
                  onClick={() => setIsBulkImportOpen(true)}
                  className="flex items-center justify-center gap-2 rounded-xl border border-teal-300 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-800 transition hover:bg-teal-100"
                  title="Import CSV with row-level validation preview"
                >
                  <Upload size={17} />
                  Bulk Import (Preview)
                </button>
                <button
                  type="button"
                disabled={!employeeOptions.countries.length}
                onClick={() => {
                  setForm(initialForm);
                  setFormErrors({});
                  setIsModalOpen(true);
                }}
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
              Employee ID may be blank for automatic assignment. New employee imports require contact,
              address, designation, joining date and country-appropriate bank details.
              Imports are limited to 2 MB and 1,000 data rows.
            </p>
          )}
        </section>

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

            <form noValidate onSubmit={addEmployee} className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-700">
                Employee ID (optional)
                <input
                  name="employeeId"
                  value={form.employeeId}
                  onChange={updateForm}
                  className={fieldClass("employeeId")}
                  placeholder="EMP001"
                  aria-invalid={Boolean(formErrors.employeeId)}
                  aria-describedby={formErrors.employeeId ? "employeeId-error" : undefined}
                />
                <FieldError errors={formErrors} name="employeeId" />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Name
                <input
                  required
                  name="name"
                  value={form.name}
                  onChange={updateForm}
                  className={fieldClass("name")}
                  placeholder="Employee name"
                  aria-invalid={Boolean(formErrors.name)}
                  aria-describedby={formErrors.name ? "name-error" : undefined}
                />
                <FieldError errors={formErrors} name="name" />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Email
                <input
                  required
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={updateForm}
                  className={fieldClass("email")}
                  placeholder="employee@example.com"
                  aria-invalid={Boolean(formErrors.email)}
                  aria-describedby={formErrors.email ? "email-error" : undefined}
                />
                <FieldError errors={formErrors} name="email" />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Phone number
                <input
                  required
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={updateForm}
                  className={fieldClass("phone")}
                  placeholder="+94 77 123 4567"
                  aria-invalid={Boolean(formErrors.phone)}
                  aria-describedby={formErrors.phone ? "phone-error" : undefined}
                />
                <FieldError errors={formErrors} name="phone" />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Personal email (optional)
                <input
                  type="email"
                  name="personalEmail"
                  value={form.personalEmail}
                  onChange={updateForm}
                  className={fieldClass("personalEmail")}
                  aria-invalid={Boolean(formErrors.personalEmail)}
                  aria-describedby={formErrors.personalEmail ? "personalEmail-error" : undefined}
                />
                <FieldError errors={formErrors} name="personalEmail" />
              </label>

              <div className="grid gap-4 sm:grid-cols-2 sm:col-span-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Role
                  <select
                    required
                    name="role"
                    value={form.role}
                    onChange={updateForm}
                    className={fieldClass("role")}
                    aria-invalid={Boolean(formErrors.role)}
                    aria-describedby={formErrors.role ? "role-error" : undefined}
                  >
                    {[...new Set(["Employee", ...employeeOptions.roles])].map((role) => (
                      <option key={role}>{role}</option>
                    ))}
                  </select>
                  <FieldError errors={formErrors} name="role" />
                </label>

                <label className="block text-sm font-semibold text-slate-700">
                  Department
                  <select
                    required
                    name="department"
                    value={form.department}
                    onChange={updateForm}
                    className={fieldClass("department")}
                    aria-invalid={Boolean(formErrors.department)}
                    aria-describedby={formErrors.department ? "department-error" : undefined}
                  >
                    {[...new Set([form.department, ...employeeOptions.departments].filter(Boolean))].map((department) => (
                      <option key={department}>{department}</option>
                    ))}
                  </select>
                  <FieldError errors={formErrors} name="department" />
                </label>
              </div>

              <div className="sm:col-span-2">
                <h3 className="font-semibold text-slate-800">Employment and bank details</h3>
                <p className="mt-1 text-xs text-slate-500">Bank codes are required only where the country-specific payment workflow needs them.</p>
              </div>

              <label className="block text-sm font-semibold text-slate-700">
                Country of employment
                <select
                  required
                  name="countryCode"
                  value={form.countryCode}
                  onChange={updateForm}
                  className={fieldClass("countryCode")}
                  aria-invalid={Boolean(formErrors.countryCode)}
                  aria-describedby={formErrors.countryCode ? "countryCode-error" : undefined}
                >
                  {employeeOptions.countries.map((country) => (
                    <option key={country.code} value={country.code}>{country.name}</option>
                  ))}
                </select>
                <FieldError errors={formErrors} name="countryCode" />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Designation
                <input
                  required
                  maxLength={100}
                  name="designation"
                  value={form.designation}
                  onChange={updateForm}
                  className={fieldClass("designation")}
                  aria-invalid={Boolean(formErrors.designation)}
                  aria-describedby={formErrors.designation ? "designation-error" : undefined}
                />
                <FieldError errors={formErrors} name="designation" />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Title (optional)
                <select name="title" value={form.title} onChange={updateForm} className={inputClassName}>
                  <option value="">Not set</option>
                  {["Mr.", "Ms.", "Mrs.", "Miss", "Dr."].map((title) => <option key={title}>{title}</option>)}
                </select>
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Assigned team lead (optional)
                <select name="assignedTeamLead" value={form.assignedTeamLead} onChange={updateForm} className={inputClassName}>
                  {[...new Set(["Not assigned", ...employeeOptions.assignedTeamLeads])].map((teamLead) => (
                    <option key={teamLead}>{teamLead}</option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Joining date
                <input
                  required
                  type="date"
                  name="joiningDate"
                  value={form.joiningDate}
                  onChange={updateForm}
                  className={fieldClass("joiningDate")}
                  aria-invalid={Boolean(formErrors.joiningDate)}
                  aria-describedby={formErrors.joiningDate ? "joiningDate-error" : undefined}
                />
                <FieldError errors={formErrors} name="joiningDate" />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Last working day (optional)
                <input type="date" name="lastWorkingDate" value={form.lastWorkingDate} onChange={updateForm} className={fieldClass("lastWorkingDate")} aria-invalid={Boolean(formErrors.lastWorkingDate)} aria-describedby={formErrors.lastWorkingDate ? "lastWorkingDate-error" : undefined} />
                <FieldError errors={formErrors} name="lastWorkingDate" />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Date of birth (optional)
                <input type="date" max={new Date().toISOString().slice(0, 10)} name="dateOfBirth" value={form.dateOfBirth} onChange={updateForm} className={fieldClass("dateOfBirth")} aria-invalid={Boolean(formErrors.dateOfBirth)} aria-describedby={formErrors.dateOfBirth ? "dateOfBirth-error" : undefined} />
                <FieldError errors={formErrors} name="dateOfBirth" />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                National ID (optional)
                <input maxLength={50} name="nationalId" value={form.nationalId} onChange={updateForm} className={inputClassName} />
              </label>

              <div className="border-t border-slate-200 pt-4 sm:col-span-2">
                <h3 className="font-semibold text-slate-800">Address</h3>
              </div>

              <label className="block text-sm font-semibold text-slate-700 sm:col-span-2">
                Address
                <textarea
                  required
                  maxLength={250}
                  rows={2}
                  name="address"
                  value={form.address}
                  onChange={updateForm}
                  className={fieldClass("address")}
                  aria-invalid={Boolean(formErrors.address)}
                  aria-describedby={formErrors.address ? "address-error" : undefined}
                />
                <FieldError errors={formErrors} name="address" />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                City
                <input
                  required
                  maxLength={100}
                  name="city"
                  value={form.city}
                  onChange={updateForm}
                  className={fieldClass("city")}
                  aria-invalid={Boolean(formErrors.city)}
                  aria-describedby={formErrors.city ? "city-error" : undefined}
                />
                <FieldError errors={formErrors} name="city" />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Country
                <input
                  required
                  maxLength={100}
                  name="country"
                  value={form.country}
                  onChange={updateForm}
                  className={fieldClass("country")}
                  aria-invalid={Boolean(formErrors.country)}
                  aria-describedby={formErrors.country ? "country-error" : undefined}
                />
                <FieldError errors={formErrors} name="country" />
              </label>

              {form.countryCode === "LK" ? (
                <label className="block text-sm font-semibold text-slate-700">
                  Postal code
                  <input
                    required
                    inputMode="numeric"
                    maxLength={5}
                    name="postalCode"
                    value={form.postalCode}
                    onChange={updateForm}
                    className={fieldClass("postalCode")}
                    aria-invalid={Boolean(formErrors.postalCode)}
                    aria-describedby={formErrors.postalCode ? "postalCode-error" : undefined}
                  />
                  <FieldError errors={formErrors} name="postalCode" />
                </label>
              ) : (
                <label className="block text-sm font-semibold text-slate-700">
                  PIN code
                  <input
                    required
                    inputMode="numeric"
                    maxLength={6}
                    name="pinCode"
                    value={form.pinCode}
                    onChange={updateForm}
                    className={fieldClass("pinCode")}
                    aria-invalid={Boolean(formErrors.pinCode)}
                    aria-describedby={formErrors.pinCode ? "pinCode-error" : undefined}
                  />
                  <FieldError errors={formErrors} name="pinCode" />
                </label>
              )}
              {isImportOpen && canAddEmployee && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4">
                  <div className="my-6 max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-slate-50 p-4 shadow-xl sm:p-6">
                    <div className="mb-4 flex justify-end">
                      <button type="button" onClick={() => setIsImportOpen(false)} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-white">Close</button>
                    </div>
                    <CsvImportPanel
                      title="Import employees"
                      description="File upload, spreadsheet paste and manual rows all use the same HR-authorized employee creation and duplicate checks."
                      columns={employeeImportColumns}
                      requiredHeaderGroups={employeeImportRequiredHeaders}
                      validateRow={validateEmployeeImportRow}
                      templateName="employee-import-template.csv"
                      sampleRow={{
                        employeeId: "",
                        name: "Example Employee",
                        email: "example.employee@example.test",
                        role: "Employee",
                        department: "Operations",
                        countryOfEmployment: "Sri Lanka",
                        countryCode: "LK",
                        address: "123 Example Street",
                        city: "Colombo",
                        country: "Sri Lanka",
                        postalCode: "00100",
                        pinCode: "",
                        phone: "+94 77 123 4567",
                        personalEmail: "example.personal@example.test",
                        dateOfBirth: "",
                        nationalId: "",
                        bankName: "People's Bank",
                        otherBankName: "",
                        accountHolderName: "Example Employee",
                        accountNumber: "1234567890",
                        bankBranch: "Colombo",
                        bankCode: "",
                        bankBranchCode: "",
                        micrCode: "",
                        ifscCode: "",
                        joiningDate: "2026-01-01",
                        lastWorkingDate: "",
                        assignedTeamLead: "Not assigned",
                        title: "",
                        designation: "Coordinator",
                      }}
                      onImport={importEmployeeContent}
                    />
                  </div>
                </div>
              )}

              <label className="block text-sm font-semibold text-slate-700">
                Bank
                <select
                  required
                  name="bankName"
                  value={form.bankName}
                  onChange={updateForm}
                  className={fieldClass("bankName")}
                  aria-invalid={Boolean(formErrors.bankName)}
                  aria-describedby={formErrors.bankName ? "bankName-error" : undefined}
                >
                  <option value="">Select a bank</option>
                  {banks.map((bank) => <option key={bank}>{bank}</option>)}
                  <option value={OTHER_BANK}>{OTHER_BANK}</option>
                </select>
                <FieldError errors={formErrors} name="bankName" />
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
                    className={fieldClass("otherBankName")}
                    placeholder="Enter the bank name"
                    aria-invalid={Boolean(formErrors.otherBankName)}
                    aria-describedby={formErrors.otherBankName ? "otherBankName-error" : undefined}
                  />
                  <FieldError errors={formErrors} name="otherBankName" />
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
                  className={fieldClass("accountHolderName")}
                  aria-invalid={Boolean(formErrors.accountHolderName)}
                  aria-describedby={formErrors.accountHolderName ? "accountHolderName-error" : undefined}
                />
                <FieldError errors={formErrors} name="accountHolderName" />
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
                  className={fieldClass("accountNumber")}
                  aria-invalid={Boolean(formErrors.accountNumber)}
                  aria-describedby={formErrors.accountNumber ? "accountNumber-error" : undefined}
                />
                <FieldError errors={formErrors} name="accountNumber" />
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
                Bank code (if applicable)
                <input maxLength={20} name="bankCode" value={form.bankCode} onChange={updateForm} className={inputClassName} />
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

              <label className="block text-sm font-semibold text-slate-700">
                MICR code (if applicable)
                <input maxLength={20} name="micrCode" value={form.micrCode} onChange={updateForm} className={inputClassName} />
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
                    className={fieldClass("ifscCode")}
                    placeholder="e.g. HDFC0001234"
                    aria-invalid={Boolean(formErrors.ifscCode)}
                    aria-describedby={formErrors.ifscCode ? "ifscCode-error" : undefined}
                  />
                  <FieldError errors={formErrors} name="ifscCode" />
                </label>
              )}

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
    {isBulkImportOpen && (
      <PersonnelBulkImport
        onImported={() => { setIsBulkImportOpen(false); refreshEmployees(); }}
        onClose={() => setIsBulkImportOpen(false)}
      />
    )}
    </>
  );
}

export default Employees;