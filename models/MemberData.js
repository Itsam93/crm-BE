import mongoose from "mongoose";

const memberDataSchema = new mongoose.Schema(
  {
    name: {
      type: String,
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
    },

    church: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Church",
    },

    hod: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hod",
      default: null,
    },
  },
  {
    _id: false,
  }
);

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

    submittedByMember: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      default: null,
      index: true,
    },

    submittedName: {
      type: String,
      trim: true,
      required: true,
    },

    submittedPhone: {
      type: String,
      trim: true,
      default: "",
    },

    data: {
      type: memberDataSchema,
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
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
  submittedByMember: 1,
});

memberRequestSchema.index({
  reviewedBy: 1,
});

memberRequestSchema.index({
  submittedPhone: 1,
  status: 1,
});

export default mongoose.models.MemberRequest ||
  mongoose.model("MemberRequest", memberRequestSchema); 