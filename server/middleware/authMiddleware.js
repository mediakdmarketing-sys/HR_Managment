import { firebaseAuth, firestore } from "../config/firebase.js";
import { isActiveHrRecord } from "../utils/employeeDirectory.js";

const authenticate = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "No token provided" });
  }

  try {
    const decoded = await firebaseAuth.verifyIdToken(header.slice(7));
    const snapshot = await firestore
      .collection("employees")
      .where("uid", "==", decoded.uid)
      .limit(1)
      .get();
    if (snapshot.empty || !isActiveHrRecord(snapshot.docs[0].data())) {
      return res.status(403).json({ success: false, message: "Active HR access is required" });
    }
    req.user = { ...decoded, ...snapshot.docs[0].data(), id: snapshot.docs[0].id };
    req.user.auth_time = decoded.auth_time;
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid Firebase token" });
  }
};

export default authenticate;
export const verifyToken = authenticate;