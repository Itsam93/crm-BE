import mongoose from "mongoose";

const memberRequestSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["registration", "update"],
      required: true,
      index: true,
    },

    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      default: null,
      index: true,
    },

    data: {
      name: {
        type: String,
        required: true,
        trim: true,
      },

      phone: {
        type: String,
        trim: true,
        default: "",
      },

      email: {
        type: String,
        trim: true,
        lowercase: true,
        default: "",
      },

      birthday: {
        type: Date,
        default: null,
      },

      kingschatId: {
        type: String,
        trim: true,
        default: "",
      },

      group: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Group",
        required: true,
      },

      church: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Church",
        required: true,
      },

      hod: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Hod",
        default: null,
      },
    },

    status: {
      type: String,
      enum: [
        "pending",
        "approved",
        "rejected",
      ],
      default: "pending",
      index: true,
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    rejectionReason: {
      type: String,
      trim: true,
      default: "",
    },

    adminNotes: {
      type: String,
      trim: true,
      default: "",
    },

    submittedFrom: {
      type: String,
      enum: ["member-portal", "admin", "mobile"],
      default: "member-portal",
    },

    ipAddress: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);


memberRequestSchema.index({
  status: 1,
  type: 1,
  createdAt: -1,
});

memberRequestSchema.index({
  member: 1,
  status: 1,
});

memberRequestSchema.index({
  "data.group": 1,
});

memberRequestSchema.index({
  "data.church": 1,
});


export default mongoose.models.MemberRequest ||
  mongoose.model("MemberRequest", memberRequestSchema);