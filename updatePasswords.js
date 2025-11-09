import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();

const client = new MongoClient(process.env.MONGO_URI);

async function updatePasswords() {
  try {
    await client.connect();
    const db = client.db("church_giving_db");
    const usersCollection = db.collection("users");

    const hods = [
      { username: "healing_hod", password: process.env.HEALING_HOD_PASSWORD },
      { username: "rhapsody_hod", password: process.env.RHAPSODY_HOD_PASSWORD },
      { username: "ministry_hod", password: process.env.MINISTRY_HOD_PASSWORD },
    ];

    for (const hod of hods) {
      const salt = await bcrypt.genSalt(10);
      const hashed = await bcrypt.hash(hod.password, salt);

      await usersCollection.updateOne(
        { username: hod.username },
        { $set: { password: hashed } }
      );

      console.log(`✅ Password hashed for: ${hod.username}`);
    }

    console.log("🎉 Password update complete!");
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

updatePasswords();
