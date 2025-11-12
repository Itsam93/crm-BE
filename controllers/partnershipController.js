import * as XLSX from "xlsx";
import Member from "../models/Member.js";
import Giving from "../models/Giving.js";
import Church from "../models/Church.js";
import Group from "../models/Group.js";

//  Add single daily giving
export const addGiving = async (req, res) => {
  try {
    const { memberName, amount, partnershipArm, date, churchId, groupId } = req.body;

    if (!memberName || !amount) {
      return res.status(400).json({ message: "Member name and amount are required" });
    }

    let member = await Member.findOne({ name: memberName, isDeleted: false });

    // Auto-create member if not exists
    if (!member) {
      member = await Member.create({
        name: memberName,
        church: churchId || null,
        group: groupId || null,
      });
    }

    const giving = await Giving.create({
      member: member._id,
      amount,
      partnershipArm,
      date: date || new Date(),
      church: member.church,
      group: member.group,
    });

    res.status(201).json({ message: "Giving recorded successfully", giving });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Bulk upload givings
export const uploadGivingsBulk = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const buffer = req.file.buffer;
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    let createdMembers = 0;
    let createdGivings = 0;
    let duplicates = 0;

    for (const row of rows) {
      const memberName = row["Member Name"]?.trim();
      const amount = parseFloat(row["Amount"]);
      const partnershipArm = row["Partnership Arm"] || "General";
      const date = row["Date"] ? new Date(row["Date"]) : new Date();

      if (!memberName || isNaN(amount)) continue;

      let member = await Member.findOne({ name: memberName, isDeleted: false });

      if (!member) {
        member = await Member.create({ name: memberName });
        createdMembers++;
      }

      // Prevent duplicate giving (same member + date + amount)
      const existingGiving = await Giving.findOne({
        member: member._id,
        amount,
        date,
        partnershipArm,
      });

      if (existingGiving) {
        duplicates++;
        continue;
      }

      await Giving.create({
        member: member._id,
        amount,
        partnershipArm,
        date,
        church: member.church,
        group: member.group,
      });

      createdGivings++;
    }

    res.json({
      message: "Bulk upload completed",
      summary: { createdMembers, createdGivings, duplicates },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update a giving
export const updateGiving = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const giving = await Giving.findByIdAndUpdate(id, updates, { new: true });
    res.json({ message: "Giving updated successfully", giving });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


export const deleteGiving = async (req, res) => {
  try {
    const { id } = req.params;
    const giving = await Giving.findByIdAndDelete(id); // Hard delete

    if (!giving) return res.status(404).json({ message: "Giving not found" });

    res.status(200).json({ message: "Giving deleted successfully" });
  } catch (err) {
    console.error("Error deleting giving:", err);
    res.status(500).json({ message: "Server error deleting giving" });
  }
};

// Download endpoint: returns CSV
export const downloadReportsCSV = async (req, res) => {
  try {
    const { type } = req.query;
    const data = await getReportsInternal({ user: req.user, type });

    // Convert Mongo aggregation result to CSV
    const csv = parse(
      data.map((row) => {
        return {
          id: row._id,
          name: row.name || "TOTAL",
          totalAmount: row.totalAmount,
          church: row.church?.name || "",
          group: row.group?.name || "",
          arms: row.arms ? row.arms.map((a) => `${a.arm}:${a.amount}`).join("; ") : "",
        };
      })
    );

    res.header("Content-Type", "text/csv");
    res.attachment(`report-${type}-${Date.now()}.csv`);
    return res.send(csv);
  } catch (err) {
    console.error("downloadReportsCSV error:", err);
    return res.status(500).json({ message: "Error generating CSV" });
  }
};