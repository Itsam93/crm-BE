import express from "express";
import multer from "multer";
import {
  addGiving,
  getGivings,
  updateGiving,
  deleteGiving,
  bulkUploadGivings,
  restoreGiving,
  getReports,
} from "../controllers/givingController.js";
import { requireAuth, requireAdmin, requireRole } from "../middleware/authMiddleware.js";

const router = express.Router();
const upload = multer();

// Define HOD roles
const HOD_ROLES = ["healing_hod", "rhapsody_hod", "ministry_hod", "bibles_hod", "innercity_hod", "lwpm_hod"];

// Public givings routes for HODs and Admin
router.get("/", requireAuth, requireRole([...HOD_ROLES, "admin"]), getGivings);
router.get("/reports", requireAuth, requireRole([...HOD_ROLES, "admin"]), getReports);

// Admin-only CRUD routes
router.post("/", requireAuth, requireAdmin, addGiving);
router.put("/:id", requireAuth, requireAdmin, updateGiving);
router.put("/:id/restore", requireAuth, requireAdmin, restoreGiving);
router.delete("/:id", requireAuth, requireAdmin, deleteGiving);

// Admin-only bulk upload
router.post("/upload", requireAuth, requireAdmin, upload.single("file"), bulkUploadGivings);

export default router;
