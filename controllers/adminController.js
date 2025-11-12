import Group from "../models/Group.js";
import Church from "../models/Church.js";
import Member from "../models/Member.js";
import Giving from "../models/Giving.js";
import User from "../models/User.js";

// ===== Admin Dashboard =====
export const getAdminSummary = async (req, res) => {
  try {
    const [totalGroups, totalChurches, totalMembers] = await Promise.all([
      Group.countDocuments({ isActive: true }),
      Church.countDocuments(),
      Member.countDocuments(),
    ]);

    const givingsAgg = await Giving.aggregate([
  {
    $match: {
      amount: { $exists: true, $ne: null },
      deleted: false, 
    },
  },
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
      totalGroups,
      totalChurches,
      totalMembers,
      totalGivingsAmount,
      totalGivingsCount,
    });
  } catch (err) {
    console.error("Error in getAdminSummary:", err);
    res.status(500).json({ message: "Server error fetching summary" });
  }
};

// ===== Group Management =====
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

//  Create a new group
export const createGroup = async (req, res) => {
  try {
    let { group_name, pastor } = req.body;

    if (!group_name || !group_name.trim()) {
      return res.status(400).json({ message: "Group name is required" });
    }

    group_name = group_name.trim();
    if (pastor) pastor = pastor.trim();

    // Case-insensitive duplicate check
    const existing = await Group.findOne({
      group_name: { $regex: `^${escapeRegex(group_name)}$`, $options: "i" },
    });

    if (existing) {
      return res
        .status(409)
        .json({ message: "Group with this name already exists" });
    }

    // Create new group
    const newGroup = new Group({
      group_name,
      pastor: pastor || "Not assigned",
      isActive: true,
    });

    await newGroup.save();

    return res
      .status(201)
      .json({ message: "Group created successfully", group: newGroup });
  } catch (err) {
    console.error("Error creating group:", err);
    res.status(500).json({ message: "Server error while creating group" });
  }
};

// Update a group
export const updateGroup = async (req, res) => {
  try {
    const { group_name, pastor } = req.body;
    const { id } = req.params;

    if (!group_name || !group_name.trim()) {
      return res.status(400).json({ message: "Group name is required" });
    }

    const trimmedName = group_name.trim();
    const trimmedPastor = pastor?.trim() || "Not assigned";

    const existing = await Group.findOne({
      _id: { $ne: id },
      group_name: { $regex: `^${escapeRegex(trimmedName)}$`, $options: "i" },
    });

    if (existing) {
      return res
        .status(409)
        .json({ message: "Another group with this name already exists" });
    }

    const updatedGroup = await Group.findByIdAndUpdate(
      id,
      { group_name: trimmedName, pastor: trimmedPastor },
      { new: true }
    );

    if (!updatedGroup) {
      return res.status(404).json({ message: "Group not found" });
    }

    res.json({ message: "Group updated successfully", group: updatedGroup });
  } catch (err) {
    console.error("Error updating group:", err);
    res.status(500).json({ message: "Server error while updating group" });
  }
};

// 🟣 Get all groups
export const getGroups = async (req, res) => {
  try {
    const groups = await Group.find().sort({ group_name: 1 });
    res.json(groups);
  } catch (err) {
    console.error("Error fetching groups:", err);
    res.status(500).json({ message: "Server error while fetching groups" });
  }
};

// Delete a group
export const deleteGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Group.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ message: "Group not found" });
    }

    res.json({ message: "Group deleted successfully" });
  } catch (err) {
    console.error("Error deleting group:", err);
    res.status(500).json({ message: "Server error while deleting group" });
  }
};


export const getUpcomingBirthdays = async (req, res) => {
  try {
    const members = await Member.find({ deleted: false })
      .populate("group", "group_name")
      .populate("church", "name");

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const today = now.getDate();

    // Filter for birthdays in current and next month
    const upcoming = members
      .filter((m) => {
        if (!m.birthday) return false;
        const bd = new Date(m.birthday);
        const month = bd.getMonth() + 1;
        const day = bd.getDate();

        // show this month and early next month birthdays
        const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
        return (
          (month === currentMonth && day >= today) ||
          (month === nextMonth && day <= 10)
        );
      })
      .sort((a, b) => new Date(a.birthday) - new Date(b.birthday));

    res.json(upcoming);
  } catch (err) {
    console.error("Error fetching upcoming birthdays:", err);
    res.status(500).json({ message: "Server error fetching birthdays" });
  }
};