import xlsx from "xlsx";
import fs from "fs";
import path from "path";
import multer from "multer";
import Member from "../models/Member.js";
import Church from "../models/Church.js";
import Group from "../models/Group.js";
import Partnership from "../models/Partnership.js";
import Giving from "../models/Giving.js";

// Ensure uploads directory exists at runtime
const uploadDir = "uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
export const upload = multer({ storage });

// Utility: normalize keys (case-insensitive, trim spaces)
function normalizeRow(row) {
  const normalized = {};
  for (let key in row) {
    const cleanKey = key.trim().toLowerCase();
    normalized[cleanKey] = row[key];
  }
  return normalized;
}

// Utility: parse Excel date safely
function parseExcelDate(value) {
  if (!value) return new Date();
  if (typeof value === "number") {
    // Excel serial number → JS date
    const dateObj = xlsx.SSF.parse_date_code(value);
    if (dateObj) {
      return new Date(dateObj.y, dateObj.m - 1, dateObj.d);
    }
  }
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

export const uploadGivings = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Please upload an Excel file" });
    }

    const filePath = path.resolve(req.file.path);
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    let results = [];

    for (let rawRow of sheetData) {
      const row = normalizeRow(rawRow);

      const memberName = row["member name"];
      const churchName = row["church name"];
      const groupName = row["group name"];
      const partnershipName = row["partnership arm"];
      const amount = row["amount"];
      const dateValue = row["date"];

      if (!memberName || !churchName || !groupName || !partnershipName || !amount) {
        results.push({ row: rawRow, status: "❌ Skipped (Missing required fields)" });
        continue;
      }

      try {
        // Ensure Group
        let group = await Group.findOne({ group_name: groupName });
        if (!group) group = await Group.create({ group_name: groupName });

        // Ensure Church
        let church = await Church.findOne({ name: churchName, group: group._id });
        if (!church) church = await Church.create({ name: churchName, group: group._id });

        // Ensure Member
        let member = await Member.findOne({ name: memberName, church: church._id });
        if (!member) member = await Member.create({ name: memberName, church: church._id });

        // Ensure Partnership
        let partnership = await Partnership.findOne({ name: partnershipName });
        if (!partnership) partnership = await Partnership.create({ name: partnershipName });

        // Save Giving
        const giving = await Giving.create({
          member: member._id,
          partnershipArm: partnership._id,
          amount: Number(amount) || 0,
          date: parseExcelDate(dateValue),
        });

        results.push({ row: rawRow, status: "✅ Saved", id: giving._id });
      } catch (err) {
        console.error("Row error:", rawRow, err);
        results.push({ row: rawRow, status: `❌ Failed (${err.message})` });
      }
    }

    fs.unlinkSync(filePath); 

    res.status(200).json({
      message: "Upload completed",
      results,
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({
      message: "Server error during upload",
      error: err.message,
      stack: err.stack,
    });
  }
};
