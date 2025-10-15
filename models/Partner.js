import mongoose from "mongoose";

const partnerSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    partnershipArm: {
      type: String,
      required: true,
      trim: true, // e.g. "Healing", "Rhapsody", "Ministry"
    },

    church: {
      type: String,
      required: true,
      trim: true,
    },

    group: {
      type: String,
      default: "",
      trim: true,
    },

    zone: {
      type: String,
      default: "",
      trim: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    // ✅ New field for specific date of giving
    dateOfGiving: {
      type: Date,
      required: true,
      default: Date.now,
    },

    status: {
      type: String,
      enum: ["confirmed", "pending"],
      default: "confirmed",
    },

    notes: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Partner", partnerSchema);
