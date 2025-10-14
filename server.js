import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import partnerRoutes from "./routes/partnerRoutes.js";

dotenv.config();
connectDB();

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5174", 
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true, 
  })
);
app.use(helmet());
app.use(morgan("tiny"));

// Test Route
app.get("/", (req, res) => {
  res.status(200).json({ message: "CRM Backend API running successfully 🚀" });
});

// ✅ Routes
app.use("/api/auth", authRoutes);
app.use("/api/partners", partnerRoutes);

// 404 Handler
app.use((req, res, next) => {
  res.status(404).json({ message: "Route not found" });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err);
  res.status(500).json({ message: "Internal Server Error" });
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
