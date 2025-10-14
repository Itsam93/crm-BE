import express from "express";
import {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
} from "../controllers/userController.js";
import { protect, superAdminOnly } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Protect all routes
router.use(protect);

// Super Admin-only routes
router.get("/", superAdminOnly, getUsers);          
router.get("/:id", superAdminOnly, getUser);        
router.post("/", superAdminOnly, createUser);    
router.put("/:id", superAdminOnly, updateUser);    
router.delete("/:id", superAdminOnly, deleteUser);  

export default router;
