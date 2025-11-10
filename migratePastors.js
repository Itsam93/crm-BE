import mongoose from "mongoose";
import Group from "./models/Group.js";
import User from "./models/User.js"; // your user model

const MONGO_URI = "mongodb+srv://samogleks:Iloveupeamune97@cluster0.7ruzuit.mongodb.net/church_giving_db?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI);

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const migratePastors = async () => {
  try {
    const groups = await Group.find();

    for (const group of groups) {
      // Only try to fetch the user if pastor is a valid ObjectId
      if (group.pastor && isValidObjectId(group.pastor)) {
        const user = await User.findById(group.pastor);
        group.pastor = user
          ? user.full_name || user.name || user.email || "Unknown"
          : "Unknown";
        await group.save();
      } else {
        // pastor is already a string or empty
        group.pastor = group.pastor || "Not assigned";
        await group.save();
      }
    }

    console.log("Migration complete!");
    mongoose.disconnect();
  } catch (err) {
    console.error(err);
    mongoose.disconnect();
  }
};

migratePastors();
