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

    const givingAgg = await Giving.aggregate([
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    const totalGivingsAmount = givingAgg[0]?.totalAmount || 0;
    const totalGivingsCount = givingAgg[0]?.count || 0;

    res.json({
      totalGroups,
      totalChurches,
      totalMembers,
      totalGivingsCount,
      totalGivingsAmount,
    });
  } catch (err) {
    console.error("Error in getAdminSummary:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ===== Group Management =====
// ✅ Create a new group
const escapeRegex = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const createGroup = async (req, res) => {
  try {
    let { group_name } = req.body;

    // Validate input
    if (!group_name || !group_name.trim()) {
      return res.status(400).json({ message: "Group name is required" });
    }

    group_name = group_name.trim();

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
    const { group_name } = req.body;
    const { id } = req.params;

    if (!group_name || !group_name.trim()) {
      return res.status(400).json({ message: "Group name is required" });
    }

    const trimmedName = group_name.trim();

    const existing = await Group.findOne({
      _id: { $ne: id }, // exclude current group
      group_name: { $regex: `^${escapeRegex(trimmedName)}$`, $options: "i" },
    });

    if (existing) {
      return res
        .status(409)
        .json({ message: "Another group with this name already exists" });
    }

    const updatedGroup = await Group.findByIdAndUpdate(
      id,
      { group_name: trimmedName },
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

// Get all groups
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
    const today = new Date();
    const twoWeeksLater = new Date();
    twoWeeksLater.setDate(today.getDate() + 14);

    // Get members with valid birthdays
    const members = await Member.find(
      { birthday: { $exists: true }, deleted: false },
      "name phone birthday group church"
    )
      .populate("group", "name")
      .populate("church", "name")
      .lean();

    // Filter for birthdays within the next 14 days
    const upcoming = members.filter((member) => {
      const bday = new Date(member.birthday);
      const bMonth = bday.getMonth();
      const bDay = bday.getDate();

      const thisYearBday = new Date(today.getFullYear(), bMonth, bDay);
      let diffDays = (thisYearBday - today) / (1000 * 60 * 60 * 24);

      if (diffDays < 0) {
        const nextYearBday = new Date(today.getFullYear() + 1, bMonth, bDay);
        diffDays = (nextYearBday - today) / (1000 * 60 * 60 * 24);
      }

      return diffDays >= 0 && diffDays <= 14;
    });

    // Sort upcoming birthdays by date
    upcoming.sort((a, b) => {
      const aDate = new Date(a.birthday);
      const bDate = new Date(b.birthday);
      return aDate.getDate() - bDate.getDate();
    });

    res.status(200).json(upcoming);
  } catch (error) {
    console.error("❌ Error fetching upcoming birthdays:", error);
    res.status(500).json({ message: "Server error fetching birthdays" });
  }
};