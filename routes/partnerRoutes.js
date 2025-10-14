import express from "express";
import multer from "multer";
import path from "path";
import {
  getAllPartners,
  getPartnerById,
  createPartner,
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

// Multer setup for file uploads (memory storage)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if ([".csv", ".xls", ".xlsx"].includes(ext)) cb(null, true);
    else cb(new Error("Only CSV, XLS, XLSX files are allowed"));
  },
});

// ---------------------- PROTECT ALL ROUTES ----------------------
router.use(protect);

/* ----------------- READ ROUTES ----------------- */
// list with pagination/filter/search - accessible to admin, viewer, and HODs
router.get(
  "/",
  restrictTo("Admin", "Viewer", "HealingHOD", "RhapsodyHOD", "MinistryHOD"),
  getAllPartners
);

// get single partner by id
router.get(
  "/:id",
  restrictTo("Admin", "Viewer", "HealingHOD", "RhapsodyHOD", "MinistryHOD"),
  getPartnerById
);

// get partners by arm aggregated per member (with pagination qs)
router.get(
  "/arm/:armName",
  restrictTo("Admin", "Viewer", "HealingHOD", "RhapsodyHOD", "MinistryHOD"),
  getGivingsByArm
);

// totals per member (across arms)
router.get(
  "/totals",
  restrictTo("Admin", "Viewer", "HealingHOD", "RhapsodyHOD", "MinistryHOD"),
  getTotalGivingsPerMember
);

// group summary (by group name)
router.get(
  "/summary/group/:groupName",
  restrictTo("Admin", "Viewer", "HealingHOD", "RhapsodyHOD", "MinistryHOD"),
  getGroupSummary
);

// partners by church or group (for detailed drilldowns)
router.get(
  "/by/:type/:value",
  restrictTo("Admin", "Viewer", "HealingHOD", "RhapsodyHOD", "MinistryHOD"),
  getPartnersByChurchOrGroup
);

// top givers
router.get(
  "/top/givers",
  restrictTo("Admin", "Viewer", "HealingHOD", "RhapsodyHOD", "MinistryHOD"),
  getTopGivers
);

/* ----------------- WRITE ROUTES (ADMIN ONLY) ----------------- */
// create partner
router.post("/", restrictTo("Admin"), createPartner);

// bulk upload CSV/XLSX
router.post("/upload", restrictTo("Admin"), upload.single("file"), bulkUploadPartners);

// update partner
router.put("/:id", restrictTo("Admin"), updatePartner);

// delete partner
router.delete("/:id", restrictTo("Admin"), deletePartner);

export default router;
