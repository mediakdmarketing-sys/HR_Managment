import { formatMoney } from "./payslipData";

const Field = ({ label, value }) => (
  <div className="ps-field">
    <span className="ps-field-label">{label}</span>
    <span className="ps-field-value">{value || "—"}</span>
  </div>
);

// The payslip document: company letterhead, employee details and the earnings table.
const PayslipSheet = ({ payslip, letterhead }) => {
  const { company, logo } = letterhead;
  const appearance = letterhead.appearance || {};
  const color = appearance.themeColor || "#3b7a2f";
  const preset = appearance.preset || "classic";
  const headerStyle = appearance.headerStyle || "rule";
  const footerStyle = appearance.footerStyle || "rule";
  const breakdown = payslip.workbookBreakdown;
  return (
    <div className={`ps-sheet ps-${preset}`} style={{ "--ps-brand": color }}>
      <div
        className="ps-head"
        style={{
          borderColor: color,
          borderBottomWidth: headerStyle === "plain" ? 0 : headerStyle === "accent" ? 4 : undefined,
        }}
      >
        {logo && <img className="ps-logo" src={`data:${logo.mime};base64,${logo.data}`} alt={company.name} />}
        <div>
          <p className="ps-company">{company.name}</p>
          {company.address && <p className="ps-company-line">{company.address}</p>}
          <p className="ps-company-line">
            {[company.phone && `Phone: ${company.phone}`, company.email && `Email: ${company.email}`]
              .filter(Boolean)
              .join(" | ")}
          </p>
        </div>
      </div>

      <div className="ps-title">
        <h2>Payslip</h2>
        <div className="ps-title-meta">
          <p>
            Pay period: <strong>{payslip.payPeriod}</strong>
          </p>
          <p>Payslip no: {payslip.payslipNumber}</p>
        </div>
      </div>

      <div className="ps-employee">
        <Field label="Employee name" value={payslip.name} />
        <Field label="Employee ID" value={payslip.id} />
        <Field label="Designation" value={payslip.designation} />
        <Field label="Department" value={payslip.department} />
        <Field label="Employment country" value={payslip.employmentCountry} />
        <Field label="Company email" value={payslip.email} />
        <Field label="Phone no" value={payslip.phone} />
        <Field label="Payment currency" value={payslip.paymentCurrency} />
        <Field label="Payment status" value={payslip.paymentStatus} />
        <Field label="Attendance breakdown" value={payslip.attendanceBreakdown.summaryText} />
      </div>

      <table className="ps-table">
        <thead>
          <tr>
            <th>Earnings</th>
            <th className="ps-count">Count</th>
            <th className="ps-amount">Amount</th>
          </tr>
        </thead>
        <tbody>
          {payslip.earnings.map((row) => (
            <tr key={row.label}>
              <td className="ps-earning">
                {row.label}
                {row.rate && <span className="ps-rate">{row.rate}</span>}
              </td>
              <td className="ps-count">{row.count}</td>
              <td className="ps-amount">{formatMoney(row.amount, payslip.legacyCurrency)}</td>
            </tr>
          ))}
          <tr className="ps-gross">
            <td>Total (existing day/hour calculation, {payslip.legacyCurrency})</td>
            <td className="ps-count" />
            <td className="ps-amount">{formatMoney(payslip.total, payslip.legacyCurrency)}</td>
          </tr>
        </tbody>
      </table>

      {breakdown && (
        <table className="ps-table ps-workbook-table">
          <thead>
            <tr><th colSpan="2">Workbook salary breakdown</th></tr>
          </thead>
          <tbody>
            <tr><td>Basic salary</td><td className="ps-amount">{formatMoney(breakdown.basicSalary, payslip.paymentCurrency)}</td></tr>
            <tr><td>Allowance</td><td className="ps-amount">{formatMoney(breakdown.allowance, payslip.paymentCurrency)}</td></tr>
            <tr><td>Incentive (shown separately)</td><td className="ps-amount">{formatMoney(breakdown.incentive, payslip.paymentCurrency)}</td></tr>
            <tr className="ps-gross"><td>Gross salary (incentive excluded)</td><td className="ps-amount">{formatMoney(breakdown.grossSalary, payslip.paymentCurrency)}</td></tr>
            <tr><td>No-pay leave deduction ({breakdown.noPayLeaveDays} day(s))</td><td className="ps-amount">{formatMoney(breakdown.noPayLeaveDeduction, payslip.paymentCurrency)}</td></tr>
            <tr><td>Missing leads deduction ({breakdown.missingLeadsHours} hour(s))</td><td className="ps-amount">{formatMoney(breakdown.missingLeadsDeduction, payslip.paymentCurrency)}</td></tr>
            <tr className="ps-gross"><td>Net pay</td><td className="ps-amount">{breakdown.netPay === null ? "Pending HR policy decision" : formatMoney(breakdown.netPay, payslip.paymentCurrency)}</td></tr>
          </tbody>
        </table>
      )}

      <p className="ps-note" style={{ borderTopWidth: footerStyle === "plain" ? 0 : undefined }}>
        This is a computer-generated payslip and does not require a signature.
      </p>
    </div>
  );
};

export default PayslipSheet;
