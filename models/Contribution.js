import mongoose from "mongoose";

const contributionSchema = new mongoose.Schema({
  member: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now },
}, { timestamps: true });

export default mongoose.model("Contribution", contributionSchema);