import fs from "fs";
import path from "path";
import xlsx from "xlsx";
import csvParser from "csv-parser";
import mongoose from "mongoose";
import Giving from "../models/Giving.js";
import Member from "../models/Member.js";
import Group from "../models/Group.js";
import Church from "../models/Church.js";

const { Types } = mongoose;

// Map HOD roles to arms
const hodArmMap = {
  healing_hod: "healing School",
  rhapsody_hod: "rhapsody",
  ministry_hod: "ministry_programs",
};

// Add single giving
export const addGiving = async (req, res) => {
  try {
    const { memberId, memberName, amount, arm, date, groupId, churchId } = req.body;

    if ((!memberId && !memberName) || !amount || !arm)
      return res.status(400).json({ message: "Missing required fields" });

    let member;

    // Find by memberId if provided
    if (memberId) {
      member = await Member.findById(memberId);
      if (!member) return res.status(404).json({ message: "Member not found" });
    } else {
      // Find by name or create new member
      member = await Member.findOne({ name: memberName });
      if (!member) {
        member = await Member.create({
          name: memberName,
          group: groupId ? new Types.ObjectId(groupId) : null,
          church: churchId ? new Types.ObjectId(churchId) : null,
        });
      }
    }

    const giving = await Giving.create({
      member: member._id,
      amount,
      arm,
      date: date ? new Date(date) : new Date(),
    });

    res.status(201).json({ message: "Giving added successfully", giving });
  } catch (err) {
    console.error("addGiving error:", err);
    res.status(500).json({ message: err.message });
  }
};


// Get all givings (with filters + pagination)
export const getGivings = async (req, res) => {
  try {
    const { page = 1, limit = 30, arm, groupId, churchId } = req.query;
    let { hodId, q, from, to } = req.query;

    // Automatically filter by HOD if the user is a HOD
    if (req.user && req.user.role && req.user.role.includes("_hod")) {
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
    if (q) match["member.name"] = { $regex: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") };

    const objectFilters = {};
    if (groupId) objectFilters["member.group"] = new Types.ObjectId(groupId);
    if (churchId) objectFilters["member.church"] = new Types.ObjectId(churchId);
    if (hodId) objectFilters["member.hod"] = new Types.ObjectId(hodId);

    const pipeline = [
      { $match: match },
      { $lookup: { from: "members", localField: "member", foreignField: "_id", as: "member" } },
      { $unwind: "$member" },
      { $match: objectFilters },
      { $lookup: { from: "churches", localField: "member.church", foreignField: "_id", as: "member.church" } },
      { $unwind: { path: "$member.church", preserveNullAndEmptyArrays: true } },
      { $lookup: { from: "groups", localField: "member.group", foreignField: "_id", as: "member.group" } },
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

    const total = (await Giving.aggregate([...pipeline, { $count: "total" }]))[0]?.total || 0;
    const skip = (Number(page) - 1) * Number(limit);
    pipeline.push({ $skip: skip }, { $limit: Number(limit) });

    const rows = await Giving.aggregate(pipeline);

    return res.json({
      data: rows,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit) || 1),
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


// Internal helper: runs the aggregation pipeline and returns data
const getReportsInternal = async ({ user, type, from, to }) => {
  const typeMap = { individual: "member", member: "member", group: "group", church: "church" };
  type = typeMap[type?.toLowerCase()];
  if (!type) throw new Error("Invalid report type");

  // Normalize HOD arm
  let partnershipArm;
  if (user?.role?.includes("_hod")) {
    const roleMap = {
      healing_hod: "healing_school",
      rhapsody_hod: "rhapsody",
      ministry_hod: "ministry_programs",
    };
    partnershipArm = roleMap[user.role];
  }

  // Base match for givings
  const match = { deleted: false };

  // Add date filters
  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = new Date(from);
    if (to) match.createdAt.$lte = new Date(to);
  }

  const pipeline = [
    // Normalize arm field
    {
      $addFields: {
        normalizedArm: {
          $replaceAll: {
            input: { $toLower: "$arm" },
            find: " ",
            replacement: "_",
          },
        },
      },
    },
    // Match HOD arm + deleted + date
    { $match: { ...match, ...(partnershipArm ? { normalizedArm: partnershipArm } : {}) } },
  ];

  // Lookup member, church, group
  pipeline.push(
    { $lookup: { from: "members", localField: "member", foreignField: "_id", as: "member" } },
    { $unwind: "$member" },
    { $lookup: { from: "churches", localField: "member.church", foreignField: "_id", as: "member.church" } },
    { $unwind: { path: "$member.church", preserveNullAndEmptyArrays: true } },
    { $lookup: { from: "groups", localField: "member.group", foreignField: "_id", as: "member.group" } },
    { $unwind: { path: "$member.group", preserveNullAndEmptyArrays: true } }
  );

  // Group by report type
  let groupStage = {};
  switch (type) {
    case "member":
      groupStage = {
        _id: "$member._id",
        name: { $first: "$member.name" },
        phone: { $first: "$member.phone" },
        totalAmount: { $sum: "$amount" },
        arms: { $push: { arm: "$arm", amount: "$amount" } },
        church: { $first: "$member.church" },
        group: { $first: "$member.group" },
      };
      break;
    case "church":
      groupStage = {
        _id: "$member.church._id",
        name: { $first: "$member.church.name" },
        totalAmount: { $sum: "$amount" },
        arms: { $push: { arm: "$arm", amount: "$amount" } },
        group: { $first: "$member.group" },
      };
      break;
    case "group":
      groupStage = {
        _id: "$member.group._id",
        name: { $first: "$member.group.name" },
        totalAmount: { $sum: "$amount" },
        arms: { $push: { arm: "$arm", amount: "$amount" } },
        group: { $first: "$member.group" },
      };
      break;
  }

  pipeline.push({ $group: groupStage }, { $sort: { totalAmount: -1 } });

  const data = await Giving.aggregate(pipeline);
  return data;
};


// Unified endpoint
export const getReports = async (req, res) => {
  try {
    const { type, from, to } = req.query;

    // Pass date filters to internal function
    const data = await getReportsInternal({ user: req.user, type, from, to });

    // Optional: send HOD arm total if HOD
    let armTotal;
    if (req.user.role.includes("_hod")) {
      // Normalize HOD arm like we did in getReportsInternal
      const roleMap = {
        healing_hod: "healing_school",
        rhapsody_hod: "rhapsody",
        ministry_hod: "ministry_programs",
      };
      const partnershipArm = roleMap[req.user.role];

      // Normalize arm field in DB and match + date filters
      const match = { deleted: false, normalizedArm: partnershipArm };
      if (from || to) {
        match.createdAt = {};
        if (from) match.createdAt.$gte = new Date(from);
        if (to) match.createdAt.$lte = new Date(to);
      }

      const armTotalAgg = await Giving.aggregate([
        {
          $addFields: {
            normalizedArm: {
              $replaceAll: {
                input: { $toLower: "$arm" },
                find: " ",
                replacement: "_",
              },
            },
          },
        },
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