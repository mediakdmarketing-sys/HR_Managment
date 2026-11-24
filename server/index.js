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
import expenseRoute from "./routes/expense.route.js";
import payrollRoute from "./routes/payroll.route.js";
import payslipShareRoute from "./routes/payslipShare.route.js";
import attendanceRoute from "./routes/attendance.route.js";
import aiRoute from "./routes/ai.route.js";
import recruitmentRoute from "./routes/recruitment.route.js";
import workReportRoute from "./routes/workReport.route.js";
import identityDocRoute from "./routes/identityDoc.route.js";
import { initializeFirebaseData } from "./database/init.js";
import { allowedOrigins } from "./config/origins.js";
import { startEmailPolling, stopEmailPolling, initializeEmailPolling } from "./services/recruitmentEmailService.js";
import { processPendingAIAnalysis } from "./services/recruitmentAIService.js";
import { startServer } from "./utils/startServer.js";


const app = express();
// Render sits behind one proxy; this makes req.ip the visitor's address (used for rate limits).
app.set("trust proxy", 1);
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
app.use("/api/expenses", expenseRoute);
app.use("/api/payroll", payrollRoute);
app.use("/api/payslips", payslipShareRoute);
app.use("/api/attendance", attendanceRoute);
app.use("/api/ai", aiRoute);
app.use("/api/recruitment", recruitmentRoute);
app.use("/api/work-reports", workReportRoute);
// Identity docs nested under users
app.use("/api/users/:id/identity", identityDocRoute);



const startBackgroundJobs = async () => {
  // Initialize and start recruitment email polling (async)
  await initializeEmailPolling();

  // Start AI analysis processor (runs every 5 minutes)
  if (process.env.NODE_ENV !== "test" && process.env.GROQ_API_KEY) {
    setInterval(async () => {
      try {
        await processPendingAIAnalysis();
      } catch (error) {
        console.error("AI analysis processor error:", error.message);
      }
    }, 5 * 60 * 1000); // 5 minutes

    // Initial run
    setTimeout(async () => {
      try {
        await processPendingAIAnalysis();
      } catch (error) {
        console.error("Initial AI analysis processor error:", error.message);
      }
    }, 10000); // 10 seconds after startup
  }
};

const initializeDatabase = async () => {
  try {
    await initializeFirebaseData();
    console.log("Firebase initialized successfully!");

    if (process.env.FUNCTIONS_WORKER_RUNTIME || process.env.K_SERVICE) {
      // Serverless hosts own the HTTP listener.
      await startBackgroundJobs();
      return;
    }

    // Background jobs (mailbox polling) start only after the port is bound; if the port is
    // taken by another instance this process exits instead of polling (see startServer).
    const server = await startServer({
      app,
      port: Number(process.env.PORT) || 5000,
      startBackgroundJobs,
    });
    // Prevent headless Windows background subshell from exiting on stdin EOF
    if (server) setInterval(() => {}, 60000);
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
  await initializeDatabase();
}

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully...");
  stopEmailPolling();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully...");
  stopEmailPolling();
  process.exit(0);
});
