// server.js
import express from "express";
import dotenv from "dotenv";
import helmet from "helmet";
import morgan from "morgan";
import cors from "cors";
import multer from "multer";
import XLSX from "xlsx";
import mongoose from "mongoose";

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

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); 
    if (!allowedOrigins.includes(origin)) {
      console.warn(`Blocked CORS request from origin: ${origin}`);
      return callback(new Error("Not allowed by CORS"), false);
    }
    return callback(null, true);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// Handle OPTIONS preflight
app.options("*", cors());

// -----------------------
// Security & Logging
// -----------------------
app.use(helmet());
app.use(morgan("tiny"));

// -----------------------
// MongoDB Schemas
// -----------------------
const contributionSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  church: { type: String, required: true },
  partnershipArm: { type: String, required: true },
  amount: { type: Number, required: true },
  date: { type: Date, required: true },
}, { timestamps: true });

contributionSchema.index({ fullName: 1, partnershipArm: 1, date: 1 }, { unique: true }); // prevent duplicates

const Contribution = mongoose.model("Contribution", contributionSchema);

// -----------------------
// Routes
// -----------------------
app.use("/api/auth", authRoutes);
app.use("/api/partners", partnerRoutes);

// -----------------------
// File Upload Setup
// -----------------------
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Upload endpoint
app.post("/api/partners/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    if (!data.length) return res.status(400).json({ message: "File is empty" });

    // Identify date columns dynamically
    const dateColumns = Object.keys(data[0]).filter(col => /\d{4}-\d{2}-\d{2}/.test(col));

    // Transform to long format
    const transformedData = [];
    data.forEach(row => {
      dateColumns.forEach(date => {
        const amount = row[date] || 0;
        if (amount !== 0) {
          transformedData.push({
            fullName: row.fullName,
            church: row.church,
            partnershipArm: row.partnershipArm,
            amount: amount,
            date: new Date(date),
          });
        }
      });
    });

    // Insert while ignoring duplicates
    const insertPromises = transformedData.map(item => 
      Contribution.updateOne(
        { fullName: item.fullName, partnershipArm: item.partnershipArm, date: item.date },
        { $set: item },
        { upsert: true }
      )
    );

    await Promise.all(insertPromises);

    res.json({ message: "File uploaded and data saved successfully", count: transformedData.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// -----------------------
// Root endpoint
// -----------------------
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
