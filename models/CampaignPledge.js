import mongoose from "mongoose";

const campaignPledgeSchema = new mongoose.Schema(
  {
    campaign: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      required: [true, "Campaign is required"],
      index: true,
    },

    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: [true, "Member is required"],
      index: true,
    },

    memberName: {
      type: String,
      required: [true, "Member name is required"],
      trim: true,
    },

    church: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Church",
      required: [true, "Church is required"],
      index: true,
    },

    churchName: {
      type: String,
      required: [true, "Church name is required"],
      trim: true,
    },

    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: [true, "Group is required"],
      index: true,
    },

    groupName: {
      type: String,
      required: [true, "Group name is required"],
      trim: true,
    },

    phone: {
      type: String,
      trim: true,
      default: "",
    },

    kingschatId: {
      type: String,
      trim: true,
      default: "",
    },

    birthday: {
      type: Date,
      default: null,
    },

    pledgeAmount: {
      type: Number,
      required: [true, "Pledge amount is required"],
      min: [
        1,
        "Pledge amount must be greater than zero",
      ],
    },

    pledgedAt: {
      type: Date,
      default: Date.now,
    },

    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Pledge recorder is required"],
    },

    notes: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },

    customValues: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

campaignPledgeSchema.index(
  {
    campaign: 1,
    member: 1,
  },
  {
    unique: true,
  }
);

campaignPledgeSchema.index({
  campaign: 1,
  church: 1,
});

campaignPledgeSchema.index({
  campaign: 1,
  group: 1,
});

campaignPledgeSchema.index({
  campaign: 1,
  pledgeAmount: -1,
});

export default mongoose.models.CampaignPledge ||
  mongoose.model(
    "CampaignPledge",
    campaignPledgeSchema
  );