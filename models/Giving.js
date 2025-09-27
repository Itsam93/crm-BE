import mongoose from "mongoose";

const givingSchema = new mongoose.Schema(
  {
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: true,
    },
    partnershipArm: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Partnership",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    deleted: {
      type: Boolean,
      default: false, // soft delete option
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt
  }
);

const Giving = mongoose.model("Giving", givingSchema);

export default Giving;
