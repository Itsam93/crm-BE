import User from "../models/User.js";

export const getUsers = async (req, res) => {
  try {
    const { role } = req.query; 

    const query = { isActive: true };
    if (role) query.role = role;

    const users = await User.find(query).select("name email role");

    res.status(200).json(users);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ message: "Error fetching users" });
  }
};
