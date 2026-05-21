import mongoose from "mongoose";
import Giving from "../models/Giving.js";
import Member from "../models/Member.js";
import Church from "../models/Church.js";
import Group from "../models/Group.js";

const { Types } = mongoose;

// Utility: start of period for grouping
const getPeriodStart = (date, timeframe) => {
  const d = new Date(date);
  switch (timeframe) {
    case "weekly": {
      const day = d.getDay(); 
      d.setDate(d.getDate() - day);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case "monthly":
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      return d;
    case "quarterly": {
      const quarterStartMonth = Math.floor(d.getMonth() / 3) * 3;
      d.setMonth(quarterStartMonth, 1);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case "semiannual": {
      const semiStartMonth = d.getMonth() < 6 ? 0 : 6;
      d.setMonth(semiStartMonth, 1);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    default:
      return new Date(d.setHours(0, 0, 0, 0));
  }
};

// -----------------------------
// Get campaign giving stats
// -----------------------------
export const getCampaignStats = async (req, res) => {
  try {
    const { campaignId, category, timeframe = "monthly", from, to } = req.query;

    if (!campaignId) {
      return res.status(400).json({ message: "campaignId is required" });
    }

    const match = {
      deleted: false,
      campaign: new Types.ObjectId(campaignId),
    };

    if (category) match.category = category;

    if (from || to) {
      match.date = {};
      if (from) match.date.$gte = new Date(from);
      if (to) match.date.$lte = new Date(to);
    }

    let periodExpression;

    switch (timeframe) {
      case "weekly":
        periodExpression = {
          $dateTrunc: {
            date: "$date",
            unit: "week",
            binSize: 1,
            timezone: "UTC",
          },
        };
        break;

      case "monthly":
        periodExpression = {
          $dateTrunc: {
            date: "$date",
            unit: "month",
          },
        };
        break;

      case "quarterly":
        periodExpression = {
          $dateTrunc: {
            date: "$date",
            unit: "quarter",
          },
        };
        break;

      case "semiannual":
        periodExpression = {
          $dateTrunc: {
            date: "$date",
            unit: "month",
            binSize: 6,
          },
        };
        break;

      default:
        periodExpression = {
          $dateTrunc: {
            date: "$date",
            unit: "month",
          },
        };
    }

    const pipeline = [
      { $match: match },

      {
        $addFields: {
          periodStart: periodExpression,
        },
      },

      {
        $group: {
          _id: {
            period: "$periodStart",
            category: "$category",
          },
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },

      { $sort: { "_id.period": 1 } },
    ];

    const stats = await Giving.aggregate(pipeline);

    res.json({
      campaignId,
      timeframe,
      stats,
    });

  } catch (err) {
    console.error("Campaign stats error:", err);
    res.status(500).json({ message: "Server error fetching campaign stats" });
  }
};

// -----------------------------
// Campaign summary (dashboard cards)
// -----------------------------
export const getCampaignSummary = async (req, res) => {
  try {
    const { campaignId } = req.query;

    if (!campaignId) {
      return res.status(400).json({ message: "campaignId is required" });
    }

    const match = {
      deleted: false,
      campaign: new mongoose.Types.ObjectId(campaignId),
    };

    const results = await Giving.aggregate([
      { $match: match },

      {
        $group: {
          _id: "$category",
          totalAmount: { $sum: "$amount" },
          donations: { $sum: 1 },
        },
      },
    ]);

    let totalAmount = 0;
    let donations = 0;
    const categories = {};

    results.forEach((item) => {
      const category = item._id || "Uncategorized";

      categories[category] = item.totalAmount;

      totalAmount += item.totalAmount;
      donations += item.donations;
    });

    res.json({
      campaignId,
      totalAmount,
      donations,
      categories,
    });
  } catch (err) {
    console.error("Campaign summary error:", err);
    res.status(500).json({ message: "Server error fetching campaign summary" });
  }
};
