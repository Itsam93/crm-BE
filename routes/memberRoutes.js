import express from "express";
import { requireAuth, requireAdmin } from "../middleware/authMiddleware.js";
import multer from "multer";
import {
  createMember,
  getMembers,
  updateMember,
  deleteMember,
  bulkUploadMembers,
  submitUpdateRequest,
  reviewUpdateRequest,
  getMemberProfile,
  searchMembers,
  getUpcomingAnniversaries,
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
router.get("/search", (req, res, next) => {
   next();
}, searchMembers);


// ============================================================
// 📋 MEMBERS LIST (admin only)
// ============================================================
router.get("/", getMembers);

// ============================================================
// ➕➖ CRUD (admin only)
// ============================================================
router.post("/", ...adminOnly, createMember);
router.put("/:id", ...adminOnly, updateMember);
router.delete("/:id", ...adminOnly, deleteMember);

// ============================================================
// 📦 BULK UPLOAD (admin only)
// ============================================================
router.post(
  "/bulk",
  ...adminOnly,
  upload.single("file"),
  bulkUploadMembers
);

// ============================================================
// MEMBER UPDATE REQUESTS
// ============================================================
router.post("/:id/request-update", submitUpdateRequest);
router.post("/:id/review-update", ...adminOnly, reviewUpdateRequest);

// ============================================================
// 👤 MEMBER PROFILE (admin only)
// ============================================================
router.get("/:id/profile", getMemberProfile);

// Upcoming wedding anniversaries (admin only)
router.get("/upcoming-anniversaries", ...adminOnly, getUpcomingAnniversaries);


export default router;
