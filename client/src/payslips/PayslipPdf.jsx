import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatMoney } from "./payslipData";

// PDF version of PayslipSheet (same layout and colours), used for sending over WhatsApp.
const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10.5, color: "#111827", lineHeight: 1.4 },
  head: { flexDirection: "row", alignItems: "center", paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: "#e5efe0" },
  logo: { width: 72, height: 54, objectFit: "contain", marginRight: 14 },
  company: { fontFamily: "Helvetica-Bold", fontSize: 17, color: "#3b7a2f" },
  companyLine: { fontFamily: "Helvetica-Bold", fontSize: 9.5, color: "#7cb342" },
  title: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 18, marginBottom: 12 },
  titleText: { fontFamily: "Helvetica-Bold", fontSize: 14, letterSpacing: 1.2 },
  meta: { fontSize: 9.5, color: "#4b5563", textAlign: "right" },
  employee: { flexDirection: "row", flexWrap: "wrap", backgroundColor: "#f8fafc", borderRadius: 8, padding: 12 },
  field: { width: "50%", flexDirection: "row", marginBottom: 4, paddingRight: 10 },
  fieldLabel: { width: 82, color: "#6b7280", fontSize: 9.5 },
  fieldValue: { flex: 1, fontFamily: "Helvetica-Bold", fontSize: 9.5 },
  table: { marginTop: 20 },
  row: { flexDirection: "row", paddingVertical: 7, paddingHorizontal: 10 },
  th: { fontFamily: "Helvetica-Bold", fontSize: 8.5, color: "#6b7280", letterSpacing: 0.8 },
  label: { flex: 1 },
  count: { width: "22%", textAlign: "center" },
  amount: { width: "28%", textAlign: "right" },
  earning: { fontFamily: "Helvetica-Bold" },
  rate: { fontSize: 8.5, color: "#6b7280" },
  total: { backgroundColor: "#f0f7ec", borderRadius: 6, paddingVertical: 10, marginTop: 4, fontFamily: "Helvetica-Bold", fontSize: 11.5 },
  totalAmount: { color: "#2f6b24" },
  note: { marginTop: 24, textAlign: "center", fontSize: 8.5, color: "#9ca3af" },
});

const tint = (hex, opacity = 0.1) => {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16));
  return `rgba(${channels.join(",")},${opacity})`;
};

const Field = ({ label, value }) => (
  <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <Text style={styles.fieldValue}>{value || "—"}</Text>
  </View>
);

const PayslipDocument = ({ payslip, letterhead }) => {
  const { company, logo } = letterhead;
  const appearance = letterhead.appearance || {};
  const brand = appearance.themeColor || "#3b7a2f";
  const breakdown = payslip.workbookBreakdown;
  const contact = [company.phone && `Phone: ${company.phone}`, company.email && `Email: ${company.email}`]
    .filter(Boolean)
    .join(" | ");
  return (
    <Document title={`Payslip ${payslip.payslipNumber} - ${payslip.name}`}>
      <Page
        size="A4"
        style={[
          styles.page,
          appearance.preset === "minimal" ? { padding: 32 } : appearance.preset === "modern" ? { padding: 34 } : {},
        ]}
      >
        <View
          style={[
            styles.head,
            {
              borderBottomColor: brand,
              borderBottomWidth: appearance.headerStyle === "plain" ? 0 : appearance.headerStyle === "accent" ? 4 : 2,
            },
          ]}
        >
          {logo && <Image style={styles.logo} src={`data:${logo.mime};base64,${logo.data}`} />}
          <View>
            <Text style={[styles.company, { color: brand }]}>{company.name}</Text>
            {company.address && <Text style={[styles.companyLine, { color: brand }]}>{company.address}</Text>}
            {contact && <Text style={[styles.companyLine, { color: brand }]}>{contact}</Text>}
          </View>
        </View>

        <View style={styles.title}>
          <Text style={styles.titleText}>PAYSLIP</Text>
          <View>
            <Text style={styles.meta}>Pay period: {payslip.payPeriod}</Text>
            <Text style={styles.meta}>Payslip no: {payslip.payslipNumber}</Text>
          </View>
        </View>

        <View style={styles.employee}>
          <Field label="Employee name" value={payslip.name} />
          <Field label="Employee ID" value={payslip.id} />
          <Field label="Designation" value={payslip.designation} />
          <Field label="Department" value={payslip.department} />
          <Field label="Employment country" value={payslip.employmentCountry} />
          <Field label="Company email" value={payslip.email} />
          <Field label="Phone no" value={payslip.phone} />
          <Field label="Payment currency" value={payslip.paymentCurrency} />
          <Field label="Payment status" value={payslip.paymentStatus} />
          <Field label="Attendance" value={payslip.attendanceBreakdown.summaryText} />
        </View>

        <View style={styles.table}>
          <View style={styles.row}>
            <Text style={[styles.th, styles.label]}>EARNINGS</Text>
            <Text style={[styles.th, styles.count]}>COUNT</Text>
            <Text style={[styles.th, styles.amount]}>AMOUNT</Text>
          </View>
          {payslip.earnings.map((row) => (
            <View key={row.label} style={styles.row}>
              <View style={styles.label}>
                <Text style={styles.earning}>{row.label}</Text>
                {row.rate && <Text style={styles.rate}>{row.rate}</Text>}
              </View>
              <Text style={styles.count}>{row.count}</Text>
              <Text style={styles.amount}>{formatMoney(row.amount, payslip.legacyCurrency)}</Text>
            </View>
          ))}
          <View style={[styles.row, styles.total]}>
            <Text style={styles.label}>Total (existing day/hour calculation, {payslip.legacyCurrency})</Text>
            <Text style={[styles.amount, styles.totalAmount, { color: brand }]}>{formatMoney(payslip.total, payslip.legacyCurrency)}</Text>
          </View>
          {breakdown && (
            <>
              <View style={[styles.row, { marginTop: 16 }]}>
                <Text style={[styles.th, styles.label]}>WORKBOOK SALARY BREAKDOWN</Text>
                <Text style={[styles.th, styles.amount]}>AMOUNT</Text>
              </View>
              {[
                ["Basic salary", breakdown.basicSalary],
                ["Allowance", breakdown.allowance],
                ["Incentive (shown separately)", breakdown.incentive],
                ["Gross salary (incentive excluded)", breakdown.grossSalary],
                [`No-pay leave deduction (${breakdown.noPayLeaveDays} day(s))`, breakdown.noPayLeaveDeduction],
                [`Missing leads deduction (${breakdown.missingLeadsHours} hour(s))`, breakdown.missingLeadsDeduction],
              ].map(([label, amount]) => (
                <View key={label} style={styles.row}>
                  <Text style={styles.label}>{label}</Text>
                  <Text style={styles.amount}>{formatMoney(amount, payslip.paymentCurrency)}</Text>
                </View>
              ))}
              <View style={[styles.row, styles.total, { backgroundColor: tint(brand) }]}>
                <Text style={styles.label}>Net pay</Text>
                <Text style={[styles.amount, styles.totalAmount, { color: brand }]}>
                  {breakdown.netPay === null ? "Pending HR policy decision" : formatMoney(breakdown.netPay, payslip.paymentCurrency)}
                </Text>
              </View>
            </>
          )}
        </View>

        <Text
          style={[
            styles.note,
            {
              borderTopWidth: appearance.footerStyle === "plain" ? 0 : 1,
              borderTopColor: brand,
              paddingTop: appearance.footerStyle === "plain" ? 0 : 6,
            },
          ]}
        >
          This is a computer-generated payslip and does not require a signature.
        </Text>
      </Page>
    </Document>
  );
};

export default PayslipDocument;
