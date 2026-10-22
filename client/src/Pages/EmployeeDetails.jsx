import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import UserLayout from "../layouts/UserLayout";
import { getUserById } from "../api/userApi";

const fields = [
  ["name", "Name"],
  ["email", "Email"],
  ["role", "Role"],
  ["department", "Department"],
  ["status", "Status"],
  ["assignedTeamLead", "Assigned team lead"],
  ["workingHours", "Working hours"],
  ["totalBreakHours", "Total break hours"],
  ["monthlyTotalWorkingHours", "Monthly total working hours"],
];

export default function EmployeeDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);
  const [error, setError] = useState("");

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
                  <p className="mt-2 font-medium text-slate-800">{employee[key] ?? "—"}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </UserLayout>
  );
}
