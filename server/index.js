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
import aiRoute from "./routes/ai.route.js";
import { initializeFirebaseData } from "./database/init.js";
import { allowedOrigins } from "./config/origins.js";


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
app.use("/api/ai", aiRoute);



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
