// models/Giving.js
import mongoose from "mongoose";

const givingSchema = new mongoose.Schema(
  {
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: true,
    },

    church: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Church",
    },

    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
    },

    amount: {
      type: Number,
      required: true,
      min: 1,
    },

    date: {
      type: Date,
      default: Date.now,
    },

    arm: {
      type: String,
      enum: [
        "Rhapsody",
        "Healing School",
        "Ministry Programs",
        "Innercity Missions",
        "Loveworld Bibles",
        "LWPM",
      ],
      required: true,
    },

    deleted: {
      type: Boolean,
      default: false,
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
    },
  },
  {
    timestamps: true,
  }
);

givingSchema.index({ ministryYear: 1, arm: 1 });
givingSchema.index({ ministryYear: 1, campaign: 1 });
givingSchema.index({ member: 1, ministryYear: 1 });
givingSchema.index({ date: 1 });

export default mongoose.model("Giving", givingSchema);