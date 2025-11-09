import mongoose from "mongoose";

const groupSchema = new mongoose.Schema(
  {
    group_name: { 
      type: String, 
      required: [true, "Group name is required"], 
      trim: true // normalize names
    },
    totalGiving: { type: Number, default: 0 },
    pastor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Group", groupSchema);
