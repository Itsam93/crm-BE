import jwt from "jsonwebtoken";

export const loginUser = async (req, res) => {
  try {
    const { password } = req.body;

    const {
      ADMIN_PASSWORD,
      VIEWER_PASSWORD,
      HEALING_HOD_PASSWORD,
      RHAPSODY_HOD_PASSWORD,
      MINISTRY_HOD_PASSWORD,
      JWT_SECRET,
    } = process.env;

    if (!password) {
      console.log("❌ No password provided");
      return res.status(400).json({ message: "Password is required" });
    }

    // Map passwords to roles using PascalCase to match frontend armMap
    const roleMap = {
      [ADMIN_PASSWORD]: "Admin",
      [VIEWER_PASSWORD]: "Viewer",
      [HEALING_HOD_PASSWORD]: "HealingHOD",
      [RHAPSODY_HOD_PASSWORD]: "RhapsodyHOD",
      [MINISTRY_HOD_PASSWORD]: "MinistryHOD",
    };

    const role = roleMap[password];

    if (!role) {
      console.log("❌ Invalid password attempt");
      return res.status(401).json({ message: "Invalid password" });
    }

    // Generate JWT token with role
    const token = jwt.sign({ role }, JWT_SECRET, { expiresIn: "7d" });

    console.log(`✅ Login successful for role: ${role}`);

    return res.status(200).json({
      message: "Login successful",
      role,
      token,
    });
  } catch (error) {
    console.error("💥 Login error:", error);
    return res.status(500).json({ message: "Error during login" });
  }
};
