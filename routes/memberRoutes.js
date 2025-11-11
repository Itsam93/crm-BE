import express from "express";
import { requireAuth, requireAdmin } from "../middleware/authMiddleware.js";
import {
  createMember,
  getMembers,
  updateMember,
  deleteMember,
  bulkUploadMembers, 
} from "../controllers/memberController.js";
import multer from "multer";

const router = express.Router();

// Middleware
router.use(requireAuth, requireAdmin);

// File upload setup
const upload = multer({ dest: "uploads/" }); 

// Routes
router.get("/", getMembers);
router.post("/", createMember);
router.put("/:id", updateMember);
router.delete("/:id", deleteMember);

// Bulk upload route
router.post("/bulk", upload.single("file"), bulkUploadMembers);

export default router;
