// 1. Imports & setup
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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
const allowedOrigins = [
  "http://localhost:5174",
  "https://crm-app-atjd.vercel.app"
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (!allowedOrigins.includes(origin)) return callback(new Error("Not allowed by CORS"), false);
    return callback(null, true);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// Security & Logging
app.use(helmet());
app.use(morgan("tiny"));

// MongoDB Schema
const contributionSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  church: { type: String, required: true },
  partnershipArm: { type: String, required: true },
  amount: { type: Number, required: true },
  date: { type: Date, required: true },
}, { timestamps: true });

contributionSchema.index({ fullName: 1, partnershipArm: 1, date: 1 }, { unique: true });

const Contribution = mongoose.model("Contribution", contributionSchema);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/partners", partnerRoutes);

// File Upload
const storage = multer.memoryStorage();
const upload = multer({ storage });

app.post("/api/partners/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    const dateCols = Object.keys(rows[0] || {}).filter(col => /\d{4}-\d{2}-\d{2}/.test(col));
    const data = [];

    for (const row of rows) {
      for (const date of dateCols) {
        const amount = Number(row[date] || 0);
        if (amount > 0) {
          data.push({
            fullName: row.fullName,
            church: row.church,
            partnershipArm: row.partnershipArm,
            amount,
            date: new Date(date)
          });
        }
      }
    }

    // Insert while preventing duplicates
    const promises = data.map(async (item) => {
      const exists = await Contribution.findOne({
        fullName: item.fullName,
        church: item.church,
        partnershipArm: item.partnershipArm,
        date: item.date
      });
      if (!exists) return Contribution.create(item);
    });

    await Promise.all(promises);

    res.json({ message: "Upload successful", count: data.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Root
app.get("/", (req, res) => res.json({ message: "CRM Backend API running 🚀" }));

// 404
app.use((req, res, next) => res.status(404).json({ message: "Route not found" }));

// Global Error
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: err.message || "Internal Server Error" });
});

// Start
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
