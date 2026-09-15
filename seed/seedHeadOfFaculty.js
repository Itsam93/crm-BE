import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/User.js";

const seedHeadOfFaculty = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is not defined");
    }

    if (!process.env.HEAD_OF_FACULTY_PASSWORD) {
      throw new Error(
        "HEAD_OF_FACULTY_PASSWORD is not defined"
      );
    }

    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB connected");

    const existingUser = await User.findOne({
      role: "head_of_faculty",
    }).lean();

    if (existingUser) {
      console.log(
        "Head of Faculty user already exists."
      );
      console.log(`Name: ${existingUser.name}`);
      console.log(`Role: ${existingUser.role}`);
      console.log(
        `Username: ${existingUser.username || "N/A"}`
      );
      console.log(
        `Active: ${existingUser.isActive}`
      );

      await mongoose.disconnect();
      return;
    }

    const username =
      process.env.HEAD_OF_FACULTY_USERNAME ||
      "head_of_faculty";

    const existingUsername =
      await User.collection.findOne({
        username,
      });

    if (existingUsername) {
      throw new Error(
        `Username "${username}" is already in use`
      );
    }

    const hashedPassword =
      await bcrypt.hash(
        process.env.HEAD_OF_FACULTY_PASSWORD,
        10
      );

    const now = new Date();

    const result =
      await User.collection.insertOne({
        name:
          process.env.HEAD_OF_FACULTY_NAME ||
          "Head of Faculty",

        username,

        password: hashedPassword,

        role: "head_of_faculty",

        isActive: true,

        createdAt: now,
        updatedAt: now,
      });

    console.log(
      "Head of Faculty user created successfully."
    );
    console.log(
      `Name: ${
        process.env.HEAD_OF_FACULTY_NAME ||
        "Head of Faculty"
      }`
    );
    console.log(`Username: ${username}`);
    console.log(
      "Role: head_of_faculty"
    );
    console.log(
      `User ID: ${result.insertedId}`
    );

    await mongoose.disconnect();
  } catch (error) {
    console.error(
      "Head of Faculty seed failed:",
      error.message
    );

    if (mongoose.connection.readyState) {
      await mongoose.disconnect();
    }

    process.exit(1);
  }
};

seedHeadOfFaculty();