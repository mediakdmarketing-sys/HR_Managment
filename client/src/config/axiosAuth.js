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

// Firebase ID tokens expire after 1 hour. Apply this interceptor to each Axios instance
// that calls the HRMS API, including instances created with axios.create().
export const configureApiAuth = (client) => {
  client.interceptors.request.use(async (config) => {
    if (!isApiRequest(config)) return config;

    // Check if user is logged in (either from Firebase or localStorage)
    const user = getUser();
    const token = localStorage.getItem("token");
    
    // If neither Firebase user nor stored token, skip auth
    if (!user && !token) return config;

    // If session has expired, end it
    if (user && isSessionExpired()) {
      await endSession("expired");
      return Promise.reject(new axios.Cancel("Session expired"));
    }

    // Try to get a valid token from Firebase or localStorage
    await firebaseAuth.authStateReady();
    const firebaseUser = firebaseAuth.currentUser;
    let authToken = firebaseUser
      ? await firebaseUser.getIdToken()
      : token || localStorage.getItem("token");
    
    if (firebaseUser && authToken) localStorage.setItem("token", authToken);
    if (authToken) config.headers.Authorization = `Bearer ${authToken}`;
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (error.response?.status === 401 && isApiRequest(error.config) && getUser()) {
        await endSession("signed-out");
      }
      return Promise.reject(error);
    },
  );
};

configureApiAuth(axios);
