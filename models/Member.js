import mongoose from "mongoose";

const memberSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    birthday: { type: Date },
    kingschatId: { type: String, trim: true },

    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
      index: true,
    },
    church: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Church",
      default: "Church",
      index: true,
    },
    hod: { type: mongoose.Schema.Types.ObjectId, ref: "Hod", index: true },

    // ────────────────────────────────────────────────────────────────
    // DEPRECATED fields — being replaced by MemberCampaignParticipation
    // Keep them temporarily during migration if needed, then remove
    // category: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    // pledgeAmount: { type: Number, default: 0 },
    // totalContributed: { type: Number, default: 0 },
    // ────────────────────────────────────────────────────────────────

    // ────────────────────────────────────────────────────────────────
    // NEW — For self-update / profile edit requests
    // ────────────────────────────────────────────────────────────────
    pendingUpdate: {
      type: Object,
      default: null,
    },
    updateStatus: {
      type: String,
      enum: ["none", "pending", "approved", "rejected"],
      default: "none",
      index: true,
    },
    updateNotes: { type: String },

    // ────────────────────────────────────────────────────────────────
    // Status & soft-delete
    // ────────────────────────────────────────────────────────────────
    deleted: { type: Boolean, default: false, index: true },
    isActive: { type: Boolean, default: true, index: true },

    // ────────────────────────────────────────────────────────────────
    // Optional: last activity / engagement tracking
    // Useful for reports like "active partners"
    // ────────────────────────────────────────────────────────────────
    lastGivingDate: { type: Date },
    lastLoginDate: { type: Date },
  },
  {
    timestamps: true,
  }
);

// ────────────────────────────────────────────────────────────────
// Indexes for performance (especially reports & lookups)
// ────────────────────────────────────────────────────────────────
memberSchema.index({ church: 1, deleted: 1 });
memberSchema.index({ group: 1, deleted: 1 });
memberSchema.index({ name: "text", phone: "text", email: "text", kingschatId: "text" });
memberSchema.index({ deleted: 1, isActive: 1 });

// ────────────────────────────────────────────────────────────────
// Virtual: current participations (optional — for easier querying)
// ────────────────────────────────────────────────────────────────
memberSchema.virtual("participations", {
  ref: "MemberCampaignParticipation",
  localField: "_id",
  foreignField: "member",
});

// ────────────────────────────────────────────────────────────────
// Pre-save hook: update lastGivingDate if needed (optional)
// ────────────────────────────────────────────────────────────────
memberSchema.pre("save", function (next) {
  if (this.isModified("totalContributed") && this.totalContributed > 0) {
    this.lastGivingDate = new Date();
  }
  next();
});

// Prevent model overwrite error
export default mongoose.models.Member || mongoose.model("Member", memberSchema);