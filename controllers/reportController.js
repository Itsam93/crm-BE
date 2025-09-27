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

// @desc Upload Excel report
// @route POST /api/reports/upload
// @access Private/Admin
export const uploadReport = [
  upload.single("file"), // middleware to parse single file
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400);
      throw new Error("No file uploaded");
    }

    const filePath = path.resolve(req.file.path);
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    for (const row of data) {
      const { memberName, partnershipName, amount, date } = row;
      if (!memberName || !partnershipName || !amount) continue;

      // Find or create member
      let member = await Member.findOne({ name: memberName });
      if (!member) member = await Member.create({ name: memberName });

      // Find or create partnership
      let partnership = await Partnership.findOne({ name: partnershipName });
      if (!partnership)
        partnership = await Partnership.create({ name: partnershipName });

      // Check if Giving already exists for same member + partnership + date
      const exists = await Giving.findOne({
        member: member._id,
        partnershipArm: partnership._id,
        date: date ? new Date(date) : new Date(),
      });

      if (!exists) {
        await Giving.create({
          member: member._id,
          partnershipArm: partnership._id,
          amount,
          date: date ? new Date(date) : new Date(),
        });
      }
    }

    // Delete file after processing
    fs.unlinkSync(filePath);

    // Emit real-time update
    const io = req.app.get("io");
    io.emit("reportUpdated", { message: "Reports updated" });

    res.json({ message: "Report uploaded and database updated successfully" });
  }),
];
