// scripts/migrate-church-totalMembers.js
import mongoose from 'mongoose';
import Church from './models/Church.js';
import Member from './models/Member.js';
import dotenv from 'dotenv';

dotenv.config();

async function migrateChurchMembers() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log('Starting church totalMembers migration...');

    // Find all churches
    const churches = await Church.find({}).lean();

    for (const church of churches) {
      // Count active members in this church
      const count = await Member.countDocuments({
        church: church._id,
        deleted: { $ne: true }, // if you have deleted flag
      });

      // Update church
      await Church.updateOne(
        { _id: church._id },
        { $set: { totalMembers: count } }
      );

      console.log(`Updated ${church.name}: ${count} members`);
    }

    console.log('Migration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await mongoose.disconnect();
  }
}

migrateChurchMembers();