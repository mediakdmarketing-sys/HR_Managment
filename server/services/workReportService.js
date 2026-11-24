/**
 * Work Reports Service
 * Manages monthly work reports with status workflow:
 *   Draft → Submitted → Under Review → Approved | Needs Revision
 *
 * Collection: workReports
 */
import { firestore } from "../config/firebase.js";
import { logAudit } from "./auditService.js";

const workReportCollection = firestore.collection("workReports");

export const WORK_REPORT_STATUSES = [
  "Draft",
  "Submitted",
  "Under Review",
  "Approved",
  "Needs Revision",
];

export const listWorkReportsService = async ({ employeeId, month, year } = {}) => {
  let query = workReportCollection;
  if (employeeId) query = query.where("employeeId", "==", employeeId);
  if (month) query = query.where("month", "==", Number(month));
  if (year) query = query.where("year", "==", Number(year));
  const snapshot = await query.get();
  const reports = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  reports.sort((a, b) => {
    if (b.year !== a.year) return b.year - a.year;
    return b.month - a.month;
  });
  return reports;
};

export const getWorkReportService = async (id) => {
  const snap = await workReportCollection.doc(id).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
};

export const createWorkReportService = async ({
  employeeId,
  employeeName,
  month,
  year,
  summary,
  tasksCompleted,
  projectsWorkedOn,
  challengesFaced,
  goalsNextMonth,
  hoursWorked,
  createdBy,
}) => {
  if (!employeeId || !month || !year) {
    const err = new Error("employeeId, month, and year are required.");
    err.statusCode = 400;
    throw err;
  }

  // Prevent duplicate for same employee/month/year
  const existing = await workReportCollection
    .where("employeeId", "==", employeeId)
    .where("month", "==", Number(month))
    .where("year", "==", Number(year))
    .get();
  if (!existing.empty) {
    const err = new Error(`A work report for ${month}/${year} already exists for this employee.`);
    err.statusCode = 409;
    throw err;
  }

  const data = {
    employeeId,
    employeeName: employeeName || "",
    month: Number(month),
    year: Number(year),
    summary: summary || "",
    tasksCompleted: tasksCompleted || "",
    projectsWorkedOn: projectsWorkedOn || "",
    challengesFaced: challengesFaced || "",
    goalsNextMonth: goalsNextMonth || "",
    hoursWorked: hoursWorked ? Number(hoursWorked) : null,
    status: "Draft",
    createdBy: createdBy || "HR Administrator",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    reviewedBy: null,
    reviewedAt: null,
    reviewComments: null,
  };

  const ref = await workReportCollection.add(data);
  return { id: ref.id, ...data };
};

export const updateWorkReportService = async (id, updates, performedBy) => {
  const ref = workReportCollection.doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    const err = new Error("Work report not found.");
    err.statusCode = 404;
    throw err;
  }
  const current = snap.data();
  if (!["Draft", "Needs Revision"].includes(current.status)) {
    const err = new Error("Only Draft or Needs Revision reports can be edited.");
    err.statusCode = 400;
    throw err;
  }
  const allowed = [
    "summary", "tasksCompleted", "projectsWorkedOn", "challengesFaced",
    "goalsNextMonth", "hoursWorked",
  ];
  const patch = {};
  for (const key of allowed) {
    if (key in updates) patch[key] = updates[key];
  }
  patch.updatedAt = new Date().toISOString();
  await ref.update(patch);
  return { id, ...current, ...patch };
};

export const submitWorkReportService = async (id, performedBy) => {
  const ref = workReportCollection.doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    const err = new Error("Work report not found.");
    err.statusCode = 404;
    throw err;
  }
  const current = snap.data();
  if (!["Draft", "Needs Revision"].includes(current.status)) {
    const err = new Error("Only Draft or Needs Revision reports can be submitted.");
    err.statusCode = 400;
    throw err;
  }
  await ref.update({ status: "Submitted", updatedAt: new Date().toISOString() });
  await logAudit({ action: "WORK_REPORT_SUBMITTED", employeeId: current.employeeId, performedBy, details: { reportId: id } });
  return { id, ...current, status: "Submitted" };
};

export const reviewWorkReportService = async (id, { status, reviewComments }, reviewedBy) => {
  if (!["Approved", "Needs Revision", "Under Review"].includes(status)) {
    const err = new Error("Invalid review status.");
    err.statusCode = 400;
    throw err;
  }
  const ref = workReportCollection.doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    const err = new Error("Work report not found.");
    err.statusCode = 404;
    throw err;
  }
  const current = snap.data();
  const patch = {
    status,
    reviewComments: reviewComments || null,
    reviewedBy,
    reviewedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await ref.update(patch);
  await logAudit({ action: `WORK_REPORT_${status.toUpperCase().replace(" ", "_")}`, employeeId: current.employeeId, performedBy: reviewedBy, details: { reportId: id, status, reviewComments } });
  return { id, ...current, ...patch };
};

export const deleteWorkReportService = async (id, performedBy) => {
  const ref = workReportCollection.doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    const err = new Error("Work report not found.");
    err.statusCode = 404;
    throw err;
  }
  if (snap.data().status !== "Draft") {
    const err = new Error("Only Draft reports can be deleted.");
    err.statusCode = 400;
    throw err;
  }
  await ref.delete();
  await logAudit({ action: "WORK_REPORT_DELETED", employeeId: snap.data().employeeId, performedBy, details: { reportId: id } });
  return true;
};
