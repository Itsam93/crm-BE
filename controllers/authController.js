import jwt from "jsonwebtoken";

// Load environment variables from .env
const {
  ADMIN_PASSWORD,
  VIEWER_PASSWORD,
  HEALING_HOD_PASSWORD,
  RHAPSODY_HOD_PASSWORD,
  MINISTRY_HOD_PASSWORD,
  JWT_SECRET,
} = process.env;

// POST /api/auth/login
export const loginUser = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
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
      return res.status(401).json({ message: "Invalid password" });
    }

    // Generate JWT token
    const token = jwt.sign({ role }, JWT_SECRET, { expiresIn: "7d" });

    res.status(200).json({
      message: "Login successful",
      role,
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Error during login" });
  }
};
