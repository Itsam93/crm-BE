import mongoose from "mongoose";

/**
 * Category = range-based classification rule
 * NOT a container of members
 */
const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    minAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    maxAmount: {
      type: Number,
      default: null, // null = no upper limit ("and above")
    },

    order: {
      type: Number,
      required: true,
      min: 1,
    },

    campaign: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
      index: true,
    },

    deleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

/**
 * Indexing for fast category lookup per campaign
 */
categorySchema.index({ campaign: 1, order: 1 });

/**
 * Validation rule: min cannot exceed max (when max exists)
 */
categorySchema.pre("validate", function (next) {
  if (
    this.maxAmount !== null &&
    this.maxAmount !== undefined &&
    this.minAmount > this.maxAmount
  ) {
    return next(new Error("minAmount cannot exceed maxAmount"));
  }
  next();
});

export default mongoose.model("Category", categorySchema);