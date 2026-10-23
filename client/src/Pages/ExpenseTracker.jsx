import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Loader2,
  Pencil,
  Plus,
  Scale,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { toast } from "react-toastify";
import { format as formatDateKey } from "date-fns";
import UserLayout from "../layouts/UserLayout";
import DateRangePicker from "../components/DateRangePicker";
import { DATE_PRESETS, formatRange } from "../utils/dateRanges";
import {
  createTransaction,
  deleteTransaction,
  getTransactions,
  updateTransaction,
} from "../api/expenseApi";

const CURRENCIES = ["LKR", "USD"];
const CURRENCY_KEY = "expenseCurrency";

const inputClassName =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-normal text-slate-700 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

const todayKey = () => formatDateKey(new Date(), "yyyy-MM-dd");

const formatDate = (value) =>
  new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(`${value}T00:00:00`),
  );

const readCurrency = () => {
  try {
    return CURRENCIES.includes(localStorage.getItem(CURRENCY_KEY)) ? localStorage.getItem(CURRENCY_KEY) : "LKR";
  } catch {
    return "LKR";
  }
};

const PANEL = {
  income: {
    title: "Income",
    addLabel: "Add income",
    icon: TrendingUp,
    tone: "text-emerald-700",
    iconTone: "bg-emerald-50 text-emerald-700",
    sign: "+",
    namePlaceholder: "e.g. Client payment",
  },
  expense: {
    title: "Expenses",
    addLabel: "Add expense",
    icon: TrendingDown,
    tone: "text-red-700",
    iconTone: "bg-red-50 text-red-700",
    sign: "−",
    namePlaceholder: "e.g. Office rent",
  },
};

const TransactionForm = ({ type, initial, onCancel, onSubmit }) => {
  const [form, setForm] = useState(
    initial
      ? { name: initial.name, description: initial.description || "", amount: String(initial.amount), date: initial.date }
      : { name: "", description: "", amount: "", date: todayKey() },
  );
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);
    try {
      await onSubmit({ ...form, type, amount: Number(form.amount) });
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-xl border border-teal-200 bg-teal-50/30 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-slate-700">
          Name <span className="text-red-600">*</span>
          <input
            required
            autoFocus
            name="name"
            maxLength={120}
            value={form.name}
            onChange={update}
            placeholder={PANEL[type].namePlaceholder}
            className={inputClassName}
          />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Value <span className="text-red-600">*</span>
          <input
            required
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            value={form.amount}
            onChange={update}
            placeholder="0.00"
            className={inputClassName}
          />
        </label>
        <label className="block text-sm font-semibold text-slate-700 sm:col-span-2">
          Description
          <textarea
            name="description"
            rows={2}
            maxLength={500}
            value={form.description}
            onChange={update}
            placeholder="Optional details"
            className={inputClassName}
          />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Date <span className="text-red-600">*</span>
          <input required name="date" type="date" value={form.date} onChange={update} className={inputClassName} />
        </label>
        <div className="flex items-end justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-wait disabled:opacity-60"
          >
            {isSaving && <Loader2 className="animate-spin" size={16} />}
            {initial ? "Save changes" : "Add"}
          </button>
        </div>
      </div>
    </form>
  );
};

const TransactionPanel = ({ type, entries, total, format, isLoading, onCreate, onUpdate, onDelete }) => {
  const config = PANEL[type];
  const Icon = config.icon;
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const remove = async (entry) => {
    if (deletingId || !window.confirm(`Delete "${entry.name}"?`)) return;
    setDeletingId(entry.id);
    try {
      await onDelete(entry);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="flex flex-col rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
        <div className="flex items-center gap-3">
          <div className={`grid h-11 w-11 place-content-center rounded-xl ${config.iconTone}`}>
            <Icon size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">{config.title}</h2>
            <p className="text-sm text-slate-500">
              {entries.length} entr{entries.length === 1 ? "y" : "ies"} ·{" "}
              <span className={`font-semibold ${config.tone}`}>{format(total)}</span>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setIsAdding(true);
            setEditingId(null);
          }}
          disabled={isAdding}
          className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
        >
          <Plus size={17} />
          {config.addLabel}
        </button>
      </div>

      <div className="flex-1 space-y-3 p-5">
        {isAdding && (
          <TransactionForm
            type={type}
            onCancel={() => setIsAdding(false)}
            onSubmit={async (data) => {
              if (await onCreate(data)) setIsAdding(false);
            }}
          />
        )}

        {isLoading ? (
          <div className="grid place-content-center py-10">
            <Loader2 className="animate-spin text-slate-400" size={22} />
          </div>
        ) : entries.length === 0 && !isAdding ? (
          <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
            <Icon className="text-slate-400" size={26} />
            <p className="mt-3 font-semibold text-slate-700">No {config.title.toLowerCase()} yet</p>
            <p className="mt-1 text-sm text-slate-500">Use “{config.addLabel}” to record one.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {entries.map((entry) =>
              editingId === entry.id ? (
                <li key={entry.id} className="py-3">
                  <TransactionForm
                    type={type}
                    initial={entry}
                    onCancel={() => setEditingId(null)}
                    onSubmit={async (data) => {
                      if (await onUpdate(entry.id, data)) setEditingId(null);
                    }}
                  />
                </li>
              ) : (
                <li key={entry.id} className="group flex items-start gap-3 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-800">{entry.name}</p>
                    {entry.description && (
                      <p className="mt-0.5 text-sm leading-5 text-slate-500">{entry.description}</p>
                    )}
                    <p className="mt-1 text-xs text-slate-400">
                      {formatDate(entry.date)}
                      {entry.createdBy ? ` · Added by ${entry.createdBy}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`font-bold tabular-nums ${config.tone}`}>
                      {config.sign} {format(entry.amount)}
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(entry.id);
                          setIsAdding(false);
                        }}
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-teal-700"
                        aria-label={`Edit ${entry.name}`}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(entry)}
                        disabled={deletingId === entry.id}
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                        aria-label={`Delete ${entry.name}`}
                      >
                        {deletingId === entry.id ? <Loader2 className="animate-spin" size={15} /> : <Trash2 size={15} />}
                      </button>
                    </div>
                  </div>
                </li>
              ),
            )}
          </ul>
        )}
      </div>
    </section>
  );
};

function ExpenseTracker() {
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  // Defaults to the current month; "All time" is one of the presets.
  const [range, setRange] = useState(() => DATE_PRESETS[0][1]());
  const [currency, setCurrency] = useState(readCurrency);

  useEffect(() => {
    let active = true;
    getTransactions()
      .then((response) => {
        if (active) setTransactions(response.data.data);
      })
      .catch((error) => {
        if (active) setLoadError(error.response?.data?.message || "Unable to load the expense tracker.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const format = useMemo(() => {
    const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 });
    return (value) => formatter.format(value || 0);
  }, [currency]);

  const changeCurrency = (value) => {
    setCurrency(value);
    try {
      localStorage.setItem(CURRENCY_KEY, value);
    } catch {
      // Only affects this visit.
    }
  };

  const fromKey = range.from ? formatDateKey(range.from, "yyyy-MM-dd") : null;
  const toKey = range.from ? formatDateKey(range.to || range.from, "yyyy-MM-dd") : null;
  const visible = fromKey
    ? transactions.filter((entry) => entry.date >= fromKey && entry.date <= toKey)
    : transactions;
  const incomes = visible.filter((entry) => entry.type === "income");
  const expenses = visible.filter((entry) => entry.type === "expense");
  const totalIncome = incomes.reduce((sum, entry) => sum + Number(entry.amount), 0);
  const totalExpense = expenses.reduce((sum, entry) => sum + Number(entry.amount), 0);
  const net = totalIncome - totalExpense;
  const spentRatio = totalIncome > 0 ? Math.min(100, Math.round((totalExpense / totalIncome) * 100)) : totalExpense > 0 ? 100 : 0;

  const errorMessage = (error, fallback) => error.response?.data?.message || fallback;

  const create = async (data) => {
    try {
      const response = await createTransaction(data);
      setTransactions((current) => [response.data.data, ...current]);
      toast.success(`${data.type === "income" ? "Income" : "Expense"} added`, { theme: "dark" });
      return true;
    } catch (error) {
      toast.error(errorMessage(error, "Unable to save the entry."), { theme: "dark" });
      return false;
    }
  };

  const update = async (id, data) => {
    try {
      const response = await updateTransaction(id, data);
      setTransactions((current) => current.map((entry) => (entry.id === id ? response.data.data : entry)));
      toast.success("Entry updated", { theme: "dark" });
      return true;
    } catch (error) {
      toast.error(errorMessage(error, "Unable to update the entry."), { theme: "dark" });
      return false;
    }
  };

  const remove = async (entry) => {
    try {
      await deleteTransaction(entry.id);
      setTransactions((current) => current.filter((item) => item.id !== entry.id));
      toast.success("Entry deleted", { theme: "dark" });
    } catch (error) {
      toast.error(errorMessage(error, "Unable to delete the entry."), { theme: "dark" });
    }
  };

  const sortByDate = (entries) =>
    [...entries].sort((a, b) => b.date.localeCompare(a.date) || String(b.createdAt).localeCompare(String(a.createdAt)));

  return (
    <UserLayout>
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-slate-900 via-slate-800 to-teal-700 p-6 text-white shadow-lg sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-teal-400/20 blur-3xl" aria-hidden="true" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-medium text-teal-200">HR operations</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Expense Tracker</h1>
              <p className="mt-2 max-w-xl text-slate-300">
                Record income and expenses and keep an eye on the net balance.
              </p>
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <span className="text-sm font-medium text-slate-500">Showing</span>
            <DateRangePicker value={range} onChange={setRange} />
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-500">
            Currency
            <select
              value={currency}
              onChange={(event) => changeCurrency(event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-teal-500"
            >
              {CURRENCIES.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
        </div>

        {loadError && <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{loadError}</p>}

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 ">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">Net balance</p>
              <div className={`grid h-10 w-10 place-content-center rounded-xl ${net >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                <Scale size={19} />
              </div>
            </div>
            <p className={`mt-3 text-3xl font-bold tracking-tight tabular-nums ${net > 0 ? "text-emerald-700" : net < 0 ? "text-red-700" : "text-slate-800"}`}>
              {isLoading ? "…" : `${net < 0 ? "−" : ""}${format(Math.abs(net))}`}
            </p>
            <p className="mt-1 text-xs text-slate-500">Total income − total expenses</p>
            <div className="mt-4">
              <div className="flex justify-between text-xs text-slate-500">
                <span>Spent of income</span>
                <span className="font-semibold text-slate-700">{spentRatio}%</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-all ${spentRatio >= 90 ? "bg-red-500" : spentRatio >= 70 ? "bg-amber-500" : "bg-emerald-500"}`}
                  style={{ width: `${spentRatio}%` }}
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">Total income</p>
              <div className="grid h-10 w-10 place-content-center rounded-xl bg-emerald-50 text-emerald-700">
                <ArrowUpRight size={19} />
              </div>
            </div>
            <p className="mt-3 text-3xl font-bold tracking-tight tabular-nums text-slate-800">
              {isLoading ? "…" : format(totalIncome)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {incomes.length} income entr{incomes.length === 1 ? "y" : "ies"}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">Total expenses</p>
              <div className="grid h-10 w-10 place-content-center rounded-xl bg-red-50 text-red-700">
                <ArrowDownRight size={19} />
              </div>
            </div>
            <p className="mt-3 text-3xl font-bold tracking-tight tabular-nums text-slate-800">
              {isLoading ? "…" : format(totalExpense)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {expenses.length} expense entr{expenses.length === 1 ? "y" : "ies"}
            </p>
          </div>
        </div>

        <div className="grid items-start gap-6 xl:grid-cols-2">
          <TransactionPanel
            type="income"
            entries={sortByDate(incomes)}
            total={totalIncome}
            format={format}
            isLoading={isLoading}
            onCreate={create}
            onUpdate={update}
            onDelete={remove}
          />
          <TransactionPanel
            type="expense"
            entries={sortByDate(expenses)}
            total={totalExpense}
            format={format}
            isLoading={isLoading}
            onCreate={create}
            onUpdate={update}
            onDelete={remove}
          />
        </div>

        {fromKey && !isLoading && (
          <p className="text-xs text-slate-400">
            Showing entries dated {formatRange(range)}. Choose “All time” in the date picker to see everything.
          </p>
        )}
      </div>
    </UserLayout>
  );
}

export default ExpenseTracker;
