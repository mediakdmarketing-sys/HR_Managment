import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, LockKeyhole } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import UserLayout from "../layouts/UserLayout";
import {
  getAccountNumber,
  getEmployeeOptions,
  getUserById,
  updateUser,
} from "../api/userApi";
import PasswordConfirmDialog from "../components/PasswordConfirmDialog";
import { OTHER_BANK, bankOptions } from "../utils/bank";
import { isReauthRequired } from "../utils/reauth";

// Which dropdown option a saved bank name belongs to; unknown names are "Others".
const bankChoiceFor = (bankName, banks) => (!bankName ? "" : banks.includes(bankName) ? bankName : OTHER_BANK);

// Optional details used to pre-fill offer and service letters.
const letterFields = [
  ["title", "Title", "select"],
  ["designation", "Designation", "text"],
  ["nationalId", "National ID card no.", "text"],
  ["joiningDate", "Joining date", "date"],
  ["lastWorkingDate", "Last working day", "date"],
  ["address", "Address", "textarea"],
];
const TITLES = ["Mr.", "Ms.", "Mrs.", "Miss", "Dr."];

const editableFields = [
  ["name", "Name", "text"],
  ["email", "Company Email", "email"],
  ["password", "New password (leave blank to keep current)", "password"],
  ["personalEmail", "Personal email", "email"],
  ["phone", "Phone number", "tel"],
  ["dateOfBirth", "Date of birth", "date"],
];
// Existing employees may not have these yet, so they are not required.
const optionalFields = ["password", "personalEmail", "phone", "dateOfBirth"];

export default function EmployeeEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [options, setOptions] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [bankChoice, setBankChoice] = useState("");
  // The account number stays masked until HR re-enters their password.
  const [accountUnlocked, setAccountUnlocked] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [confirmFor, setConfirmFor] = useState(null);

  useEffect(() => {
    Promise.all([getUserById(id), getEmployeeOptions()])
      .then(([employeeResponse, optionsResponse]) => {
        setForm({ ...employeeResponse.data.data, password: "" });
        setBankChoice(bankChoiceFor(employeeResponse.data.data.bankName, bankOptions(optionsResponse.data.data.banks)));
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

  const chooseBank = (event) => {
    const choice = event.target.value;
    setBankChoice(choice);
    // "Others" starts empty so HR types the bank name; a listed bank is saved as-is.
    setForm((current) => ({
      ...current,
      bankName: choice === OTHER_BANK ? (banks.includes(current.bankName) ? "" : current.bankName || "") : choice,
    }));
  };

  const banks = bankOptions(options?.banks);

  const selectFields = {
    role: ["Role", options?.roles || []],
    department: ["Department", options?.departments || []],
    status: ["Status", options?.statuses || []],
    assignedTeamLead: [
      "Assigned team lead",
      ["Not assigned", ...(options?.assignedTeamLeads || [])],
    ],
  };

  const loadAccountNumber = async () => {
    const response = await getAccountNumber(id);
    setForm((current) => ({ ...current, accountNumber: response.data.data.accountNumber }));
    setAccountUnlocked(true);
  };

  const unlockAccountNumber = async () => {
    setIsUnlocking(true);
    try {
      await loadAccountNumber();
    } catch (requestError) {
      if (isReauthRequired(requestError)) setConfirmFor("unlock");
      else setError(requestError.response?.data?.message || "Unable to load the account number.");
    } finally {
      setIsUnlocking(false);
    }
  };

  const submit = async () => {
    setSaving(true);
    setError("");
    const payload = { ...form };
    if (!payload.password) delete payload.password;
    delete payload.id;
    delete payload.createdAt;
    delete payload.accountNumberMasked;
    // A typed name that matches a listed bank (ignoring case) is saved with the listed spelling.
    const typedBank = String(payload.bankName || "").trim().toLowerCase();
    payload.bankName = banks.find((bank) => bank.toLowerCase() === typedBank) || payload.bankName;
    // Only send the account number when it was unlocked (and so possibly changed).
    if (!accountUnlocked) delete payload.accountNumber;

    try {
      await updateUser(id, payload);
      toast.success("Employee updated successfully", { theme: "dark" });
      navigate(`/employees/${id}`);
    } catch (requestError) {
      // The password confirmation is only valid for a few minutes; ask again, then retry.
      if (isReauthRequired(requestError)) setConfirmFor("save");
      else setError(requestError.response?.data?.message || "Unable to update employee.");
    } finally {
      setSaving(false);
    }
  };

  const save = (event) => {
    event.preventDefault();
    if (!saving) submit();
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
                      required={!optionalFields.includes(key)}
                      max={key === "dateOfBirth" ? new Date().toISOString().slice(0, 10) : undefined}
                      placeholder={key === "phone" ? "+94 77 123 4567" : undefined}
                      name={key}
                      type={type}
                      value={form[key] ?? ""}
                      onChange={updateField}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                    />
                  )}
                </label>
              ))}
              <div className="border-t border-slate-200 pt-5 sm:col-span-2">
                <h2 className="text-lg font-bold text-slate-800">Letter details</h2>
                <p className="mt-1 text-sm text-slate-500">Optional. Used to pre-fill offer and service letters.</p>
              </div>
              {letterFields.map(([key, label, type]) => (
                <label key={key} className={`text-sm font-semibold text-slate-700 ${type === "textarea" ? "sm:col-span-2" : ""}`}>
                  {label}
                  {type === "select" ? (
                    <select
                      name={key}
                      value={form[key] ?? ""}
                      onChange={updateField}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                    >
                      <option value="">Not set</option>
                      {TITLES.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  ) : type === "textarea" ? (
                    <textarea
                      name={key}
                      rows={3}
                      value={form[key] ?? ""}
                      onChange={updateField}
                      placeholder="Street, city, country (one line per row)"
                      className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                    />
                  ) : (
                    <input
                      name={key}
                      type={type}
                      value={form[key] ?? ""}
                      onChange={updateField}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                    />
                  )}
                </label>
              ))}
              <div className="border-t border-slate-200 pt-5 sm:col-span-2">
                <h2 className="text-lg font-bold text-slate-800">Bank details</h2>
                <p className="mt-1 text-sm text-slate-500">Optional. Used for salary payments.</p>
              </div>
              <label className="text-sm font-semibold text-slate-700">
                Bank name
                <select
                  value={bankChoice}
                  onChange={chooseBank}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                >
                  <option value="">Not set</option>
                  {[...banks, OTHER_BANK].map((bank) => (
                    <option key={bank}>{bank}</option>
                  ))}
                </select>
              </label>
              {bankChoice === OTHER_BANK && (
                <label className="text-sm font-semibold text-slate-700">
                  Other bank name
                  <input
                    required
                    autoFocus
                    name="bankName"
                    maxLength={80}
                    value={form.bankName ?? ""}
                    onChange={updateField}
                    placeholder="Enter the bank name"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                  />
                </label>
              )}
              <div className={`text-sm font-semibold text-slate-700 ${bankChoice === OTHER_BANK ? "sm:col-span-2" : ""}`}>
                <label htmlFor="accountNumber">Account number</label>
                {accountUnlocked ? (
                  <input
                    id="accountNumber"
                    name="accountNumber"
                    inputMode="numeric"
                    autoComplete="off"
                    pattern="[0-9 \-]{6,24}"
                    title="6 to 20 digits"
                    value={form.accountNumber ?? ""}
                    onChange={updateField}
                    placeholder="e.g. 1234567890"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal tracking-wide outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                  />
                ) : (
                  <div className="mt-1 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2">
                    <span className="font-mono font-normal tracking-wider text-slate-600">
                      {form.accountNumberMasked || "Not set"}
                    </span>
                    <button
                      id="accountNumber"
                      type="button"
                      onClick={unlockAccountNumber}
                      disabled={isUnlocking}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-teal-700 transition hover:bg-teal-50"
                    >
                      {isUnlocking ? <Loader2 className="animate-spin" size={14} /> : <LockKeyhole size={14} />}
                      {form.accountNumberMasked ? "Unlock to edit" : "Unlock to add"}
                    </button>
                  </div>
                )}
              </div>
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
      {confirmFor && (
        <PasswordConfirmDialog
          description={
            confirmFor === "save"
              ? "Your password confirmation has expired. Re-enter it to save the account number."
              : "Re-enter your password to view and edit this account number."
          }
          onClose={() => setConfirmFor(null)}
          onConfirmed={async () => {
            const action = confirmFor;
            setConfirmFor(null);
            if (action === "save") await submit();
            else await loadAccountNumber();
          }}
        />
      )}
    </UserLayout>
  );
}
