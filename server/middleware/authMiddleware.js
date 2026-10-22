import { firebaseAuth, firestore } from "../config/firebase.js";

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
    if (snapshot.empty || snapshot.docs[0].data().status !== "Active") {
      return res.status(401).json({ success: false, message: "Inactive or unknown user" });
    }
    req.user = { id: snapshot.docs[0].id, ...snapshot.docs[0].data(), ...decoded };
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid Firebase token" });
  }
};

export default authenticate;
export const verifyToken = authenticate;