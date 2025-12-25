import Group from "../models/Group.js";
import Church from "../models/Church.js";
import Member from "../models/Member.js";
import Giving from "../models/Giving.js";
import User from "../models/User.js";
import Marriage from "../models/Marriage.js";

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
      .populate("group", "name")
      .populate("church", "name");

    const today = new Date();
    today.setHours(0, 0, 0, 0); 

    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(today.getDate() + 7);

    const upcoming = members
      .map((m) => {
        if (!m.birthday) return null;

        const birthDate = new Date(m.birthday);

        // Normalize to this year
        let nextBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());

        // Move to next year if birthday already passed this year
        if (nextBirthday < today) {
          nextBirthday.setFullYear(today.getFullYear() + 1);
        }

        // Calculate days remaining
        const diffMs = nextBirthday.getTime() - today.getTime();
        const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        // Only include birthdays within next 7 days
        if (daysRemaining < 0 || daysRemaining > 7) return null;

        return {
          id: m._id.toString(),
          name: m.name,
          birthday: m.birthday,
          daysRemaining,
          isToday: daysRemaining === 0,
          group: m.group ? { name: m.group.name } : { name: "—" },
          church: m.church ? { name: m.church.name } : { name: "—" },
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.daysRemaining - b.daysRemaining); // closest birthday first

    res.json(upcoming);
  } catch (err) {
    console.error("Error fetching upcoming birthdays:", err);
    res.status(500).json({ message: "Server error fetching birthdays" });
  }
};


export const getRecentGivings = async (req, res) => {
  try {
    const recent = await Giving.find({ deleted: false })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("member", "name")
      .populate("church", "name")
      .populate("group", "name");

    const formatted = recent.map((g) => ({
      memberName: g.member?.name || "—",
      churchName: g.church?.name || "—",
      groupName: g.group?.name || "—",
      partnershipArm: g.partnershipArm || "—",
      amount: g.amount,
      date: g.createdAt,
    }));

    res.json(formatted);
  } catch (err) {
    console.error("Error fetching recent givings:", err);
    res.status(500).json({ message: "Server error fetching recent givings" });
  }
};


export const getTopPartners = async (req, res) => {
  try {
    // Top Individuals
    const topIndividuals = await Giving.aggregate([
      { $match: { deleted: false, member: { $exists: true } } },
      { $group: { _id: "$member", totalAmount: { $sum: "$amount" } } },
      { $sort: { totalAmount: -1 } },
      { $limit: 5 },
    ]);

    // Top Churches
    const topChurches = await Giving.aggregate([
      { $match: { deleted: false, church: { $exists: true } } },
      { $group: { _id: "$church", totalAmount: { $sum: "$amount" } } },
      { $sort: { totalAmount: -1 } },
      { $limit: 5 },
    ]);

    // Top Groups
    const topGroups = await Giving.aggregate([
      { $match: { deleted: false, group: { $exists: true } } },
      { $group: { _id: "$group", totalAmount: { $sum: "$amount" } } },
      { $sort: { totalAmount: -1 } },
      { $limit: 5 },
    ]);

    // Populate names
    const populateName = async (arr, model) => {
      const result = [];
      for (let item of arr) {
        const doc = await model.findById(item._id);
        result.push({ name: doc?.name || "—", totalAmount: item.totalAmount });
      }
      return result;
    };

    const [individuals, churches, groups] = await Promise.all([
      populateName(topIndividuals, Member),
      populateName(topChurches, Church),
      populateName(topGroups, Group),
    ]);

    res.json({ individuals, churches, groups });
  } catch (err) {
    console.error("Error fetching top partners:", err);
    res.status(500).json({ message: "Server error fetching top partners" });
  }
};


// ==========================
// TREND ANALYSIS
// ==========================

// Helper: format date label based on period
const formatLabel = (date, period) => {
  const d = new Date(date);
  switch (period) {
    case "daily":
      return d.toISOString().slice(0, 10); // YYYY-MM-DD
    case "weekly":
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay()); // Sunday
      return weekStart.toISOString().slice(0, 10);
    case "monthly":
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    case "quarterly":
      const quarter = Math.floor(d.getMonth() / 3) + 1;
      return `${d.getFullYear()}-Q${quarter}`;
    default:
      return d.toISOString().slice(0, 10);
  }
};

// 1️⃣ Givings Trend
export const getGivingsTrend = async (req, res) => {
  try {
    const period = req.query.period || "daily";

    const givings = await Giving.aggregate([
      { $match: { deleted: false, amount: { $gt: 0 } } },
      {
        $group: {
          _id: {
            $switch: {
              branches: [
                {
                  case: { $eq: [period, "daily"] },
                  then: {
                    $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
                  }
                },
                {
                  case: { $eq: [period, "weekly"] },
                  then: {
                    $dateToString: {
                      format: "%Y-%m-%d",
                      date: {
                        $dateSubtract: {
                          startDate: "$createdAt",
                          unit: "day",
                          amount: { $subtract: [{ $dayOfWeek: "$createdAt" }, 1] }
                        }
                      }
                    }
                  }
                },
                {
                  case: { $eq: [period, "monthly"] },
                  then: {
                    $dateToString: { format: "%Y-%m", date: "$createdAt" }
                  }
                },
                {
                  case: { $eq: [period, "quarterly"] },
                  then: {
                    $concat: [
                      { $toString: { $year: "$createdAt" } },
                      "-Q",
                      {
                        $toString: {
                          $ceil: { $divide: [{ $month: "$createdAt" }, 3] }
                        }
                      }
                    ]
                  }
                }
              ],
              default: {
                $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
              }
            }
          },
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    res.json(
      givings.map(g => ({
        label: g._id,
        amount: g.totalAmount,
        count: g.count
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch givings trend" });
  }
};


// 2️⃣ Partners Trend
export const getPartnersTrend = async (req, res) => {
  try {
    const period = req.query.period || "daily";

    const agg = await Giving.aggregate([
      {
        $match: {
          deleted: false,
          amount: { $gt: 0 },
          $or: [
            { member: { $ne: null } },
            { church: { $ne: null } },
            { group: { $ne: null } }
          ]
        }
      },
      {
        $group: {
          _id: {
            period: {
              $switch: {
                branches: [
                  {
                    case: { $eq: [period, "daily"] },
                    then: {
                      $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
                    }
                  },
                  {
                    case: { $eq: [period, "weekly"] },
                    then: {
                      $concat: [
                        { $toString: { $isoWeekYear: "$createdAt" } },
                        "-W",
                        { $toString: { $isoWeek: "$createdAt" } }
                      ]
                    }
                  },
                  {
                    case: { $eq: [period, "monthly"] },
                    then: {
                      $dateToString: { format: "%Y-%m", date: "$createdAt" }
                    }
                  },
                  {
                    case: { $eq: [period, "quarterly"] },
                    then: {
                      $concat: [
                        { $toString: { $year: "$createdAt" } },
                        "-Q",
                        {
                          $toString: {
                            $ceil: { $divide: [{ $month: "$createdAt" }, 3] }
                          }
                        }
                      ]
                    }
                  }
                ],
                default: {
                  $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
                }
              }
            }
          },
          partners: {
            $addToSet: {
              $ifNull: ["$member", { $ifNull: ["$church", "$group"] }]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          label: "$_id.period",
          partnersCount: { $size: "$partners" }
        }
      },
      { $sort: { label: 1 } }
    ]);

    res.status(200).json(agg);
  } catch (err) {
    console.error("Partners trend error:", err);
    res.status(500).json({ message: "Failed to fetch partners trend" });
  }
};



// 3️⃣ Cumulative Partnership
export const getCumulativePartnership = async (req, res) => {
  try {
    const partnerTypes = ["member", "church", "group"];
    const result = [];

    for (let type of partnerTypes) {
      const agg = await Giving.aggregate([
        { $match: { deleted: false, [type]: { $exists: true }, amount: { $exists: true } } },
        { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
      ]);

      result.push({
        type: type === "member" ? "Individuals" : type === "church" ? "Churches" : "Groups",
        amount: agg[0]?.totalAmount || 0,
      });
    }

    res.status(200).json(result);
  } catch (err) {
    console.error("Error in getCumulativePartnership:", err);
    res.status(500).json({ message: "Server error fetching cumulative partnership" });
  }
};


// Get Marriage Anniversary

export const getUpcomingAnniversaries = async (req, res) => {
  try {
    const today = new Date();
    const next30Days = new Date();
    next30Days.setDate(today.getDate() + 30);

    const anniversaries = await Marriage.aggregate([
      {
        $match: {
          status: "active",
          $expr: {
            $and: [
              {
                $gte: [
                  {
                    $dateFromParts: {
                      year: today.getFullYear(),
                      month: { $month: "$weddingDate" },
                      day: { $dayOfMonth: "$weddingDate" }
                    }
                  },
                  today
                ]
              },
              {
                $lte: [
                  {
                    $dateFromParts: {
                      year: today.getFullYear(),
                      month: { $month: "$weddingDate" },
                      day: { $dayOfMonth: "$weddingDate" }
                    }
                  },
                  next30Days
                ]
              }
            ]
          }
        }
      },
      {
        $lookup: {
          from: "members",
          localField: "husband",
          foreignField: "_id",
          as: "husband"
        }
      },
      {
        $lookup: {
          from: "members",
          localField: "wife",
          foreignField: "_id",
          as: "wife"
        }
      },
      {
        $project: {
          weddingDate: 1,
          husband: { $arrayElemAt: ["$husband", 0] },
          wife: { $arrayElemAt: ["$wife", 0] }
        }
      }
    ]);

    res.status(200).json(anniversaries);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch anniversaries" });
  }
};