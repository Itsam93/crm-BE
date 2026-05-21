// services/participation.service.js
import mongoose from "mongoose";
import Giving from "../models/Giving.js";
import Participation from "../models/MemberCampaignParticipation.js";
import Category from "../models/Category.js";

export const recomputeParticipation = async (memberId, campaignId) => {
  const memberObjectId = new mongoose.Types.ObjectId(memberId);
  const campaignObjectId = new mongoose.Types.ObjectId(campaignId);

  // 1. TOTAL GIVING
  const [agg] = await Giving.aggregate([
    {
      $match: {
        member: memberObjectId,
        campaign: campaignObjectId,
        deleted: false,
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$amount" },
      },
    },
  ]);

  const totalContributed = agg?.total || 0;

  // 2. GET CATEGORIES
  const categories = await Category.find({
    campaign: campaignObjectId,
    deleted: false,
  }).sort({ order: 1 });

  // 3. FIND MATCHING CATEGORY
  const matchedCategory = categories.find((cat) => {
    return (
      totalContributed >= cat.minAmount &&
      (cat.maxAmount === null || totalContributed <= cat.maxAmount)
    );
  });

  // 4. GET PARTICIPATION
  const participation = await Participation.findOne({
    member: memberObjectId,
    campaign: campaignObjectId,
  });

  if (!participation) return; // no participation → ignore

  // 5. PROGRESS
  const progress =
    participation.targetAmount > 0
      ? (totalContributed / participation.targetAmount) * 100
      : 0;

  // 6. UPDATE
  participation.totalContributed = totalContributed;
  participation.effectiveCategory = matchedCategory?._id;
  participation.progressPercent = progress;

  await participation.save();
};