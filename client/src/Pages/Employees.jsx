import { useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import UserLayout from "../layouts/UserLayout";
import mockEmployees from "../assets/mockEmployees";
import { getUser } from "../utils/auth";

const PAGE_SIZE = 10;

const initialForm = {
  name: "",
  email: "",
  password: "",
  role: "Employees",
  department: "Software",
};

const inputClassName =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

function Employees() {
  const user = getUser();
  const canAddEmployee = user?.role === "HR";
  const [employees, setEmployees] = useState(mockEmployees);
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("All departments");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState(initialForm);

  const filteredEmployees = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return employees.filter((employee) => {
      const matchesSearch =
        !search ||
        employee.name.toLowerCase().includes(search) ||
        employee.email.toLowerCase().includes(search);
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
    setForm((currentForm) => ({ ...currentForm, [name]: value }));
  };

  const addEmployee = (event) => {
    event.preventDefault();
    if (!canAddEmployee) return;

    const nextEmployee = {
      id: `EMP${String(employees.length + 1).padStart(3, "0")}`,
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password,
      role: form.role,
      department: form.department,
      status: "Active",
      assignedTeamLead: "Not assigned",
      workingHours: 0,
    };

    setEmployees((currentEmployees) => [nextEmployee, ...currentEmployees]);
    setForm(initialForm);
    setIsModalOpen(false);
    setCurrentPage(1);
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
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-800"
              >
                <Plus size={18} />
                Add employee
              </button>
            )}
          </div>
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
                  <th className="px-6 py-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-center">
                {visibleEmployees.length > 0 ? (
                  visibleEmployees.map((employee) => (
                    <tr
                      key={employee.id}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="px-6 py-4 font-semibold text-slate-800">
                        {employee.name}
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
                      colSpan="5"
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
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
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

            <form onSubmit={addEmployee} className="space-y-4">
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

              <label className="block text-sm font-semibold text-slate-700">
                Temporary password
                <input
                  required
                  minLength="6"
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={updateForm}
                  className={inputClassName}
                  placeholder="Enter temporary password"
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
                    <option>HR</option>
                    <option>Managers</option>
                    <option>Employees</option>
                    <option>Recruiters</option>
                    <option>Finance</option>
                    <option>Team Lead</option>
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
                    <option>Software</option>
                    <option>Digital Marketing</option>
                    <option>HR</option>
                  </select>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-800"
                >
                  Add employee
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
