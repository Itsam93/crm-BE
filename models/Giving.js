import mongoose from "mongoose";

const GIVING_ARMS = [
  "Rhapsody",
  "Healing School",
  "Ministry Programs",
  "Innercity Missions",
  "Loveworld Bibles",
  "LWPM",
];

const givingSchema = new mongoose.Schema(
  {
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: true,
      index: true,
    },

    church: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Church",
      default: null,
      index: true,
    },

    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      default: null,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 1,
    },

    date: {
      type: Date,
      default: Date.now,
      index: true,
    },

    arm: {
      type: String,
      enum: GIVING_ARMS,
      required: true,
      index: true,
    },

    deleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    ministryYear: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MinistryYear",
      required: true,
      index: true,
    },

    campaign: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      default: null,
      index: true,
    },

    category: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

givingSchema.index({
  ministryYear: 1,
  arm: 1,
});

givingSchema.index({
  ministryYear: 1,
  campaign: 1,
});

givingSchema.index({
  member: 1,
  ministryYear: 1,
});

givingSchema.index({
  member: 1,
  arm: 1,
  date: 1,
});

givingSchema.index({
  church: 1,
  arm: 1,
  date: 1,
});

givingSchema.index({
  group: 1,
  arm: 1,
  date: 1,
});

export { GIVING_ARMS };

export default mongoose.models.Giving ||
  mongoose.model("Giving", givingSchema);