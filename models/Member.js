import mongoose from "mongoose";

const memberSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String },
    birthday: { type: Date },
    kingschatId: { type: String },
    group: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
    church: { type: mongoose.Schema.Types.ObjectId, ref: "Church", required: true },
    hod: { type: mongoose.Schema.Types.ObjectId, ref: "Hod" }, // new field
    deleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("Member", memberSchema);
