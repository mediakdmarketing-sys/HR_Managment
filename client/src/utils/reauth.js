import { EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { firebaseAuth } from "../config/firebase";

// Re-checks the signed-in user's password with Firebase. The refreshed ID token carries a new
// auth_time, which the server requires before revealing or changing an account number.
export const confirmPassword = async (password) => {
  await firebaseAuth.authStateReady();
  const user = firebaseAuth.currentUser;
  if (!user?.email) throw new Error("Your session has expired. Please log in again.");
  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
    await user.getIdToken(true);
  } catch (error) {
    if (["auth/wrong-password", "auth/invalid-credential", "auth/invalid-login-credentials"].includes(error.code)) {
      throw new Error("Incorrect password. Please try again.", { cause: error });
    }
    if (error.code === "auth/too-many-requests") {
      throw new Error("Too many attempts. Please wait a few minutes and try again.", { cause: error });
    }
    throw new Error("Unable to confirm your password. Please try again.", { cause: error });
  }
};

export const isReauthRequired = (error) => error.response?.data?.code === "REAUTH_REQUIRED";
