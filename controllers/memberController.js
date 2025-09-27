import asyncHandler from "express-async-handler";
import Member from "../models/Member.js";
import Giving from "../models/Giving.js";
import Church from "../models/Church.js";
import Group from "../models/Group.js";

// @desc    Get all members with detailed givings including date
// @route   GET /api/members
// @access  Private
export const getMembers = asyncHandler(async (req, res) => {
  const members = await Member.find()
    .populate({
      path: "church",
      select: "name group",
      populate: { path: "group", select: "group_name" },
    })
    .lean();

  const result = await Promise.all(
    members.map(async (member) => {
      // Get all givings for this member
      const givings = await Giving.find({ member: member._id })
        .populate("partnershipArm", "name")
        .lean();

      return {
        ...member,
        givings: givings.map((g) => ({
          partnershipArm: g.partnershipArm ? g.partnershipArm.name : "Unknown",
          totalAmount: g.amount,
          date: g.date,
        })),
        grandTotal: givings.reduce((sum, g) => sum + g.amount, 0),
      };
    })
  );

  res.json(result);
});

// @desc    Add new member
// @route   POST /api/members
// @access  Private
export const addMember = asyncHandler(async (req, res) => {
  const { name, email, phone, church, designation } = req.body;

  if (!name || !church) {
    res.status(400);
    throw new Error("Member name and church are required");
  }

  const member = await Member.create({
    name,
    email,
    phone,
    church,
    designation: designation || [],
  });

  res.status(201).json(member);
});

// @desc    Update a member
// @route   PUT /api/members/:id
// @access  Private
export const updateMember = asyncHandler(async (req, res) => {
  const member = await Member.findById(req.params.id);
  if (!member) {
    res.status(404);
    throw new Error("Member not found");
  }
  Object.assign(member, req.body);
  const updatedMember = await member.save();
  res.json(updatedMember);
});

// @desc    Delete a member
// @route   DELETE /api/members/:id
// @access  Private
export const deleteMember = asyncHandler(async (req, res) => {
  const member = await Member.findById(req.params.id);
  if (!member) {
    res.status(404);
    throw new Error("Member not found");
  }
  await member.deleteOne();
  res.json({ message: "Member removed" });
});

// @desc    Get all groups with their churches
// @route   GET /api/groups-with-churches
// @access  Private
export const getGroupsWithChurches = asyncHandler(async (req, res) => {
  const groups = await Group.find().lean();
  const churches = await Church.find().populate("group", "name").lean();

  const result = groups.map((g) => ({
    ...g,
    churches: churches.filter((c) => c.group._id.toString() === g._id.toString()),
  }));

  res.json(result);
});
