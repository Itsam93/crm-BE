import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import Member from "../models/Member.js";
import Giving from "../models/Giving.js";
import Church from "../models/Church.js";
import Group from "../models/Group.js";

/**
 * Utility: safely find by id (ObjectId or string)
 */
const findMemberById = async (id) => {
  if (mongoose.Types.ObjectId.isValid(id)) {
    return await Member.findById(id)
      .populate({
        path: "church",
        select: "name group",
        populate: { path: "group", select: "group_name" },
      })
      .lean({ virtuals: true });
  }
  // fallback: attempt as plain string (if later you switch to UUIDs/custom ids)
  return await Member.findOne({ _id: id })
    .populate({
      path: "church",
      select: "name group",
      populate: { path: "group", select: "group_name" },
    })
    .lean({ virtuals: true });
};

// ============================
// @desc    Get all members
// @route   GET /api/members
// @access  Private
// ============================
export const getMembers = asyncHandler(async (req, res) => {
  try {
    const members = await Member.find()
      .populate({
        path: "church",
        select: "name group",
        populate: { path: "group", select: "group_name" },
      })
      .lean({ virtuals: true });

    const result = await Promise.all(
      members.map(async (member) => {
        const givings = await Giving.find({ member: member._id })
          .populate("partnershipArm", "name")
          .lean();

        const groupedGivings = givings.reduce((acc, g) => {
          const arm = g.partnershipArm ? g.partnershipArm.name : "Unknown";
          if (!acc[arm]) acc[arm] = [];
          acc[arm].push({
            amount: g.amount || 0,
            date: g.date || null,
          });
          return acc;
        }, {});

        return {
          ...member,
          givings: groupedGivings,
          grandTotal: givings.reduce((sum, g) => sum + (g.amount || 0), 0),
        };
      })
    );

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// ============================
// @desc    Get a single member
// @route   GET /api/members/:id
// @access  Private
// ============================
export const getMemberById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const member = await findMemberById(id);

    if (!member) {
      return res.status(404).json({ success: false, error: "Member not found" });
    }

    const givings = await Giving.find({ member: member._id })
      .populate("partnershipArm", "name")
      .lean();

    const groupedGivings = givings.reduce((acc, g) => {
      const arm = g.partnershipArm ? g.partnershipArm.name : "Unknown";
      if (!acc[arm]) acc[arm] = [];
      acc[arm].push({
        amount: g.amount || 0,
        date: g.date || null,
      });
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        ...member,
        givings: groupedGivings,
        grandTotal: givings.reduce((sum, g) => sum + (g.amount || 0), 0),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// ============================
// @desc    Add new member
// @route   POST /api/members
// @access  Private
// ============================
export const addMember = asyncHandler(async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      church,
      designation,
      gender,
      dateOfBirth,
      maritalStatus,
      weddingAnniversary,
    } = req.body;

    if (!name || !church || !gender) {
      return res.status(400).json({
        success: false,
        error: "Member name, gender, and church are required",
      });
    }

    const member = await Member.create({
      name,
      email,
      phone,
      church,
      designation: designation || [],
      gender,
      dateOfBirth,
      maritalStatus,
      weddingAnniversary,
    });

    res.status(201).json({ success: true, data: member });
  } catch (err) {
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// ============================
// @desc    Update a member
// @route   PUT /api/members/:id
// @access  Private
// ============================
export const updateMember = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    let member = await Member.findById(id);

    if (!member) {
      return res.status(404).json({ success: false, error: "Member not found" });
    }

    const allowedUpdates = [
      "name",
      "email",
      "phone",
      "church",
      "designation",
      "gender",
      "dateOfBirth",
      "maritalStatus",
      "weddingAnniversary",
      "group",
    ];

    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        member[field] = req.body[field];
      }
    });

    const updatedMember = await member.save();
    res.json({ success: true, data: updatedMember });
  } catch (err) {
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// ============================
// @desc    Delete a member
// @route   DELETE /api/members/:id
// @access  Private
// ============================
export const deleteMember = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const member = await Member.findById(id);

    if (!member) {
      return res.status(404).json({ success: false, error: "Member not found" });
    }

    await Giving.deleteMany({ member: member._id });
    await member.deleteOne();

    res.json({ success: true, message: "Member removed successfully" });
  } catch (err) {
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// ============================
// @desc    Get all groups with their churches
// @route   GET /api/groups-with-churches
// @access  Private
// ============================
export const getGroupsWithChurches = asyncHandler(async (req, res) => {
  try {
    const groups = await Group.find().lean();
    const churches = await Church.find()
      .populate("group", "group_name")
      .lean();

    const result = groups.map((g) => ({
      ...g,
      churches: churches.filter(
        (c) => c.group && c.group._id.toString() === g._id.toString()
      ),
    }));

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: "Server error" });
  }
});
