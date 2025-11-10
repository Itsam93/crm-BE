import express from "express";
import {
  getChurches,
  createChurch,
  updateChurch,
  deleteChurch,
  getChurchesByGroup, 
} from "../controllers/churchController.js";
import { requireAuth, requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// All church routes are protected by auth and admin
router.use(requireAuth, requireAdmin);

// ===== Church Routes =====
router.get("/", getChurches);                   
router.get("/group/:groupId", getChurchesByGroup); 
router.post("/", createChurch);                 
router.put("/:id", updateChurch);              
router.delete("/:id", deleteChurch);           

export default router;
