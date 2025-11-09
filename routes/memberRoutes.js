import express from "express";
import { requireAuth, requireAdmin } from "../middleware/authMiddleware.js";
import {
  createMember,
  getMembers,
  updateMember,
  deleteMember,
} from "../controllers/memberController.js";

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.get("/", getMembers);
router.post("/", createMember);
router.put("/:id", updateMember);
router.delete("/:id", deleteMember);

export default router;
