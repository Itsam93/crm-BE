import mongoose from "mongoose";

const groupSchema = new mongoose.Schema(
  {
    group_name: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

export default mongoose.model("Group", groupSchema);
