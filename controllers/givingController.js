import asyncHandler from "express-async-handler";
import Giving from "../models/Giving.js";
import Member from "../models/Member.js";
import Partnership from "../models/Partnership.js";
import Church from "../models/Church.js"; 

// @desc Add new giving
// @route POST /api/givings
export const addGiving = asyncHandler(async (req, res) => {
  const { member, partnershipArm, amount, date } = req.body;

  if (!member || !partnershipArm || !amount) {
    res.status(400);
    throw new Error("Member, partnership arm and amount are required");
  }

  const existingMember = await Member.findById(member);
  if (!existingMember) {
    res.status(404);
    throw new Error("Member not found");
  }

  const existingPartnership = await Partnership.findById(partnershipArm);
  if (!existingPartnership) {
    res.status(404);
    throw new Error("Partnership Arm not found");
  }

  const giving = await Giving.create({ member, partnershipArm, amount, date });

  const populatedGiving = await Giving.findById(giving._id)
    .populate({
      path: "member",
      select: "name church",
      populate: { path: "church", select: "name" },
    })
    .populate("partnershipArm", "name");

  res.status(201).json(populatedGiving);
});

// @desc Get all givings
// @route GET /api/givings
export const getGivings = asyncHandler(async (req, res) => {
  const givings = await Giving.find()
    .populate({
      path: "member",
      select: "name church",
      populate: { path: "church", select: "name" },
    })
    .populate("partnershipArm", "name");

  res.json(givings);
});

// @desc Get all givings for a specific member
// @route GET /api/givings/member/:id
export const getGivingsByMember = asyncHandler(async (req, res) => {
  const memberId = req.params.id;

  const member = await Member.findById(memberId)
    .populate("church", "name")
    .lean(); 

  if (!member) {
    res.status(404);
    throw new Error("Member not found");
  }

  const givings = await Giving.find({ member: memberId })
    .populate("partnershipArm", "name")
    .select("amount date partnershipArm")
    .sort({ date: 1 })
    .lean();

  
  member.givings = givings;

  res.json({
    success: true,
    data: member,
  });
});

// @desc Update a giving
// @route PUT /api/givings/:id
export const updateGiving = asyncHandler(async (req, res) => {
  const { member, partnershipArm, amount, date } = req.body;

  const giving = await Giving.findById(req.params.id);
  if (!giving) {
    res.status(404);
    throw new Error("Giving not found");
  }

  if (member) {
    const existingMember = await Member.findById(member);
    if (!existingMember) {
      res.status(404);
      throw new Error("Member not found");
    }
    giving.member = member;
  }

  if (partnershipArm) {
    const existingPartnership = await Partnership.findById(partnershipArm);
    if (!existingPartnership) {
      res.status(404);
      throw new Error("Partnership Arm not found");
    }
    giving.partnershipArm = partnershipArm;
  }

  if (amount !== undefined) giving.amount = amount;
  if (date !== undefined) giving.date = date;

  await giving.save();

  const populatedGiving = await Giving.findById(giving._id)
    .populate({
      path: "member",
      select: "name church",
      populate: { path: "church", select: "name" },
    })
    .populate("partnershipArm", "name");

  res.json(populatedGiving);
});

// @desc Delete a giving
// @route DELETE /api/givings/:id
export const deleteGiving = asyncHandler(async (req, res) => {
  const giving = await Giving.findById(req.params.id);
  if (!giving) {
    res.status(404);
    throw new Error("Giving not found");
  }

  await Giving.findByIdAndDelete(req.params.id);
  res.json({ message: "Giving deleted successfully" });
});

// @desc Get totals grouped by member
// @route GET /api/givings/totals
export const getTotalsByMember = asyncHandler(async (req, res) => {
  const totals = await Giving.aggregate([
    { $group: { _id: "$member", totalAmount: { $sum: "$amount" } } },
    {
      $lookup: {
        from: "members",
        localField: "_id",
        foreignField: "_id",
        as: "member",
      },
    },
    { $unwind: "$member" },
    {
      $project: {
        _id: 0,
        memberId: "$member._id",
        memberName: "$member.name",
        totalAmount: 1,
      },
    },
  ]);

  res.json(totals);
});

// @desc Get report: total giving, totals by group, totals by partnership
// @route GET /api/reports
export const getReport = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const match = {};

  if (startDate) match.date = { $gte: new Date(startDate) };
  if (endDate) match.date = { ...match.date, $lte: new Date(endDate) };

  const totalGiving = await Giving.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  const totalsByGroup = await Giving.aggregate([
    { $match: match },
    {
      $lookup: {
        from: "members",
        localField: "member",
        foreignField: "_id",
        as: "member",
      },
    },
    { $unwind: "$member" },
    {
      $lookup: {
        from: "churches",
        localField: "member.church",
        foreignField: "_id",
        as: "church",
      },
    },
    { $unwind: "$church" },
    {
      $group: {
        _id: "$church._id",
        group_name: { $first: "$church.name" },
        total: { $sum: "$amount" },
      },
    },
  ]);

  const totalsByPartnership = await Giving.aggregate([
    { $match: match },
    {
      $lookup: {
        from: "partnerships",
        localField: "partnershipArm",
        foreignField: "_id",
        as: "partnership",
      },
    },
    { $unwind: "$partnership" },
    {
      $group: {
        _id: "$partnership._id",
        partnership_name: { $first: "$partnership.name" },
        total: { $sum: "$amount" },
      },
    },
  ]);

  res.json({
    total: totalGiving[0]?.total || 0,
    groups: totalsByGroup,
    partnerships: totalsByPartnership,
  });
});
