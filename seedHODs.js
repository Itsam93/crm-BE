import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

const HODS = [
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
  {
    username: "bibles_hod",
    email: "bibles@church.com",
    role: "bibles_hod",
    password: process.env.BIBLES_HOD_PASSWORD,
  },
  {
    username: "innercity_hod",
    email: "innercity@church.com",
    role: "innercity_hod",
    password: process.env.INNERCITY_HOD_PASSWORD,
  },
  {
    username: "lwpm_hod",
    email: "lwpm@church.com",
    role: "lwpm_hod",
    password: process.env.LWPM_HOD_PASSWORD,
  },
];

async function seedHODs() {
  try {
    await client.connect();
    console.log("✅ Connected to MongoDB");

    const db = client.db("church_giving_db");
    const usersCollection = db.collection("users");

    for (const hod of HODS) {
      if (!hod.password) {
        console.warn(`⚠️ Missing password for ${hod.username}`);
        continue;
      }

      const hashedPassword = await bcrypt.hash(hod.password, 10);

      const result = await usersCollection.updateOne(
        { role: hod.role },
        {
          $set: {
            username: hod.username,
            email: hod.email,
            role: hod.role,
            password: hashedPassword,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        { upsert: true }
      );

      if (result.upsertedCount > 0) {
        console.log(`✅ Created HOD: ${hod.username}`);
      } else {
        console.log(`🔁 Updated password for: ${hod.username}`);
      }
    }

    console.log("🎉 HOD seeding & password update complete");
  } catch (error) {
    console.error("❌ Error seeding HODs:", error);
  } finally {
    await client.close();
  }
}

seedHODs();
