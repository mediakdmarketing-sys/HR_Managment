import { firebaseAuth, firestore } from "../config/firebase.js";
import mockEmployees from "../mockEmployees.js";

const authConfigurationError = () =>
  new Error(
    "Firebase Authentication is not enabled for this project. " +
      "Open Firebase Console > Build > Authentication > Get started, " +
      "then enable the Email/Password sign-in provider.",
  );

export const initializeFirebaseData = async () => {
  for (const employee of mockEmployees) {
    const reference = firestore.collection("employees").doc(employee.id);
    const existing = await reference.get();
    if (existing.exists) continue;

    let authUser;
    try {
      authUser = await firebaseAuth.getUserByEmail(employee.email);
    } catch (error) {
      if (error.code === "auth/configuration-not-found") {
        throw authConfigurationError();
      }
      if (error.code !== "auth/user-not-found") throw error;
      try {
        authUser = await firebaseAuth.createUser({
          email: employee.email,
          password: employee.plain_paaword,
          displayName: employee.name,
          disabled: employee.status !== "Active",
        });
      } catch (createError) {
        if (createError.code === "auth/configuration-not-found") {
          throw authConfigurationError();
        }
        throw createError;
      }
    }

    await reference.set({
      uid: authUser.uid,
      name: employee.name,
      email: employee.email.toLowerCase(),
      department: employee.department,
      status: employee.status,
      role: employee.role,
      personlEmail: employee.personalEmail,
      assignedTeamLead: employee.assignedTeamLead,
      workingHours: employee.workingHours,
      totalBreakHours: employee.totalBreakHours,
      monthlyTotalWorkingHours: employee.monthlyTotalWorkingHours,
      createdAt: new Date().toISOString(),
    });
  }
  console.log("Firebase data initialized.");
};
