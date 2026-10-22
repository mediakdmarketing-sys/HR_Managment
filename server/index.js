import "dotenv/config";
import cookieParser from "cookie-parser";
import express from "express";
import cors from "cors";
import authRoute from "./routes/auth.route.js";
// import ticketRoute from "./routes/ticket.route.js";
import userRoute from "./routes/user.route.js";
import leaveRoute from "./routes/leave.route.js";
import notificationRoute from "./routes/notification.route.js";
import templateRoute from "./routes/template.route.js";
import { initializeFirebaseData } from "./database/init.js";


const app = express();
// CLIENT_URL is a comma-separated list of allowed frontend origins (e.g. the Vercel URL).
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  ...(process.env.CLIENT_URL || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean),
];
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.get("/api/health", (req, res) => res.json({ success: true }));
app.use(express.json({ limit: "8mb" }));
app.use(cookieParser());



app.use("/api/auth", authRoute);
// app.use("/api/tickets", ticketRoute);
app.use("/api/users", userRoute);
app.use("/api/leaves", leaveRoute);
app.use("/api/notifications", notificationRoute);
app.use("/api/templates", templateRoute);



const initializeDatabase = async () => {
  try {
    await initializeFirebaseData();
    console.log("Firebase initialized successfully!");

    if (!process.env.FUNCTIONS_WORKER_RUNTIME && !process.env.K_SERVICE) {
      app.listen(Number(process.env.PORT) || 5000, () => {
        console.log(`Server running on port ${Number(process.env.PORT) || 5000}`);
      });
    }
  } catch (error) {
    console.error("Database initialization failed:", error);
    if (process.env.FUNCTIONS_WORKER_RUNTIME || process.env.K_SERVICE) {
      throw error;
    }
    process.exit(1);
  }
};

export { app, initializeDatabase };

if (!process.env.FUNCTIONS_WORKER_RUNTIME && !process.env.K_SERVICE) {
  initializeDatabase();
}
