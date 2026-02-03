import fs from "fs";
import path from "path";
import xlsx from "xlsx";
import csvParser from "csv-parser";
import mongoose from "mongoose";
import Giving from "../models/Giving.js";
import Member from "../models/Member.js";
import Group from "../models/Group.js";
import Church from "../models/Church.js";
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


// Add single giving
export const addGiving = async (req, res) => {
  try {
    const { memberId, memberName, amount, arm, groupId, churchId } = req.body;

    if ((!memberId && !memberName) || !amount || !arm)
      return res.status(400).json({ message: "Missing required fields" });

    let member;

    // Find by memberId if provided
    if (memberId) {
      member = await Member.findById(memberId);
      if (!member) return res.status(404).json({ message: "Member not found" });
    } else {
      // Find by name only, do NOT create new member
      member = await Member.findOne({ name: memberName });
      if (!member) {
        return res.status(404).json({ message: "Member not found in the database" });
      }
    }

    const giving = await Giving.create({
      member: member._id,
      amount,
      arm,
      date: req.body.date ? new Date(req.body.date) : new Date(),
    });

    res.status(201).json({ message: "Giving added successfully", giving });
  } catch (err) {
    console.error("addGiving error:", err.message);
    res.status(500).json({ message: "Internal server error" });
  }
};


// Get all givings (with filters + pagination)
export const getGivings = async (req, res) => {
  try {
    let { page = 1, limit = 30, arm, groupId, churchId } = req.query;
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

    // Base pipeline
    const pipeline = [
      { $match: match },

      // Get member
      { 
        $lookup: { 
          from: "members",
          localField: "member",
          foreignField: "_id",
          as: "member"
        }
      },
      { $unwind: "$member" },

      { $match: objectFilters },

      // Get church
      {
        $lookup: {
          from: "churches",
          localField: "member.church",
          foreignField: "_id",
          as: "member.church"
        }
      },
      { $unwind: { path: "$member.church", preserveNullAndEmptyArrays: true } },

      // Get group
      {
        $lookup: {
          from: "groups",
          localField: "member.group",
          foreignField: "_id",
          as: "member.group"
        }
      },
      { $unwind: { path: "$member.group", preserveNullAndEmptyArrays: true } },

      {
        $project: {
          amount: 1,
          date: 1,
          arm: 1,
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
    const total =
      (await Giving.aggregate([...pipeline, { $count: "total" }]))[0]?.total || 0;

    let rows;

    // If limit = "all", return everything
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
    const { memberId, memberName, amount, arm, date, groupId, churchId } = req.body;

    const updateData = {};

    if (memberId) {
      updateData.member = new Types.ObjectId(memberId);
    } else if (memberName) {
      let member = await Member.findOne({ name: memberName });
      if (!member) {
        member = await Member.create({
          name: memberName,
          group: groupId ? new Types.ObjectId(groupId) : null,
          church: churchId ? new Types.ObjectId(churchId) : null,
        });
      }
      updateData.member = member._id;
    }

    if (amount !== undefined) updateData.amount = amount;
    if (arm) updateData.arm = arm;
    if (date) updateData.date = new Date(date);

    const updated = await Giving.findByIdAndUpdate(id, updateData, { new: true });
    if (!updated) return res.status(404).json({ message: "Giving not found" });

    res.json({ message: "Giving updated successfully", giving: updated });
  } catch (err) {
    console.error("updateGiving error:", err);
    res.status(500).json({ message: err.message });
  }
};

// Hard delete giving (ONLY delete-related logic changed)
export const deleteGiving = async (req, res) => {
  try {
    const { id } = req.params;

    // Perform HARD DELETE
    const deletedGiving = await Giving.findByIdAndDelete(id);

    if (!deletedGiving) {
      return res.status(404).json({ message: "Giving not found" });
    }

    // Recalculate totals (still correct for hard delete)
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

    res.status(200).json({
      message: "Giving deleted successfully",
      summary: { totalGivingsAmount, totalGivingsCount },
    });
  } catch (error) {
    console.error("Error deleting giving:", error);
    res.status(500).json({ message: "Server error while deleting giving" });
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

      const givingDate = dateVal ? new Date(dateVal) : new Date();
      const exists = await Giving.findOne({
        member: memberDoc._id,
        amount,
        date: {
          $gte: new Date(givingDate.setHours(0, 0, 0, 0)),
          $lte: new Date(givingDate.setHours(23, 59, 59, 999)),
        },
        arm,
      });

      if (exists) {
        skippedDuplicates++;
        duplicateRows.push({ name, amount, date: givingDate, reason: "duplicate" });
        return;
      }

      await Giving.create({ member: memberDoc._id, amount, arm, date: givingDate });
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
export const getReportsInternal = async ({ user, type, from, to }) => {
  const typeMap = {
    individual: "member",
    member: "member",
    group: "group",
    church: "church",
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

  const pipeline = [
    // Normalize arm for consistent HOD filtering
    {
      $addFields: {
        normalizedArm: {
          $replaceAll: { input: { $toLower: "$arm" }, find: " ", replacement: "_" },
        },
      },
    },
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

    // Aggregations
    {
      $facet: {
        rows: [
          {
            $group: (() => {
              switch (type) {
                case "member":
                  return {
                    _id: "$member._id",
                    name: { $first: "$member.name" },
                    phone: { $first: "$member.phone" },
                    church: { $first: "$member.church" },
                    group: { $first: "$member.group" },
                    totalAmount: { $sum: "$amount" },
                    arms: { $push: { arm: "$arm", amount: "$amount" } },
                  };
                case "church":
                  return {
                    _id: "$member.church._id",
                    name: { $first: "$member.church.name" },
                    group: { $first: "$member.group" },
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
              }
            })(),
          },
          { $sort: { totalAmount: -1 } },
        ],

        // Per-arm totals (Admin/HOD)
        armTotals: [
          {
            $group: {
              _id: "$normalizedArm",
              totalAmount: { $sum: "$amount" },
            },
          },
        ],

        // Grand total
        grandTotal: [
          {
            $group: {
              _id: null,
              totalAmount: { $sum: "$amount" },
            },
          },
        ],
      },
    },
  ];

  const [result] = await Giving.aggregate(pipeline);

  return {
    rows: result.rows,
    armTotals: result.armTotals.reduce((acc, cur) => {
      acc[cur._id] = cur.totalAmount;
      return acc;
    }, {}),
    grandTotal: result.grandTotal[0]?.totalAmount || 0,
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