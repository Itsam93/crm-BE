import multer from "multer";
import XLSX from "xlsx";
import Member from "../models/Member.js";
import Group from "../models/Group.js";
import Church from "../models/Church.js";
import Partnership from "../models/Partnership.js";
import Giving from "../models/Giving.js";

// Multer setup (memory storage)
const storage = multer.memoryStorage();
export const upload = multer({ storage });

// Convert Excel date or string to JS Date
const parseDate = (date) => {
  if (!date) return new Date();
  if (typeof date === "number") return new Date((date - 25569) * 86400 * 1000); // Excel serial
  if (typeof date === "string") {
    // Convert DD/MM/YYYY to YYYY-MM-DD
    if (date.includes("/")) {
      const [d, m, y] = date.split("/");
      return new Date(`${y}-${m}-${d}`);
    }
    return new Date(date); // YYYY-MM-DD
  }
  return new Date();
};

// Controller
export const uploadGivings = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Convert sheet to JSON
    let rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    if (!rows.length) return res.status(400).json({ message: "Excel sheet is empty" });

    const failedRows = [];

    for (const [index, row] of rows.entries()) {
      try {
        // Map headers flexibly (trim & lower case)
        const map = {};
        for (const key of Object.keys(row)) {
          map[key.trim().toLowerCase()] = row[key];
        }

        const member_name = map["member name"]?.toString().trim() || null;
        const church_name = map["church name"]?.toString().trim() || null;
        const group_name = map["group name"]?.toString().trim() || null;
        const partnership_name = map["partnership arm"]?.toString().trim() || null;
        let amountRaw = map["amount"];
        const dateRaw = map["date"];

        // Validate mandatory fields
        if (!church_name || !amountRaw) {
          failedRows.push({ row: index + 2, reason: "Missing Church Name or Amount" });
          continue;
        }

        // Parse amount (remove commas, currency symbols)
        amountRaw = amountRaw.toString().replace(/[^0-9.-]+/g, "");
        const amount = Number(amountRaw);
        if (isNaN(amount)) {
          failedRows.push({ row: index + 2, reason: "Invalid Amount" });
          continue;
        }

        const date = parseDate(dateRaw);

        // Find or create Group
        const group = group_name
          ? await Group.findOne({ name: group_name }) || await Group.create({ name: group_name })
          : null;

        // Find or create Church
        const church = await Church.findOne({ name: church_name }) || await Church.create({ name: church_name });

        // Find or create Partnership
        const partnership = partnership_name
          ? await Partnership.findOne({ name: partnership_name }) || await Partnership.create({ name: partnership_name })
          : null;

        // Find or create Member
        const member = member_name
          ? await Member.findOne({ name: member_name }) || await Member.create({
              name: member_name,
              group: group?._id || null,
              church: church?._id || null,
            })
          : null;

        // Create Giving
        await Giving.create({
          member: member?._id || null,
          group: group?._id || null,
          church: church?._id || null,
          partnership: partnership?._id || null,
          amount,
          date,
        });

      } catch (rowErr) {
        failedRows.push({ row: index + 2, reason: rowErr.message });
      }
    }

    res.json({
      message: `Givings upload completed. Failed rows: ${failedRows.length}`,
      failedRows,
    });

  } catch (err) {
    console.error("Upload failed:", err);
    res.status(500).json({ message: "Failed to process file", error: err.message });
  }
};
