// models/PartnershipArm.js
import mongoose from "mongoose";

const partnershipArmSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("PartnershipArm", partnershipArmSchema);
