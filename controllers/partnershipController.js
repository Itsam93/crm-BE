import * as XLSX from "xlsx";
import Member from "../models/Member.js";
import Giving from "../models/Giving.js";
import Church from "../models/Church.js";
import Group from "../models/Group.js";

// ✅ Add single daily giving
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

// ✅ Bulk upload givings
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

// ✅ Update a giving
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

// ✅ Soft delete
export const deleteGiving = async (req, res) => {
  try {
    const { id } = req.params;
    await Giving.findByIdAndUpdate(id, { isDeleted: true });
    res.json({ message: "Giving deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Reports
export const getReports = async (req, res) => {
  try {
    const { type } = req.query; // "group", "church", "individual"
    const allArms = ["Rhapsody", "Healing School", "Ministry Programs"];

    // Fetch all givings with populated references
    const givings = await Giving.find({ isDeleted: false })
      .populate("member")
      .populate("group")
      .populate("church");

    const totals = {};

    givings.forEach((g) => {
      // Normalize the arm name
      const rawArm = g.arm || g.partnershipArm || "";
      const armName = rawArm.toLowerCase().includes("healing")
        ? "Healing School"
        : rawArm.toLowerCase().includes("ministry")
        ? "Ministry Programs"
        : "Rhapsody";

      let entityName = "N/A";

      if (type === "individual") {
        // Show all individuals who gave
        entityName = g.member?.name || g.memberName || "Unknown Member";
      } 
      else if (type === "group") {
        // Show all groups where member or group gave
        entityName =
          g.group?.group_name ||
          g.member?.group?.group_name ||
          "Unknown Group";
      } 
      else if (type === "church") {
        // Show all churches where member or group belongs
        entityName =
          g.church?.name ||
          g.member?.church?.name ||
          g.group?.church?.name ||
          "Unknown Church";
      }

      // Skip if entityName is still unknown
      if (!entityName || entityName === "N/A") return;

      // Initialize the entity totals if not already
      if (!totals[entityName]) {
        totals[entityName] = {
          arms: Object.fromEntries(allArms.map((a) => [a, 0])),
          grandTotal: 0,
        };
      }

      // Add the giving amount
      totals[entityName].arms[armName] += g.amount || 0;
      totals[entityName].grandTotal += g.amount || 0;
    });

    res.json({ type, data: totals });
  } catch (error) {
    console.error("Error in getReports:", error);
    res.status(500).json({ message: error.message });
  }
};
