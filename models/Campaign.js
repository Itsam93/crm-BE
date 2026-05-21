import mongoose from "mongoose";

const campaignSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
    },

    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
      required: true,
    },

    arm: {
      type: String,
      enum: [
        "Partnership",
        "Rhapsody",
        "Healing School",
        "Ministry Programs",
        "Innercity Missions",
        "Loveworld Bibles",
        "LWPM",
      ],
      required: true,
    },

    active: {
      type: Boolean,
      default: true,
    },

    deleted: {
      type: Boolean,
      default: false,
    },

    // Campaign → Categories relationship
    categories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model("Campaign", campaignSchema);
