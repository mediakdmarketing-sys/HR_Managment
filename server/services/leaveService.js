import { firestore, storageBucket } from "../config/firebase.js";

const leaves = firestore.collection("leaveRequests");
const employees = firestore.collection("employees");
const notifications = firestore.collection("notifications");

const employeeById = async (id) => {
  const snapshot = await employees.doc(id).get();
  return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null;
};

const serialize = (snapshot, employee) => ({
  id: snapshot.id,
  ...snapshot.data(),
  employeeId: snapshot.data().employeeId,
  employeeName: employee?.name || "",
  employeeEmail: employee?.email || "",
});

// Attachments are stored as byte chunks in Firestore (documents are capped at 1 MiB),
// so leave requests do not depend on Firebase Storage being enabled.
const attachments = firestore.collection("leaveAttachments");
const CHUNK_SIZE = 900 * 1024;

const saveAttachment = async (requestId, data) => {
  if (!data) return {};
  const buffer = Buffer.from(data, "base64");
  const batch = firestore.batch();
  let chunkCount = 0;
  for (let offset = 0; offset < buffer.length; offset += CHUNK_SIZE) {
    batch.set(attachments.doc(`${requestId}_${chunkCount}`), {
      requestId,
      index: chunkCount,
      data: buffer.subarray(offset, offset + CHUNK_SIZE),
    });
    chunkCount += 1;
  }
  await batch.commit();
  return { attachmentChunks: chunkCount, attachmentSize: buffer.length };
};

// HR leave goes to Managers; everyone else's goes to HR and their assigned team lead.
// Nobody can review their own request.
const canReviewRequest = (request, employee, user) => {
  if (request.employeeId === user.id) return false;
  if (employee?.role === "HR") return user.role === "Manager";
  return user.role === "HR" || employee?.assignedTeamLead === user.name;
};

const canAccessRequest = (request, employee, user) =>
  request.employeeId === user.id || canReviewRequest(request, employee, user);

export const getLeaveRequests = async (user) => {
  const [leaveSnapshot, employeeSnapshot] = await Promise.all([
    leaves.get(),
    employees.get(),
  ]);
  const employeeMap = new Map(employeeSnapshot.docs.map((doc) => [doc.id, { id: doc.id, ...doc.data() }]));
  const current = employeeMap.get(user.id);
  return leaveSnapshot.docs
    .map((doc) => serialize(doc, employeeMap.get(doc.data().employeeId)))
    .filter((request) =>
      canAccessRequest(request, employeeMap.get(request.employeeId), { ...user, name: current?.name }),
    )
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
};

export const createLeaveRequest = async ({
  employeeId, type, startDate, endDate, days, reason, attachment, attachmentData, attachmentMime,
}) => {
  const employee = await employeeById(employeeId);
  if (!employee) throw new Error("Employee not found");
  const reference = leaves.doc();
  const stored = await saveAttachment(reference.id, attachmentData);
  const request = {
    employeeId, type, startDate, endDate, days: Number(days), reason,
    attachment: attachment || null,
    attachmentMime: attachmentMime || null,
    ...stored,
    status: "Pending",
    createdAt: new Date().toISOString(),
  };
  await reference.set(request);

  const allEmployees = await employees.get();
  const recipients = allEmployees.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((candidate) =>
      candidate.status === "Active" &&
      canReviewRequest({ employeeId }, employee, candidate),
    );
  await Promise.all(recipients.map((recipient) =>
    notifications.doc().set({
      recipientEmployeeId: recipient.id,
      type: "leave_request",
      title: "New leave request",
      message: `${employee.name} requested ${days} day(s) of ${type}.`,
      entityId: reference.id,
      isRead: false,
      createdAt: new Date().toISOString(),
    }),
  ));
  return getLeaveRequestById(reference.id);
};

export const getLeaveRequestById = async (id) => {
  const snapshot = await leaves.doc(id).get();
  if (!snapshot.exists) return null;
  return serialize(snapshot, await employeeById(snapshot.data().employeeId));
};

export const updateLeaveStatus = async (id, status, reviewer) => {
  const reference = leaves.doc(id);
  const snapshot = await reference.get();
  if (!snapshot.exists) return null;
  const request = snapshot.data();
  const employee = await employeeById(request.employeeId);
  if (!canReviewRequest(request, employee, reviewer)) return null;
  await reference.update({ status });
  await notifications.doc().set({
    recipientEmployeeId: request.employeeId,
    type: status === "Approved" ? "leave_approved" : "leave_rejected",
    title: `Leave request ${status.toLowerCase()}`,
    message: `Your ${request.type} request (${request.startDate} to ${request.endDate}) was ${status.toLowerCase()} by ${reviewer.name}.`,
    entityId: id,
    isRead: false,
    createdAt: new Date().toISOString(),
  });
  return getLeaveRequestById(id);
};

export const getLeaveAttachment = async (id, user) => {
  const snapshot = await leaves.doc(id).get();
  if (!snapshot.exists) return null;
  const request = snapshot.data();
  const employee = await employeeById(request.employeeId);
  if (!canAccessRequest(request, employee, user)) return null;

  let buffer = null;
  if (request.attachmentChunks) {
    const chunks = await attachments.where("requestId", "==", id).get();
    buffer = Buffer.concat(
      chunks.docs
        .map((doc) => doc.data())
        .sort((a, b) => a.index - b.index)
        .map((chunk) => Buffer.from(chunk.data)),
    );
  } else if (request.attachmentPath) {
    // Records migrated while Firebase Storage was in use.
    [buffer] = await storageBucket.file(request.attachmentPath).download();
  }
  if (!buffer) return null;
  return {
    buffer,
    name: request.attachment || "attachment",
    mime: request.attachmentMime || "application/octet-stream",
  };
};

export const getNotifications = async (employeeId) => {
  const snapshot = await notifications.where("recipientEmployeeId", "==", employeeId).get();
  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 50);
};

export const markNotificationRead = async (id, employeeId) => {
  const reference = notifications.doc(id);
  const snapshot = await reference.get();
  if (snapshot.exists && snapshot.data().recipientEmployeeId === employeeId) {
    await reference.update({ isRead: true });
  }
};

export const markAllNotificationsRead = async (employeeId) => {
  const snapshot = await notifications
    .where("recipientEmployeeId", "==", employeeId)
    .where("isRead", "==", false)
    .get();
  const batch = firestore.batch();
  snapshot.docs.forEach((doc) => batch.update(doc.ref, { isRead: true }));
  await batch.commit();
};
