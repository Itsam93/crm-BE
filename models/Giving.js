import mongoose from "mongoose";

const givingSchema = new mongoose.Schema(
  {
    member: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true },
    church: { type: mongoose.Schema.Types.ObjectId, ref: "Church" }, 
    group: { type: mongoose.Schema.Types.ObjectId, ref: "Group" },   
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    arm: {
      type: String,
      enum: ["Rhapsody", "Healing School", "Ministry Programs", "Innercity Missions", "Loveworld Bibles"],
      required: true,
    },
    deleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("Giving", givingSchema);
