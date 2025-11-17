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
} from "../controllers/memberController.js";

const router = express.Router();

// Middleware
router.use(requireAuth); // All routes require authentication

// Admin-only routes
const adminOnly = [requireAdmin];

// File upload setup
const upload = multer({ dest: "uploads/" });

// Routes

// Get members (admin can see all)
router.get("/", ...adminOnly, getMembers);

// CRUD operations (admin only)
router.post("/", ...adminOnly, createMember);
router.put("/:id", ...adminOnly, updateMember);
router.delete("/:id", ...adminOnly, deleteMember);

// Bulk upload (admin only)
router.post("/bulk", ...adminOnly, upload.single("file"), bulkUploadMembers);

// Member self-update request (any authenticated member)
router.post("/:id/request-update", submitUpdateRequest);

// Admin review of update requests
router.post("/:id/review-update", ...adminOnly, reviewUpdateRequest);

export default router;
