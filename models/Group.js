import mongoose from "mongoose";

const groupSchema = new mongoose.Schema(
  {
    group_name: {
      type: String,
      required: [true, "Group name is required"],
      trim: true,
    },

    // Total active members across all churches in this group
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
      default: "Null",
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
    toJSON: { virtuals: true },    // include virtuals in JSON output
    toObject: { virtuals: true },
  }
);

// ────────────────────────────────────────────────────────────────
// Indexes ────────────────────────────────────────────────────────
groupSchema.index({ group_name: "text" });           // text search
groupSchema.index({ isActive: 1 });                  // filter active groups
groupSchema.index({ totalMembers: -1 });             // sort by size
groupSchema.index({ totalGiving: -1 });              // sort by giving
groupSchema.index({ zoneOrRegion: 1 });              // regional filtering

// ────────────────────────────────────────────────────────────────
// Virtuals ───────────────────────────────────────────────────────
groupSchema.virtual("churches", {
  ref: "Church",
  localField: "_id",
  foreignField: "group",
  match: { isActive: true },     // only active churches
});

// ────────────────────────────────────────────────────────────────
// Post-save hook: recalculate totalMembers from churches (safety net)
// ────────────────────────────────────────────────────────────────
groupSchema.post("save", async function (doc) {
  // Optional: you can trigger recalculation here if needed
  // But since Church already updates group on save, this is redundant unless bulk operations
});

// Prevent overwrite error
const Group = mongoose.models.Group || mongoose.model("Group", groupSchema);

export default Group;