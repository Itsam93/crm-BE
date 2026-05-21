import mongoose from "mongoose";
import Campaign from "./models/Campaign.js";
import Category from "./models/Category.js";
import Member from "./models/Member.js";
import MemberCampaignParticipation from "./models/MemberCampaignParticipation.js";
import dotenv from "dotenv";
dotenv.config();

await mongoose.connect(process.env.MONGO_URI);

console.log("Starting migration...");

const categories = await Category.find({ deleted: false }).populate("campaign");

for (const cat of categories) {
  for (const memEntry of cat.members || []) {
    const memberId = memEntry.memberId;
    const campaignId = cat.campaign._id;

    const target = cat.campaign.arm === "Rhapsody"
      ? memEntry.pledgeAmount * 600   // copies → money
      : memEntry.pledgeAmount;

    await MemberCampaignParticipation.findOneAndUpdate(
      { member: memberId, campaign: campaignId },
      {
        member: memberId,
        campaign: campaignId,
        pledgedCategory: cat._id,
        effectiveCategory: cat._id,
        targetAmount: target || cat.minAmount,
        pledgedTargetCopies: cat.campaign.arm === "Rhapsody" ? memEntry.pledgeAmount : null,
        totalContributed: memEntry.pledgeAmount || 0, // initial
      },
      { upsert: true, new: true }
    );
  }
}

console.log("Migration completed! You can now remove 'members' array from Category.");
process.exit(0);