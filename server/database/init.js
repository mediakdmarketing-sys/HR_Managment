import { firestore } from "../config/firebase.js";

export const initializeFirebaseData = async () => {
  await firestore.collection("employees").limit(1).get();
  console.log("Firebase connectivity verified; no employee or authentication records were seeded.");
};
