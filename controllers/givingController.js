import fs from "fs";
import path from "path";
import xlsx from "xlsx";
import csvParser from "csv-parser";
import mongoose from "mongoose";
import Giving from "../models/Giving.js";
import Member from "../models/Member.js";
import Group from "../models/Group.js";
import Church from "../models/Church.js";
import Campaign from "../models/Campaign.js";
import { parse } from "json2csv";


const { Types } = mongoose;

const normalizeArm = (value) => {
  if (!value) return "Rhapsody";

  const key = value.toLowerCase().trim().replace(/\s+/g, "_");

  const map = {
    rhapsody: "Rhapsody",
    healing_school: "Healing School",
    ministry_programs: "Ministry Programs",
    loveworld_bibles: "Loveworld Bibles",
    innercity_missions: "Innercity Missions",
    lwpm: "LWPM",
  };

  return map[key] || "Rhapsody";
};

// Map HOD roles to arms
const hodArmMap = {
  healing_hod: "healing_school",
  rhapsody_hod: "rhapsody",
  ministry_hod: "ministry_programs",
  bibles_hod: "loveworld_bibles",
  innercity_hod: "innercity_missions",
  lwpm_hod: "lwpm"
};

const ROLE_TO_ARM = {
  healing_hod: "Healing School",
  rhapsody_hod: "Rhapsody",
  ministry_hod: "Ministry Programs",
  bibles_hod: "LoveWorld Bibles",
  innercity_hod: "InnerCity Missions",
  lwpm_hod: "LWPM",
};

// Validate ObjectId
const isValidId = (id) => Types.ObjectId.isValid(id);

// Normalize date to start/end of day
const normalizeDateRange = (date) => ({
  start: new Date(new Date(date).setHours(0, 0, 0, 0)),
  end: new Date(new Date(date).setHours(23, 59, 59, 999)),
});

/**
 * 🔥 SAFE CAMPAIGN RESOLUTION
 * - Uses explicit campaignId if provided
 * - Falls back ONLY if exactly one campaign matches date
 */
const resolveCampaign = async ({ campaignId, givingDate }) => {
  if (campaignId && isValidId(campaignId)) {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      throw new Error("Campaign not found");
    }
    return campaign;
  }

  // 🔍 Fallback: find campaign by date
  const matches = await Campaign.find({
    startDate: { $lte: givingDate },
    endDate: { $gte: givingDate },
  });

  if (matches.length === 1) {
    console.warn("⚠️ Auto-attached campaign:", matches[0].name);
    return matches[0];
  }
  
  if (matches.length > 1) {
    throw new Error("Multiple campaigns match this date. Please specify campaignId.");
  }

  throw new Error("No active campaign found for this date.");
};

/* =========================================================
   ADD GIVING (BEST PRACTICE)
========================================================= */

export const addGiving = async (req, res) => {
  try {
    const {
      memberId,
      memberName,
      amount,
      arm,
      groupId,
      churchId,
      category,
      date,
    } = req.body;

    // =========================
    // VALIDATION
    // =========================
    if ((!memberId && !memberName) || !amount || !arm) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (Number(amount) <= 0) {
      return res.status(400).json({ message: "Amount must be greater than 0" });
    }

    // =========================
    // FIND MEMBER
    // =========================
    let member;
    if (memberId && isValidId(memberId)) {
      member = await Member.findById(memberId);
    } else if (memberName) {
      member = await Member.findOne({ name: memberName });
    }

    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }

    // =========================
    // DATE
    // =========================
    const givingDate = date ? new Date(date) : new Date();

    // =========================
    // CREATE GIVING
    // =========================
    const giving = await Giving.create({
      member: member._id,
      amount: Number(amount),
      arm,
      date: givingDate,
      group: groupId || member.group || null,
      church: churchId || member.church || null,
      category: category || null,
    });

    console.log("✅ Giving created:", {
      member: member.name,
      amount,
      date: givingDate,
    });

    return res.status(201).json({
      message: "Giving recorded successfully",
      giving,
    });
  } catch (err) {
    console.error("❌ addGiving error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/* =========================================================
   DEBUG ENDPOINT (VERY IMPORTANT)
========================================================= */

export const debugCampaignGivings = async (req, res) => {
  try {
    const { campaignId } = req.params;

    if (!isValidId(campaignId)) {
      return res.status(400).json({ message: "Invalid campaignId" });
    }

    const givings = await Giving.find({
      campaign: campaignId,
      deleted: false,
    }).lean();

    console.log("📊 DEBUG CAMPAIGN GIVINGS COUNT:", givings.length);
    console.log("📊 SAMPLE:", givings[0]);

    return res.json({
      count: givings.length,
      sample: givings[0] || null,
      data: givings,
    });

  } catch (err) {
    console.error("❌ debugCampaignGivings error:", err);
    res.status(500).json({ message: "Debug failed" });
  }
};

/* =========================================================
   MIGRATION FIX (RUN ONCE)
========================================================= */

export const fixMissingCampaigns = async (req, res) => {
  try {
    const campaigns = await Campaign.find();

    const givings = await Giving.find({ campaign: null });

    let fixed = 0;

    for (const g of givings) {
      const match = campaigns.find(
        (c) => g.date >= c.startDate && g.date <= c.endDate
      );

      if (match) {
        g.campaign = match._id;
        await g.save();
        fixed++;
      }
    }

    console.log(`✅ Fixed ${fixed} givings`);

    return res.json({
      message: "Migration complete",
      fixed,
    });

  } catch (err) {
    console.error("❌ Migration error:", err);
    res.status(500).json({ message: "Migration failed" });
  }
};



// Get all givings (with filters + pagination)
export const getGivings = async (req, res) => {
  try {
    let { page = 1, limit = 30, arm, groupId, churchId, campaignId, category } = req.query;
    let { hodId, q, from, to } = req.query;

    // Support custom limit: "all"
    const returnAll = limit === "all";

    // Auto-filter for HOD
    if (req.user?.role?.includes("_hod")) {
      hodId = req.user.id;
    }

    // Base match
    const match = { deleted: false };

    if (arm) match.arm = arm;
    if (campaignId) match.campaign = new Types.ObjectId(campaignId);
    if (category) match.category = category;

    if (from || to) {
      match.date = {};
      if (from) match.date.$gte = new Date(from);
      if (to) match.date.$lte = new Date(to);
    }

    if (q) {
      match["member.name"] = {
        $regex: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
      };
    }

    const objectFilters = {};
    if (groupId) objectFilters["member.group"] = new Types.ObjectId(groupId);
    if (churchId) objectFilters["member.church"] = new Types.ObjectId(churchId);
    if (hodId) objectFilters["member.hod"] = new Types.ObjectId(hodId);

    // Base aggregation pipeline
    const pipeline = [
      { $match: match },

      // Lookup member
      {
        $lookup: {
          from: "members",
          localField: "member",
          foreignField: "_id",
          as: "member",
        },
      },
      { $unwind: "$member" },

      { $match: objectFilters },

      // Lookup church
      {
        $lookup: {
          from: "churches",
          localField: "member.church",
          foreignField: "_id",
          as: "member.church",
        },
      },
      { $unwind: { path: "$member.church", preserveNullAndEmptyArrays: true } },

      // Lookup group
      {
        $lookup: {
          from: "groups",
          localField: "member.group",
          foreignField: "_id",
          as: "member.group",
        },
      },
      { $unwind: { path: "$member.group", preserveNullAndEmptyArrays: true } },

      {
        $project: {
          amount: 1,
          date: 1,
          arm: 1,
          campaign: 1,
          category: 1,
          deleted: 1,
          "member._id": 1,
          "member.name": 1,
          "member.hod": 1,
          "member.church._id": 1,
          "member.church.name": 1,
          "member.group._id": 1,
          "member.group.name": 1,
        },
      },

      { $sort: { date: -1 } },
    ];

    // total count BEFORE pagination
    const total = (await Giving.aggregate([...pipeline, { $count: "total" }]))[0]?.total || 0;

    let rows;

    // Return all records if requested
    if (returnAll) {
      rows = await Giving.aggregate(pipeline);
    } else {
      // Normal pagination
      limit = Number(limit);
      page = Number(page);
      const skip = (page - 1) * limit;
      pipeline.push({ $skip: skip }, { $limit: limit });

      rows = await Giving.aggregate(pipeline);
    }

    return res.json({
      data: rows,
      meta: {
        total,
        page: returnAll ? 1 : page,
        limit: returnAll ? "all" : limit,
        totalPages: returnAll ? 1 : Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("getGivings error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};


//  Edit giving
export const updateGiving = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await Giving.findById(id);
    if (!existing) {
      return res.status(404).json({ message: "Giving not found" });
    }

    const updateData = { ...req.body };

    if (updateData.amount && updateData.amount <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    if (updateData.date) {
      updateData.date = new Date(updateData.date);
    }

    const updated = await Giving.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    return res.json({
      message: "Giving updated",
      giving: updated,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Hard delete giving (ONLY delete-related logic changed)
export const deleteGiving = async (req, res) => {
  try {
    const { id } = req.params;

    // =========================
    // FIND GIVING FIRST
    // =========================
    const giving = await Giving.findById(id);

    if (!giving) {
      return res.status(404).json({ message: "Giving not found" });
    }

    const { member, campaign, amount } = giving;

    // =========================
    // DELETE GIVING
    // =========================
    await Giving.findByIdAndDelete(id);

    // =========================
    // UPDATE PARTICIPATION (MCP)
    // =========================
    if (campaign && member) {
      await MemberCampaignParticipation.findOneAndUpdate(
        {
          member,
          campaign,
        },
        {
          $inc: {
            totalContributed: -amount, // 🔥 reverse contribution
          },
        }
      );
    }

    // =========================
    // GLOBAL SUMMARY (OPTIONAL)
    // =========================
    const givingsAgg = await Giving.aggregate([
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    const totalGivingsAmount = givingsAgg[0]?.totalAmount || 0;
    const totalGivingsCount = givingsAgg[0]?.count || 0;

    // =========================
    // RESPONSE
    // =========================
    res.status(200).json({
      message: "Giving deleted successfully",
      summary: {
        totalGivingsAmount,
        totalGivingsCount,
      },
    });

  } catch (error) {
    console.error("Error deleting giving:", error);
    res.status(500).json({
      message: "Server error while deleting giving",
    });
  }
};


// Restore giving
export const restoreGiving = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await Giving.findByIdAndUpdate(id, { deleted: false }, { new: true });
    if (!updated) return res.status(404).json({ message: "Giving not found" });
    res.json({ message: "Giving restored", giving: updated });
  } catch (err) {
    console.error("restoreGiving error:", err);
    res.status(500).json({ message: err.message });
  }
};

// Bulk upload givings
export const bulkUploadGivings = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const ext = path.extname(req.file.originalname.toLowerCase());
    let createdMembers = 0, createdGivings = 0, skippedDuplicates = 0;
    const duplicateRows = [], newMembers = [];

    const processRow = async (row) => {
      const name = (row.name || row.Name || "").trim();
      const amount = Number(row.amount || row.Amount || 0);
      const arm = row.arm || row.Arm || "Rhapsody";
      const groupName = row.group || row.Group || "";
      const churchName = row.church || row.Church || "";
      const dateVal = row.date || row.Date || "";
      const campaignName = row.campaign || row.Campaign || "";
      const categoryName = row.category || row.Category || "";

      if (!name || !amount) return;

      // Find or create group
      let groupDoc = groupName ? await Group.findOne({ name: groupName }) : null;
      if (groupName && !groupDoc) groupDoc = await Group.create({ name: groupName });

      // Find or create church
      let churchDoc = churchName
        ? await Church.findOne({ name: churchName, group: groupDoc?._id })
        : null;
      if (churchName && !churchDoc) churchDoc = await Church.create({ name: churchName, group: groupDoc?._id });

      // Find or create member
      let memberDoc =
        (await Member.findOne({ name, church: churchDoc?._id })) ||
        (await Member.findOne({ name }));
      if (!memberDoc) {
        memberDoc = await Member.create({
          name,
          church: churchDoc?._id || null,
          group: groupDoc?._id || null,
        });
        createdMembers++;
        newMembers.push({ name, id: memberDoc._id });
      }

      // Find campaign if name exists
      let campaignDoc = null;
      if (campaignName) {
        campaignDoc = await Campaign.findOne({ name: campaignName });
      }

      const givingDate = dateVal ? new Date(dateVal) : new Date();
      const exists = await Giving.findOne({
        member: memberDoc._id,
        amount,
        date: {
          $gte: new Date(givingDate.setHours(0, 0, 0, 0)),
          $lte: new Date(givingDate.setHours(23, 59, 59, 999)),
        },
        arm,
        campaign: campaignDoc?._id || null,
        category: categoryName || null,
      });

      if (exists) {
        skippedDuplicates++;
        duplicateRows.push({ name, amount, date: givingDate, reason: "duplicate" });
        return;
      }

      await Giving.create({
        member: memberDoc._id,
        amount,
        arm,
        date: givingDate,
        group: groupDoc?._id || null,
        church: churchDoc?._id || null,
        campaign: campaignDoc?._id || null,
        category: categoryName || null,
      });
      createdGivings++;
    };

    let rows = [];
    if (ext === ".csv") {
      await new Promise((resolve, reject) => {
        fs.createReadStream(req.file.path)
          .pipe(csvParser())
          .on("data", (row) => rows.push(row))
          .on("end", resolve)
          .on("error", reject);
      });
      fs.unlink(req.file.path, () => {}); 
    } else {
      const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });
    }

    // Process rows sequentially (can optimize later with batching)
    for (const row of rows) await processRow(row);

    return res.json({
      message: "Upload processed",
      createdMembers,
      createdGivings,
      skippedDuplicates,
      duplicates: duplicateRows.slice(0, 50),
      newMembers: newMembers.slice(0, 50),
    });
  } catch (err) {
    console.error("bulkUploadGivings error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

// -----------------------
// Internal helper
// -----------------------
export const getReportsInternal = async ({ user, type, from, to, page = 1, limit = 20 }) => {
  const typeMap = {
    individual: "member",
    member: "member",
    group: "group",
    church: "church",
    campaign: "campaign",
    category: "category",
  };

  type = typeMap[type?.toLowerCase()];
  if (!type) throw new Error("Invalid report type");

  // Restrict HODs to their partnership arm
  let partnershipArm = null;
  if (user?.role?.endsWith("_hod")) {
    partnershipArm = hodArmMap[user.role]?.toLowerCase();
  }

  // Normalize date filters
  const baseMatch = { deleted: false };
  if (from || to) {
    baseMatch.date = {};
    if (from) baseMatch.date.$gte = new Date(new Date(from).setHours(0, 0, 0, 0));
    if (to) baseMatch.date.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
  }

  // -------------------------------
  // Aggregation pipeline
  // -------------------------------
  const pipeline = [
    // Normalize arm for HOD restriction
    {
      $addFields: {
        normalizedArm: { $replaceAll: { input: { $toLower: "$arm" }, find: " ", replacement: "_" } },
      },
    },

    // Match filters
    {
      $match: {
        ...baseMatch,
        ...(partnershipArm ? { normalizedArm: partnershipArm } : {}),
      },
    },

    // Lookups
    { $lookup: { from: "members", localField: "member", foreignField: "_id", as: "member" } },
    { $unwind: "$member" },
    { $lookup: { from: "churches", localField: "member.church", foreignField: "_id", as: "member.church" } },
    { $unwind: { path: "$member.church", preserveNullAndEmptyArrays: true } },
    { $lookup: { from: "groups", localField: "member.group", foreignField: "_id", as: "member.group" } },
    { $unwind: { path: "$member.group", preserveNullAndEmptyArrays: true } },
    { $lookup: { from: "categories", localField: "member.category", foreignField: "_id", as: "member.category" } },
    { $unwind: { path: "$member.category", preserveNullAndEmptyArrays: true } },
    { $lookup: { from: "campaigns", localField: "campaign", foreignField: "_id", as: "campaign" } },
    { $unwind: { path: "$campaign", preserveNullAndEmptyArrays: true } },

    // Group by report type
    {
      $group: (() => {
        switch (type) {
          case "member":
            return {
              _id: "$member._id",
              name: { $first: "$member.name" },
              phone: { $first: "$member.phone" },
              church: { $first: "$member.church.name" },
              group: { $first: "$member.group.name" },
              category: { $first: "$member.category.name" },
              pledge: { $first: "$member.pledge" },
              monthlyRaw: {
                $push: {
                  month: { $dateToString: { format: "%Y-%m", date: "$date" } },
                  amount: "$amount",
                },
              },
              totalAmount: { $sum: "$amount" },
            };
          case "church":
            return {
              _id: "$member.church._id",
              name: { $first: "$member.church.name" },
              monthlyRaw: {
                $push: {
                  month: { $dateToString: { format: "%Y-%m", date: "$date" } },
                  amount: "$amount",
                },
              },
              totalAmount: { $sum: "$amount" },
            };
          case "group":
            return {
              _id: "$member.group._id",
              name: { $first: "$member.group.name" },
              monthlyRaw: {
                $push: {
                  month: { $dateToString: { format: "%Y-%m", date: "$date" } },
                  amount: "$amount",
                },
              },
              totalAmount: { $sum: "$amount" },
            };
          case "campaign":
            return {
              _id: "$campaign._id",
              name: { $first: "$campaign.name" },
              monthlyRaw: {
                $push: {
                  month: { $dateToString: { format: "%Y-%m", date: "$date" } },
                  amount: "$amount",
                },
              },
              totalAmount: { $sum: "$amount" },
            };
          case "category":
            return {
              _id: "$member.category._id",
              name: { $first: "$member.category.name" },
              monthlyRaw: {
                $push: {
                  month: { $dateToString: { format: "%Y-%m", date: "$date" } },
                  amount: "$amount",
                },
              },
              totalAmount: { $sum: "$amount" },
            };
        }
      })(),
    },

    // Convert monthlyRaw → monthly object
    {
      $addFields: {
        monthly: {
          $arrayToObject: {
            $map: {
              input: {
                $setUnion: [{ $map: { input: "$monthlyRaw", as: "m", in: "$$m.month" } }],
              },
              as: "monthKey",
              in: {
                k: "$$monthKey",
                v: {
                  $sum: {
                    $map: {
                      input: { $filter: { input: "$monthlyRaw", as: "m", cond: { $eq: ["$$m.month", "$$monthKey"] } } },
                      as: "x",
                      in: "$$x.amount",
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    { $project: { monthlyRaw: 0 } },

    { $sort: { totalAmount: -1 } },

    // Pagination
    { $skip: (page - 1) * limit },
    { $limit: limit },
  ];

  const rows = await Giving.aggregate(pipeline);

  // Compute grand total and monthly totals ignoring pagination
  const allRows = await Giving.aggregate([
    {
      $addFields: {
        normalizedArm: { $replaceAll: { input: { $toLower: "$arm" }, find: " ", replacement: "_" } },
      },
    },
    { $match: { ...baseMatch, ...(partnershipArm ? { normalizedArm: partnershipArm } : {}) } },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: "$amount" },
        monthlyRaw: {
          $push: {
            month: { $dateToString: { format: "%Y-%m", date: "$date" } },
            amount: "$amount",
          },
        },
      },
    },
  ]);

  const grandTotal = allRows[0]?.totalAmount || 0;

  return {
    rows,
    grandTotal,
    monthly: allRows[0]?.monthlyRaw || [],
  };
};

// -----------------------
// Unified endpoint
// -----------------------
export const getReports = async (req, res) => {
  try {
    const { type, from, to } = req.query;

    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const partnershipArm = req.user.role?.endsWith("_hod")
      ? hodArmMap[req.user.role]?.toLowerCase()
      : null;

    const data = await getReportsInternal({ user: req.user, type, from, to });

    // Extra per-arm total for HODs
    let armTotal = 0;
    if (partnershipArm) {
      const match = { deleted: false, normalizedArm: partnershipArm };
      if (from || to) {
        match.date = {};
        if (from) match.date.$gte = new Date(new Date(from).setHours(0, 0, 0, 0));
        if (to) match.date.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
      }

      const armTotalAgg = await Giving.aggregate([
        { $addFields: { normalizedArm: { $replaceAll: { input: { $toLower: "$arm" }, find: " ", replacement: "_" } } } },
        { $match: match },
        { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
      ]);

      armTotal = armTotalAgg[0]?.totalAmount || 0;
    }

    return res.json({ data, armTotal });
  } catch (err) {
    console.error("getReports error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};


export const downloadReportsCSV = async (req, res) => {
  try {
    const { type = "member", from, to } = req.query;

    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    // Determine HOD arm if user is a HOD
    const partnershipArm = req.user.role?.endsWith("_hod")
      ? hodArmMap[req.user.role]?.toLowerCase()
      : null;

    // Build base match for date filtering
    const match = { deleted: false };
    if (from || to) {
      match.date = {};
      if (from) match.date.$gte = new Date(new Date(from).setHours(0, 0, 0, 0));
      if (to) match.date.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
    }

    if (partnershipArm) {
      match.normalizedArm = partnershipArm;
    }

    // Normalize type
    const typeMap = {
      individual: "member",
      member: "member",
      group: "group",
      church: "church",
    };
    const reportType = typeMap[type.toLowerCase()];
    if (!reportType) return res.status(400).json({ message: "Invalid report type" });

    // Aggregation pipeline
    const pipeline = [
      // Normalize arm
      {
        $addFields: {
          normalizedArm: { $replaceAll: { input: { $toLower: "$arm" }, find: " ", replacement: "_" } },
        },
      },
      { $match: match },
      { $lookup: { from: "members", localField: "member", foreignField: "_id", as: "member" } },
      { $unwind: "$member" },
      { $lookup: { from: "churches", localField: "member.church", foreignField: "_id", as: "member.church" } },
      { $unwind: { path: "$member.church", preserveNullAndEmptyArrays: true } },
      { $lookup: { from: "groups", localField: "member.group", foreignField: "_id", as: "member.group" } },
      { $unwind: { path: "$member.group", preserveNullAndEmptyArrays: true } },
      {
        $group: (() => {
          switch (reportType) {
            case "member":
              return {
                _id: "$member._id",
                name: { $first: "$member.name" },
                phone: { $first: "$member.phone" },
                church: { $first: "$member.church.name" },
                group: { $first: "$member.group.name" },
                totalAmount: { $sum: "$amount" },
                arms: { $push: { arm: "$arm", amount: "$amount" } },
              };
            case "group":
              return {
                _id: "$member.group._id",
                name: { $first: "$member.group.name" },
                totalAmount: { $sum: "$amount" },
                arms: { $push: { arm: "$arm", amount: "$amount" } },
              };
            case "church":
              return {
                _id: "$member.church._id",
                name: { $first: "$member.church.name" },
                group: { $first: "$member.group.name" },
                totalAmount: { $sum: "$amount" },
                arms: { $push: { arm: "$arm", amount: "$amount" } },
              };
          }
        })(),
      },
      { $sort: { totalAmount: -1 } },
    ];

    const rows = await Giving.aggregate(pipeline);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "No records found for the selected filters" });
    }

    // Convert aggregation result to CSV
    const csv = parse(
      rows.map((row) => {
        const result = {
          id: row._id,
          name: row.name || "TOTAL",
          totalAmount: row.totalAmount,
          arms: row.arms ? row.arms.map((a) => `${a.arm}:${a.amount}`).join("; ") : "",
        };
        if (reportType === "member") {
          result.phone = row.phone || "";
          result.church = row.church || "";
          result.group = row.group || "";
        }
        if (reportType === "church") {
          result.group = row.group || "";
        }
        return result;
      })
    );

    res.header("Content-Type", "text/csv");
    res.attachment(`report-${reportType}-${Date.now()}.csv`);
    return res.send(csv);
  } catch (err) {
    console.error("downloadReportsCSV error:", err);
    return res.status(500).json({ message: "Error generating CSV" });
  }
};



/* =========================================================
   GET HOD REPORTS (MAIN FUNCTION)
========================================================= */
export const getHodReport = async (req, res) => {
  try {
    console.log("🚀 HOD REPORT REQUEST STARTED");

    const { type = "individual", from, to, page = 1, limit = 20 } = req.query;
    const role = req.user?.role;

    if (!role) return res.status(401).json({ message: "Unauthorized" });

    const arm = ROLE_TO_ARM[role];
    if (!arm) return res.status(403).json({ message: "Invalid HOD role" });

    console.log("🎯 HOD Arm:", arm);

    const normalizedArm = arm.toLowerCase().replace(/\s+/g, "_");

    /* =========================================================
       1️⃣ GET CAMPAIGN (FOR MCP ONLY)
    ========================================================= */
    const campaign = await Campaign.findOne({
      arm: new RegExp(`^${arm}$`, "i"),
      deleted: false,
    }).sort({ startDate: -1 });

    if (!campaign) {
      console.log("⚠️ No campaign found");
    } else {
      console.log("📌 Campaign:", campaign.name);
    }

    /* =========================================================
       2️⃣ MATCH GIVINGS BY ARM
    ========================================================= */
    const match = {
      deleted: false,
      $expr: {
        $eq: [
          {
            $replaceAll: {
              input: { $toLower: "$arm" },
              find: " ",
              replacement: "_",
            },
          },
          normalizedArm,
        ],
      },
    };

    if (from || to) {
      match.date = {};
      if (from) match.date.$gte = new Date(from);
      if (to) {
        const d = new Date(to);
        d.setHours(23, 59, 59, 999);
        match.date.$lte = d;
      }
    }

    console.log("🔎 MATCH:", JSON.stringify(match));

    /* =========================================================
       3️⃣ GROUP FIELD
    ========================================================= */
    let groupIdField = "$member._id";
    if (type === "church") groupIdField = "$church._id";
    if (type === "group") groupIdField = "$group._id";

    /* =========================================================
       4️⃣ PIPELINE
    ========================================================= */
    const pipeline = [
      { $match: match },

      // MEMBER
      {
        $lookup: {
          from: "members",
          localField: "member",
          foreignField: "_id",
          as: "member",
        },
      },
      { $unwind: { path: "$member", preserveNullAndEmptyArrays: true } },

      // GROUP
      {
        $lookup: {
          from: "groups",
          localField: "member.group",
          foreignField: "_id",
          as: "group",
        },
      },
      { $unwind: { path: "$group", preserveNullAndEmptyArrays: true } },

      // CHURCH
      {
        $lookup: {
          from: "churches",
          localField: "member.church",
          foreignField: "_id",
          as: "church",
        },
      },
      { $unwind: { path: "$church", preserveNullAndEmptyArrays: true } },

      /* =============================
         🔥 MCP (FIXED: ONLY WHEN CAMPAIGN EXISTS)
      ============================= */
      ...(campaign
        ? [
            {
              $lookup: {
                from: "membercampaignparticipations",
                let: { memberId: "$member._id" },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $eq: ["$member", "$$memberId"] },
                          { $eq: ["$campaign", campaign._id] },
                        ],
                      },
                    },
                  },
                ],
                as: "mcp",
              },
            },
            {
              $unwind: {
                path: "$mcp",
                preserveNullAndEmptyArrays: true,
              },
            },
          ]
        : []),

      // CATEGORY FROM MCP
      {
        $lookup: {
          from: "categories",
          localField: "mcp.pledgedCategory",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },

      /* =============================
         GROUPING
      ============================= */
      {
        $group: {
          _id: groupIdField,

          name: { $first: "$member.name" },
          phone: { $first: "$member.phone" },
          church: { $first: "$church.name" },

          group: { $first: "$group.group_name" },

          category: { $first: "$category.name" },
          pledgeAmount: { $first: "$mcp.targetAmount" },

          totalAmount: { $sum: "$amount" },

          monthlyRaw: {
            $push: {
              month: {
                $dateToString: {
                  format: "%Y-%m",
                  date: "$date",
                },
              },
              amount: "$amount",
            },
          },
        },
      },

      /* =============================
         MONTHLY MAP
      ============================= */
      {
        $addFields: {
          monthly: {
            $arrayToObject: {
              $map: {
                input: {
                  $setUnion: [
                    {
                      $map: {
                        input: "$monthlyRaw",
                        as: "m",
                        in: "$$m.month",
                      },
                    },
                  ],
                },
                as: "monthKey",
                in: {
                  k: "$$monthKey",
                  v: {
                    $sum: {
                      $map: {
                        input: {
                          $filter: {
                            input: "$monthlyRaw",
                            as: "m",
                            cond: {
                              $eq: ["$$m.month", "$$monthKey"],  
                            },
                          },
                        },
                        as: "x",
                        in: "$$x.amount",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },

      { $project: { monthlyRaw: 0 } },

      { $sort: { totalAmount: -1 } },
      { $skip: (parseInt(page) - 1) * parseInt(limit) },
      { $limit: parseInt(limit) },
    ];

    const rows = await Giving.aggregate(pipeline);

    console.log("📊 Rows:", rows.length);

    /* =========================================================
       ALL ROWS
    ========================================================= */
    const allRowsPipeline = [...pipeline];
    allRowsPipeline.pop();
    allRowsPipeline.pop();

    const allRows = await Giving.aggregate(allRowsPipeline);

    const grandTotal = allRows.reduce(
      (acc, g) => acc + (g.totalAmount || 0),
      0
    );

    /* =========================================================
       NORMALIZATION
    ========================================================= */
    const normalize = (v, d = "-") => (v || v === 0 ? v : d);

    rows.forEach((r) => {
      r.name = normalize(r.name, "Unnamed");
      r.phone = normalize(r.phone);
      r.church = normalize(r.church);
      r.group = normalize(r.group);
      r.category = normalize(r.category, "Uncategorized");
      r.pledgeAmount = normalize(r.pledgeAmount, 0);
    });

    console.log("✅ HOD REPORT READY");

    return res.json({
      data: {
        rows,
        allRows,
        grandTotal,
        meta: { total: allRows.length },
      },
    });
  } catch (err) {
    console.error("❌ HOD REPORT ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  } 
};  