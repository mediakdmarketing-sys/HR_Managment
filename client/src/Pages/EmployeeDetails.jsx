import { useEffect, useState } from "react";
import { ArrowLeft, Landmark, LockKeyhole } from "lucide-react";
import { toast } from "react-toastify";
import { useNavigate, useParams } from "react-router-dom";
import UserLayout from "../layouts/UserLayout";
import { getAccountNumber, getUserById } from "../api/userApi";
import PasswordConfirmDialog from "../components/PasswordConfirmDialog";
import { getUser } from "../utils/auth";

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
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bank name</p>
                    <p className="mt-2 font-medium text-slate-800">{employee.bankName || "—"}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Account number</p>
                    <AccountNumber employeeId={id} masked={employee.accountNumberMasked} />
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      </div>
    </UserLayout>
  );
}
