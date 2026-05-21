import Member from "../models/Member.js";
import Group from "../models/Group.js";
import Church from "../models/Church.js";
import fs from "fs";
import XLSX from "xlsx";
import Giving from "../models/Giving.js";
import Marriage from "../models/Marriage.js";
import mongoose from "mongoose";
import Campaign from "../models/Campaign.js";
import Category from "../models/Category.js"

/* ===============================
   CREATE NEW MEMBER
================================= */
export const createMember = async (req, res) => {
  try {
    const { name, phone, birthday, kingschatId, group, church, hod, email } = req.body;

    if (!name) return res.status(400).json({ message: "Member name is required" });

    const existingGroup = await Group.findById(group);
    if (!existingGroup) return res.status(404).json({ message: "Group not found" });
      let existingChurch = null;

      if (church) {
        existingChurch = await Church.findById(church);
        if (!existingChurch) {
          return res.status(404).json({ message: "Church not found" });
        }
      }
    
    const member = await Member.create({
      name,
      phone,
      birthday,
      kingschatId,
      group,
      church: existingChurch ? existingChurch._id : null,
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
    // Parse query params
    const page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 1000;
    const search = req.query.search || "";
    const group = req.query.group || "";
    const church = req.query.church || "";
    const gender = req.query.gender || "";

    const filter = {};

    // 🔹 Search by full_name (for dropdown compatibility)
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { kingschatId: { $regex: search, $options: "i" } },
      ];
    }

    if (group) filter.group = group; 
    if (church) filter.church = church;
    if (gender) filter.gender = gender;

    // 🔹 If fetching for dropdowns, return ALL members
    // For dropdowns, frontend can pass ?all=true
    if (req.query.all === "true") {
      limit = 0; // no limit
    }

    // 🔹 Count total documents for pagination info
    const total = await Member.countDocuments(filter);

    // 🔹 Query members
    let query = Member.find(filter)
      .populate("group", "group_name")
      .populate("church", "name")
      .populate("hod", "name"); 

    // 🔹 Apply pagination only if limit > 0
    if (limit > 0) {
      query = query.skip((page - 1) * limit).limit(limit);
    }

    const members = await query;

    res.json({
      members,
      total,
      page,
      limit: limit > 0 ? limit : total,
    });
  } catch (err) {
    console.error("Error fetching members:", err);
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

    const skippedRows = [];
    let insertedCount = 0;
    let updatedCount = 0;

    for (const row of data) {
      try {
        // =========================
        // VALIDATION
        // =========================
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

        // =========================
        // NORMALIZE DATA
        // =========================
        let birthday = null;
        if (row.birthday) {
          const date = new Date(row.birthday);
          if (!isNaN(date.getTime())) birthday = date;
        }

        const normalizedPhone = row.phone?.toString().trim();

        // =========================
        // FIND EXISTING MEMBER
        // Priority: phone → fallback: name
        // =========================
        let existingMember = null;

        if (normalizedPhone) {
          existingMember = await Member.findOne({ phone: normalizedPhone });
        }

        if (!existingMember) {
          existingMember = await Member.findOne({
            name: { $regex: `^${row.name}$`, $options: "i" },
          });
        }

        // =========================
        // UPDATE EXISTING MEMBER
        // =========================
        if (existingMember) {
          let updated = false;

          const updateFields = {};

          // Only update if field is missing or empty
          if (!existingMember.email && row.email) {
            updateFields.email = row.email;
            updated = true;
          }

          if (!existingMember.phone && normalizedPhone) {
            updateFields.phone = normalizedPhone;
            updated = true;
          }

          if (!existingMember.kingschatId && row.kingschatId) {
            updateFields.kingschatId = row.kingschatId;
            updated = true;
          }

          if (!existingMember.birthday && birthday) {
            updateFields.birthday = birthday;
            updated = true;
          }

          // Always ensure group/church are correct
          if (existingMember.group?.toString() !== groupDoc._id.toString()) {
            updateFields.group = groupDoc._id;
            updated = true;
          }

          if (existingMember.church?.toString() !== churchDoc._id.toString()) {
            updateFields.church = churchDoc._id;
            updated = true;
          }

          if (updated) {
            await Member.updateOne(
              { _id: existingMember._id },
              { $set: updateFields }
            );
            updatedCount++;
          }

          continue;
        }

        // =========================
        // CREATE NEW MEMBER
        // =========================
        await Member.create({
          name: row.name,
          email: row.email || "",
          phone: normalizedPhone || "",
          birthday,
          kingschatId: row.kingschatId || "",
          group: groupDoc._id,
          church: churchDoc._id,
        });

        insertedCount++;

      } catch (err) {
        console.error("Row processing error:", err);
        skippedRows.push({ row, reason: "Processing error" });
      }
    }

    fs.unlinkSync(req.file.path);

    return res.status(200).json({
      message: "Bulk upload completed",
      inserted: insertedCount,
      updated: updatedCount,
      skipped: skippedRows.length,
      skippedRows,
    });

  } catch (err) {
    console.error("Bulk upload error:", err);
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(500).json({
      message: "Internal server error",
      error: err.message,
    });
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

    // =========================
    // MEMBER
    // =========================
    const member = await Member.findById(id)
      .populate("group", "group_name")
      .populate("church", "name")
      .populate("hod", "name")
      .lean();

    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }

    // =========================
    // MARRIAGE
    // =========================
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

    // =========================
    // NORMALIZE ARM
    // =========================
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

    // =========================
    // GIVING SUMMARY
    // =========================
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

    const allArms = [
      "Rhapsody",
      "Healing School",
      "Ministry Programs",
      "Innercity Missions",
      "Loveworld Bibles",
      "LWPM",
    ];

    const givingSummary = allArms.map((armName) => {
      const found = givingSummaryRaw.find(
        (g) => normalizeArm(g.arm) === armName
      );
      return {
        arm: armName,
        totalAmount: found ? found.totalAmount : 0,
      };
    });

    const grandTotal = givingSummary.reduce(
      (sum, g) => sum + g.totalAmount,
      0
    );

    // =========================
    // CAMPAIGNS + CATEGORIES
    // =========================

    // 1. Get all campaigns
    const campaigns = await Campaign.find().lean();

    // 2. Get all categories
    const categories = await Category.find().lean();

    // 3. Build maps
    const campaignsMap = {};
    const campaignDetailsMap = {};
    const categoriesMap = {};

    campaigns.forEach((c) => {
      campaignsMap[c._id] = c.name;

      campaignDetailsMap[c._id] = {
        name: c.name,
        arm: c.arm,
      };
    });

    categories.forEach((cat) => {
      categoriesMap[cat._id] = {
        _id: cat._id,
        name: cat.name,
        minAmount: cat.minAmount,
        maxAmount: cat.maxAmount,
        campaign: cat.campaign,
      };
    });

    // =========================
    // ENSURE MEMBER HAS ALL CAMPAIGNS
    // =========================
    if (!member.campaignCategories) {
      member.campaignCategories = {};
    }

    campaigns.forEach((c) => {
      if (!member.campaignCategories[c._id]) {
        member.campaignCategories[c._id] = null;
      }
    });

    // =========================
    // CELEBRATIONS
    // =========================
    const today = new Date();

    const birthdayToday =
      member.birthday &&
      new Date(member.birthday).getDate() === today.getDate() &&
      new Date(member.birthday).getMonth() === today.getMonth();

    const anniversaryToday =
      weddingDate &&
      new Date(weddingDate).getDate() === today.getDate() &&
      new Date(weddingDate).getMonth() === today.getMonth();

    // =========================
    // RESPONSE
    // =========================
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
      campaignsMap,
      categoriesMap,
      campaignDetailsMap,
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

export const getMembersByChurch = async (req, res) => {
  try {
    const { churchId } = req.params;

    const members = await Member.find({
      church: churchId,
      deleted: false
    }).sort({ name: 1 });

    res.json(members);
  } catch (err) {
    console.error("Error fetching church members:", err);
    res.status(500).json({ message: "Server error" });
  }
};


export const bulkUpdateMembers = async (req, res) => {
  const { memberIds, group, church } = req.body;

  if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
    return res.status(400).json({ message: "No members selected" });
  }

  try {
    // Update all selected members
    await Member.updateMany(
      { _id: { $in: memberIds } },
      { $set: { group, church } }
    );

    res.status(200).json({ message: "Members updated successfully" });
  } catch (err) {
    console.error("Bulk update error:", err);
    res.status(500).json({ message: "Error updating members" });
  }
};