import mongoose from "mongoose";

const connectDB = async (mongoUri) => {
  try {
    const conn = await mongoose.connect(mongoUri, {
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    process.exit(1);
  }
};

export default connectDB;
