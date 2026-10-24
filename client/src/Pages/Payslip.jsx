import { useEffect, useState } from "react";
import { Eye, Loader2, MessageCircle, Pencil, Plus, Printer, Search, X } from "lucide-react";
import { toast } from "react-toastify";
import UserLayout from "../layouts/UserLayout";
import { getLetterhead } from "../api/templateApi";
import { getPayroll, savePayrollRecord, sharePayslip, sharedPayslipUrl } from "../api/payrollApi";
import PayrollEntryDialog from "../components/PayrollEntryDialog";
import { DEFAULT_COMPANY } from "../letters/companyDefaults";
import PayslipSheet from "../payslips/PayslipSheet";
import { PAYSLIP_CSS } from "../payslips/payslipStyles";
import { buildPayslip, currentPeriod, formatMoney, formatPeriod } from "../payslips/payslipData";
import { printPayslip } from "../payslips/printPayslip";
import { payslipMessage, whatsappNumber, whatsappWebUrl } from "../payslips/whatsapp";

const PAGE_SIZE = 10;
const inputClassName =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100";
const actionClassName =
  "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40";

const blobToBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

function Payslip() {
  const [period, setPeriod] = useState(currentPeriod);
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("All departments");
  const [currentPage, setCurrentPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [sendingId, setSendingId] = useState(null);
  // Same logo and company details as the letters; defaults are used until they load.
  const [letterhead, setLetterhead] = useState({ logo: null, company: DEFAULT_COMPANY });

  useEffect(() => {
    let active = true;
    getLetterhead()
      .then((response) => {
        if (!active) return;
        const { logo, company } = response.data.data;
        setLetterhead({ logo, company: { ...DEFAULT_COMPANY, ...company } });
      })
      .catch(() => {
        // Keep the default company details; the payslip still works without a logo.
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    getPayroll(period)
      .then((response) => {
        if (!active) return;
        setEmployees(response.data.data.employees);
        setError("");
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || "Unable to load payroll.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [period]);

  const changePeriod = (value) => {
    if (!value) return;
    setIsLoading(true);
    setPeriod(value);
    setCurrentPage(1);
  };

  const saveEntry = async (entry) => {
    const response = await savePayrollRecord(editing.id, period, entry);
    const record = response.data.data;
    setEmployees((current) =>
      current.map((employee) =>
        employee.id === editing.id ? { ...employee, record, payslipNumber: record.payslipNumber } : employee,
      ),
    );
    setEditing(null);
    toast.success(`Payroll saved for ${editing.name}.`, { theme: "dark" });
  };

  // WhatsApp Web links can't carry files, so the PDF is uploaded behind a private link and the
  // link goes in the message: one press of Send delivers both.
  const sendOnWhatsApp = async (employee) => {
    const chatWindow = window.open("", "_blank");
    if (!chatWindow) {
      toast.error("Allow pop-ups for this site to open WhatsApp Web.", { theme: "dark" });
      return;
    }
    setSendingId(employee.id);
    try {
      const payslip = buildPayslip(employee, employee.record);
      const { renderPayslipPdf } = await import("../payslips/renderPayslipPdf");
      const blob = await renderPayslipPdf(payslip, letterhead);
      const response = await sharePayslip(employee.id, period, await blobToBase64(blob));
      const link = sharedPayslipUrl(response.data.data.token);
      chatWindow.location.href = whatsappWebUrl(employee.phone, payslipMessage(payslip, letterhead.company.name, link));
    } catch (sendError) {
      chatWindow.close();
      toast.error(sendError.response?.data?.message || "Unable to prepare the payslip for WhatsApp.", { theme: "dark" });
    } finally {
      setSendingId(null);
    }
  };

  const filteredEmployees = employees.filter((employee) => {
    const search = searchTerm.trim().toLowerCase();
    return (
      (!search ||
        employee.name.toLowerCase().includes(search) ||
        employee.email.toLowerCase().includes(search) ||
        employee.id.toLowerCase().includes(search) ||
        employee.payslipNumber.toLowerCase().includes(search)) &&
      (departmentFilter === "All departments" || employee.department === departmentFilter)
    );
  });
  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / PAGE_SIZE));
  const displayedPage = Math.min(currentPage, totalPages);
  const visibleEmployees = filteredEmployees.slice((displayedPage - 1) * PAGE_SIZE, displayedPage * PAGE_SIZE);
  const departments = [...new Set(employees.map((employee) => employee.department))].sort();
  const completed = employees.filter((employee) => employee.record).length;
  const monthTotal = employees.reduce((sum, employee) => sum + (employee.record?.total || 0), 0);

  return (
    <UserLayout>
      <div className="space-y-6">
        <div className="rounded-3xl bg-linear-to-r from-slate-900 to-teal-700 p-8 text-white shadow-lg">
          <h1 className="text-4xl font-bold">Payroll & Payslips</h1>
          <p className="mt-3 text-slate-200">
            Enter each employee's monthly attendance, then print or send their payslip.
          </p>
          <div className="mt-6 flex flex-wrap gap-6 text-sm">
            <p>
              <span className="block text-slate-300">Payslips ready</span>
              <span className="text-2xl font-bold">
                {completed} / {employees.length}
              </span>
            </p>
            <p>
              <span className="block text-slate-300">Total for {formatPeriod(period)}</span>
              <span className="text-2xl font-bold">{formatMoney(monthTotal)}</span>
            </p>
          </div>
        </div>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <label className="text-sm font-semibold text-slate-600 lg:w-48">
              <span className="sr-only">Pay period</span>
              <input
                type="month"
                value={period}
                onChange={(event) => changePeriod(event.target.value)}
                className={`${inputClassName} mt-0`}
                aria-label="Pay period"
              />
            </label>
            <div className="relative flex-1">
              <Search
                size={19}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search by name, email or ID..."
                className={`${inputClassName} mt-0 pl-11`}
              />
            </div>
            <select
              value={departmentFilter}
              onChange={(event) => {
                setDepartmentFilter(event.target.value);
                setCurrentPage(1);
              }}
              className={`${inputClassName} mt-0 lg:w-56`}
              aria-label="Filter by department"
            >
              <option>All departments</option>
              {departments.map((department) => (
                <option key={department}>{department}</option>
              ))}
            </select>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </section>

        <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-center">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 text-center">
                <tr>
                  <th className="px-6 py-4 font-semibold">Employee</th>
                  <th className="px-6 py-4 font-semibold">Department</th>
                  <th className="px-6 py-4 font-semibold">Company email</th>
                  <th className="px-6 py-4 font-semibold">F / H days</th>
                  <th className="px-6 py-4 font-semibold">Lagging hours</th>
                  <th className="px-6 py-4 font-semibold">Total</th>
                  <th className="px-6 py-4 font-semibold ">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading && (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-500">
                      Loading payroll...
                    </td>
                  </tr>
                )}
                {!isLoading && visibleEmployees.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-500">
                      No employees found.
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  visibleEmployees.map((employee) => {
                    const { record } = employee;
                    const canSend = record && whatsappNumber(employee.phone);
                    return (
                      <tr key={employee.id} className="transition hover:bg-slate-50">
                        <td className="px-6 py-4 text-left">
                          <p className="font-semibold text-slate-800">{employee.name}</p>
                          <p className="mt-1 text-xs text-slate-400">{employee.id}</p>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{employee.department}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{employee.email}</td>
                        <td className="px-6 py-4 text-sm font-semibold text-slate-700">
                          {record ? `${record.fullDays} / ${record.halfDays}` : "—"}
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-slate-700">
                          {record ? `${record.laggingHours}h` : "—"}
                        </td>
                        <td className="px-6 py-4 font-semibold text-teal-700">
                          {record ? (
                            formatMoney(record.total)
                          ) : (
                            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                              Not added
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditing(employee)}
                              className={`${actionClassName} bg-teal-50 text-teal-700 hover:bg-teal-100`}
                            >
                              {record ? <Pencil size={15} /> : <Plus size={15} />}
                              {record ? "Edit" : "Add"}
                            </button>
                            <button
                              type="button"
                              disabled={!record}
                              title={record ? undefined : "Add this month's payroll first"}
                              onClick={() => setSelectedPayslip(buildPayslip(employee, record))}
                              className={`${actionClassName} bg-slate-800 text-white hover:bg-teal-700`}
                            >
                              <Eye size={15} />
                              View & print
                            </button>
                            <button
                              type="button"
                              disabled={!canSend || sendingId === employee.id}
                              title={
                                !record
                                  ? "Add this month's payroll first"
                                  : !canSend
                                    ? "Add a phone number to this employee's profile"
                                    : "Send the payslip on WhatsApp"
                              }
                              onClick={() => sendOnWhatsApp(employee)}
                              className={`${actionClassName} bg-emerald-600 text-white hover:bg-emerald-700`}
                            >
                              {sendingId === employee.id ? (
                                <Loader2 className="animate-spin" size={15} />
                              ) : (
                                <MessageCircle size={15} />
                              )}
                              WhatsApp
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 text-sm text-slate-500">
            <span>
              Page {displayedPage} of {totalPages} · {filteredEmployees.length} employees
            </span>
            <div className="flex gap-2">
              <button type="button" disabled={displayedPage === 1} onClick={() => setCurrentPage((page) => page - 1)} className="rounded-lg px-3 py-2 font-medium hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300">← Previous</button>
              <button type="button" disabled={displayedPage === totalPages} onClick={() => setCurrentPage((page) => page + 1)} className="rounded-lg px-3 py-2 font-medium hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300">Next →</button>
            </div>
          </div>
        </section>
      </div>

      {editing && (
        <PayrollEntryDialog employee={editing} period={period} onSave={saveEntry} onClose={() => setEditing(null)} />
      )}

      {selectedPayslip && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4">
          <div className="my-8 w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-5 py-3">
              <p className="font-semibold text-slate-800">Payslip preview</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!printPayslip(selectedPayslip, letterhead)) {
                      toast.error("Allow pop-ups for this site to print the payslip.", { theme: "dark" });
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
                >
                  <Printer size={17} /> Print payslip
                </button>
                <button type="button" onClick={() => setSelectedPayslip(null)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close payslip preview"><X size={20} /></button>
              </div>
            </div>
            <style>{PAYSLIP_CSS}</style>
            <PayslipSheet payslip={selectedPayslip} letterhead={letterhead} />
          </div>
        </div>
      )}
    </UserLayout>
  );
}

export default Payslip;
