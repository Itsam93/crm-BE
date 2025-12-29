import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const loginUser = async (req, res) => {
  const { role, password } = req.body;

  if (!role || !password) {
    return res.status(400).json({ message: "Role and password are required" });
  }

  try {
    // ============================
    // ADMIN LOGIN (ENV-based)
    // ============================
    if (role === "admin") {
      if (password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const token = jwt.sign(
        { role: "admin", type: "system" },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      return res.status(200).json({
        success: true,
        role: "admin",
        token,
        userId: "admin-system" 
      });
    }

    // ============================
    // HOD LOGIN (DATABASE-based)
    // ============================
    const allowedHODRoles = ["healing_hod", "rhapsody_hod", "ministry_hod"];
    if (!allowedHODRoles.includes(role)) {
      return res.status(404).json({ message: "Role not found" });
    }

    const user = await User.findOne({ role }).select("+password");

    if (!user) {
      return res.status(404).json({ message: "HOD user not found" });
    }

    const passwordMatch = await user.matchPassword(password);
    if (!passwordMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        type: "hod"
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      success: true,
      role: user.role,
      token,
      userId: user._id
    });

  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
