import { signOut } from "firebase/auth";
import { firebaseAuth } from "../config/firebase";

// Maximum length of a login session, regardless of activity.
export const SESSION_HOURS = Number(import.meta.env.VITE_SESSION_HOURS) || 12;

export const getUser = () => {
  const user = localStorage.getItem("user");

  return user ? JSON.parse(user) : null;
};

export const getRole = () => {
  const user = getUser();

  return user?.role;
};

export const startSession = (token, user) => {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
  localStorage.setItem("sessionStartedAt", String(Date.now()));
};

export const isSessionExpired = () => {
  const startedAt = Number(localStorage.getItem("sessionStartedAt"));
  return !startedAt || Date.now() - startedAt > SESSION_HOURS * 3600000;
};

export const isLoggedIn = () =>
  Boolean(localStorage.getItem("token") && getUser()) && !isSessionExpired();

export const clearSession = async () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("sessionStartedAt");
  try {
    // The HR assistant's conversation must not carry over to the next person who logs in.
    sessionStorage.removeItem("hr-ai-chat");
  } catch {
    // Storage may be unavailable; nothing to clear then.
  }
  try {
    await signOut(firebaseAuth);
  } catch {
    // Local session data is already cleared.
  }
};
