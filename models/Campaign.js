import mongoose from "mongoose";

const CAMPAIGN_ARMS = [
  "Rhapsody",
  "Healing School",
  "Ministry Programs",
  "Innercity Missions",
  "Loveworld Bibles",
  "LWPM",
];

const campaignSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Campaign name is required"],
      trim: true,
      maxlength: 200,
    },

    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },

    arm: {
      type: String,
      enum: CAMPAIGN_ARMS,
      required: [true, "Partnership arm is required"],
      index: true,
    },

    startDate: {
      type: Date,
      required: [true, "Campaign start date is required"],
      index: true,
    },

    endDate: {
      type: Date,
      default: null,
      index: true,
    },

    status: {
      type: String,
      enum: ["draft", "active", "closed"],
      default: "draft",
      index: true,
    },

    customFields: [
      {
        key: {
          type: String,
          required: true,
          trim: true,
        },

        label: {
          type: String,
          required: true,
          trim: true,
        },

        type: {
          type: String,
          enum: [
            "text",
            "number",
            "date",
            "select",
            "textarea",
          ],
          default: "text",
        },

        options: {
          type: [String],
          default: [],
        },

        required: {
          type: Boolean,
          default: false,
        },

        order: {
          type: Number,
          default: 0,
        },
      },
    ],

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Campaign creator is required"],
      index: true,
    },

    closedAt: {
      type: Date,
      default: null,
    },

    closedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

campaignSchema.index({
  arm: 1,
  status: 1,
});

campaignSchema.index({
  startDate: 1,
  endDate: 1,
});

campaignSchema.index({
  createdBy: 1,
  createdAt: -1,
});

campaignSchema.pre("validate", function (next) {
  if (!Array.isArray(this.customFields)) {
    return next();
  }

  const keys = new Set();

  for (const field of this.customFields) {
    if (keys.has(field.key)) {
      return next(
        new Error(
          `Duplicate custom field key: ${field.key}`
        )
      );
    }

    keys.add(field.key);
  }

  next();
});

export { CAMPAIGN_ARMS };

export default mongoose.models.Campaign ||
  mongoose.model("Campaign", campaignSchema);