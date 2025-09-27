import asyncHandler from "express-async-handler";
import User from "../models/User.js";
import generateToken from "../utils/generateToken.js";


export const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  console.log("🔍 Login attempt:", { username, password });

  if (!username || !password) {
    res.status(400);
    console.error("❌ Missing username or password");
    throw new Error("Please provide username and password");
  }

  const user = await User.findOne({ username });
  console.log("🔍 User found in DB:", user?.username);

  if (user) {
    const match = await user.matchPassword(password);
    console.log("🔑 Password match result:", match);

    if (match) {
      const token = generateToken({ id: user._id }, process.env.JWT_SECRET);
      console.log("✅ Login successful, token generated");
      return res.json({
        token,
        user: { id: user._id, username: user.username, role: user.role },
      });
    }
  }

  console.error("❌ Invalid username or password");
  res.status(401);
  throw new Error("Invalid username or password");
});

export const getProfile = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user) {
    console.error("❌ Not authorized");
    res.status(401);
    throw new Error("Not authorized");
  }
  console.log("ℹ️ Fetched user profile:", user.username);
  res.json({ id: user._id, username: user.username, role: user.role });
});
