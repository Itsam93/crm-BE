import express from "express";
import { requireAuth, requireAdmin } from "../middleware/authMiddleware.js";
import multer from "multer";
import {
  createMember,
  getMembers,
  updateMember,
  deleteMember,
  bulkUploadMembers,
  bulkUpdateMembers, 
  submitUpdateRequest,
  reviewUpdateRequest,
  getMemberProfile,
  searchMembers,
  getUpcomingAnniversaries,
  getMembersByChurch,
} from "../controllers/memberController.js";

const router = express.Router();

// ============================================================
// 🔐 Middleware
// ============================================================
router.use(requireAuth); // All routes require authentication
const adminOnly = [requireAdmin];

// ============================================================
// 📤 File upload setup
// ============================================================
const upload = multer({ dest: "uploads/" });

// ============================================================
// 🔍 SEARCH
// ============================================================
router.get("/search", searchMembers);

// ============================================================
// 📋 MEMBERS LIST
// ============================================================
router.get("/", getMembers);

// ============================================================
// ⛪ MEMBERS BY CHURCH
// ============================================================
router.get("/church/:churchId", getMembersByChurch);

// ============================================================
// ➕➖ CRUD (admin only)
// ============================================================
router.post("/", ...adminOnly, createMember);

// 🔹 ✅ Bulk update (group / church changes)
router.put(
  "/bulk-update",
  ...adminOnly,
  bulkUpdateMembers
);


router.put("/:id", ...adminOnly, updateMember);
router.delete("/:id", ...adminOnly, deleteMember);

// ============================================================
// 📦 BULK OPERATIONS (admin only)
// ============================================================

// 🔹 Bulk upload (Excel)
router.post(
  "/bulk",
  ...adminOnly,
  upload.single("file"),
  bulkUploadMembers
);


// ============================================================
// 📝 MEMBER UPDATE REQUESTS
// ============================================================
router.post("/:id/request-update", submitUpdateRequest);
router.post("/:id/review-update", ...adminOnly, reviewUpdateRequest);

// ============================================================
// 👤 MEMBER PROFILE
// ============================================================
router.get("/:id/profile", getMemberProfile);

// ============================================================
// 💍 ANNIVERSARIES (admin only)
// ============================================================
router.get(
  "/upcoming-anniversaries",
  ...adminOnly,
  getUpcomingAnniversaries
);

export default router;