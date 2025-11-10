import mongoose from "mongoose";

const groupSchema = new mongoose.Schema(
  {
    group_name: {
      type: String,
      required: [true, "Group name is required"],
      trim: true,
    },
    totalGiving: { type: Number, default: 0 },

    // ⬇️ Changed pastor from ObjectId → String
    pastor: {
      type: String,
      trim: true,
      default: "Not assigned",
    },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Group", groupSchema);
