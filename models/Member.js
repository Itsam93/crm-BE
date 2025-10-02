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

    gender: {
      type: String,
      enum: ["Male", "Female", "Other"],
      required: true,
    },

    dateOfBirth: { type: Date },
    maritalStatus: {
      type: String,
      enum: ["Single", "Married", "Widowed", "Divorced"],
      default: "Single",
    },
    weddingAnniversary: { type: Date },
  },
  { timestamps: true }
);

memberSchema.virtual("avatar").get(function () {
  if (!this.name) return null;

  const initials = this.name
    .split(" ")
    .map((n) => n[0]?.toUpperCase())
    .join("")
    .slice(0, 2);

  let bgColor = "999999"; 
  if (this.gender === "Male") bgColor = "0D8ABC"; 
  if (this.gender === "Female") bgColor = "FF69B4";

  return {
    initials,
    bgColor: `#${bgColor}`,
  };
});

memberSchema.set("toJSON", { virtuals: true });
memberSchema.set("toObject", { virtuals: true });

export default mongoose.model("Member", memberSchema);
