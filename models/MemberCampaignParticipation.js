import mongoose from "mongoose";

const participationSchema = new mongoose.Schema(
  {
    member: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true },
    campaign: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign", required: true },

    pledgedCategory: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    effectiveCategory: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },

    targetAmount: { type: Number, required: true },
    pledgedTargetCopies: { type: Number },

    upgradeStatus: {
      type: String,
      enum: ["none", "pending", "approved", "rejected"],
      default: "none",
    },

    suggestedCategory: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },

    upgradeHistory: [
      {
        from: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
        to: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
        date: { type: Date, default: Date.now },
        approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      },
    ],

    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Unique per member per campaign
participationSchema.index({ member: 1, campaign: 1 }, { unique: true });

export default mongoose.model("MemberCampaignParticipation", participationSchema);