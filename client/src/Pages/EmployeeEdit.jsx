import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import UserLayout from "../layouts/UserLayout";
import {
  getEmployeeOptions,
  getUserById,
  updateUser,
} from "../api/userApi";

const editableFields = [
  ["name", "Name", "text"],
  ["email", "Email", "email"],
  ["password", "New password (leave blank to keep current)", "password"],
  ["workingHours", "Working hours", "number"],
  ["totalBreakHours", "Total break hours", "number"],
  ["monthlyTotalWorkingHours", "Monthly total working hours", "number"],
];

export default function EmployeeEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [options, setOptions] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([getUserById(id), getEmployeeOptions()])
      .then(([employeeResponse, optionsResponse]) => {
        setForm({ ...employeeResponse.data.data, password: "" });
        setOptions(optionsResponse.data.data);
      })
      .catch((requestError) =>
        setError(requestError.response?.data?.message || "Unable to load employee."),
      );
  }, [id]);

  const updateField = (event) => {
    const { name, value, type } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === "number" ? (value === "" ? "" : Number(value)) : value,
    }));
  };

  const selectFields = {
    role: ["Role", options?.roles || []],
    department: ["Department", options?.departments || []],
    status: ["Status", options?.statuses || []],
    assignedTeamLead: [
      "Assigned team lead",
      ["Not assigned", ...(options?.assignedTeamLeads || [])],
    ],
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const payload = { ...form };
    if (!payload.password) delete payload.password;
    delete payload.id;
    delete payload.createdAt;

    try {
      await updateUser(id, payload);
      toast.success("Employee updated successfully", { theme: "dark" });
      navigate(`/employees/${id}`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to update employee.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <UserLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        <button
          type="button"
          onClick={() => navigate(`/employees/${id}`)}
          className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-teal-700"
        >
          <ArrowLeft size={18} /> Back to details
        </button>
        <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200/70">
          <h1 className="text-3xl font-bold text-slate-800">Edit employee</h1>
          {error && <p className="mt-5 text-red-600">{error}</p>}
          {form ? (
            <form onSubmit={save} className="mt-8 grid gap-5 sm:grid-cols-2">
              {[
                ...editableFields.slice(0, 2),
                ["role", ...selectFields.role, "select"],
                ["department", ...selectFields.department, "select"],
                ["status", ...selectFields.status, "select"],
                ["assignedTeamLead", ...selectFields.assignedTeamLead, "select"],
                editableFields[2],
                ...editableFields.slice(3),
              ].map(([key, label, type, inputType]) => (
                <label key={key} className="text-sm font-semibold text-slate-700">
                  {label}
                  {inputType === "select" ? (
                    <select
                      required
                      name={key}
                      value={form[key] ?? ""}
                      onChange={updateField}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                    >
                      <option value="">Select {label.toLowerCase()}</option>
                      {type.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      required={key !== "password"}
                      name={key}
                      type={type}
                      value={form[key] ?? ""}
                      onChange={updateField}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                    />
                  )}
                </label>
              ))}
              <div className="flex justify-end gap-3 sm:col-span-2">
                <button type="button" onClick={() => navigate(`/employees/${id}`)} className="rounded-xl px-5 py-3 font-semibold text-slate-600 hover:bg-slate-100">
                  Cancel
                </button>
                <button disabled={saving} type="submit" className="rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white hover:bg-teal-800 disabled:opacity-50">
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          ) : !error ? (
            <p className="mt-6 text-slate-500">Loading...</p>
          ) : null}
        </section>
      </div>
    </UserLayout>
  );
}
