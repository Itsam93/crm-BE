import mongoose from "mongoose";

const partnerSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    partnershipArm: { type: String, required: true, trim: true }, // e.g., "Healing", "Rhapsody", "Ministry"
    church: { type: String, required: true, trim: true },
    group: { type: String, default: "", trim: true },
    zone: { type: String, default: "", trim: true },
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, default: Date.now },
    status: { type: String, enum: ["confirmed", "pending"], default: "confirmed" },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("Partner", partnerSchema);
