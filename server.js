import express from "express";
import dotenv from "dotenv";
import helmet from "helmet";
import morgan from "morgan";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import partnerRoutes from "./routes/partnerRoutes.js";
import cors from "cors";

dotenv.config();

// Connect to database
connectDB();

const app = express();

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS Middleware - make sure no trailing slash in allowed origins
const allowedOrigins = [
  "http://localhost:5174",
  "https://crm-app-atjd.vercel.app"
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// Optional security and logging
app.use(helmet());
app.use(morgan("tiny"));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/partners", partnerRoutes);

// Root
app.get("/", (req, res) => {
  res.status(200).json({ message: "CRM Backend API running successfully 🚀" });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err.message || err);
  res.status(500).json({ message: "Internal Server Error" });
});

// Use dynamic port for Render or fallback
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
