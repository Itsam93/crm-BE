import express from "express";
import multer from "multer";
import path from "path";
import {
  getAllPartners,
  getPartnerById,
  addGiving, 
  updatePartner,
  deletePartner,
  bulkUploadPartners,
  getGivingsByArm,
  getTotalGivingsPerMember,
  getGroupSummary,
  getTopGivers,
  getPartnersByChurchOrGroup,
} from "../controllers/partnerController.js";

import { protect, restrictTo } from "../middleware/authMiddleware.js";

const router = express.Router();

// ---------------------- MULTER CONFIG ----------------------
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, 
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if ([".csv", ".xls", ".xlsx"].includes(ext)) cb(null, true);
    else cb(new Error("Only CSV, XLS, XLSX files are allowed"));
  },
});

// ---------------------- PROTECT ALL ROUTES ----------------------
router.use(protect);

/* ---------------------- READ ROUTES ---------------------- */

// Total givings per member (across all arms)
router.get(
  "/totals",
  restrictTo("admin", "viewer", "healinghod", "rhapsodyhod", "ministryhod"),
  getTotalGivingsPerMember
);

// Top givers overall
router.get(
  "/top/givers",
  restrictTo("admin", "viewer", "healinghod", "rhapsodyhod", "ministryhod"),
  getTopGivers
);

// Group summary (by group name)
router.get(
  "/summary/group/:groupName",
  restrictTo("admin", "viewer", "healinghod", "rhapsodyhod", "ministryhod"),
  getGroupSummary
);

// Partners by church or group (for filtering)
router.get(
  "/by/:type/:value",
  restrictTo("admin", "viewer", "healinghod", "rhapsodyhod", "ministryhod"),
  getPartnersByChurchOrGroup
);

// Get givings by partnership arm
router.get(
  "/arm/:armName",
  restrictTo("admin", "viewer", "healinghod", "rhapsodyhod", "ministryhod"),
  getGivingsByArm
);

// List all records (with pagination/filter/search)
router.get(
  "/",
  restrictTo("admin", "viewer", "healinghod", "rhapsodyhod", "ministryhod"),
  getAllPartners
);

// Get single record by ID (keep last)
router.get(
  "/:id",
  restrictTo("admin", "viewer", "healinghod", "rhapsodyhod", "ministryhod"),
  getPartnerById
);

/* ---------------------- WRITE ROUTES (ADMIN ONLY) ---------------------- */

// ✅ Add new giving (formerly createPartner)
router.post("/", restrictTo("admin"), addGiving);

// Bulk upload
router.post("/upload", upload.single("file"), restrictTo("admin"), bulkUploadPartners);

// Update giving/partner
router.put("/:id", restrictTo("admin"), updatePartner);

// Delete giving/partner
router.delete("/:id", restrictTo("admin"), deletePartner);

export default router;
