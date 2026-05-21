// models/Church.js
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
      index: true,  // single index here is cleaner
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
    totalMembers: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Optional but useful for future filtering/reporting
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

// ────────────────────────────────────────────────────────────────
// Indexes — consolidated and no duplicates
// ────────────────────────────────────────────────────────────────
churchSchema.index({ name: 1, group: 1 }, { unique: true });  // keep unique constraint
churchSchema.index({ totalMembers: -1 });                     // sorting by size
churchSchema.index({ isActive: 1 });                          // active/inactive filtering

// ────────────────────────────────────────────────────────────────
// Post-save hook: notify group to update its totalMembers (if needed)
// ────────────────────────────────────────────────────────────────
churchSchema.post("save", async function (doc) {
  // Only run if totalMembers changed
  if (this.isModified("totalMembers") && doc.group) {
    const Group = mongoose.model("Group");
    const total = await mongoose.model("Church").aggregate([
      { $match: { group: doc.group, isActive: true } },
      { $group: { _id: null, sum: { $sum: "$totalMembers" } } },
    ]);

    await Group.updateOne(
      { _id: doc.group },
      { $set: { totalMembers: total[0]?.sum || 0 } }
    );
  }
});

// Prevent overwrite error
export default mongoose.models.Church || mongoose.model("Church", churchSchema);