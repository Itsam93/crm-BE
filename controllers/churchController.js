import asyncHandler from "express-async-handler";
import Church from "../models/Church.js";
import Group from "../models/Group.js";
import Member from "../models/Member.js";
import Giving from "../models/Giving.js";

// @desc Get all churches with group and total givings
// @route GET /api/churches
// @access Private
export const getChurches = asyncHandler(async (req, res) => {
  const churches = await Church.find().populate("group", "group_name");

  const result = await Promise.all(
    churches.map(async (church) => {
      // Find members of this church
      const members = await Member.find({ church: church._id }).select("_id");

      // Get all givings by these members
      const givings = await Giving.aggregate([
        { $match: { member: { $in: members.map((m) => m._id) } } },
        {
          $group: {
            _id: "$partnershipArm",
            totalAmount: { $sum: "$amount" },
          },
        },
      ]);

      const total = givings.reduce((acc, g) => acc + g.totalAmount, 0);

      return {
        ...church.toObject(),
        givings: {
          byArm: givings,
          total,
        },
      };
    })
  );

  res.json(result);
});

// @desc Add new church
// @route POST /api/churches
// @access Private
export const addChurch = asyncHandler(async (req, res) => {
  const { name, group, location } = req.body;

  if (!name || !group) {
    res.status(400);
    throw new Error("Church name and group are required");
  }

  const existingGroup = await Group.findById(group);
  if (!existingGroup) {
    res.status(404);
    throw new Error("Group not found");
  }

  const church = await Church.create({ name, group, location });
  res.status(201).json(church);
});

// @desc Update a church
// @route PUT /api/churches/:id
// @access Private
export const updateChurch = asyncHandler(async (req, res) => {
  const { name, group, location } = req.body;

  const church = await Church.findById(req.params.id);
  if (!church) {
    res.status(404);
    throw new Error("Church not found");
  }

  if (group) {
    const existingGroup = await Group.findById(group);
    if (!existingGroup) {
      res.status(404);
      throw new Error("Group not found");
    }
  }

  church.name = name || church.name;
  church.group = group || church.group;
  church.location = location || church.location;

  const updatedChurch = await church.save();
  res.json(updatedChurch);
});

// @desc Delete a church
// @route DELETE /api/churches/:id
// @access Private
export const deleteChurch = asyncHandler(async (req, res) => {
  const church = await Church.findById(req.params.id);
  if (!church) {
    res.status(404);
    throw new Error("Church not found");
  }

  await Church.findByIdAndDelete(req.params.id);
  res.json({ message: "Church removed" });
});
