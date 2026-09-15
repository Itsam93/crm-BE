import mongoose from "mongoose";

const groupSchema = new mongoose.Schema(
  {
    group_name: {
      type: String,
      required: [true, "Group name is required"],
      trim: true,
    },

    totalMembers: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalGiving: {
      type: Number,
      default: 0,
    },

    pastor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    zoneOrRegion: {
      type: String,
      trim: true,
      default: "Unassigned",
    },
  },
  {
    timestamps: true,

    toJSON: {
      virtuals: true,
    },

    toObject: {
      virtuals: true,
    },
  }
);

groupSchema.index({ group_name: "text" });
groupSchema.index({ isActive: 1 });
groupSchema.index({ totalMembers: -1 });
groupSchema.index({ totalGiving: -1 });
groupSchema.index({ zoneOrRegion: 1 });

groupSchema.virtual("churches", {
  ref: "Church",
  localField: "_id",
  foreignField: "group",
  match: {
    isActive: true,
  },
});

const Group =
  mongoose.models.Group ||
  mongoose.model("Group", groupSchema);

export default Group;