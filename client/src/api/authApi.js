import axios from "axios";
import { signInWithEmailAndPassword } from "firebase/auth";
import { firebaseAuth } from "../config/firebase";

const API = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/auth`,
  withCredentials: true,
});

export const registerUser = (userData) => {
  return API.post("/register", userData);
};

export const loginUser = async ({ email, password }) => {
  const credentials = await signInWithEmailAndPassword(firebaseAuth, email, password);
  const idToken = await credentials.user.getIdToken();
  return API.post("/login", { idToken });
};

export const logoutUser = () => {
  return API.post("/logout", {}, { withCredentials: true });
};
