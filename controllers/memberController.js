import Member from "../models/Member.js";
import Group from "../models/Group.js";
import Church from "../models/Church.js";
import fs from "fs";
import XLSX from "xlsx";
import Giving from "../models/Giving.js";
import Marriage from "../models/Marriage.js";
import mongoose from "mongoose";

/* ===============================
   CREATE NEW MEMBER
================================= */
export const createMember = async (req, res) => {
  try {
    const { name, phone, birthday, kingschatId, group, church, hod, email } = req.body;

    if (!name) return res.status(400).json({ message: "Member name is required" });

    const existingGroup = await Group.findById(group);
    const existingChurch = await Church.findById(church);
    if (!existingGroup) return res.status(404).json({ message: "Group not found" });
    if (!existingChurch) return res.status(404).json({ message: "Church not found" });

    const member = await Member.create({
      name,
      phone,
      birthday,
      kingschatId,
      group,
      church,
      hod,
      email,
    });

    res.status(201).json(member);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ===============================
   GET MEMBERS (Paginated, Filtered)
================================= */
export const getMembers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const group = req.query.group || "";
    const church = req.query.church || "";

    const filter = {}; 
    if (search) filter.name = { $regex: search, $options: "i" };
    if (group) filter.group = group;
    if (church) filter.church = church;
    if (req.query.gender) filter.gender = req.query.gender;


    const total = await Member.countDocuments(filter);
    const members = await Member.find(filter)
      .populate("group", "group_name")
      .populate("church", "name")
      .populate("hod", "name")
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({ members, total, page, limit });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const searchMembers = async (req, res) => {

  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search?.trim();

    const filter = {
      deleted: false,
    };

    // ✅ Correct search — matches your schema
    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    const total = await Member.countDocuments(filter);

    const members = await Member.find(filter)
      .populate("group", "group_name")
      .populate("church", "name")
      .populate("hod", "name")
      .limit(limit)
      .skip((page - 1) * limit);

    res.status(200).json({
      members,
      total,
      page,
      limit,
    });
  } catch (err) {
    console.error("❌ searchMembers ERROR:", err);
    res.status(500).json({ message: "Search failed" });
  }
};



/* ===============================
   UPDATE MEMBER (Admin/HOD Direct Update)
================================= */
export const updateMember = async (req, res) => {
  try {
    const { id } = req.params; // ID comes from the URL
    const updates = { ...req.body };

    // Remove editId if present to avoid trying to update _id
    if (updates.editId) delete updates.editId;

    // Find and update member
    const updated = await Member.findByIdAndUpdate(id, updates, {
      new: true,          // return the updated document
      runValidators: true // ensure schema validations are applied
    });

    if (!updated) return res.status(404).json({ message: "Member not found" });

    res.status(200).json(updated);
  } catch (err) {
    console.error("Error updating member:", err);
    res.status(500).json({ message: err.message });
  }
};

/* ===============================
   MEMBER SELF-UPDATE REQUEST
================================= */
export const submitUpdateRequest = async (req, res) => {
  try {
    const { id } = req.params; 
    const newDetails = req.body;

    const member = await Member.findById(id);
    if (!member) return res.status(404).json({ message: "Member not found" });

    member.pendingUpdate = newDetails;
    member.updateStatus = "pending";
    await member.save();

    res.status(200).json({ message: "Update request submitted successfully", member });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ===============================
   APPROVE OR REJECT MEMBER UPDATE
================================= */
export const reviewUpdateRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, notes } = req.body; 

    const member = await Member.findById(id);
    if (!member) return res.status(404).json({ message: "Member not found" });

    if (action === "approve") {
      if (member.pendingUpdate) {
        Object.assign(member, member.pendingUpdate); 
        member.pendingUpdate = null;
        member.updateStatus = "approved";
        member.updateNotes = notes || "Approved successfully";
      }
    } else if (action === "reject") {
      member.updateStatus = "rejected";
      member.updateNotes = notes || "Request rejected";
      member.pendingUpdate = null;
    } else {
      return res.status(400).json({ message: "Invalid action. Must be 'approve' or 'reject'." });
    }

    await member.save();
    res.status(200).json({ message: `Update ${action}ed successfully`, member });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ===============================
   HARD DELETE MEMBER
================================= */
export const deleteMember = async (req, res) => {
  try {
    const { id } = req.params;
    const member = await Member.findByIdAndDelete(id); // <-- hard delete
    if (!member) return res.status(404).json({ message: "Member not found" });
    res.json({ message: "Member deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ===============================
   BULK UPLOAD MEMBERS
================================= */
export const bulkUploadMembers = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });

  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    if (!data || data.length === 0) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: "Excel file is empty or invalid" });
    }

    const membersToInsert = [];
    const skippedRows = [];

    for (const row of data) {
      if (!row.name || !row.group || !row.church) {
        skippedRows.push({ row, reason: "Missing required fields" });
        continue;
      }

      const groupDoc = await Group.findOne({ group_name: row.group });
      const churchDoc = await Church.findOne({ name: row.church });

      if (!groupDoc) {
        skippedRows.push({ row, reason: "Group not found" });
        continue;
      }
      if (!churchDoc) {
        skippedRows.push({ row, reason: "Church not found" });
        continue;
      }

      let birthday = null;
      if (row.birthday) {
        const date = new Date(row.birthday);
        if (!isNaN(date.getTime())) birthday = date;
      }

      membersToInsert.push({
        name: row.name,
        email: row.email || "",
        phone: row.phone || "",
        birthday,
        kingschatId: row.kingschatId || "",
        group: groupDoc._id,
        church: churchDoc._id,
      });
    }

    if (membersToInsert.length === 0) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: "No valid members to insert" });
    }

    let inserted = [];
    let duplicateCount = 0;

    try {
      inserted = await Member.insertMany(membersToInsert, { ordered: false });
    } catch (err) {
      if (err.code === 11000 && err.writeErrors) {
        duplicateCount = err.writeErrors.length;
        inserted = err.insertedDocs || [];
      } else {
        throw err;
      }
    }

    fs.unlinkSync(req.file.path);
    return res.status(201).json({
      message: `${inserted.length} members uploaded successfully`,
      duplicatesSkipped: duplicateCount,
      skippedRows,
    });
  } catch (err) {
    console.error("Bulk upload error:", err);
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
};


/* ===============================
   GET MEMBER PROFILE
================================= */
export const getMemberProfile = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid member ID" });
    }

    // ===== Member Core Details =====
    const member = await Member.findById(id)
      .populate("group", "group_name")
      .populate("church", "name")
      .populate("hod", "name")
      .lean();

    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }

    // ===== Marriage Info =====
    const marriage = await Marriage.findOne({
      status: "active",
      $or: [{ husband: id }, { wife: id }],
    })
      .populate("husband", "name phone")
      .populate("wife", "name phone")
      .lean();

    let maritalStatus = "Single";
    let spouse = null;
    let weddingDate = null;
    let yearsMarried = null;

    if (marriage) {
      maritalStatus = "Married";
      weddingDate = marriage.weddingDate;

      spouse =
        marriage.husband._id.toString() === id
          ? marriage.wife
          : marriage.husband;

      const today = new Date();
      yearsMarried =
        today.getFullYear() - new Date(weddingDate).getFullYear();
    }

   // Normalize arm function
const normalizeArm = (value) => {
  if (!value) return "Rhapsody";

  const key = value.toLowerCase().trim().replace(/\s+/g, "_");

  const map = {
    rhapsody: "Rhapsody",
    healing_school: "Healing School",
    ministry_programs: "Ministry Programs",
    innercity_missions: "Innercity Missions",
    loveworld_bibles: "Loveworld Bibles",
    lwpm: "LWPM",
  };

  return map[key] || "Rhapsody";
};

// ===== Giving Summary =====
const givingSummaryRaw = await Giving.aggregate([
  {
    $match: {
      member: new mongoose.Types.ObjectId(id),
      deleted: false,
    },
  },
  {
    $group: {
      _id: "$arm",
      totalAmount: { $sum: "$amount" },
    },
  },
  {
    $project: {
      arm: "$_id",
      totalAmount: 1,
      _id: 0,
    },
  },
]);

// Normalize arms from the DB and ensure all arms are included
const allArms = [
  "Rhapsody",
  "Healing School",
  "Ministry Programs",
  "Innercity Missions",
  "Loveworld Bibles",
  "LWPM",
];

const givingSummary = allArms.map((armName) => {
  const found = givingSummaryRaw.find((g) => normalizeArm(g.arm) === armName);
  return { arm: armName, totalAmount: found ? found.totalAmount : 0 };
});

const grandTotal = givingSummary.reduce((sum, g) => sum + g.totalAmount, 0);


    // ===== Celebrations =====
    const today = new Date();

    const birthdayToday =
      member.birthday &&
      member.birthday.getDate() === today.getDate() &&
      member.birthday.getMonth() === today.getMonth();

    const anniversaryToday =
      weddingDate &&
      new Date(weddingDate).getDate() === today.getDate() &&
      new Date(weddingDate).getMonth() === today.getMonth();

    // ===== Respond =====
    res.status(200).json({
      member,
      maritalStatus,
      spouse,
      weddingDate,
      yearsMarried,
      givingSummary,
      grandTotal,
      celebrations: {
        birthdayToday,
        anniversaryToday,
      },
    });
  } catch (err) {
    console.error("Error fetching member profile:", err);
    res.status(500).json({ message: "Failed to fetch member profile" });
  }
};


// GET /admin/members/upcoming-anniversaries
export const getUpcomingAnniversaries = async (req, res) => {
  try {
    const today = new Date();
    const next30 = new Date();
    next30.setDate(today.getDate() + 30);

    const marriages = await Marriage.find({ status: "active" })
      .populate("husband", "name group church")
      .populate("wife", "name group church")
      .lean();

    const upcoming = marriages.filter((m) => {
      if (!m.weddingDate) return false;
      const anniv = new Date(today.getFullYear(), m.weddingDate.getMonth(), m.weddingDate.getDate());
      return anniv >= today && anniv <= next30;
    });

    res.status(200).json({ upcoming });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch upcoming anniversaries" });
  }
};
