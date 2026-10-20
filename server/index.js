import cookieParser from "cookie-parser";
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import pool from "./db.js";
import authRoute from "./routes/auth.route.js";
import ticketRoute from "./routes/ticket.route.js";
import userRoute from "./routes/user.route.js";
import "./config/db.js";

dotenv.config();

const app = express();
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());



app.use("/api/auth", authRoute);
app.use("/api/tickets", ticketRoute);
app.use("/api/users", userRoute);

const PORT = process.env.PORT || 5000;

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });

