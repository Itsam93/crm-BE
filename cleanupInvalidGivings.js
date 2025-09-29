import mongoose from "mongoose";
import dotenv from "dotenv";
import Giving from "./models/Giving.js";
import Partnership from "./models/Partnership.js";

dotenv.config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection failed:", err);
    process.exit(1);
  }
};

const cleanupGivings = async () => {
  try {
    // Get all valid partnership IDs
    const validPartnerships = await Partnership.find({}, "_id");
    const validIds = validPartnerships.map((p) => p._id.toString());

    // Delete givings with invalid or missing partnershipArm
    const result = await Giving.deleteMany({
      $or: [
        { partnershipArm: { $exists: false } },
        { partnershipArm: { $nin: validIds } },
      ],
    });

    console.log(`Deleted ${result.deletedCount} invalid givings.`);
  } catch (err) {
    console.error("Error cleaning up givings:", err);
  } finally {
    mongoose.disconnect();
  }
};

// Run
const run = async () => {
  await connectDB();
  await cleanupGivings();
};

run();
