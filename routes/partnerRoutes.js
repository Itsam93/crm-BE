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
  restrictTo("admin", "viewer", "healinghod", "rhapsodyhod", "ministryhod"),
  getAllPartners
);

// get single partner by id
router.get(
  "/:id",
  restrictTo("admin", "viewer", "healinghod", "rhapsodyhod", "ministryhod"),
  getPartnerById
);

// get partners by arm aggregated per member (with pagination qs)
router.get(
  "/arm/:armName",
  restrictTo("admin", "viewer", "healinghod", "rhapsodyhod", "ministryhod"),
  getGivingsByArm
);

// totals per member (across arms)
router.get(
  "/totals",
  restrictTo("admin", "viewer", "healinghod", "rhapsodyhod", "ministryhod"),
  getTotalGivingsPerMember
);

// group summary (by group name)
router.get(
  "/summary/group/:groupName",
  restrictTo("admin", "viewer", "healinghod", "rhapsodyhod", "ministryhod"),
  getGroupSummary
);

// partners by church or group (for detailed drilldowns)
router.get(
  "/by/:type/:value",
  restrictTo("admin", "viewer", "healinghod", "rhapsodyhod", "ministryhod"),
  getPartnersByChurchOrGroup
);

// top givers
router.get(
  "/top/givers",
  restrictTo("admin", "viewer", "healinghod", "rhapsodyhod", "ministryhod"),
  getTopGivers
);

/* ----------------- WRITE ROUTES (ADMIN ONLY) ----------------- */
// create partner
router.post("/", restrictTo("admin"), createPartner);

// bulk upload CSV/XLSX
router.post("/upload", restrictTo("admin"), upload.single("file"), bulkUploadPartners);

// update partner
router.put("/:id", restrictTo("admin"), updatePartner);

// delete partner
router.delete("/:id", restrictTo("admin"), deletePartner);

export default router;
