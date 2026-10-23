// Default content for offer and service letters. Everything here is editable per letter.

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

const belowThousand = (number) => {
  const hundreds = Math.floor(number / 100);
  const rest = number % 100;
  const parts = [];
  if (hundreds) parts.push(`${ONES[hundreds]} Hundred`);
  if (rest >= 20) parts.push(`${TENS[Math.floor(rest / 10)]}${rest % 10 ? `-${ONES[rest % 10]}` : ""}`);
  else if (rest) parts.push(ONES[rest]);
  return parts.join(" ");
};

export const numberToWords = (value) => {
  let number = Math.floor(Number(value));
  if (!Number.isFinite(number) || number <= 0) return "";
  const scales = ["", "Thousand", "Million", "Billion"];
  const parts = [];
  for (let scale = 0; number > 0 && scale < scales.length; scale += 1) {
    const chunk = number % 1000;
    if (chunk) parts.unshift(`${belowThousand(chunk)}${scales[scale] ? ` ${scales[scale]}` : ""}`);
    number = Math.floor(number / 1000);
  }
  return parts.join(" ");
};

const CURRENCY_WORDS = { LKR: "Rupees", USD: "US Dollars", INR: "Rupees", GBP: "Pounds", EUR: "Euros" };

export const amountInWords = (currency, amount) => {
  const words = numberToWords(amount);
  if (!words) return "";
  return `${CURRENCY_WORDS[currency] || currency} ${words} only`;
};

export const formatAmount = (amount) => {
  const number = Number(String(amount).replace(/,/g, ""));
  return Number.isFinite(number) && String(amount).trim() !== ""
    ? number.toLocaleString("en-US")
    : String(amount || "");
};

export const formatLetterDate = (value) => {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(date);
};

const todayKey = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export const TITLES = ["Mr.", "Ms.", "Mrs.", "Miss", "Dr."];

export const pronouns = (title) => {
  if (title === "Mr.") return { subject: "he", object: "him", possessive: "his" };
  if (["Ms.", "Mrs.", "Miss"].includes(title)) return { subject: "she", object: "her", possessive: "her" };
  return { subject: "they", object: "them", possessive: "their" };
};

// Fields that are also stored on the employee record.
export const PROFILE_FIELDS = ["title", "designation", "address", "nationalId", "joiningDate"];

const employeeBasics = (employee) => ({
  employeeId: employee.id || "",
  title: employee.title || "Mr.",
  fullName: employee.name || "",
  address: employee.address || "",
  nationalId: employee.nationalId || "",
  designation: employee.designation || employee.role || "",
  department: employee.department || "",
  joiningDate: employee.joiningDate || (employee.createdAt || "").slice(0, 10),
});

export const createOfferLetter = (employee, company) => {
  const basics = employeeBasics(employee);
  return {
    ...basics,
    date: todayKey(),
    reportingTo: employee.assignedTeamLead && employee.assignedTeamLead !== "Not assigned"
      ? employee.assignedTeamLead
      : "CEO",
    currency: "LKR",
    salaryAmount: "",
    salaryWords: "",
    salaryNote:
      "inclusive of all applicable allowances, payable in accordance with the Company’s payroll policies.",
    confidentiality:
      "The Employee shall maintain strict confidentiality regarding their salary and compensation details and shall not disclose or share this information with other team members, colleagues, or any other unauthorized persons, except where disclosure is required by law or to exercise applicable legal rights.",
    paymentDay: "10th",
    workDays: "Monday to Saturday",
    workHours: "8:00 AM to 6:00 PM (GMT-4) – New York Time",
    breaks: "1 hour in total (30-minute meal break and two 15-minute short breaks)",
    responsibilities: [
      "Develop, maintain, and update websites using front-end and back-end technologies.",
      "Collaborate with the team to deliver assigned projects on time and to a high standard.",
      "Troubleshoot, test, and resolve issues in existing systems and applications.",
      "Follow company processes, documentation standards, and reporting requirements.",
    ].join("\n"),
    responsibilitiesNote:
      "Further details of your duties and performance expectations will be provided during onboarding and training.",
    probationPeriod: "six (6) months",
    leavePolicy: [
      "Upon successful completion of the probation period, you will be entitled to 5 paid holidays per year: January 1st, July 4th, December 25th and Two (2) cultural holidays (with prior manager approval).",
      "All other leave will be considered unpaid and must be approved in advance.",
    ].join("\n"),
    noticePeriod: "one (1) month's",
    employmentTerms: [
      "This offer and your employment are contingent upon your agreement to comply with all Company policies, procedures, and confidentiality requirements.",
      "Detailed terms of employment will be provided in your Employee Agreement, which must be signed upon joining.",
    ].join("\n"),
    workArrangement: "This is a remote (online) position. You are required to:",
    workRequirements: [
      "Work online through Zoom with your camera on during all working hours.",
      "Install and use the company’s Invigilator software for attendance and monitoring.",
      "Maintain a stable internet connection and a quiet, professional workspace.",
    ].join("\n"),
    workRequirementsNote: "Failure to follow these requirements may result in disciplinary action.",
    signatoryName: "",
    signatoryTitle: company.signatoryTitle,
  };
};

export const createServiceLetter = (employee, company) => {
  const basics = employeeBasics(employee);
  const isActive = employee.status === "Active";
  return {
    ...basics,
    date: todayKey(),
    referenceNo: `${employee.id || "EMP"}/SL/${new Date().getFullYear()}`,
    currentlyEmployed: isActive,
    lastWorkingDate: employee.lastWorkingDate || (isActive ? "" : todayKey()),
    employmentType: "Full-time",
    workArrangement: "Remote (online)",
    responsibilities: [
      "Developed, maintained, and updated websites and web applications.",
      "Collaborated with team members to deliver assigned projects on schedule.",
      "Troubleshot and resolved technical issues in existing systems.",
    ].join("\n"),
    conduct:
      "During the period of service, {name} demonstrated professionalism, dedication, and a strong commitment to {possessive} responsibilities. {Subject} maintained good conduct and character throughout {possessive} employment with us.",
    purpose: "whatever purpose it may serve",
    signatoryName: "",
    signatoryTitle: company.signatoryTitle,
  };
};

// Replaces {name}, {subject}, {Subject}, {object}, {possessive} in free-text paragraphs.
export const fillPronouns = (text, letter) => {
  const words = pronouns(letter.title);
  const capitalize = (word) => word.charAt(0).toUpperCase() + word.slice(1);
  return String(text || "")
    .replaceAll("{name}", `${letter.title} ${letter.fullName}`.trim())
    .replaceAll("{Subject}", capitalize(words.subject))
    .replaceAll("{subject}", words.subject)
    .replaceAll("{object}", words.object)
    .replaceAll("{possessive}", words.possessive);
};

export const lines = (text) =>
  String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
