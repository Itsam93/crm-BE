import xlsx from "xlsx";
import fs from "fs";
import path from "path";
import Member from "../models/Member.js";
import Church from "../models/Church.js";
import Group from "../models/Group.js";
import Partnership from "../models/Partnership.js";
import Giving from "../models/Giving.js";


import multer from "multer";
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
export const upload = multer({ storage });

export const uploadGivings = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Please upload an Excel file" });
    }

    // Read the Excel file
    const filePath = path.resolve(req.file.path);
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    let results = [];

    for (let row of sheetData) {
      const {
        "Member Name": memberName,
        "Church Name": churchName,
        "Group Name": groupName,
        "Partnership Arm": partnershipName,
        Amount,
        Date,
      } = row;

      if (!memberName || !churchName || !groupName || !partnershipName || !Amount) {
        results.push({ row, status: "❌ Skipped (Missing required fields)" });
        continue;
      }

      // Ensure Group
      let group = await Group.findOne({ group_name: groupName });
      if (!group) {
        group = await Group.create({ group_name: groupName });
      }

      // Ensure Church
      let church = await Church.findOne({ name: churchName, group: group._id });
      if (!church) {
        church = await Church.create({ name: churchName, group: group._id });
      }

      // Ensure Member
      let member = await Member.findOne({ name: memberName, church: church._id });
      if (!member) {
        member = await Member.create({ name: memberName, church: church._id });
      }

      // Ensure Partnership
      let partnership = await Partnership.findOne({ name: partnershipName });
      if (!partnership) {
        partnership = await Partnership.create({ name: partnershipName });
      }

      // Save Giving
      const giving = await Giving.create({
        member: member._id,
        partnershipArm: partnership._id,
        amount: Amount,
        date: Date ? new Date(Date) : new Date(),
      });

      results.push({ row, status: "✅ Saved", id: giving._id });
    }

    // Delete uploaded file after processing
    fs.unlinkSync(filePath);

    res.status(200).json({
      message: "Upload completed",
      results,
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
