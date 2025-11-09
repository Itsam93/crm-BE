import mongoose from "mongoose";

const churchSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    pastorName: {
      type: String,
      trim: true,
    },
    location: {
      type: String,
      trim: true,
    },
    totalGiving: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Ensure combination of name + group is unique
churchSchema.index({ name: 1, group: 1 }, { unique: true });

// ✅ Avoid OverwriteModelError
const Church = mongoose.models.Church || mongoose.model("Church", churchSchema);

export default Church;
