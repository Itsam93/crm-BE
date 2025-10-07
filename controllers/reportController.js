import asyncHandler from "express-async-handler";
import multer from "multer";
import XLSX from "xlsx";
import fs from "fs";
import path from "path";

import Member from "../models/Member.js";
import Partnership from "../models/Partnership.js";
import Giving from "../models/Giving.js";

// Multer setup
const upload = multer({ dest: "uploads/" });

// Helper: Convert Excel serial or text date to valid JS Date
function parseExcelDate(value) {
  if (!value) return new Date();

  // Handle Excel serial date (numeric)
  if (typeof value === "number") {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30)); // Excel base date
    return new Date(excelEpoch.getTime() + value * 86400000);
  }

  // Handle text date (e.g., August_20th,_2025)
  try {
    const cleaned = value.replace(/_/g, " ").replace(/,/g, "");
    const parsed = new Date(cleaned);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  } catch {
    return new Date();
  }
}

// @desc Upload Excel report
// @route POST /api/reports/upload
// @access Private/Admin
export const uploadReport = [
  upload.single("file"), // middleware to parse single file
  asyncHandler(async (req, res) => {
    console.log("📤 Upload endpoint hit");

    if (!req.file) {
      console.error("❌ No file uploaded");
      res.status(400);
      throw new Error("No file uploaded");
    }

    console.log("📁 File received:", req.file.originalname);
    const filePath = path.resolve(req.file.path);
    console.log("🗂️ File saved temporarily at:", filePath);

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    console.log("📄 Sheet name detected:", sheetName);

    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);
    console.log(`🔢 Parsed ${data.length} rows from Excel`);
    console.log("🧾 First 3 rows preview:", data.slice(0, 3));

    let createdCount = 0;
    let skippedCount = 0;

    for (const row of data) {
      console.log("➡️ Processing row:", row);

      const { memberName, partnershipName, amount, date } = row;
      if (!memberName || !partnershipName || !amount) {
        console.warn("⚠️ Skipped row (missing data):", row);
        skippedCount++;
        continue;
      }

      // Parse date correctly (handles Excel serials or text)
      const parsedDate = parseExcelDate(date);

      // Find or create member
      let member = await Member.findOne({ name: memberName });
      if (!member) {
        member = await Member.create({ name: memberName });
        console.log("👤 Created new member:", memberName);
      }

      // Find or create partnership
      let partnership = await Partnership.findOne({ name: partnershipName });
      if (!partnership) {
        partnership = await Partnership.create({ name: partnershipName });
        console.log("🤝 Created new partnership:", partnershipName);
      }

      // Allow multiple daily givings — do NOT skip duplicates
      await Giving.create({
        member: member._id,
        partnershipArm: partnership._id,
        amount,
        date: parsedDate,
      });

      createdCount++;
      console.log("✅ Giving created for:", { memberName, partnershipName, amount, date: parsedDate });
    }

    // Delete file after processing
    fs.unlinkSync(filePath);
    console.log("🗑️ Temporary file deleted");

    // Emit real-time update
    const io = req.app.get("io");
    if (io) {
      io.emit("reportUpdated", { message: "Reports updated" });
      console.log("📡 Emitted socket update event");
    } else {
      console.warn("⚠️ No socket.io instance found in app");
    }

    console.log(`🎯 Upload complete: ${createdCount} new records, ${skippedCount} skipped`);

    res.json({
      message: "Report uploaded and database updated successfully",
      createdCount,
      skippedCount,
    });
  }),
];
