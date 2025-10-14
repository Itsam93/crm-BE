import express from "express";
import {
  createUser,
  getUsers,
  updateUser,
  deleteUser,
} from "../controllers/adminController.js";

import { protect, superAdminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

// All routes are protected: only super_admin can manage users

// Create a new user
router.post("/users", protect, superAdminOnly, createUser);

// Get all users
router.get("/users", protect, superAdminOnly, getUsers);

// Update a user by ID
router.put("/users/:id", protect, superAdminOnly, updateUser);

// Delete a user by ID
router.delete("/users/:id", protect, superAdminOnly, deleteUser);

export default router;
