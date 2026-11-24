import { useState } from "react";
import { Loader2, X } from "lucide-react";
import {
  calculateWorkbookPayrollPreview,
  formatMoney,
  formatPeriod,
  getEarnings,
} from "../payslips/payslipData";

const rows = [
  { label: "Full days", count: "fullDays", rate: "fullDayRate", unit: "per day", step: "1" },
  { label: "Half days", count: "halfDays", rate: "halfDayRate", unit: "per half day", step: "1" },
  { label: "Lagging hours", count: "laggingHours", rate: "laggingHourRate", unit: "per hour", step: "0.5" },
];

const inputClassName =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-right text-sm text-slate-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

const previewMoney = (amount, currency) =>
  /^[A-Z]{3}$/.test(String(currency || "").toUpperCase())
    ? formatMoney(amount, String(currency).toUpperCase())
    : Number(amount).toFixed(2);

// HR enters the month's counts. Rates and the increment start from the employee's previous
// month (or the company defaults) and can be changed, e.g. when company policy changes.
function PayrollEntryDialog({ employee, period, onSave, onClose }) {
  const start = employee.record || employee.suggested;
  const [entry, setEntry] = useState({
    fullDays: employee.record?.fullDays ?? "",
    halfDays: employee.record?.halfDays ?? "",
    laggingHours: employee.record?.laggingHours ?? "",
    fullDayRate: start.fullDayRate,
    halfDayRate: start.halfDayRate,
    laggingHourRate: start.laggingHourRate,
    increment: start.increment,
    workbookEnabled: Boolean(employee.record?.workbookBreakdown),
    basicSalary: employee.record?.workbookBreakdown?.basicSalary ?? "",
    allowance: employee.record?.workbookBreakdown?.allowance ?? "",
    incentive: employee.record?.workbookBreakdown?.incentive ?? "",
    noPayLeaveDays: employee.record?.workbookBreakdown?.noPayLeaveDays ?? "",
    missingLeadsHours: employee.record?.workbookBreakdown?.missingLeadsHours ?? "",
    workingDayDivisor: employee.record?.workbookBreakdown?.workingDayDivisor ?? 26,
    hoursPerDay: employee.record?.workbookBreakdown?.hoursPerDay ?? 9,
    incentiveNetTreatment: employee.record?.workbookBreakdown?.incentiveNetTreatment ?? "unconfirmed",
    currency: employee.record?.workbookBreakdown?.currency ?? "",
  });
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const { earnings, total } = getEarnings(entry);
  const referencePreview = calculateWorkbookPayrollPreview(entry);

  const update = (event) => setEntry((current) => ({ ...current, [event.target.name]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setError("");
    try {
      const legacy = Object.fromEntries(
        Object.entries(entry)
          .filter(([key]) => ["fullDays", "halfDays", "laggingHours", "fullDayRate", "halfDayRate", "laggingHourRate", "increment"].includes(key))
          .map(([key, value]) => [key, Number(value) || 0]),
      );
      if (entry.workbookEnabled) {
        Object.assign(
          legacy,
          Object.fromEntries(
            ["basicSalary", "allowance", "incentive", "noPayLeaveDays", "missingLeadsHours", "workingDayDivisor", "hoursPerDay"]
              .map((key) => [key, Number(entry[key]) || 0]),
          ),
          {
            workbookEnabled: true,
            currency: entry.currency,
            incentiveNetTreatment: entry.incentiveNetTreatment,
          },
        );
      } else {
        legacy.workbookEnabled = false;
      }
      await onSave(legacy);
    } catch (saveError) {
      setError(saveError.response?.data?.message || "Unable to save the payroll details.");
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4">
      <form onSubmit={submit} className="my-8 w-full max-w-2xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              {employee.record ? "Edit payroll" : "Add payroll"} · {formatPeriod(period)}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {employee.name} · {employee.department}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="overflow-x-auto px-6 py-5">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="pb-3 text-left font-semibold" />
                <th className="w-24 pb-3 text-right font-semibold">Count</th>
                <th className="w-6 pb-3" />
                <th className="w-32 pb-3 text-right font-semibold">Rate (LKR)</th>
                <th className="w-6 pb-3" />
                <th className="w-36 pb-3 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.count}>
                  <td className="py-2 font-semibold text-slate-700">{row.label}</td>
                  <td className="py-2">
                    <input
                      type="number"
                      min="0"
                      step={row.step}
                      name={row.count}
                      value={entry[row.count]}
                      onChange={update}
                      autoFocus={index === 0}
                      placeholder="0"
                      aria-label={`${row.label} count`}
                      className={inputClassName}
                    />
                  </td>
                  <td className="py-2 text-center text-slate-400">×</td>
                  <td className="py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      name={row.rate}
                      value={entry[row.rate]}
                      onChange={update}
                      aria-label={`${row.label} rate`}
                      className={inputClassName}
                    />
                    <span className="mt-0.5 block text-right text-xs text-slate-400">{row.unit}</span>
                  </td>
                  <td className="py-2 text-center text-slate-400">=</td>
                  <td className="py-2 text-right font-semibold tabular-nums text-slate-800">
                    {formatMoney(earnings[index].amount)}
                  </td>
                </tr>
              ))}
              <tr>
                <td className="py-2 font-semibold text-slate-700">
                  Increment
                  <span className="block text-xs font-normal text-slate-400">Added every month from now on</span>
                </td>
                <td colSpan={2} />
                <td className="py-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    name="increment"
                    value={entry.increment}
                    onChange={update}
                    aria-label="Increment"
                    className={inputClassName}
                  />
                </td>
                <td className="py-2 text-center text-slate-400">=</td>
                <td className="py-2 text-right font-semibold tabular-nums text-slate-800">
                  {formatMoney(earnings[3].amount)}
                </td>
              </tr>
              <tr className="border-t border-slate-200">
                <td className="pt-4 text-base font-bold text-slate-800">Total</td>
                <td colSpan={4} />
                <td className="pt-4 text-right text-lg font-bold tabular-nums text-teal-700">{formatMoney(total)}</td>
              </tr>
            </tbody>
          </table>
          <section className="mt-6 rounded-xl border border-slate-200 p-4">
            <label className="flex items-start gap-3 text-sm font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={entry.workbookEnabled}
                onChange={(event) => update({ target: { name: "workbookEnabled", value: event.target.checked } })}
                className="mt-1 h-4 w-4 accent-teal-700"
              />
              Use the optional Excel workbook salary breakdown
            </label>
            <p className="mt-2 text-xs text-slate-500">
              Does not replace the existing day/hour payroll total. Workbook reference: gross = basic salary + allowance (incentive excluded). The workbook’s example uses 26 working days and 9 hours per day; both remain editable per payroll record.
            </p>
            {entry.workbookEnabled && (
              <>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    ["basicSalary", "Basic salary"],
                    ["allowance", "Allowance"],
                    ["incentive", "Incentive"],
                    ["noPayLeaveDays", "No-pay leave days"],
                    ["missingLeadsHours", "Missing leads hours"],
                    ["workingDayDivisor", "Working-day divisor"],
                    ["hoursPerDay", "Hours per day"],
                  ].map(([key, label]) => (
                    <label key={key} className="text-xs font-semibold text-slate-600">
                      {label}
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={entry[key]}
                        onChange={update}
                        name={key}
                        required
                        className={`${inputClassName} mt-1 text-right`}
                      />
                    </label>
                  ))}
                  <label className="text-xs font-semibold text-slate-600">
                    Payment currency
                    <input
                      type="text"
                      maxLength={3}
                      pattern="[A-Za-z]{3}"
                      value={entry.currency}
                      onChange={update}
                      name="currency"
                      required
                      className={`${inputClassName} mt-1 uppercase`}
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Incentive treatment in net pay
                    <select
                      value={entry.incentiveNetTreatment}
                      onChange={update}
                      name="incentiveNetTreatment"
                      className={`${inputClassName} mt-1`}
                    >
                      <option value="unconfirmed">Not configured — net pay pending HR decision</option>
                      <option value="include">Include incentive after deductions</option>
                      <option value="exclude">Exclude incentive from net pay</option>
                    </select>
                  </label>
                </div>
                {referencePreview && (
                  <div className="mt-4 grid gap-2 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-2">
                    <p>Gross salary (incentive excluded): <strong>{previewMoney(referencePreview.grossSalary, entry.currency)}</strong></p>
                    <p>No-pay leave deduction: <strong>{previewMoney(referencePreview.noPayLeaveDeduction, entry.currency)}</strong></p>
                    <p>Missing leads deduction: <strong>{previewMoney(referencePreview.missingLeadsDeduction, entry.currency)}</strong></p>
                    <p>Net pay: <strong>{referencePreview.netPay === null ? "Pending HR incentive policy" : previewMoney(referencePreview.netPay, entry.currency)}</strong></p>
                  </div>
                )}
                {!entry.currency && <p className="mt-2 text-xs text-amber-800">Choose the payment currency explicitly; it is not inferred from employment country.</p>}
                <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
                  HR review required: the supplied workbook excludes incentive from gross salary, and its net-pay treatment is not established by that formula. Select an explicit treatment before a net amount is calculated.
                </p>
              </>
            )}
          </section>
          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {isSaving && <Loader2 className="animate-spin" size={16} />}
            Save
          </button>
        </div>
      </form>
    </div>
  );
}

export default PayrollEntryDialog;
