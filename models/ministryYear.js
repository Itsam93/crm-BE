import mongoose from "mongoose";

const ministryYearSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    startDate: {
      type: Date,
      required: true,
      index: true,
    },

    endDate: {
      type: Date,
      required: true,
      index: true,
      validate: {
        validator(value) {
          return value > this.startDate;
        },
        message: "End date must be greater than start date.",
      },
    },

    status: {
      type: String,
      enum: ["Upcoming", "Current", "Closed"],
      default: "Upcoming",
    },

    isActive: {
      type: Boolean,
      default: false,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

ministryYearSchema.index(
  { isActive: 1 },
  {
    unique: true,
    partialFilterExpression: {
      isActive: true,
    },
  }
);

ministryYearSchema.index(
  { status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: "Current",
    },
  }
);

ministryYearSchema.index({
  startDate: 1,
  endDate: 1,
});

export default mongoose.model("MinistryYear", ministryYearSchema);