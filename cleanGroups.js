import mongoose from "mongoose";
import dotenv from "dotenv";
import Group from "./models/Group.js"; // adjust path if needed

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

const cleanGroups = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB Atlas...");

    // 1️⃣ Find any groups with null or empty group_name
    const badGroups = await Group.find({
      $or: [{ group_name: null }, { group_name: "" }],
    });

    if (badGroups.length > 0) {
      console.log(`Found ${badGroups.length} groups with null or empty names.`);
      await Group.deleteMany({
        _id: { $in: badGroups.map((g) => g._id) },
      });
      console.log("✅ All null/empty group_name entries cleaned up!");
    } else {
      console.log("✅ No groups with null or empty names found.");
    }

    // 2️⃣ Drop old index if it exists
    const indexes = await Group.collection.indexes();
    const oldIndex = indexes.find((idx) => idx.name === "group_name_1");
    if (oldIndex) {
      await Group.collection.dropIndex("group_name_1");
      console.log("✅ Dropped old group_name_1 index.");
    }

    // 3️⃣ Create a proper unique index
    await Group.collection.createIndex(
      { group_name: 1 },
      { unique: true } // simple unique index without partial filter
    );
    console.log("✅ Created new unique index on group_name.");

    process.exit(0);
  } catch (err) {
    console.error("Error cleaning groups:", err);
    process.exit(1);
  }
};

cleanGroups();
