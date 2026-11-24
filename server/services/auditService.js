/**
 * Audit log service — writes immutable log entries to `employeeAuditLog` Firestore collection.
 * Called whenever sensitive personnel data is accessed or modified.
 */
import { firestore } from "../config/firebase.js";

const auditCollection = firestore.collection("employeeAuditLog");

/**
 * @param {{ action: string, employeeId: string, performedBy: string, details?: object }} opts
 */
export const logAudit = async ({ action, employeeId, performedBy, details = {} }) => {
  try {
    await auditCollection.add({
      action,
      employeeId,
      performedBy,
      details,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    // Audit failures must NOT block business operations — log to console only.
    console.error("[AUDIT ERROR]", err.message);
  }
};
