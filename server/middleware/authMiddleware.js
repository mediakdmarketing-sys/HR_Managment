import { firebaseAuth, firestore } from "../config/firebase.js";
import { isActiveHrRecord } from "../utils/employeeDirectory.js";
import { createFirebaseHrAuthenticator } from "./authMiddlewareFactory.js";

const authenticate = createFirebaseHrAuthenticator({
  firebaseAuth,
  firestore,
  isActiveHrRecord,
});

export default authenticate;
export const verifyToken = authenticate;