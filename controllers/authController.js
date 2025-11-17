import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const uri = process.env.MONGO_URI;

// ----------------------------
// LOGIN CONTROLLER
// ----------------------------
export const loginUser = async (req, res) => {
  const { role, password } = req.body;

  if (!role || !password || password.trim() === "") {
    return res.status(400).json({ message: "Role and password are required" });
  }

  const { ADMIN_PASSWORD, VIEWER_PASSWORD, JWT_SECRET } = process.env;
  if (!JWT_SECRET) {
    return res.status(500).json({ message: "Server configuration error: Missing JWT_SECRET" });
  }

  try {
    // Admin / Viewer login
    const envPasswordMap = { admin: ADMIN_PASSWORD, viewer: VIEWER_PASSWORD };
    if (Object.keys(envPasswordMap).includes(role)) {
      if (password.trim() !== envPasswordMap[role]) {
        return res.status(401).json({ message: "Incorrect password for the selected role" });
      }

      const userId = uuidv4();
      const token = jwt.sign({ id: userId, role }, JWT_SECRET, { expiresIn: "7d" });

      return res.status(200).json({
        success: true,
        message: "Login successful",
        role,
        token,
        userId,
      });
    }

    // HOD login (MongoDB)
    const client = new MongoClient(uri);
    try {
      await client.connect();
      const db = client.db("church_giving_db");
      const usersCollection = db.collection("users");

      const hodUser = await usersCollection.findOne({ username: role });
      if (!hodUser) return res.status(404).json({ message: "User not found" });

      const isMatch = await bcrypt.compare(password.trim(), hodUser.password);
      if (!isMatch) return res.status(401).json({ message: "Incorrect password for the selected role" });

      const token = jwt.sign({ id: hodUser._id.toString(), role: hodUser.role }, JWT_SECRET, { expiresIn: "7d" });

      return res.status(200).json({
        success: true,
        message: "Login successful",
        role: hodUser.role,
        token,
        userId: hodUser._id.toString(),
      });
    } finally {
      await client.close();
    }
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// ----------------------------
// VERIFY USER CONTROLLER
// ----------------------------
export const verifyUser = async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  const { JWT_SECRET, ADMIN_PASSWORD, VIEWER_PASSWORD } = process.env;

  if (!token) return res.status(401).json({ message: "No token provided" });
  if (!JWT_SECRET) return res.status(500).json({ message: "Server configuration error: Missing JWT_SECRET" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Env-based users (Admin/Viewer) validation
    if (decoded.role === "admin" || decoded.role === "viewer") {
      return res.status(200).json({ user: { id: decoded.id, role: decoded.role } });
    }

    // HOD user validation in MongoDB
    const client = new MongoClient(uri);
    try {
      await client.connect();
      const db = client.db("church_giving_db");
      const usersCollection = db.collection("users");

      const hodUser = await usersCollection.findOne({ _id: new ObjectId(decoded.id) });
      if (!hodUser) return res.status(404).json({ message: "User not found" });

      return res.status(200).json({ user: { id: hodUser._id.toString(), role: hodUser.role } });
    } finally {
      await client.close();
    }
  } catch (err) {
    console.error("Verify user error:", err);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
