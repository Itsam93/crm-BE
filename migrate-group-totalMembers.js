// scripts/migrate-group-totalMembers.js
import mongoose from 'mongoose';
import Group from './models/Group.js';
import Church from './models/Church.js';
import dotenv from 'dotenv';

dotenv.config();

async function migrateGroupMembers() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Starting group totalMembers migration...');

  const groups = await Group.find({}).lean();

  for (const group of groups) {
    // Sum totalMembers from all churches in this group
    const total = await Church.aggregate([
      { $match: { group: group._id } },
      { $group: { _id: null, total: { $sum: "$totalMembers" } } }
    ]);

    const memberCount = total[0]?.total || 0;

    await Group.updateOne(
      { _id: group._id },
      { $set: { totalMembers: memberCount } }
    );

    console.log(`Updated ${group.group_name}: ${memberCount} members`);
  }

  console.log('Group migration completed!');
  await mongoose.disconnect();
}

migrateGroupMembers();