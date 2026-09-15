import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const USER_ROLES = [
  "admin",
  "head_of_faculty",
  "healing_hod",
  "rhapsody_hod",
  "ministry_hod",
  "bibles_hod",
  "innercity_hod",
  "lwpm_hod",
];

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    role: {
      type: String,
      enum: USER_ROLES,
      required: true,
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);

  this.password = await bcrypt.hash(
    this.password,
    salt
  );

  next();
});

userSchema.methods.matchPassword = async function (
  enteredPassword
) {
  return bcrypt.compare(
    enteredPassword,
    this.password
  );
};

export { USER_ROLES };

export default mongoose.models.User ||
  mongoose.model("User", userSchema);