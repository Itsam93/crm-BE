import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

async function seedHODs() {
  try {
    await client.connect();
    console.log("✅ Connected to MongoDB");

    const db = client.db("church_giving_db");
    const usersCollection = db.collection("users");

    await usersCollection.deleteMany({ $or: [{ email: null }, { username: null }] });

    const hods = [
      {
        username: "healing_hod",
        email: "healing@church.com",
        role: "healing_hod",
        password: process.env.HEALING_HOD_PASSWORD,
      },
      {
        username: "rhapsody_hod",
        email: "rhapsody@church.com",
        role: "rhapsody_hod",
        password: process.env.RHAPSODY_HOD_PASSWORD,
      },
      {
        username: "ministry_hod",
        email: "ministry@church.com",
        role: "ministry_hod",
        password: process.env.MINISTRY_HOD_PASSWORD,
      },
    ];

    for (const hod of hods) {
      // Check if HOD already exists
      const existing = await usersCollection.findOne({
        $or: [{ username: hod.username }, { email: hod.email }],
      });

      if (existing) {
        console.log(`⚠️ HOD already exists: ${hod.username}`);
        continue; // Skip duplicates
      }

      // Hash the password
      const salt = await bcrypt.genSalt(10);
      hod.password = await bcrypt.hash(hod.password, salt);

      await usersCollection.insertOne(hod);
      console.log(`✅ HOD seeded: ${hod.username}`);
    }

    console.log("🎉 Seeding complete!");
  } catch (err) {
    console.error("❌ Seeding error:", err);
  } finally {
    await client.close();
  }
}

seedHODs();
