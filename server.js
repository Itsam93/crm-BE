import express from "express";
import dotenv from "dotenv";
import helmet from "helmet";
import morgan from "morgan";
import cors from "cors";

import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import partnerRoutes from "./routes/partnerRoutes.js";

dotenv.config();
connectDB();

const app = express();

// -----------------------
// Body Parsers
// -----------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// -----------------------
// CORS Configuration
// -----------------------
const allowedOrigins = [
  "http://localhost:5174",
  "https://crm-app-atjd.vercel.app"
];

const corsOptions = {
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps, curl)
    if (!origin) return callback(null, true);
    if (!allowedOrigins.includes(origin)) {
      return callback(new Error(`CORS policy: The origin ${origin} is not allowed.`), false);
    }
    return callback(null, true);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

// Enable CORS
app.use(cors(corsOptions));

// Handle preflight OPTIONS requests for all routes
app.options("/*", cors(corsOptions));

// -----------------------
// Security & Logging
// -----------------------
app.use(helmet());
app.use(morgan("tiny"));

// -----------------------
// Routes
// -----------------------
app.use("/api/auth", authRoutes);
app.use("/api/partners", partnerRoutes);

// Root endpoint
app.get("/", (req, res) => {
  res.status(200).json({ message: "CRM Backend API running successfully 🚀" });
});

// -----------------------
// 404 Handler
// -----------------------
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// -----------------------
// Global Error Handler
// -----------------------
app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err);
  res.status(500).json({ message: err.message || "Internal Server Error" });
});

// -----------------------
// Start Server
// -----------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
