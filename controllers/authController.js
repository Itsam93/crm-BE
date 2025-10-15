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

    let role = null;

    // Match password to role
    if (password === ADMIN_PASSWORD) role = "admin";
    else if (password === VIEWER_PASSWORD) role = "viewer";
    else if (password === HEALING_HOD_PASSWORD) role = "healing_hod";
    else if (password === RHAPSODY_HOD_PASSWORD) role = "rhapsody_hod";
    else if (password === MINISTRY_HOD_PASSWORD) role = "ministry_hod";

    // If no match, reject login
    if (!role) {
      console.log("❌ Invalid password attempt");
      return res.status(401).json({ message: "Invalid password" });
    }

    // Generate JWT token
    const token = jwt.sign({ role }, JWT_SECRET, { expiresIn: "7d" });

    console.log(`✅ Login successful for role: ${role}`);

    // ✅ Always return JSON response to avoid 204
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
