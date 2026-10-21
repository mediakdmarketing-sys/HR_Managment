import { useMemo, useState } from "react";
import { Eye, Printer, Search, X } from "lucide-react";
import UserLayout from "../layouts/UserLayout";
import mockEmployees from "../assets/mockEmployees";
import companyIcon from "../assets/icon.png";

const PAGE_SIZE = 10;
const MAX_COUNTABLE_HOURS = 240;
const HOURLY_RATE = 150;
const inputClassName =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 0,
  }).format(amount);

const getPayslip = (employee) => {
  const monthlyTotalWorkingHours = Number(employee.monthlyTotalWorkingHours) || 0;
  const countableHours = Math.min(monthlyTotalWorkingHours, MAX_COUNTABLE_HOURS);
  const basicSalary = countableHours * HOURLY_RATE;
  const housingAllowance = Math.round(basicSalary * 0.2);
  const transportAllowance = 2500;
  const providentFund = Math.round(basicSalary * 0.12);
  const tax = Math.round((basicSalary + housingAllowance) * 0.05);

  return {
    ...employee,
    payslipNumber: `PS-${new Date().getFullYear()}-${employee.id}`,
    payPeriod: "October 2026",
    monthlyTotalWorkingHours,
    countableHours,
    hourlyRate: HOURLY_RATE,
    basicSalary,
    housingAllowance,
    transportAllowance,
    providentFund,
    tax,
    grossPay: basicSalary + housingAllowance + transportAllowance,
    totalDeductions: providentFund + tax,
    netPay:
      basicSalary +
      housingAllowance +
      transportAllowance -
      providentFund -
      tax,
  };
};

const PayslipContent = ({ payslip }) => (
  <div className="space-y-6">
    <div className="flex flex-col justify-between gap-5 border-b border-slate-200 pb-5 sm:flex-row sm:items-start">
      <div className="flex items-center gap-3">
        <img src={companyIcon} alt="HRMS logo" className="h-14 w-14" />
        <div>
          <p className="text-xl font-bold text-slate-800">HRMS</p>
          <p className="text-sm text-slate-500">HR Management</p>
        </div>
      </div>
      <div className="sm:text-right">
        <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">
          Salary statement
        </p>
        <p className="mt-1 text-sm text-slate-500">{payslip.payPeriod}</p>
        <p className="mt-1 text-xs text-slate-400">{payslip.payslipNumber}</p>
      </div>
    </div>

    <div className="grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-400">
          Employee
        </p>
        <p className="mt-1 font-semibold text-slate-800">{payslip.name}</p>
        <p className="text-sm text-slate-500">{payslip.email}</p>
      </div>
      <div className="sm:text-right">
        <p className="text-xs uppercase tracking-wide text-slate-400">
          Employment details
        </p>
        <p className="mt-1 text-sm text-slate-700">{payslip.role}</p>
        <p className="text-sm text-slate-500">
          {payslip.department} · {payslip.id}
        </p>
      </div>
    </div>

    <div className="grid gap-6 sm:grid-cols-2">
      <div>
        <h3 className="border-b border-slate-200 pb-2 text-sm font-bold uppercase tracking-wide text-slate-600">
          Earnings
        </h3>
        <div className="space-y-3 pt-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Basic salary</span>
            <span className="font-medium">{formatCurrency(payslip.basicSalary)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Countable hours ({payslip.hourlyRate}/h)</span>
            <span className="font-medium">{payslip.countableHours}h</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Housing allowance</span>
            <span className="font-medium">{formatCurrency(payslip.housingAllowance)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Transport allowance</span>
            <span className="font-medium">{formatCurrency(payslip.transportAllowance)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-3 font-bold text-slate-800">
            <span>Gross pay</span>
            <span>{formatCurrency(payslip.grossPay)}</span>
          </div>
        </div>
      </div>

      <div>
        <h3 className="border-b border-slate-200 pb-2 text-sm font-bold uppercase tracking-wide text-slate-600">
          Deductions
        </h3>
        <div className="space-y-3 pt-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Provident fund</span>
            <span className="font-medium">{formatCurrency(payslip.providentFund)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Income tax</span>
            <span className="font-medium">{formatCurrency(payslip.tax)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-3 font-bold text-slate-800">
            <span>Total deductions</span>
            <span>{formatCurrency(payslip.totalDeductions)}</span>
          </div>
        </div>
      </div>
    </div>

    <div className="flex items-center justify-between rounded-xl bg-teal-700 px-5 py-4 text-white">
      <div>
        <p className="text-sm text-teal-100">Net pay</p>
        <p className="mt-1 text-2xl font-bold">{formatCurrency(payslip.netPay)}</p>
      </div>
      <p className="text-right text-xs text-teal-100">
        Payable for<br />{payslip.payPeriod}
      </p>
    </div>

    <p className="text-center text-xs text-slate-400">
      This is a computer-generated payslip and does not require a signature.
    </p>
  </div>
);

const printPayslip = (payslip) => {
  const printWindow = window.open("", "_blank", "width=900,height=900");
  if (!printWindow) {
    return;
  }

  const logoUrl = new URL(companyIcon, window.location.origin).href;
  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${payslip.payslipNumber} - ${payslip.name}</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; background: #f1f5f9; color: #1e293b; font-family: Arial, sans-serif; }
          .sheet { max-width: 820px; margin: 32px auto; padding: 42px; background: white; }
          .header, .employee, .columns, .row, .net { display: flex; }
          .header, .employee, .net { justify-content: space-between; }
          .header { align-items: flex-start; border-bottom: 1px solid #e2e8f0; padding-bottom: 20px; }
          .brand { display: flex; align-items: center; gap: 12px; }
          .brand img { width: 58px; height: 58px; }
          h1, h2, p { margin: 0; }
          h1 { font-size: 22px; }
          h2 { color: #0f766e; font-size: 13px; text-transform: uppercase; letter-spacing: .08em; }
          .muted { color: #64748b; font-size: 13px; margin-top: 5px; }
          .right { text-align: right; }
          .employee { margin-top: 24px; padding: 16px; background: #f8fafc; border-radius: 10px; }
          .columns { gap: 42px; margin-top: 28px; }
          .column { flex: 1; }
          .section-title { border-bottom: 1px solid #e2e8f0; padding-bottom: 9px; color: #475569; font-size: 12px; font-weight: bold; letter-spacing: .08em; text-transform: uppercase; }
          .row { justify-content: space-between; padding: 8px 0; font-size: 14px; }
          .row span:first-child { color: #64748b; }
          .total { border-top: 1px solid #e2e8f0; font-weight: bold; padding-top: 12px; }
          .net { margin-top: 28px; padding: 16px 20px; background: #0f766e; color: white; border-radius: 10px; align-items: center; }
          .net-label { color: #ccfbf1; font-size: 13px; }
          .net-value { font-size: 25px; font-weight: bold; margin-top: 5px; }
          .note { color: #94a3b8; font-size: 11px; text-align: center; margin-top: 25px; }
          @media print { body { background: white; } .sheet { margin: 0; max-width: none; box-shadow: none; } }
        </style>
      </head>
      <body>
        <main class="sheet">
          <div class="header">
            <div class="brand"><img src="${logoUrl}" alt="HRMS logo"><div><h1>HRMS</h1><p class="muted">HR Management</p></div></div>
            <div class="right"><h2>Salary statement</h2><p class="muted">${payslip.payPeriod}</p><p class="muted">${payslip.payslipNumber}</p></div>
          </div>
          <div class="employee">
            <div><p class="muted">EMPLOYEE</p><p style="font-weight:bold;margin-top:5px">${payslip.name}</p><p class="muted">${payslip.email}</p></div>
            <div class="right"><p class="muted">EMPLOYMENT DETAILS</p><p style="margin-top:5px">${payslip.role}</p><p class="muted">${payslip.department} · ${payslip.id}</p></div>
          </div>
          <div class="columns">
            <div class="column"><p class="section-title">Earnings</p><div class="row"><span>Monthly working hours</span><span>${payslip.monthlyTotalWorkingHours}h</span></div><div class="row"><span>Countable hours × LKR ${payslip.hourlyRate}</span><span>${payslip.countableHours}h</span></div><div class="row"><span>Basic salary</span><span>${formatCurrency(payslip.basicSalary)}</span></div><div class="row"><span>Housing allowance</span><span>${formatCurrency(payslip.housingAllowance)}</span></div><div class="row"><span>Transport allowance</span><span>${formatCurrency(payslip.transportAllowance)}</span></div><div class="row total"><span>Gross pay</span><span>${formatCurrency(payslip.grossPay)}</span></div></div>
            <div class="column"><p class="section-title">Deductions</p><div class="row"><span>Provident fund</span><span>${formatCurrency(payslip.providentFund)}</span></div><div class="row"><span>Income tax</span><span>${formatCurrency(payslip.tax)}</span></div><div class="row total"><span>Total deductions</span><span>${formatCurrency(payslip.totalDeductions)}</span></div></div>
          </div>
          <div class="net"><div><div class="net-label">NET PAY</div><div class="net-value">${formatCurrency(payslip.netPay)}</div></div><div style="text-align:right;font-size:11px;color:#ccfbf1">Payable for<br>${payslip.payPeriod}</div></div>
          <p class="note">This is a computer-generated payslip and does not require a signature.</p>
        </main>
        <script>window.onload = function () { window.print(); };</script>
      </body>
    </html>
  `);
  printWindow.document.close();
};

function Payslip() {
  const payslips = useMemo(() => mockEmployees.map(getPayslip), []);
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("All departments");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedPayslip, setSelectedPayslip] = useState(null);

  const filteredPayslips = payslips.filter((payslip) => {
    const search = searchTerm.trim().toLowerCase();
    return (
      (!search ||
        payslip.name.toLowerCase().includes(search) ||
        payslip.email.toLowerCase().includes(search)) &&
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
                placeholder="Search by employee name or email..."
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
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-left">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-6 py-4 font-semibold">Employee</th>
                  <th className="px-6 py-4 font-semibold">Department</th>
                  <th className="px-6 py-4 font-semibold">Pay period</th>
                  <th className="px-6 py-4 font-semibold">Countable hours</th>
                  <th className="px-6 py-4 font-semibold">Net pay</th>
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
                    <td className="px-6 py-4 text-sm font-semibold text-slate-700">{payslip.countableHours}h</td>
                    <td className="px-6 py-4 font-semibold text-teal-700">{formatCurrency(payslip.netPay)}</td>
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
          <div className="my-8 w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex justify-end gap-2">
              <button type="button" onClick={() => printPayslip(selectedPayslip)} className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"><Printer size={17} /> Print payslip</button>
              <button type="button" onClick={() => setSelectedPayslip(null)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close payslip preview"><X size={20} /></button>
            </div>
            <PayslipContent payslip={selectedPayslip} />
          </div>
        </div>
      )}
    </UserLayout>
  );
}

export default Payslip;
