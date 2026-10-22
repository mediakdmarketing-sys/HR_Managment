import axios from "axios";
import { firebaseAuth } from "./firebase";
import { clearSession, getUser, isSessionExpired } from "../utils/auth";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";

const isApiRequest = (config) => `${config.baseURL ?? ""}${config.url ?? ""}`.startsWith(API_BASE);

const endSession = async (reason) => {
  await clearSession();
  if (window.location.pathname !== "/login") {
    window.location.assign(`/login?reason=${reason}`);
  }
};

// Firebase ID tokens always expire after 1 hour. Instead of reusing the token saved at
// login, attach a fresh one to every API call; Firebase renews it automatically.
axios.interceptors.request.use(async (config) => {
  if (!isApiRequest(config) || !getUser()) return config;

  if (isSessionExpired()) {
    await endSession("expired");
    return Promise.reject(new axios.Cancel("Session expired"));
  }

  await firebaseAuth.authStateReady();
  const firebaseUser = firebaseAuth.currentUser;
  if (firebaseUser) {
    const token = await firebaseUser.getIdToken();
    localStorage.setItem("token", token);
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && isApiRequest(error.config) && getUser()) {
      await endSession("signed-out");
    }
    return Promise.reject(error);
  },
);
