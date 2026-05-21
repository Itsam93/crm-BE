import Campaign from "../models/Campaign.js";
import Giving from "../models/Giving.js";
import mongoose from "mongoose";
import Category from "../models/Category.js";
import Member from "../models/Member.js";
import Church from "../models/Church.js";
import Group from "../models/Group.js";
import MemberCampaignParticipation from "../models/MemberCampaignParticipation.js";

const { Types } = mongoose;

/* =========================================================
   UTILITY
========================================================= */

const hodArmMap = {
  healing_hod: "Healing School",
  rhapsody_hod: "Rhapsody",
  ministry_hod: "Ministry Programs",
  bibles_hod: "Loveworld Bibles",
  innercity_hod: "Innercity Missions",
  lwpm_hod: "LWPM"
};

// =========================
// Helper: Check valid ObjectId
// =========================
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const toObjectId = (id) => new Types.ObjectId(id);

// -------------------------
// Helper: group givings by member and month
// -------------------------
const getMonthlyGivingMap = (givings) => {
  // Returns: { memberId: { "2026-01": totalGiven, "2026-02": totalGiven, ... } }
  const map = {};
    givings.forEach((g) => {
    if (!g.member) return;

    const d = new Date(g.date);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

    const memberId = g.member.toString();

    if (!map[memberId]) map[memberId] = {};
    if (!map[memberId][month]) map[memberId][month] = 0;

    map[memberId][month] += g.amount || 0;
    });
    return map;
  };

// =========================
// Helper: Get giving map for a campaign (monthly)
// =========================
const getCampaignGivingMap = async (campaignId) => {
  // Aggregate givings grouped by member and month
  const givings = await Giving.aggregate([
    { $match: { campaign: new mongoose.Types.ObjectId(campaignId), deleted: false } },
    {
      $project: {
        member: 1,
        amount: 1,
        month: { $month: "$date" },
        year: { $year: "$date" },
      },
    },
    {
      $group: {
        _id: { member: "$member", year: "$year", month: "$month" },
        totalContributed: { $sum: "$amount" },
      },
    },
  ]);

  // Build a nested map: memberId -> { "YYYY-MM": totalContributed }
  const givingMap = {};
  givings.forEach((g) => {
    const memberId = g._id.member.toString();
    const key = `${g._id.year}-${String(g._id.month).padStart(2, "0")}`;
    if (!givingMap[memberId]) givingMap[memberId] = {};
    givingMap[memberId][key] = g.totalContributed;
  });

  return givingMap;
};

/* =========================================================
   CAMPAIGNS (BASIC CRUD)
========================================================= */

export const getCampaigns = async (req, res) => {
  try {
    const { arm, from, to, search } = req.query;

    const query = { deleted: false };

    if (arm) query.arm = arm;

    if (from || to) {
      query.startDate = {};
      if (from) query.startDate.$gte = new Date(from);
      if (to) query.startDate.$lte = new Date(to);
    }

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    const campaigns = await Campaign.find(query)
      .populate("categories", "name minAmount maxAmount")
      .sort({ createdAt: -1 })
      .lean();

    return res.json(campaigns);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch campaigns" });
  }
};

export const createCampaign = async (req, res) => {
  try {
    const { name, startDate, endDate, arm, description } = req.body;

    if (!name || !startDate || !endDate || !arm) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const campaign = await Campaign.create({
      name,
      startDate,
      endDate,
      arm,
      description,
    });

    return res.status(201).json(campaign);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create campaign" });
  }
};

/* =========================================================
   CAMPAIGN REPORT (TRUTH-BASED)
========================================================= */

export const getCampaignReport = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({ message: "Invalid campaign ID" });
    }

    const campaign = await Campaign.findById(id)
      .populate("categories", "name minAmount maxAmount")
      .lean();

    if (!campaign) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    const givingMap = await getCampaignGivingMap(id);

    const participations = await MemberCampaignParticipation.find({
      campaign: id,
    })
      .populate({
        path: "member",
        populate: [
          { path: "church", select: "name" },
          { path: "group", select: "name" },
        ],
      })
      .lean();

    const rows = participations.map((p) => {
      const memberId = p.member?._id?.toString();
      const giving = givingMap[memberId] || { totalContributed: 0 };

      return {
        memberId,
        name: p.member?.name,
        church: p.member?.church?.name,
        group: p.member?.group?.name,
        pledgedAmount: p.targetAmount || 0,
        totalContributed: giving.totalContributed,
        progress:
          p.targetAmount > 0
            ? Number(((giving.totalContributed / p.targetAmount) * 100).toFixed(2))
            : 0,
      };
    });

    const totalAmount = rows.reduce((sum, r) => sum + r.totalContributed, 0);

    return res.json({
      campaign,
      summary: {
        totalAmount,
        totalMembers: rows.length,
      },
      rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to generate report" });
  }
};

/* =========================================================
   ADVANCED REPORT
========================================================= */
export const getAdvancedCampaignReport = async (req, res) => {
  try {
    const { campaignId, groupId, churchId } = req.query;

    console.log("🚀 Advanced Report Request:", { campaignId, groupId, churchId });

    if (!isValidId(campaignId)) {
      console.log("❌ Invalid campaignId");
      return res.status(400).json({ message: "Invalid campaignId" });
    }

    const campaign = await Campaign.findById(campaignId).lean();
    if (!campaign) {
      console.log("❌ Campaign not found");
      return res.status(404).json({ message: "Campaign not found" });
    }

    console.log("📌 Campaign:", campaign.name);

    // 1️⃣ Build campaign months range
    const start = new Date(campaign.startDate);
    const end = new Date(campaign.endDate);

    const months = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      const m = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
      months.push(m);
      cursor.setMonth(cursor.getMonth() + 1);
    }

    console.log("📅 Months:", months);

    // 2️⃣ Get all givings
    const givings = await Giving.find({
      date: {
        $gte: new Date(campaign.startDate),
        $lte: new Date(campaign.endDate),
      },
      arm: campaign.arm,
      deleted: false,
    }).lean();

    console.log("💰 Total givings fetched:", givings.length);

    const monthlyGivingMap = getMonthlyGivingMap(givings);

    // 3️⃣ Get participations
    const participations = await MemberCampaignParticipation.find({ campaign: campaignId })
      .populate({
        path: "member",
        select: "name phone church group",
        populate: [
          { path: "church", select: "name" },
          { path: "group", select: "group_name name" },
        ],
      })
      .populate("pledgedCategory", "name minAmount maxAmount")
      .lean();

    console.log("👥 Participations count:", participations.length);
    console.log("🔍 SAMPLE PARTICIPATION:", JSON.stringify(participations[0], null, 2));

    // 4️⃣ Filter by group/church
    const filtered = participations.filter((p) => {
      if (!p.member) return false;

      const memberGroupId =
        p.member.group?._id?.toString() || p.member.group?.toString();

      const memberChurchId =
        p.member.church?._id?.toString() || p.member.church?.toString();

      if (groupId && isValidId(groupId) && memberGroupId !== groupId) return false;
      if (churchId && isValidId(churchId) && memberChurchId !== churchId) return false;

      return true;
    });

    console.log("✅ Filtered count:", filtered.length);

    // 5️⃣ Build rows (FIXED SECTION)
    const rows = filtered.map((p, index) => {
      const memberId = p.member._id.toString();
      const memberMonthly = monthlyGivingMap[memberId] || {};

      const monthlyProgress = months.map((month) => {
        const pledged =
          p.targetAmount ??
          p.pledgeAmount ??
          p.pledgedAmount ??
          0;

        const given = memberMonthly[month] || 0;

        return {
          month,
          pledged,
          given,
          progress: pledged > 0 ? (given / pledged) * 100 : 0,
        };
      });

      const totalContributed = monthlyProgress.reduce((sum, m) => sum + m.given, 0);

      const row = {
        memberId,
        name: p.member?.name || "Unnamed",
        phone: p.member?.phone || "-",

        // ✅ FIXED CHURCH
        church:
          p.member?.church && typeof p.member.church === "object"
            ? p.member.church.name || "-"
            : typeof p.member?.church === "string"
            ? p.member.church
            : "-",

        // ✅ FIXED GROUP
        group:
          p.member?.group && typeof p.member.group === "object"
            ? p.member.group.group_name || p.member.group.name || "-"
            : typeof p.member?.group === "string"
            ? p.member.group
            : "-",

        // ✅ FIXED CATEGORY
        category:
          p.pledgedCategory?.name ||
          p.member?.category?.name ||
          "Uncategorized",

        categoryName:
          p.pledgedCategory?.name ||
          p.member?.category?.name ||
          "Uncategorized",

        // ✅ FIXED PLEDGE
        pledgeAmount:
          p.targetAmount ??
          p.pledgeAmount ??
          p.pledgedAmount ??
          0,

        pledgedAmount:
          p.targetAmount ??
          p.pledgeAmount ??
          p.pledgedAmount ??
          0,

        monthly: monthlyProgress.reduce((acc, m) => {
          acc[m.month] = m.given;
          return acc;
        }, {}),

        totalAmount: totalContributed,
      };

      // 🔍 LOG FIRST 2 ROWS ONLY (avoid flooding)
      if (index < 2) {
        console.log("🧾 ROW SAMPLE:", JSON.stringify(row, null, 2));
      }

      return row;
    });

    console.log("📊 Total rows built:", rows.length);

    // 6️⃣ Group by category
    const categoriesMap = {};
    rows.forEach((r) => {
      if (!categoriesMap[r.category]) categoriesMap[r.category] = [];
      categoriesMap[r.category].push(r);
    });

    const categories = Object.keys(categoriesMap).map((catName) => ({
      categoryName: catName,
      members: categoriesMap[catName],
    }));

    console.log("📂 Categories count:", categories.length);

    return res.json({
      success: true,
      campaign: {
        _id: campaign._id,
        name: campaign.name,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        months,
      },
      count: rows.length,
      data: categories,
    });
  } catch (err) {
    console.error("❌ Advanced report error:", err);
    res.status(500).json({ message: "Failed advanced report" });
  }
};


/* =========================================================
   ASSIGNMENT (UNCHANGED - MCP STILL OK HERE)
========================================================= */

export const assignMembersToCampaign = async (req, res) => {
  try {
    const { campaignId, categoryId, members } = req.body;

    if (!isValidId(campaignId) || !isValidId(categoryId)) {
      return res.status(400).json({ message: "Invalid IDs" });
    }

    const results = [];

    for (const m of members) {
      if (!isValidId(m.memberId)) continue;

      const participation = await MemberCampaignParticipation.findOneAndUpdate(
        {
          member: m.memberId,
          campaign: campaignId,
        },
        {
          $set: {
            pledgedCategory: categoryId,
            targetAmount: m.pledgeAmount || 0,
          },
          $setOnInsert: {
            joinedAt: new Date(),
          },
        },
        { new: true, upsert: true }
      );

      results.push(participation);
    }

    return res.json({
      success: true,
      count: results.length,
      data: results,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Assignment failed" });
  }
};

/* =========================================================
   SUMMARY (FIXED)
========================================================= */

/**
 * ============================================
 * PATCH /campaigns/:id
 * ============================================
 */
export const updateCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({ message: "Invalid campaign ID" });
    }

    const update = { ...req.body };

    const campaign = await Campaign.findByIdAndUpdate(id, update, {
      new: true,
    }).populate("categories", "name minAmount maxAmount");

    if (!campaign) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    return res.json(campaign);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update campaign" });
  }
};

// ----------------------------------
// DELETE /campaigns/:id
// (Soft delete)
// ----------------------------------
export const deleteCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await Campaign.findByIdAndUpdate(
      id,
      { deleted: true },
      { new: true }
    );

    if (!campaign) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    res.json({ message: "Campaign deleted successfully" });
  } catch (err) {
    console.error("Delete campaign error:", err);
    res.status(500).json({ message: "Server error deleting campaign" });
  }
};

// ----------------------------------
// GET /campaigns/:id/categories
// ----------------------------------
export const getCampaignCategories = async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await Campaign.findById(id)
      .populate("categories", "name minAmount maxAmount members");

    if (!campaign) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    res.json(campaign.categories);
  } catch (err) {
    console.error("Error fetching campaign categories:", err);
    res.status(500).json({ message: "Server error fetching categories" });
  }
};


// ----------------------------------
// GET /campaigns/stats
// ----------------------------------
export const getCampaignStats = async (req, res) => {
  try {
    const campaigns = await Campaign.find({ deleted: false }).populate(
      "categories",
      "name minAmount maxAmount"
    );

    const stats = [];

    for (const c of campaigns) {
      const givings = await Giving.find({
        campaign: c._id,
        deleted: false,
      });

      const memberMap = {};
      const churchMap = {};
      const groupMap = {};

      givings.forEach((g) => {
        if (g.member) memberMap[g.member] = (memberMap[g.member] || 0) + 1;
        if (g.church) churchMap[g.church] = (churchMap[g.church] || 0) + 1;
        if (g.group) groupMap[g.group] = (groupMap[g.group] || 0) + 1;
      });

      const mostConsistentMember = Object.entries(memberMap).sort(
        (a, b) => b[1] - a[1]
      )[0];

      const mostConsistentChurch = Object.entries(churchMap).sort(
        (a, b) => b[1] - a[1]
      )[0];

      const mostConsistentGroup = Object.entries(groupMap).sort(
        (a, b) => b[1] - a[1]
      )[0];

      stats.push({
        campaign: c.name,
        arm: c.arm,

        mostConsistentMember: mostConsistentMember
          ? {
              id: mostConsistentMember[0],
              contributions: mostConsistentMember[1],
            }
          : null,
          
        mostConsistentChurch: mostConsistentChurch
          ? {
              id: mostConsistentChurch[0],
              contributions: mostConsistentChurch[1],
            }
          : null,

        mostConsistentGroup: mostConsistentGroup
          ? {
              id: mostConsistentGroup[0],
              contributions: mostConsistentGroup[1],
            }
          : null,
      });
    }

    res.json(stats);
  } catch (err) {
    console.error("Error fetching campaign stats:", err);
    res.status(500).json({ message: "Server error fetching campaign stats" });
  }
};


export const getCampaignsWithCategories = async (req, res) => {
  try {
    const campaigns = await Campaign.find({ deleted: false }).lean();

    // Attach categories to each campaign
    const campaignsWithCategories = await Promise.all(
      campaigns.map(async (c) => {
        const categories = await Category.find({ campaign: c._id, deleted: false }).lean();
        return { ...c, categories };
      })
    );

    res.json(campaignsWithCategories);
  } catch (err) {
    console.error("Error fetching campaigns with categories:", err);
    res.status(500).json({ message: "Failed to fetch campaigns with categories" });
  }
};




// GET /campaigns/:id
export const getCampaignById = async (req, res) => {
   try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      console.warn('⚠️ Invalid ObjectId format:', id);
      return res.status(400).json({ success: false, message: "Invalid campaign ID format" });
    }

    console.log('   • querying Campaign.findById...');
    const campaign = await Campaign.findById(id)
      .populate("categories", "name minAmount maxAmount");

    if (!campaign) {
      console.warn('⚠️ Campaign not found for ID:', id);
      return res.status(404).json({ success: false, message: "Campaign not found" });
    }

    return res.status(200).json({
      success: true,
      data: campaign
    });
  } catch (err) {
    console.error('❌ [getCampaignById] Error:', err.message);
    console.error('   • stack:', err.stack);
    return res.status(500).json({
      success: false,
      message: "Server error fetching campaign",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// ─────────────────────────────────────────────
// GET /campaigns/participation/:campaignId
// ─────────────────────────────────────────────
export const getCampaignParticipation = async (req, res) => {
  try {
    const { campaignId } = req.params;

    if (!Types.ObjectId.isValid(campaignId)) {
      return res.status(400).json({ message: "Invalid campaignId" });
    }

    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    // ✅ 1. GET ALL ASSIGNED MEMBERS (SOURCE OF TRUTH)
    const participations = await MemberCampaignParticipation.find({
      campaign: campaignId,
    })
      .populate({
        path: "member",
        populate: [
          { path: "church", select: "name" },
          { path: "group", select: "group_name" },
        ],
      })
      .populate("pledgedCategory", "name minAmount maxAmount")
      .lean();

    // ✅ 2. GET GIVING MAP
    const givingMap = await getCampaignGivingMap(campaignId);

    // ✅ 3. MERGE MCP + GIVING
    const data = participations.map((p) => {
      const memberId = p.member?._id?.toString();

      const giving = givingMap[memberId] || {
        totalContributed: 0,
        lastGivingDate: null,
      };

      return {
        memberId,
        memberName: p.member?.name,
        church: p.member?.church?.name,
        group: p.member?.group?.group_name,

        // 🔥 MCP
        pledgedAmount: p.targetAmount || 0,
        categoryId: p.pledgedCategory?._id || null,
        categoryName: p.pledgedCategory?.name || "Uncategorized",

        // 🔥 GIVING
        totalContributed: giving.totalContributed,
        lastGivingDate: giving.lastGivingDate,

        // 🔥 COMPUTED
        progress:
          p.targetAmount > 0
            ? (giving.totalContributed / p.targetAmount) * 100
            : 0,
      };
    });

    return res.json({
      campaign: campaign.name,
      count: data.length,
      data,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /campaigns/:campaignId/church/:churchId
export const getChurchMembersByCampaign = async (req, res) => {
  try {
    const { campaignId, churchId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(campaignId) || !mongoose.Types.ObjectId.isValid(churchId)) {
      return res.status(400).json({ message: "Invalid campaignId or churchId" });
    }

    const campaign = await Campaign.findById(campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    // 1️⃣ Fetch all participations for this campaign
    const participations = await MemberCampaignParticipation.find({ campaign: campaignId })
      .populate({
        path: "member",
        select: "name phone church",
      })
      .populate("pledgedCategory", "name")
      .lean();

    // 2️⃣ Filter members belonging to the requested church
    const filteredParticipations = participations.filter(
      p => p.member && p.member.church?.toString() === churchId
    );

    if (!filteredParticipations.length) {
      return res.json({ success: true, months: [], categories: [] });
    }

    // 3️⃣ Build months range
    const start = new Date(campaign.startDate);
    const end = new Date(campaign.endDate);
    const months = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      months.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
      cursor.setMonth(cursor.getMonth() + 1);
    }

    // 4️⃣ Aggregate givings for filtered members
    const memberIds = filteredParticipations.map(p => p.member._id);
    const givingsAgg = await Giving.aggregate([
      { $match: { member: { $in: memberIds }, date: { $gte: start, $lte: end }, deleted: false } },
      { $addFields: { month: { $dateToString: { format: "%Y-%m", date: "$date" } } } },
      { $group: { _id: { member: "$member", month: "$month" }, total: { $sum: "$amount" } } },
    ]);

    const givingMap = {};
    givingsAgg.forEach(g => {
      const memberId = g._id.member.toString();
      if (!givingMap[memberId]) givingMap[memberId] = {};
      givingMap[memberId][g._id.month] = g.total;
    });

    // 5️⃣ Build response
    const result = filteredParticipations.map(p => {
      const memberId = p.member._id.toString();
      const memberMonthly = {};
      months.forEach(m => {
        memberMonthly[m] = givingMap[memberId]?.[m] || 0;
      });
      const totalContributed = Object.values(memberMonthly).reduce((a, b) => a + b, 0);
      return {
        _id: memberId,
        name: p.member.name,
        phone: p.member.phone || "-",
        memberMonthly,
        totalContributed,
        pledgeAmount: p.targetAmount || 0,
        categoryId: p.pledgedCategory?._id || null,
        categoryName: p.pledgedCategory?.name || "Uncategorized",
        progress: p.targetAmount > 0 ? (totalContributed / p.targetAmount) * 100 : 0,
      };
    });

    // 6️⃣ Group by category
    const categoriesMap = {};
    result.forEach(m => {
      const cat = m.categoryName || "Uncategorized";
      if (!categoriesMap[cat]) categoriesMap[cat] = [];
      categoriesMap[cat].push(m);
    });

    const categories = Object.keys(categoriesMap).map(catName => ({
      categoryName: catName,
      members: categoriesMap[catName],
    }));

    return res.json({ success: true, months, categories });
  } catch (err) {
    console.error("❌ getChurchMembersByCampaign error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


export const getCampaignMemberReport = async (req, res) => {
  try {
    const { campaignId } = req.params;

    const data = await Giving.aggregate([
      {
        $match: {
          campaign: new mongoose.Types.ObjectId(campaignId),
          deleted: false,
        },
      },

      {
        $group: {
          _id: "$member",
          totalAmount: { $sum: "$amount" },
          contributions: { $sum: 1 },
        },
      },

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
          memberId: "$member._id",
          name: "$member.name",
          totalAmount: 1,
          contributions: 1,
        },
      },

      { $sort: { totalAmount: -1 } },
    ]);

    res.json({
      campaignId,
      members: data,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

export const getHodDashboard = async (req, res) => {
  try {
    console.log("🚀 HOD DASHBOARD REQUEST");

    const user = req.user;

    if (!user || !user.role?.endsWith("_hod")) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const arm = hodArmMap[user.role];

    if (!arm) {
      return res.status(400).json({ message: "Invalid HOD role" });
    }

    console.log("🎯 Arm:", arm);

    const campaigns = await Campaign.find({
      arm: new RegExp(`^${arm}$`, "i"),
      deleted: false,
    });

    if (!campaigns.length) {
      return res.json({
        data: {
          rows: [],
          allRows: [],
          meta: { total: 0 },
          grandTotal: 0,
        },
      });
    }

    const campaign = campaigns.sort(
      (a, b) => new Date(b.startDate) - new Date(a.startDate)
    )[0];

    console.log("📌 Selected Campaign:", campaign.name);

    let advResponse;

    await getAdvancedCampaignReport(
      { query: { campaignId: campaign._id } },
      {
        json: (data) => {
          advResponse = data;   
        },
        status: () => ({
          json: (e) => {
            throw e;
          },
        }),
      }
    );

    const adv = advResponse;

if (!adv || !adv.data) {
  return res.json({
    data: {
      rows: [],
      allRows: [],
      meta: { total: 0 },
      grandTotal: 0,
    },
  });
}

const allRows = adv.data.flatMap(cat => cat.members || []);

// 🔥 NORMALIZE DATA HERE (VERY IMPORTANT)
const normalizedRows = allRows.map((r) => ({
  name: r.name || "Unnamed",
  phone: r.phone || "-",
  church: r.church || "-",
  group: r.group || "-",

  // ✅ FIX CATEGORY
  category: r.category || r.categoryName || "Uncategorized",

  // ✅ FIX PLEDGE
  pledgeAmount:
    r.pledgeAmount ??
    r.pledgedAmount ??
    r.targetAmount ??
    0,

    monthly: r.monthly || {},
    totalAmount: r.totalAmount || 0,
  }));

    console.log("✅ NORMALIZED SAMPLE:", normalizedRows[0]);
    console.log("📊 Rows returned:", allRows.length);

    const grandTotal = normalizedRows.reduce(
      (sum, r) => sum + (r.totalAmount || 0),
      0
    );

    console.log("💰 Grand Total:", grandTotal);

    return res.json({
      data: {
        rows: normalizedRows,
        allRows: normalizedRows,
        meta: { total: allRows.length },
        grandTotal,
      },
    });
  } catch (err) {
    console.error("❌ HOD DASHBOARD ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};