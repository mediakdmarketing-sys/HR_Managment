import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";

// messages: [{ role: "user" | "assistant", text }], oldest first.
export const askAssistant = (messages) => axios.post(`${API_BASE}/ai/chat`, { messages });
