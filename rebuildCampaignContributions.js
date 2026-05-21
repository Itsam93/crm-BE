import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import Campaign from "./models/Campaign.js";
import Giving from "./models/Giving.js";
import MemberCampaignParticipation from "./models/MemberCampaignParticipation.js";

// =========================
// DB CONNECT
// =========================
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    throw new Error("MONGO_URI is not defined in environment variables");
}
await mongoose.connect(MONGO_URI);

console.log("✅ Connected to DB");

// =========================
// REBUILD LOGIC
// =========================
await MemberCampaignParticipation.deleteMany({});

const campaigns = await Campaign.find({ deleted: false });

for (const campaign of campaigns) {
  const campaignStart = new Date(campaign.startDate);
  campaignStart.setHours(0, 0, 0, 0);

  const givings = await Giving.find({
    campaign: campaign._id,
    deleted: false,
    date: { $gte: campaignStart },
  });

  const map = {};

  for (const g of givings) {
    const id = g.member.toString();

    if (!map[id]) {
      map[id] = { total: 0, group: g.group, church: g.church };
    }

    map[id].total += g.amount;
  }

  for (const memberId in map) {
    await MemberCampaignParticipation.create({
      member: memberId,
      campaign: campaign._id,
      totalContributed: map[memberId].total,
      group: map[memberId].group,
      church: map[memberId].church,
      joinedAt: campaignStart,
    });
  }

  console.log(`✔ Rebuilt: ${campaign.name}`);
}

console.log("🎉 DONE");

// =========================
// EXIT
// =========================
await mongoose.disconnect();
process.exit(0);