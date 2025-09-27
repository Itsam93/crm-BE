import mongoose from "mongoose";

const partnershipSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Partnership arm name is required"],
      trim: true,
    },
  },
  { timestamps: true }
);

const Partnership = mongoose.model("Partnership", partnershipSchema);

export default Partnership;
