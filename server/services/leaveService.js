import { firestore, storageBucket } from "../config/firebase.js";
import {
  DEFAULT_LEAVE_POLICIES,
  customLeavePolicyId,
  isDefaultLeavePolicyName,
  mergeLeavePolicies,
  normalizeLeavePolicyName,
  validateLeavePolicyName,
} from "../utils/leavePolicy.js";
import {
  calculateLeaveRequestAllocation,
} from "../utils/leaveBalance.js";
import {
  createValidatedLeaveRequest,
  formatLeaveNumber,
  isDuplicateLeaveRequest,
  leaveRequestIdentity,
  nextLeaveNumber,
  processLeaveCsv,
} from "../utils/leaveRequestImport.js";

const leaves = firestore.collection("leaveRequests");
const leaveRequestCounters = firestore.collection("leaveRequestCounters");
const employees = firestore.collection("employees");
const notifications = firestore.collection("notifications");
const leavePolicies = firestore.collection("leavePolicies");

const httpError = (statusCode, message) =>
  Object.assign(new Error(message), { statusCode });

const employeeById = async (id) => {
  const snapshot = await employees.doc(id).get();
  return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null;
};

export const getLeavePolicies = async () => {
  const snapshot = await leavePolicies.get();
  const savedPolicies = snapshot.docs.map((document) => ({
    ...document.data(),
    id: document.id,
  }));
  return mergeLeavePolicies(savedPolicies);
};

export const getLeaveEmployeesForHR = async () => {
  const snapshot = await employees.where("status", "==", "Active").get();
  return snapshot.docs
    .map((document) => ({
      id: document.id,
      name: String(document.data().name || ""),
      email: String(document.data().email || "").trim().toLowerCase(),
      department: String(document.data().department || ""),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
};

export const getLeaveAllocationPreview = async (id, reviewer) => {
  const requestSnapshot = await leaves.doc(id).get();
  if (!requestSnapshot.exists) return null;
  const request = { id: requestSnapshot.id, ...requestSnapshot.data() };
  if (request.status !== "Pending") {
    throw httpError(409, "Only pending leave requests can be previewed.");
  }

  const [employee, policySnapshot, leaveSnapshot] = await Promise.all([
    employeeById(request.employeeId),
    leavePolicies.get(),
    leaves.where("employeeId", "==", request.employeeId).get(),
  ]);
  if (!employee) throw httpError(404, "Employee not found");
  if (!canReviewRequest(request, employee, reviewer)) return null;

  const policies = mergeLeavePolicies(
    policySnapshot.docs.map((document) => ({
      ...document.data(),
      id: document.id,
    })),
  );
  const leaveRequests = leaveSnapshot.docs.map((document) => ({
    ...document.data(),
    id: document.id,
  }));
  return {
    employeeName: employee.name || "",
    ...calculateLeaveRequestAllocation({
      request,
      employee,
      policies,
      leaveRequests,
    }),
  };
};

export const createLeavePolicy = async ({ name, createdBy }) => {
  const validated = validateLeavePolicyName(name);
  if (validated.error) throw httpError(400, validated.error);

  const { name: normalizedDisplayName, normalizedName } = validated.value;
  const policyId = customLeavePolicyId(normalizedName);
  const policyReference = leavePolicies.doc(policyId);
  const defaultReferences = DEFAULT_LEAVE_POLICIES.map((policy) =>
    leavePolicies.doc(policy.id),
  );
  const createdAt = new Date().toISOString();

  try {
    return await firestore.runTransaction(async (transaction) => {
      const [existingPolicies, existingCustom, ...existingDefaults] =
        await Promise.all([
          transaction.get(leavePolicies),
          transaction.get(policyReference),
          ...defaultReferences.map((reference) => transaction.get(reference)),
        ]);
      const duplicate = existingPolicies.docs.some(
        (document) =>
          normalizeLeavePolicyName(document.data().name) === normalizedName,
      );
      if (
        isDefaultLeavePolicyName(normalizedName) ||
        duplicate ||
        existingCustom.exists
      ) {
        throw httpError(409, "This leave type already exists.");
      }

      DEFAULT_LEAVE_POLICIES.forEach((policy, index) => {
        if (!existingDefaults[index].exists) {
          transaction.create(defaultReferences[index], {
            ...policy,
            isDefault: true,
            createdAt,
            createdBy,
          });
        }
      });

      const newPolicy = {
        id: policyId,
        name: normalizedDisplayName,
        days: 0,
        carryForward: 0,
        isDefault: false,
        createdAt,
        createdBy,
      };
      transaction.create(policyReference, newPolicy);
      return newPolicy;
    });
  } catch (error) {
    if (error.statusCode) throw error;
    if (
      error.code === 6 ||
      error.code === "6" ||
      error.code === "already-exists"
    ) {
      throw httpError(409, "This leave type already exists.");
    }
    throw error;
  }
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

// HR can review every request except their own; nobody can review their own request.
const canReviewRequest = (request, employee, user) => {
  if (request.employeeId === user.id) return false;
  if (user.role === "HR") return true;
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

const createRequestIfAbsent = async (candidate, createdBy, attachment = {}) => {
  const { identityKey, documentId } = leaveRequestIdentity(candidate);
  const reference = leaves.doc(documentId);
  const counterReference = leaveRequestCounters.doc("sequence");
  const employeeReference = employees.doc(candidate.employeeId);
  const attachmentBuffer = attachment.attachmentData
    ? Buffer.from(attachment.attachmentData, "base64")
    : null;
  const attachmentChunks = attachmentBuffer
    ? Math.ceil(attachmentBuffer.length / CHUNK_SIZE)
    : 0;
  return firestore.runTransaction(async (transaction) => {
    const [
      employeeSnapshot,
      identitySnapshot,
      existingSnapshot,
      policySnapshot,
      counterSnapshot,
    ] =
      await Promise.all([
        transaction.get(employeeReference),
        transaction.get(reference),
        transaction.get(leaves.where("employeeId", "==", candidate.employeeId)),
        transaction.get(leavePolicies.doc(candidate.policyId)),
        transaction.get(counterReference),
      ]);
    if (!employeeSnapshot.exists || employeeSnapshot.data().status !== "Active") {
      throw httpError(422, "The selected employee no longer exists or is not active.");
    }
    const employee = { id: employeeSnapshot.id, ...employeeSnapshot.data() };
    if (
      candidate.employeeEmail &&
      String(employee.email || "").trim().toLowerCase() !== candidate.employeeEmail
    ) {
      throw httpError(409, "The employee record changed. Reload the employee list and try again.");
    }
    if (
      policySnapshot.exists &&
      normalizeLeavePolicyName(policySnapshot.data().name) !==
        normalizeLeavePolicyName(candidate.type)
    ) {
      throw httpError(409, "The leave policy changed. Reload policies and try again.");
    }
    if (
      !policySnapshot.exists &&
      !DEFAULT_LEAVE_POLICIES.some((policy) => policy.id === candidate.policyId)
    ) {
      throw httpError(422, "The selected leave policy no longer exists.");
    }
    if (identitySnapshot.exists) return { duplicate: true };

    const duplicate = existingSnapshot.docs.some((document) =>
      isDuplicateLeaveRequest(
        { id: document.id, ...document.data() },
        candidate,
      ),
    );
    if (duplicate) return { duplicate: true };

    const historicalRequests = counterSnapshot.exists
      ? []
      : (await transaction.get(leaves)).docs.map((document) => document.data());
    const sequenceNumber = nextLeaveNumber(
      counterSnapshot.exists ? counterSnapshot.data()?.nextNumber : null,
      historicalRequests,
    );
    const leaveNumber = formatLeaveNumber(sequenceNumber);
    if (counterSnapshot.exists) {
      transaction.update(counterReference, { nextNumber: sequenceNumber + 1 });
    } else {
      transaction.create(counterReference, { nextNumber: sequenceNumber + 1 });
    }

    const createdAt = new Date().toISOString();
    const stored = {
      employeeId: employee.id,
      leaveNumber,
      type: candidate.type,
      leavePolicyId: candidate.policyId,
      startDate: candidate.startDate,
      endDate: candidate.endDate,
      days: candidate.days,
      reason: candidate.reason,
      status: "Pending",
      sourceType: candidate.sourceType,
      sourceName: candidate.sourceName,
      sourceSubmittedAt: candidate.sourceSubmittedAt || null,
      externalRequestId: candidate.externalRequestId || null,
      idempotencyKey: identityKey,
      createdBy,
      createdAt,
      attachment: attachment.attachment || null,
      attachmentMime: attachment.attachmentMime || null,
      ...(attachmentBuffer
        ? {
            attachmentChunks,
            attachmentSize: attachmentBuffer.length,
          }
        : {}),
    };
    transaction.create(reference, stored);
    if (attachmentBuffer) {
      for (let index = 0; index < attachmentChunks; index += 1) {
        const offset = index * CHUNK_SIZE;
        transaction.create(attachments.doc(`${reference.id}_${index}`), {
          requestId: reference.id,
          index,
          data: attachmentBuffer.subarray(offset, offset + CHUNK_SIZE),
        });
      }
    }
    return {
      duplicate: false,
      request: {
        id: reference.id,
        ...stored,
        employeeName: String(employee.name || ""),
        employeeEmail: String(employee.email || ""),
      },
    };
  });
};

const loadLeaveRequestCreationData = async () => {
  const [employeeSnapshot, policies] = await Promise.all([
    employees.get(),
    getLeavePolicies(),
  ]);
  return {
    employees: employeeSnapshot.docs.map((document) => ({
      id: document.id,
      ...document.data(),
    })),
    policies,
  };
};

export const createLeaveRequest = async ({
  employeeId,
  employeeEmail,
  type,
  startDate,
  endDate,
  days,
  reason,
  sourceReference,
  attachment,
  attachmentData,
  attachmentMime,
  createdBy,
}) => {
  const { employees: employeeRecords, policies } =
    await loadLeaveRequestCreationData();
  return createValidatedLeaveRequest({
    input: {
      employeeId,
      employeeEmail,
      type,
      startDate,
      endDate,
      days,
      reason,
      sourceReference,
    },
    employees: employeeRecords,
    policies,
    sourceType: "hr_manual",
    sourceName: "HR manual entry",
    createRequestIfAbsent: (candidate) =>
      createRequestIfAbsent(candidate, createdBy, {
        attachment,
        attachmentData,
        attachmentMime,
      }),
  });
};

export const importLeaveRequests = async ({
  content,
  sourceType,
  sourceName,
  dateFormat,
  createdBy,
}) => {
  const { employees: employeeRecords, policies } =
    await loadLeaveRequestCreationData();
  return processLeaveCsv({
    content,
    employees: employeeRecords,
    policies,
    sourceType,
    sourceName,
    dateFormat,
    createRequestIfAbsent: (candidate) =>
      createRequestIfAbsent(candidate, createdBy),
  });
};

export const getLeaveRequestById = async (id) => {
  const snapshot = await leaves.doc(id).get();
  if (!snapshot.exists) return null;
  return serialize(snapshot, await employeeById(snapshot.data().employeeId));
};

export const updateLeaveStatus = async (
  id,
  status,
  reviewer,
  expectedAllocation,
) => {
  const reference = leaves.doc(id);
  const decision = await firestore.runTransaction(async (transaction) => {
    const currentSnapshot = await transaction.get(reference);
    if (!currentSnapshot.exists) return null;
    const currentRequest = {
      id: currentSnapshot.id,
      ...currentSnapshot.data(),
    };
    const employeeSnapshot = await transaction.get(
      employees.doc(currentRequest.employeeId),
    );
    if (!employeeSnapshot.exists) return null;
    const employee = { id: employeeSnapshot.id, ...employeeSnapshot.data() };
    if (!canReviewRequest(currentRequest, employee, reviewer)) return null;
    if (currentRequest.status !== "Pending") {
      throw httpError(
        409,
        `This request was already ${currentRequest.status.toLowerCase()}`,
      );
    }

    let allocation = null;
    if (status === "Approved") {
      const [policySnapshot, leaveSnapshot] = await Promise.all([
        transaction.get(leavePolicies),
        transaction.get(
          leaves.where("employeeId", "==", currentRequest.employeeId),
        ),
      ]);
      const policies = mergeLeavePolicies(
        policySnapshot.docs.map((document) => ({
          ...document.data(),
          id: document.id,
        })),
      );
      const leaveRequests = leaveSnapshot.docs.map((document) => ({
        ...document.data(),
        id: document.id,
      }));
      allocation = calculateLeaveRequestAllocation({
        request: currentRequest,
        employee,
        policies,
        leaveRequests,
      });

      if (expectedAllocation) {
        const expectedPaidDays = Number(expectedAllocation.paidDays);
        const expectedUnpaidDays = Number(expectedAllocation.unpaidDays);
        if (
          !Number.isFinite(expectedPaidDays) ||
          !Number.isFinite(expectedUnpaidDays) ||
          Math.abs(expectedPaidDays - allocation.paidDays) > 0.001 ||
          Math.abs(expectedUnpaidDays - allocation.unpaidDays) > 0.001 ||
          Number(expectedAllocation.leaveYear) !== allocation.leaveYear
        ) {
          throw httpError(
            409,
            "The available leave balance changed. Review the updated allocation before approving.",
          );
        }
      }
    }

    transaction.update(reference, {
      status,
      reviewedBy: reviewer.id,
      reviewedAt: new Date().toISOString(),
      ...(allocation
        ? {
            paidDays: allocation.paidDays,
            unpaidDays: allocation.unpaidDays,
            paidLeaveYear: allocation.leaveYear,
            paidLeaveTypeId: allocation.leaveTypeId,
            paidLeaveBalanceBefore: allocation.availablePaidDays,
          }
        : {}),
    });
    return { request: currentRequest, allocation };
  });
  if (!decision) return null;

  const allocationMessage = decision.allocation
    ? ` (${decision.allocation.paidDays} paid, ${decision.allocation.unpaidDays} unpaid day(s))`
    : "";
  await notifications.doc().set({
    recipientEmployeeId: decision.request.employeeId,
    type: status === "Approved" ? "leave_approved" : "leave_rejected",
    title: `Leave request ${status.toLowerCase()}`,
    message: `Your ${decision.request.type} request (${decision.request.startDate} to ${decision.request.endDate}) was ${status.toLowerCase()} by ${reviewer.name}.${allocationMessage}`,
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
