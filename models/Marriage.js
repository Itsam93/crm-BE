import mongoose from "mongoose";

const marriageSchema = new mongoose.Schema(
  {
    husband: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: true,
    },
    wife: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: true,
    },
    weddingDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "separated", "widowed"],
      default: "active",
    },
    church: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Church",
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
    },
  },
  { timestamps: true }
);

// Prevent duplicate active marriages
marriageSchema.index(
  { husband: 1, wife: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "active" } }
);

export default mongoose.model("Marriage", marriageSchema);
