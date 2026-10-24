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
  return (
    <div className="ps-sheet">
      <div className="ps-head">
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
        <Field label="Company email" value={payslip.email} />
        <Field label="Phone no" value={payslip.phone} />
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
              <td className="ps-amount">{formatMoney(row.amount)}</td>
            </tr>
          ))}
          <tr className="ps-gross">
            <td>Total</td>
            <td className="ps-count" />
            <td className="ps-amount">{formatMoney(payslip.total)}</td>
          </tr>
        </tbody>
      </table>

      <p className="ps-note">This is a computer-generated payslip and does not require a signature.</p>
    </div>
  );
};

export default PayslipSheet;
