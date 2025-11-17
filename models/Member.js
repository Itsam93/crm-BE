import mongoose from "mongoose";

const memberSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String },
    email: { type: String }, 
    birthday: { type: Date },
    kingschatId: { type: String },
    group: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
    church: { type: mongoose.Schema.Types.ObjectId, ref: "Church", required: true },
    hod: { type: mongoose.Schema.Types.ObjectId, ref: "Hod" },

    // ====== For Self-Update Requests ======
    pendingUpdate: {
      type: Object, 
      default: null,
    },
    updateStatus: {
      type: String,
      enum: ["none", "pending", "approved", "rejected"],
      default: "none",
    },
    updateNotes: {
      type: String, 
    },

    deleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("Member", memberSchema);
