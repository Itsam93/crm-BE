import mongoose from "mongoose";
import Church from "./models/Church.js";

const MONGO_URI = "your-atlas-uri-here";

async function sync() {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Connected to MongoDB");

    const result = await Church.syncIndexes();
    console.log("🔄 Indexes synced:", result);

  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected");
  }
}

sync();