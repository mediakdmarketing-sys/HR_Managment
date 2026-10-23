import { useEffect, useRef, useState } from "react";
import { Eye, FileUp, Printer, Search, X } from "lucide-react";
import { toast } from "react-toastify";
import UserLayout from "../layouts/UserLayout";
import mockEmployees from "../assets/mockEmployees";
import { getLetterhead } from "../api/templateApi";
import { DEFAULT_COMPANY } from "../letters/companyDefaults";
import PayslipSheet from "../payslips/PayslipSheet";
import { PAYSLIP_CSS } from "../payslips/payslipStyles";
import { formatMoney, getPayslip, parsePayslipCsv } from "../payslips/payslipData";
import { printPayslip } from "../payslips/printPayslip";

const PAGE_SIZE = 10;
const inputClassName =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

function Payslip() {
  const fileInputRef = useRef(null);
  const [payslips, setPayslips] = useState(() => mockEmployees.map(getPayslip));
  const [dataSource, setDataSource] = useState("Mock data");
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("All departments");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedPayslip, setSelectedPayslip] = useState(null);
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

  const importCsv = (event) => {
    const [file] = event.target.files;
    if (!file) return;

    setError("");
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const importedPayslips = parsePayslipCsv(String(reader.result));
        if (importedPayslips.length === 0) {
          throw new Error("The CSV file does not contain valid payslip records.");
        }
        setPayslips(importedPayslips);
        setDataSource(file.name);
        setCurrentPage(1);
        setSearchTerm("");
        setDepartmentFilter("All departments");
      } catch (parseError) {
        setError(parseError.message);
      } finally {
        event.target.value = "";
      }
    };
    reader.onerror = () => {
      setError("The CSV file could not be read.");
      event.target.value = "";
    };
    reader.readAsText(file);
  };

  const restoreMockData = () => {
    setPayslips(mockEmployees.map(getPayslip));
    setDataSource("Mock data");
    setError("");
    setCurrentPage(1);
    setSearchTerm("");
    setDepartmentFilter("All departments");
  };

  const filteredPayslips = payslips.filter((payslip) => {
    const search = searchTerm.trim().toLowerCase();
    return (
      (!search ||
        payslip.name.toLowerCase().includes(search) ||
        payslip.email.toLowerCase().includes(search) ||
        payslip.id.toLowerCase().includes(search)) &&
      (departmentFilter === "All departments" ||
        payslip.department === departmentFilter)
    );
  });
  const totalPages = Math.max(1, Math.ceil(filteredPayslips.length / PAGE_SIZE));
  const displayedPage = Math.min(currentPage, totalPages);
  const visiblePayslips = filteredPayslips.slice(
    (displayedPage - 1) * PAGE_SIZE,
    displayedPage * PAGE_SIZE,
  );
  const departments = [...new Set(payslips.map((payslip) => payslip.department))];

  return (
    <UserLayout>
      <div className="space-y-6">
        <div className="rounded-3xl bg-linear-to-r from-slate-900 to-teal-700 p-8 text-white shadow-lg">
          <h1 className="text-4xl font-bold">Payroll & Payslips</h1>
          <p className="mt-3 text-slate-200">
            Review individual salary statements and print professional payslips.
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
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search by employee name, email or ID..."
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
              aria-label="Filter payslips by department"
            >
              <option>All departments</option>
              {departments.map((department) => (
                <option key={department}>{department}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                setDepartmentFilter("All departments");
                setCurrentPage(1);
              }}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
            >
              Clear
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={importCsv}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-800"
            >
              <FileUp size={18} />
              Import CSV
            </button>
            {dataSource !== "Mock data" && (
              <button
                type="button"
                onClick={restoreMockData}
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Restore mock data
              </button>
            )}
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <p className="mt-3 text-xs text-slate-400">Data source: {dataSource}</p>
        </section>

        <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-left">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-6 py-4 font-semibold">Employee</th>
                  <th className="px-6 py-4 font-semibold">Department</th>
                  <th className="px-6 py-4 font-semibold">Pay period</th>
                  <th className="px-6 py-4 font-semibold">Full / half days</th>
                  <th className="px-6 py-4 font-semibold">Other hours</th>
                  <th className="px-6 py-4 font-semibold">Gross pay</th>
                  <th className="px-6 py-4 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visiblePayslips.map((payslip) => (
                  <tr key={payslip.id} className="transition hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-800">{payslip.name}</p>
                      <p className="mt-1 text-sm text-slate-500">{payslip.email}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{payslip.department}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{payslip.payPeriod}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-700">
                      {payslip.fullDays} / {payslip.halfDays}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-700">{payslip.otherHours}h</td>
                    <td className="px-6 py-4 font-semibold text-teal-700">{formatMoney(payslip.grossPay)}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedPayslip(payslip)}
                        className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white transition hover:bg-teal-700"
                      >
                        <Eye size={16} />
                        View & print
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 text-sm text-slate-500">
            <span>Page {displayedPage} of {totalPages} · {filteredPayslips.length} records</span>
            <div className="flex gap-2">
              <button type="button" disabled={displayedPage === 1} onClick={() => setCurrentPage((page) => page - 1)} className="rounded-lg px-3 py-2 font-medium hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300">← Previous</button>
              <button type="button" disabled={displayedPage === totalPages} onClick={() => setCurrentPage((page) => page + 1)} className="rounded-lg px-3 py-2 font-medium hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300">Next →</button>
            </div>
          </div>
        </section>
      </div>

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
