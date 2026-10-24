import { firestore } from "../config/firebase.js";

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models";
// Tried in order: the first is accurate, the second is a fast fallback when the first is
// slow or busy. Free-tier model names change over time; override them in the environment.
const MODELS = [
  { name: process.env.GEMINI_MODEL || "gemini-3.5-flash", timeout: 30_000 },
  { name: process.env.GEMINI_FALLBACK_MODEL || "gemini-flash-lite-latest", timeout: 25_000 },
];
const TIMEZONE = process.env.BIRTHDAY_TIMEZONE || "Asia/Colombo";
const MAX_TRANSACTIONS = 400;

export const isConfigured = () => Boolean(process.env.GEMINI_API_KEY);

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date());

// One line per row, "|"-separated, so the snapshot stays compact.
const table = (title, columns, rows) =>
  `## ${title} (${rows.length})\n${columns.join(" | ")}\n${rows
    .map((row) => columns.map((column) => String(row[column] ?? "").replace(/[|\n]/g, " ")).join(" | "))
    .join("\n")}`;

// The data the assistant may use. Deliberately left out, because free-tier prompts may be
// read by Google: account numbers, bank names, national IDs, addresses, phone numbers,
// personal emails, passwords, leave reasons and attachments.
const buildSnapshot = async () => {
  const [employeeSnapshot, leaveSnapshot, transactionSnapshot, payrollSnapshot] = await Promise.all([
    firestore.collection("employees").get(),
    firestore.collection("leaveRequests").get(),
    firestore.collection("transactions").get(),
    firestore.collection("payrollRecords").get(),
  ]);

  const employees = employeeSnapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name,
      companyEmail: data.email,
      role: data.role,
      designation: data.designation || "",
      department: data.department,
      status: data.status,
      teamLead: data.assignedTeamLead || "",
      joiningDate: data.joiningDate || "",
      addedOn: String(data.createdAt || "").slice(0, 10),
      birthday: data.dateOfBirth ? data.dateOfBirth.slice(5) : "",
    };
  });
  const names = new Map(employees.map((employee) => [employee.id, employee.name]));

  const leaves = leaveSnapshot.docs
    .map((doc) => doc.data())
    .map((leave) => ({
      employee: names.get(leave.employeeId) || leave.employeeId,
      type: leave.type,
      from: leave.startDate,
      to: leave.endDate,
      days: leave.days,
      status: leave.status,
      reviewedBy: names.get(leave.reviewedBy) || "",
    }))
    .sort((a, b) => String(b.from).localeCompare(String(a.from)));

  const transactions = transactionSnapshot.docs
    .map((doc) => doc.data())
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, MAX_TRANSACTIONS)
    .map((item) => ({
      date: item.date,
      type: item.type,
      name: item.name,
      description: item.description || "",
      amountLKR: item.amount,
    }));

  const payroll = payrollSnapshot.docs
    .map((doc) => doc.data())
    .sort((a, b) => b.period.localeCompare(a.period))
    .map((record) => ({
      month: record.period,
      employee: names.get(record.employeeId) || record.employeeId,
      payslipNo: record.payslipNumber,
      fullDays: record.fullDays,
      halfDays: record.halfDays,
      laggingHours: record.laggingHours,
      fullDayRate: record.fullDayRate,
      halfDayRate: record.halfDayRate,
      laggingHourRate: record.laggingHourRate,
      increment: record.increment,
      totalLKR: record.total,
    }));

  return [
    summary(employees, leaves, transactions, payroll),
    table("Employees", ["id", "name", "companyEmail", "role", "designation", "department", "status", "teamLead", "joiningDate", "addedOn", "birthday"], employees),
    table("Leave requests", ["employee", "type", "from", "to", "days", "status", "reviewedBy"], leaves),
    table(
      `Expense tracker entries${transactions.length === MAX_TRANSACTIONS ? ` (latest ${MAX_TRANSACTIONS} only)` : ""}`,
      ["date", "type", "name", "description", "amountLKR"],
      transactions,
    ),
    table("Payroll records", ["month", "employee", "payslipNo", "fullDays", "halfDays", "laggingHours", "fullDayRate", "halfDayRate", "laggingHourRate", "increment", "totalLKR"], payroll),
  ].join("\n\n");
};

const money = (amount) => `LKR ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const countBy = (rows, key) =>
  Object.entries(rows.reduce((counts, row) => ({ ...counts, [row[key] || "Unassigned"]: (counts[row[key] || "Unassigned"] || 0) + 1 }), {}))
    .map(([name, count]) => `${name}: ${count}`)
    .join(", ");

// Totals calculated here so the model copies exact numbers instead of counting rows itself.
const summary = (employees, leaves, transactions, payroll) => {
  const date = today();
  const active = employees.filter((employee) => employee.status === "Active");
  const onLeaveToday = leaves.filter((leave) => leave.status === "Approved" && leave.from <= date && leave.to >= date);

  const byMonth = {};
  for (const item of transactions) {
    const month = String(item.date).slice(0, 7);
    byMonth[month] ||= { income: 0, expense: 0 };
    byMonth[month][item.type] += Number(item.amountLKR) || 0;
  }
  const income = transactions.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amountLKR, 0);
  const expense = transactions.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amountLKR, 0);

  const payrollByMonth = {};
  for (const record of payroll) {
    payrollByMonth[record.month] ||= { total: 0, count: 0 };
    payrollByMonth[record.month].total += Number(record.totalLKR) || 0;
    payrollByMonth[record.month].count += 1;
  }

  return [
    "## Summary (pre-calculated: use these numbers for counts and totals)",
    `- Employees: ${employees.length} total, ${active.length} active, ${employees.length - active.length} not active`,
    `- Active employees by department: ${countBy(active, "department")}`,
    `- All employees by status: ${countBy(employees, "status")}`,
    `- Active employees by role: ${countBy(active, "role")}`,
    `- Leave requests by status: ${countBy(leaves, "status") || "none"}`,
    `- On approved leave today: ${onLeaveToday.map((leave) => `${leave.employee} (${leave.type})`).join(", ") || "nobody"}`,
    `- Expense tracker, all time: income ${money(income)}, expenses ${money(expense)}, net ${money(income - expense)}`,
    ...Object.keys(byMonth)
      .sort()
      .reverse()
      .map((month) => `- Expense tracker ${month}: income ${money(byMonth[month].income)}, expenses ${money(byMonth[month].expense)}, net ${money(byMonth[month].income - byMonth[month].expense)}`),
    ...Object.keys(payrollByMonth)
      .sort()
      .reverse()
      .map((month) => `- Payroll ${month}: ${payrollByMonth[month].count} payslips, total ${money(payrollByMonth[month].total)}`),
  ].join("\n");
};

const SYSTEM_GUIDE = `
The HR portal has these pages:
- Dashboard: headcount, active employees, new joiners (added in the last 14 days), departures, people on leave today, pending approvals.
- Employee Management (HR): add, view, edit and disable employees; bank details are masked and need the password to view.
- Leave Management: employees request leave; HR and the employee's team lead approve or reject; HR's own leave goes to Managers.
- Attendance & Work Hours: currently mock data.
- Payroll & Payslips: pick a month, Add/Edit full days, half days, lagging hours (count x rate) and an increment that carries into later months; View & print; send a payslip link on WhatsApp.
- Letter Templates: offer and service letters as PDF, using the letterhead logo and company details.
- Expense Tracker: income and expense entries with a date range; net balance = income - expenses.
- My profile (click your name in the sidebar): profile photo, read-only details, change password.
- Forgot password on the login page emails a reset link.
`;

const systemInstruction = (snapshot, user) => `You are the AI assistant inside the KD Marketing Group HR portal, talking to ${user.name || "an HR user"} (HR).
Today is ${today()} (${TIMEZONE}). Money is in Sri Lankan rupees (LKR).

Rules:
- Answer questions about employees, leave, expenses/income, payroll and how to use the portal.
- Use only the data below for facts and numbers. Calculate totals carefully. If the data does not contain the answer, say so plainly; never invent records.
- Keep answers short and clear. Use bullet lists or small tables for several items. Format money like LKR 12,500.00.
- For actions (adding, editing, approving), explain where in the portal to do it; you cannot change data yourself.
- Politely decline requests unrelated to HR work or this portal.
${SYSTEM_GUIDE}
# Current data
${snapshot}`;

const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

// messages: [{ role: "user" | "assistant", text }], oldest first, last one from the user.
const callModel = async (model, payload) => {
  const response = await fetch(`${GEMINI_URL}/${model.name}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(model.timeout),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error(`Gemini ${model.name} error:`, response.status, body.error?.message);
    const message =
      response.status === 429
        ? "The AI assistant has reached the free Gemini usage limit. Please try again in a minute."
        : [400, 401, 403, 404].includes(response.status)
          ? "The AI assistant is not set up correctly (check GEMINI_API_KEY and GEMINI_MODEL)."
          : "The AI assistant is unavailable right now. Please try again.";
    throw httpError(response.status === 429 ? 429 : 502, message);
  }

  const candidate = body.candidates?.[0];
  const text = candidate?.content?.parts?.map((part) => (part.thought ? "" : part.text || "")).join("").trim();
  if (text) return text;
  if (candidate?.finishReason === "SAFETY" || body.promptFeedback?.blockReason) return "I can't help with that request.";
  throw httpError(502, "The AI assistant returned an empty answer. Please try again.");
};

// messages: [{ role: "user" | "assistant", text }], oldest first, last one from the user.
export const ask = async (messages, user) => {
  const payload = {
    systemInstruction: { parts: [{ text: systemInstruction(await buildSnapshot(), user) }] },
    contents: messages.map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.text }],
    })),
    generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
  };

  let lastError;
  for (const model of MODELS) {
    try {
      return await callModel(model, payload);
    } catch (error) {
      if (error.name === "TimeoutError") {
        console.error(`Gemini ${model.name} timed out after ${model.timeout / 1000}s`);
        lastError = httpError(504, "The AI assistant took too long to answer. Please try again.");
      } else {
        lastError = error;
      }
    }
  }
  throw lastError;
};
