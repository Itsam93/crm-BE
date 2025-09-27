import asyncHandler from "express-async-handler";
import Group from "../models/Group.js";
import Church from "../models/Church.js";
import Member from "../models/Member.js";
import Giving from "../models/Giving.js";
import Partnership from "../models/PartnershipArm.js"; // <-- import the partnership model

// @desc    Get all groups with churches, partnership arm totals + grand total
// @route   GET /api/groups
// @access  Private
export const getGroups = asyncHandler(async (req, res) => {
  const groups = await Group.find();

  const result = await Promise.all(
    groups.map(async (group) => {
      // Get churches in this group
      const churches = await Church.find({ group: group._id });

      // Get members in those churches
      const members = await Member.find({
        church: { $in: churches.map((c) => c._id) },
      }).select("_id");

      // Aggregate givings for those members
      let givings = await Giving.aggregate([
        { $match: { member: { $in: members.map((m) => m._id) } } },
        {
          $group: {
            _id: "$partnershipArm",
            totalAmount: { $sum: "$amount" },
          },
        },
      ]);

      // Replace partnershipArm _id with name
      givings = await Promise.all(
        givings.map(async (g) => {
          const arm = await Partnership.findById(g._id).select("name");
          return {
            partnershipArm: arm ? arm.name : "Unknown",
            totalAmount: g.totalAmount,
          };
        })
      );

      // Compute group grand total
      const total = givings.reduce((acc, g) => acc + g.totalAmount, 0);

      return {
        ...group.toObject(),
        churches,          // <-- include churches in the response
        givings: {
          byArm: givings,
          total,
        },
      };
    })
  );

  res.json(result);
});

// @desc    Add new group
// @route   POST /api/groups
// @access  Private
export const addGroup = asyncHandler(async (req, res) => {
  const { group_name } = req.body;
  if (!group_name) {
    res.status(400);
    throw new Error("Group name is required");
  }
  const group = await Group.create({ group_name });
  res.status(201).json(group);
});

// @desc    Update a group
// @route   PUT /api/groups/:id
// @access  Private
export const updateGroup = asyncHandler(async (req, res) => {
  const group = await Group.findById(req.params.id);
  if (!group) {
    res.status(404);
    throw new Error("Group not found");
  }

  group.group_name = req.body.group_name || group.group_name;
  const updatedGroup = await group.save();
  res.json(updatedGroup);
});

// @desc    Delete a group
// @route   DELETE /api/groups/:id
// @access  Private
export const deleteGroup = asyncHandler(async (req, res) => {
  const group = await Group.findById(req.params.id);
  if (!group) {
    res.status(404);
    throw new Error("Group not found");
  }

  await group.deleteOne();
  res.json({ message: "Group removed" });
});


// @route   GET /api/groups-with-churches
// @access  Private
export const getGroupsWithChurches = asyncHandler(async (req, res) => {
  const groups = await Group.find().lean(); // get plain JS objects
  const result = await Promise.all(
    groups.map(async (group) => {
      const churches = await Church.find({ group: group._id }).select("_id name").lean();
      return {
        ...group,
        churches,
      };
    })
  );

  res.json(result);
});