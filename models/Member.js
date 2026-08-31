import mongoose from "mongoose";

const memberSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      trim: true,
      default: "",
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },

    birthday: {
      type: Date,
      default: null,
    },

    kingschatId: {
      type: String,
      trim: true,
      default: "",
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
      index: true,
    },

    church: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Church",
      required: true,
      index: true,
    },

    hod: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      default: null,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    deleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    lastGivingDate: {
      type: Date,
      default: null,
    },

    lastLoginDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);


memberSchema.index({ church: 1, deleted: 1 });

memberSchema.index({ group: 1, deleted: 1 });

memberSchema.index({
  name: "text",
  phone: "text",
  email: "text",
  kingschatId: "text",
});

memberSchema.index({
  deleted: 1,
  isActive: 1,
});

memberSchema.virtual("participations", {
  ref: "MemberCampaignParticipation",
  localField: "_id",
  foreignField: "member",
});

export default mongoose.models.Member ||
  mongoose.model("Member", memberSchema);