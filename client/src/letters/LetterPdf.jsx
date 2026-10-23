import { createContext, useContext } from "react";
import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import {
  fillPronouns,
  formatAmount,
  formatLetterDate,
  lines,
  pronouns,
} from "./letterDefaults";

// Layout mirrors the company's offer letter: A4, letterhead repeated on every page,
// numbered section headings and a signature/date line at the foot of each page.
// Never split words across lines with hyphens.
Font.registerHyphenationCallback((word) => [word]);

const COLORS = {
  ink: "#111827",
  muted: "#374151",
  brand: "#3b7a2f",
  brandLight: "#7cb342",
};

// Density levels: renderLetterPdf steps up a level when a letter would run past its page
// limit, so long addresses or clauses tighten the spacing instead of adding a page.
const DENSITY = [
  { fontSize: 10, lineHeight: 1.4, paragraph: 6, headingTop: 6, headingBottom: 4, block: 8, subject: 10, header: 14, logo: 64 },
  { fontSize: 9.6, lineHeight: 1.34, paragraph: 5, headingTop: 5, headingBottom: 3, block: 6, subject: 8, header: 10, logo: 58 },
  { fontSize: 9.2, lineHeight: 1.28, paragraph: 4, headingTop: 4, headingBottom: 2, block: 5, subject: 6, header: 8, logo: 52 },
];
export const MAX_DENSITY = DENSITY.length - 1;

const buildStyles = (level) => {
  const d = DENSITY[level];
  return StyleSheet.create({
    page: {
      paddingTop: 30,
      paddingBottom: 54,
      paddingHorizontal: 44,
      fontFamily: "Helvetica",
      fontSize: d.fontSize,
      lineHeight: d.lineHeight,
      color: COLORS.ink,
    },
    header: { flexDirection: "row", alignItems: "center", marginBottom: d.header },
    logo: { width: Math.round(d.logo * 1.28), height: d.logo, objectFit: "contain", marginRight: 14 },
    companyName: { fontFamily: "Helvetica-Bold", fontSize: 17, color: COLORS.brand, lineHeight: 1.2 },
    companyLine: { fontFamily: "Helvetica-Bold", fontSize: 10.5, color: COLORS.brandLight, lineHeight: 1.3 },
    bold: { fontFamily: "Helvetica-Bold" },
    block: { marginBottom: d.block },
    line: { fontFamily: "Helvetica-Bold" },
    subject: { fontFamily: "Helvetica-Bold", fontSize: d.fontSize + 2, marginTop: 2, marginBottom: d.subject },
    heading: {
      fontFamily: "Helvetica-Bold",
      fontSize: d.fontSize + 2,
      marginTop: d.headingTop,
      marginBottom: d.headingBottom,
    },
    paragraph: { marginBottom: d.paragraph, textAlign: "justify" },
    list: { marginBottom: d.paragraph },
    field: { flexDirection: "row", marginBottom: 1.5, paddingLeft: 4 },
    fieldLabel: { fontFamily: "Helvetica-Bold" },
    fieldValue: { flex: 1 },
    bulletRow: { flexDirection: "row", marginBottom: 1.5, paddingLeft: 14 },
    bullet: { width: 14 },
    bulletText: { flex: 1, textAlign: "justify" },
    signature: { height: 36, width: 120, objectFit: "contain", marginTop: 2 },
    signatureSpace: { height: 26 },
    signatureLine: {
      width: 170,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.muted,
      borderBottomStyle: "dotted",
      marginTop: 4,
      marginBottom: 3,
    },
    acknowledgment: { marginTop: d.block + 4 },
    footer: {
      position: "absolute",
      bottom: 24,
      left: 44,
      right: 44,
      flexDirection: "row",
      justifyContent: "space-between",
      fontFamily: "Helvetica-Bold",
      fontSize: 10,
    },
    footerBlank: { width: 160, borderBottomWidth: 1, borderBottomColor: COLORS.ink, marginLeft: 4 },
    footerItem: { flexDirection: "row", alignItems: "flex-end" },
    pageCounter: { position: "absolute", top: 0, left: 0, fontSize: 1, color: "#ffffff" },
  });
};

const STYLES = DENSITY.map((_, level) => buildStyles(level));
const StylesContext = createContext(STYLES[0]);
const useStyles = () => useContext(StylesContext);

const imageSource = (image) => (image ? `data:${image.mime};base64,${image.data}` : null);

// Invisible fixed element whose render callback reports the final page count.
const PageCounter = ({ onPageCount }) => {
  const styles = useStyles();
  if (!onPageCount) return null;
  return (
    <Text
      fixed
      style={styles.pageCounter}
      render={({ totalPages }) => {
        onPageCount(totalPages);
        return " ";
      }}
    />
  );
};

const Letterhead = ({ company, logo }) => {
  const styles = useStyles();
  return (
    <View style={styles.header} fixed>
      {logo && <Image src={imageSource(logo)} style={styles.logo} />}
      <View style={{ flex: 1 }}>
        <Text style={styles.companyName}>{company.name}</Text>
        {company.address ? <Text style={styles.companyLine}>{company.address}</Text> : null}
        <Text style={styles.companyLine}>
          {[company.phone && `Phone: ${company.phone}`, company.email && `Email: ${company.email}`]
            .filter(Boolean)
            .join(" | ")}
        </Text>
      </View>
    </View>
  );
};

const SignatureFooter = () => {
  const styles = useStyles();
  return (
    <View style={styles.footer} fixed>
      <View style={styles.footerItem}>
        <Text>Signature:</Text>
        <View style={styles.footerBlank} />
      </View>
      <View style={styles.footerItem}>
        <Text>Date:</Text>
        <View style={styles.footerBlank} />
      </View>
    </View>
  );
};

const Heading = ({ children }) => {
  const styles = useStyles();
  // minPresenceAhead keeps a heading from being left alone at the bottom of a page.
  return (
    <Text style={styles.heading} minPresenceAhead={34}>
      {children}
    </Text>
  );
};

const Paragraphs = ({ text }) => {
  const styles = useStyles();
  return lines(text).map((paragraph, index) => (
    <Text key={index} style={styles.paragraph}>
      {paragraph}
    </Text>
  ));
};

const Bullets = ({ text }) => {
  const styles = useStyles();
  return (
    <View style={styles.list}>
      {lines(text).map((item, index) => (
        <View key={index} style={styles.bulletRow} wrap={false}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
};

const Fields = ({ rows, labelWidth = 92 }) => {
  const styles = useStyles();
  return (
    <View style={styles.list}>
      {rows
        .filter(([, value]) => value)
        .map(([label, value]) => (
          <View key={label} style={styles.field}>
            <Text style={[styles.fieldLabel, { width: labelWidth }]}>{label}:</Text>
            <Text style={styles.fieldValue}>{value}</Text>
          </View>
        ))}
    </View>
  );
};

const Recipient = ({ letter }) => {
  const styles = useStyles();
  return (
    <View style={styles.block}>
      <Text style={styles.line}>To:</Text>
      <Text style={[styles.line, { paddingLeft: 4 }]}>{`${letter.title} ${letter.fullName},`.trim()}</Text>
      {lines(letter.address).map((addressLine, index) => (
        <Text key={index} style={[styles.line, { paddingLeft: 4 }]}>
          {addressLine}
        </Text>
      ))}
    </View>
  );
};

const SignOff = ({ letter, company, signature }) => {
  const styles = useStyles();
  return (
    <View wrap={false} style={{ marginTop: 4 }}>
      <Text style={styles.bold}>Sincerely,</Text>
      <Text style={styles.bold}>For {company.legalName || company.name}</Text>
      {signature ? (
        <Image src={imageSource(signature)} style={styles.signature} />
      ) : (
        <View style={styles.signatureSpace} />
      )}
      <View style={styles.signatureLine} />
      <Text style={{ color: COLORS.muted }}>Authorized Person</Text>
      {letter.signatoryName ? <Text style={styles.bold}>{letter.signatoryName}</Text> : null}
      <Text style={styles.bold}>{letter.signatoryTitle}</Text>
    </View>
  );
};

const OfferLetterBody = ({ letter, company, logo, signature, onPageCount }) => {
  const styles = useStyles();
  const name = `${letter.title} ${letter.fullName}`.trim();
  const companyName = company.legalName || company.name;
  const salary = [letter.currency, formatAmount(letter.salaryAmount)].filter(Boolean).join(" ");
  return (
    <Page size="A4" style={styles.page}>
      <Letterhead company={company} logo={logo} />
      <SignatureFooter />
      <PageCounter onPageCount={onPageCount} />

      <View style={styles.block}>
        <Text style={styles.line}>Date: {formatLetterDate(letter.date)}</Text>
      </View>
      <Recipient letter={letter} />
      {letter.nationalId ? (
        <Text style={[styles.line, styles.block]}>National ID Card No.: {letter.nationalId}</Text>
      ) : null}
      <Text style={styles.subject}>Subject: Offer of Employment – {letter.designation}</Text>

      <Text style={[styles.bold, styles.block]}>Dear {name},</Text>
      <Text style={styles.paragraph}>
        After a detailed review of your application and successful completion of the interview process, we are
        pleased to extend an offer of employment for the position of {letter.designation} with {companyName}.
      </Text>
      <Text style={styles.paragraph}>
        Your employment with the Company will be governed by the terms summarized below:
      </Text>

      <Heading>1. Position &amp; Start Date</Heading>
      <Fields
        rows={[
          ["Position", letter.designation],
          ["Department", letter.department],
          ["Start Date", formatLetterDate(letter.joiningDate)],
          ["Reporting To", letter.reportingTo],
        ]}
      />

      <Heading>2. Compensation</Heading>
      <Text style={styles.paragraph}>
        <Text style={styles.bold}>Monthly Salary: </Text>
        The Employee shall be entitled to a monthly salary of {salary || "[amount]"}
        {letter.salaryWords ? ` (${letter.salaryWords})` : ""}, {letter.salaryNote}
      </Text>
      {letter.confidentiality ? (
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>Salary Confidentiality: </Text>
          {letter.confidentiality}
        </Text>
      ) : null}
      {letter.paymentDay ? (
        <Text style={styles.paragraph}>
          All payments will be made via bank transfer on the {letter.paymentDay} of each month.
        </Text>
      ) : null}

      <Heading>3. Working Hours</Heading>
      <Fields
        rows={[
          ["Work Schedule", letter.workDays],
          ["Working Hours", letter.workHours],
          ["Breaks", letter.breaks],
        ]}
      />

      <Heading>4. Job Responsibilities</Heading>
      <Text style={styles.paragraph}>
        As a {letter.designation}, your primary duties will include, but are not limited to:
      </Text>
      <Bullets text={letter.responsibilities} />
      <Paragraphs text={letter.responsibilitiesNote} />

      <Heading>5. Probation &amp; Performance Review</Heading>
      <Text style={styles.paragraph}>
        Your initial period of employment will be {letter.probationPeriod}, during which your performance,
        conduct, and adherence to company standards will be reviewed. Successful completion of this
        probationary period will confirm your continued employment and eligibility for company benefits.
      </Text>

      <Heading>6. Leave Policy</Heading>
      <Paragraphs text={letter.leavePolicy} />

      <Heading>7. Early Termination Clause</Heading>
      <Text style={styles.paragraph}>
        If the Employee wishes to resign, they must provide {letter.noticePeriod} written notice to the Company.
        If the Employee discontinues employment without prior notice or stops reporting to work without serving
        the required notice period, the Company reserves the right to withhold salary or settle any outstanding
        dues in accordance with Company policy.
      </Text>

      <Heading>8. Employment Terms</Heading>
      <Paragraphs text={letter.employmentTerms} />

      <Heading>9. Location &amp; Work Requirements</Heading>
      <Paragraphs text={letter.workArrangement} />
      <Bullets text={letter.workRequirements} />
      <Paragraphs text={letter.workRequirementsNote} />

      <Heading>10. Acceptance of Offer</Heading>
      <Text style={styles.paragraph}>
        Please confirm your acceptance of this offer by signing and returning a copy of this letter as soon as
        possible.
      </Text>
      <Text style={styles.paragraph}>
        We look forward to welcoming you to our team and are confident that your skills and enthusiasm will
        contribute significantly to the continued growth and success of {companyName}.
      </Text>

      <SignOff letter={letter} company={company} signature={signature} />

      <View wrap={false} style={styles.acknowledgment}>
        <Text style={styles.heading}>Acknowledgment by Employee</Text>
        <Text style={styles.paragraph}>
          I, {letter.fullName}, accept the above offer of employment and agree to the terms and conditions as
          outlined.
        </Text>
      </View>
    </Page>
  );
};

const ServiceLetterBody = ({ letter, company, logo, signature, onPageCount }) => {
  const styles = useStyles();
  const name = `${letter.title} ${letter.fullName}`.trim();
  const words = pronouns(letter.title);
  const companyName = company.legalName || company.name;
  const period = letter.currentlyEmployed
    ? `since ${formatLetterDate(letter.joiningDate)} and is currently employed with us`
    : `from ${formatLetterDate(letter.joiningDate)} to ${formatLetterDate(letter.lastWorkingDate)}`;
  return (
    <Page size="A4" style={styles.page}>
      <Letterhead company={company} logo={logo} />
      <PageCounter onPageCount={onPageCount} />

      <View style={[styles.block, { flexDirection: "row", justifyContent: "space-between" }]}>
        <Text style={styles.line}>Ref No.: {letter.referenceNo}</Text>
        <Text style={styles.line}>Date: {formatLetterDate(letter.date)}</Text>
      </View>

      <Text style={[styles.subject, { textAlign: "center", marginTop: 10 }]}>TO WHOM IT MAY CONCERN</Text>
      <Text style={styles.subject}>Subject: Service Letter – {name}</Text>

      <Text style={styles.paragraph}>
        This is to certify that {name}
        {letter.nationalId ? ` (National ID Card No.: ${letter.nationalId})` : ""} has served {companyName} as a{" "}
        {letter.designation} {period}.
      </Text>

      <Heading>1. Employment Details</Heading>
      <Fields
        rows={[
          ["Employee Name", name],
          ["Employee ID", letter.employeeId],
          ["Designation", letter.designation],
          ["Department", letter.department],
          ["Date Joined", formatLetterDate(letter.joiningDate)],
          [
            letter.currentlyEmployed ? "Status" : "Last Working Day",
            letter.currentlyEmployed ? "Currently employed" : formatLetterDate(letter.lastWorkingDate),
          ],
          ["Employment Type", letter.employmentType],
          ["Work Arrangement", letter.workArrangement],
        ]}
        labelWidth={118}
      />

      <Heading>2. Duties &amp; Responsibilities</Heading>
      <Text style={styles.paragraph}>
        During {words.possessive} tenure, {words.possessive} key responsibilities included:
      </Text>
      <Bullets text={letter.responsibilities} />

      <Heading>3. Conduct &amp; Performance</Heading>
      <Paragraphs text={fillPronouns(letter.conduct, letter)} />

      <Text style={[styles.paragraph, { marginTop: 6 }]}>
        This letter is issued upon the request of {name} for {letter.purpose}. We wish {words.object}{" "}
        {letter.currentlyEmployed ? "continued success" : "every success in all future endeavours"}.
      </Text>

      <SignOff letter={letter} company={company} signature={signature} />
    </Page>
  );
};

export const OfferLetterDocument = ({ density = 0, ...props }) => (
  <Document title={`${props.letter.fullName} - Offer Letter`} author={props.company.legalName || props.company.name}>
    <StylesContext.Provider value={STYLES[density]}>
      <OfferLetterBody {...props} />
    </StylesContext.Provider>
  </Document>
);

export const ServiceLetterDocument = ({ density = 0, ...props }) => (
  <Document title={`${props.letter.fullName} - Service Letter`} author={props.company.legalName || props.company.name}>
    <StylesContext.Provider value={STYLES[density]}>
      <ServiceLetterBody {...props} />
    </StylesContext.Provider>
  </Document>
);
