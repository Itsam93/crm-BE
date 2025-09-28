// models/Member.js
import mongoose from "mongoose";

const memberSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String },
    phone: { type: String },
    church: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Church",
      required: true,
    },
    designation: {
      type: [String], 
      enum: ["Pastor", "Deacon", "Deaconness", "Bro", "Sis"],
      default: [],
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Member", memberSchema);
