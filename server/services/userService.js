import { firebaseAuth, firestore } from "../config/firebase.js";

const employeeCollection = firestore.collection("employees");

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
  return {
    roles: unique("role"),
    departments: unique("department"),
    statuses: unique("status"),
    assignedTeamLeads: employees
      .filter((employee) => /team lead|manager/i.test(employee.role || ""))
      .map((employee) => employee.name)
      .sort(),
  };
};

const nextEmployeeId = async () => {
  const snapshot = await employeeCollection.get();
  const highest = snapshot.docs.reduce((max, employee) => {
    const number = Number(employee.id.replace(/^EMP/, ""));
    return Number.isFinite(number) ? Math.max(max, number) : max;
  }, 0);
  return `EMP${String(highest + 1).padStart(3, "0")}`;
};

export const createUserService = async ({ name, email, password, role, department }) => {
  const normalizedEmail = email.trim().toLowerCase();
  const duplicate = await employeeCollection.where("email", "==", normalizedEmail).limit(1).get();
  if (!duplicate.empty) {
    const error = new Error("An employee with this email already exists");
    error.code = "already-exists";
    throw error;
  }
  const authUser = await firebaseAuth.createUser({ email: normalizedEmail, password, displayName: name.trim() });
  const id = await nextEmployeeId();
  const employee = {
    uid: authUser.uid,
    name: name.trim(),
    email: normalizedEmail,
    department,
    status: "Active",
    role,
    assignedTeamLead: "Not assigned",
    workingHours: 8,
    totalBreakHours: 1,
    monthlyTotalWorkingHours: 240,
    createdAt: new Date().toISOString(),
  };
  await employeeCollection.doc(id).set(employee);
  return { id, ...employee };
};

export const getUserByIdService = async (id) => {
  const snapshot = await employeeCollection.doc(id).get();
  return snapshot.exists ? toEmployee(snapshot) : null;
};

export const updateUserService = async (id, data) => {
  const reference = employeeCollection.doc(id);
  const snapshot = await reference.get();
  if (!snapshot.exists) return null;
  const current = snapshot.data();
  const allowed = [
    "name", "email", "department", "role", "status", "assignedTeamLead",
    "workingHours", "totalBreakHours", "monthlyTotalWorkingHours",
  ];
  const updates = Object.fromEntries(
    allowed.filter((field) => data[field] !== undefined).map((field) => [field, data[field]]),
  );
  if (data.email && data.email !== current.email) {
    await firebaseAuth.updateUser(current.uid, { email: data.email.trim().toLowerCase() });
    updates.email = data.email.trim().toLowerCase();
  }
  if (data.name) await firebaseAuth.updateUser(current.uid, { displayName: data.name.trim() });
  if (data.password) await firebaseAuth.updateUser(current.uid, { password: data.password });
  if (Object.keys(updates).length) await reference.update(updates);
  return getUserByIdService(id);
};

export const disableUserService = async (id) => {
  const reference = employeeCollection.doc(id);
  const snapshot = await reference.get();
  if (!snapshot.exists) return null;
  await reference.update({ status: "Not Active" });
  await firebaseAuth.updateUser(snapshot.data().uid, { disabled: true });
  return getUserByIdService(id);
};
