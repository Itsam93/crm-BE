import mongoose from "mongoose";
import dotenv from "dotenv";
import Group from "./models/Group.js"; // ✅ make sure this path is correct (case-sensitive on Linux)

dotenv.config(); // ✅ ensures .env is loaded

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("❌ MONGO_URI not found in environment variables");
  process.exit(1);
}

mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log("✅ Connected to MongoDB Atlas...");

    const indexes = await Group.collection.getIndexes();
    console.log("Existing indexes:", indexes);

    // Drop any old unique index on group_name if it exists
    try {
      await Group.collection.dropIndex("group_name_1");
      console.log("✅ Dropped old index on group_name");
    } catch (err) {
      console.log("ℹ️ No existing index to drop or already removed.");
    }

    // Create a new case-insensitive unique index
    await Group.collection.createIndex(
      { group_name: 1 },
      { unique: true, collation: { locale: "en", strength: 2 } }
    );

    console.log("✅ Created new case-insensitive unique index on group_name");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Error fixing index:", err);
    process.exit(1);
  });
