// dropChurchIndex.js
import mongoose from "mongoose";

const MONGO_URI = "mongodb+srv://samogleks:Iloveupeamune97@cluster0.7ruzuit.mongodb.net/church_giving_db?retryWrites=true&w=majority";

async function dropIndex() {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("✅ Connected to MongoDB");

    const db = mongoose.connection.db;

    // Drop the broken index
    const result = await db.collection("churches").dropIndex("church_name_1_group_id_1");
    console.log("🗑️ Dropped index:", result);

    // Show remaining indexes
    const indexes = await db.collection("churches").indexes();
    console.log("📌 Remaining indexes:", indexes);
  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected");
  }
}

dropIndex();
