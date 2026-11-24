import { firestore } from "../config/firebase.js";
import {
  uploadToStorage,
  generateSignedUrl,
  deleteFromStorage,
  buildPersonnelDocPath,
} from "../utils/storageUtils.js";
import { logAudit } from "./auditService.js";
import {
  employeeEmailIndexId,
  EMPLOYMENT_COUNTRIES,
  normalizeEmployeeEmail,
  validateEmployeeUpdate,
} from "../utils/employeeDirectory.js";
import { makeEmployeeDirectoryPersistence } from "./employeeDirectoryPersistence.js";

const employeeCollection = firestore.collection("employees");
const employeeEmailIndexes = firestore.collection("employeeEmailIndexes");
const legacyBanksDoc = firestore.collection("settings").doc("banks");
const employeePersistence = makeEmployeeDirectoryPersistence(firestore);

const toEmployee = (snapshot) => ({ id: snapshot.id, ...snapshot.data() });

export const getUsersService = async (page = 1, limit = 10, role = "all") => {
  const snapshot = await employeeCollection.get();
  let users = snapshot.docs.map(toEmployee);
  if (role !== "all") users = users.filter((user) => user.role === role);
  users.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const total = users.length;
  const start = (page - 1) * limit;
  return { users: users.slice(start, start + limit), total, page, totalPages: Math.ceil(total / limit) };
};

export const getEmployeeOptionsService = async () => {
  const snapshot = await employeeCollection.get();
  const employees = snapshot.docs.map(toEmployee);
  const unique = (key) => [...new Set(employees.map((employee) => employee[key]).filter(Boolean))].sort();
  const savedBanks = await Promise.all(
    EMPLOYMENT_COUNTRIES.map(async (country) => {
      const countryDoc = await firestore
        .collection("settings")
        .doc(`banks_${country.code.toLowerCase()}`)
        .get();
      const legacy = country.code === "LK"
        ? (await legacyBanksDoc.get()).data()?.names || []
        : [];
      return [
        country.code,
        [...new Set([...(countryDoc.data()?.names || []), ...legacy])],
      ];
    }),
  );
  return {
    countries: EMPLOYMENT_COUNTRIES.map(({ code, name }) => ({ code, name })),
    banksByCountry: Object.fromEntries(
      savedBanks.map(([code, names]) => [
        code,
        [...new Set([
          ...EMPLOYMENT_COUNTRIES.find((country) => country.code === code).banks,
          ...names,
          ...employees
            .filter((employee) => employee.countryCode === code)
            .map((employee) => employee.bankName)
            .filter(Boolean),
        ])],
      ]),
    ),
    roles: unique("role"),
    departments: unique("department"),
    statuses: unique("status"),
    assignedTeamLeads: employees
      .filter((employee) => /team lead|manager/i.test(employee.role || ""))
      .map((employee) => employee.name)
      .sort(),
  };
};

const employeeEmailIndexReference = (email) =>
  employeeEmailIndexes.doc(employeeEmailIndexId(email));

export const createUserService = employeePersistence.create;
export const importEmployeesCsvService = employeePersistence.importCsv;

export const getUserByIdService = async (id) => {
  const snapshot = await employeeCollection.doc(id).get();
  return snapshot.exists ? toEmployee(snapshot) : null;
};

export const updateUserService = async (id, data, performedBy = "HR Administrator") => {
  const reference = employeeCollection.doc(id);
  let capturedUpdates = null;
  const updated = await firestore.runTransaction(async (transaction) => {
    const freshSnapshot = await transaction.get(reference);
    if (!freshSnapshot.exists) return;
    const current = { ...freshSnapshot.data(), id: freshSnapshot.id };
    const updates = validateEmployeeUpdate(current, data);
    capturedUpdates = updates;
    const emailChanged =
      updates.email !== undefined &&
      normalizeEmployeeEmail(updates.email) !== normalizeEmployeeEmail(current.email);
    const nextEmailReference = emailChanged
      ? employeeEmailIndexReference(updates.email)
      : null;
    const previousEmailReference = employeeEmailIndexReference(current.email);
    const currentEmailIndex = await transaction.get(previousEmailReference);
    const employeesSnapshot = await transaction.get(employeeCollection);
    if (emailChanged) {
      const emailIndexSnapshot = await transaction.get(nextEmailReference);
      if (
        (emailIndexSnapshot.exists &&
          emailIndexSnapshot.data().employeeId !== id) ||
        employeesSnapshot.docs.some(
          (document) =>
            document.id !== id &&
            normalizeEmployeeEmail(document.data().email) === updates.email,
        )
      ) {
        throw duplicateEmployeeError();
      }
      transaction.create(nextEmailReference, { employeeId: id });
      if (
        currentEmailIndex.exists &&
        currentEmailIndex.data().employeeId === id
      ) {
        transaction.delete(previousEmailReference);
      }
    } else if (!currentEmailIndex.exists && current.email) {
      transaction.create(previousEmailReference, { employeeId: id });
    }
    if (Object.keys(updates).length) transaction.update(reference, updates);
    return true;
  });

  if (updated && capturedUpdates) {
    const bankFields = ["bankName", "accountNumber", "accountHolderName", "ifscCode", "swiftCode", "bankBranch", "bankBranchCode", "countryOfEmployment"];
    const modifiedBankFields = Object.keys(capturedUpdates).filter((k) => bankFields.includes(k));
    if (modifiedBankFields.length > 0) {
      await logAudit({
        action: "EMPLOYEE_BANK_DETAILS_UPDATED",
        employeeId: id,
        performedBy,
        details: { fields: modifiedBankFields },
      });
    }
  }

  return updated ? getUserByIdService(id) : null;
};

export const disableUserService = async (id) => {
  const reference = employeeCollection.doc(id);
  const updated = await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists) return false;
    if (snapshot.data().uid) {
      const error = new Error("Authentication-linked records cannot be deactivated through employee directory management.");
      error.statusCode = 403;
      throw error;
    }
    transaction.update(reference, { status: "Not Active" });
    return true;
  });
  return updated ? getUserByIdService(id) : null;
};

// Profile photos live in their own collection so employee lists stay small.
const profilePhotos = firestore.collection("profilePhotos");

export const getProfilePhotoService = async (id) => {
  const snapshot = await profilePhotos.doc(id).get();
  return snapshot.exists ? { mime: snapshot.data().mime, data: snapshot.data().data } : null;
};

export const saveProfilePhotoService = (id, photo) =>
  profilePhotos.doc(id).set({ ...photo, updatedAt: new Date().toISOString() });

export const removeProfilePhotoService = (id) => profilePhotos.doc(id).delete();

// ==========================================
// Employee Personnel File & Documents
// ==========================================

export const PERSONNEL_DOCUMENT_CATEGORIES = [
  "CV / Resume",
  "Offer Letter",
  "Employment Contract",
  "Salary Slips",
  "Bank Details / Proof",
  "Service / Experience Letters",
  "Other HR Documents",
];

const personnelDocuments = firestore.collection("personnelDocuments");

export const listEmployeeDocumentsService = async (employeeId) => {
  const snapshot = await personnelDocuments
    .where("employeeId", "==", employeeId)
    .get();
  const docs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  docs.sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0));
  return docs;
};

export const uploadEmployeeDocumentService = async ({
  employeeId,
  category,
  title,
  fileName,
  fileType,
  fileBase64,
  fileSize,
  notes,
  uploadedBy,
}) => {
  if (!PERSONNEL_DOCUMENT_CATEGORIES.includes(category)) {
    const error = new Error(`Invalid category. Allowed: ${PERSONNEL_DOCUMENT_CATEGORIES.join(", ")}`);
    error.statusCode = 400;
    throw error;
  }

  // Determine document version for this title & category
  const existingSnapshot = await personnelDocuments
    .where("employeeId", "==", employeeId)
    .where("category", "==", category)
    .where("title", "==", title.trim())
    .get();
  const version = existingSnapshot.size + 1;

  const resolvedFileName = fileName || `${category.replace(/\s+/g, "_")}_${Date.now()}`;
  const resolvedType = fileType || "application/pdf";

  // Upload to Cloud Storage if file data provided
  let storagePath = null;
  let resolvedSize = Number(fileSize) || 0;
  let fileDataFallback = null;
  if (fileBase64) {
    const rawBase64 = fileBase64.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(rawBase64, "base64");
    const candidatePath = buildPersonnelDocPath(employeeId, resolvedFileName);
    try {
      await uploadToStorage(buffer, candidatePath, resolvedType);
      storagePath = candidatePath;
    } catch (storageErr) {
      console.warn("Cloud Storage upload failed, storing fallback in Firestore:", storageErr.message);
      storagePath = null;
      fileDataFallback = fileBase64;
    }
    resolvedSize = buffer.length;
  }

  const docData = {
    employeeId,
    category,
    title: title.trim(),
    fileName: resolvedFileName,
    fileType: resolvedType,
    storagePath,          // Cloud Storage path (null if no file attached)
    fileData: fileDataFallback, // Fallback if storage bucket is not reachable
    fileSize: resolvedSize,
    version,
    notes: notes || "",
    uploadedBy: uploadedBy || "HR Administrator",
    uploadedAt: new Date().toISOString(),
  };

  const ref = await personnelDocuments.add(docData);
  await logAudit({ action: "PERSONNEL_DOC_UPLOADED", employeeId, performedBy: uploadedBy || "HR", details: { docId: ref.id, category, fileName: resolvedFileName } });
  return { id: ref.id, ...docData };
};

export const deleteEmployeeDocumentService = async (docId, performedBy) => {
  const snap = await personnelDocuments.doc(docId).get();
  if (!snap.exists) return false;
  const { storagePath, employeeId } = snap.data();
  // Delete from Cloud Storage first
  if (storagePath) {
    try {
      await deleteFromStorage(storagePath);
    } catch (delErr) {
      console.warn("Storage deletion error:", delErr.message);
    }
  }
  await personnelDocuments.doc(docId).delete();
  await logAudit({ action: "PERSONNEL_DOC_DELETED", employeeId: employeeId || "unknown", performedBy: performedBy || "HR", details: { docId } });
  return true;
};

export const getEmployeeDocumentService = async (docId) => {
  const snapshot = await personnelDocuments.doc(docId).get();
  if (!snapshot.exists) return null;
  const data = snapshot.data();
  // Generate a signed URL for download if stored in Cloud Storage
  let downloadUrl = null;
  if (data.storagePath) {
    try {
      downloadUrl = await generateSignedUrl(data.storagePath, 30);
    } catch (_) {
      // Signed URL generation may fail if credentials lack signBlob permission
    }
  }
  return { id: snapshot.id, ...data, downloadUrl: downloadUrl || data.fileData };
};
