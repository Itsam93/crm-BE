import express from "express";
import multer from "multer";
import {
  uploadGivingsBulk,
  addGiving,
  updateGiving,
  deleteGiving,
} from "../controllers/partnershipController.js";
import { requireAuth, requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Upload bulk givings file (Excel/CSV)
router.post("/bulk-upload", requireAuth, requireAdmin, upload.single("file"), uploadGivingsBulk);

// Add single giving
router.post("/", requireAuth, requireAdmin, addGiving);

// Update a giving
router.put("/:id", requireAuth, requireAdmin, updateGiving);

// Soft delete
router.delete("/:id", requireAuth, requireAdmin, deleteGiving);

export default router;
