import { firestore } from "../config/firebase.js";
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

export const updateUserService = async (id, data) => {
  const reference = employeeCollection.doc(id);
  const updated = await firestore.runTransaction(async (transaction) => {
    const freshSnapshot = await transaction.get(reference);
    if (!freshSnapshot.exists) return;
    const current = { ...freshSnapshot.data(), id: freshSnapshot.id };
    const updates = validateEmployeeUpdate(current, data);
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
