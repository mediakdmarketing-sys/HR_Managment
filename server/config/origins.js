// Frontend origins allowed by CORS. CLIENT_URL is a comma-separated list (e.g. the Vercel URL).
export const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://hr-managment-olive.vercel.app",
  ...(process.env.CLIENT_URL || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean),
];
