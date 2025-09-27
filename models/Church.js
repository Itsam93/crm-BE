import mongoose from "mongoose";

const churchSchema = mongoose.Schema(
  {
    name: { type: String, required: true },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    location: { type: String },
  },
  { timestamps: true }
);

// ✅ Ensure no duplicate church name within the same group
churchSchema.index({ name: 1, group: 1 }, { unique: true });

export default mongoose.model("Church", churchSchema);
