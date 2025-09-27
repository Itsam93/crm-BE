import express from "express";
import {
  getMembers,
  addMember,
  updateMember,
  deleteMember,
} from "../controllers/memberController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.route("/").get(protect, getMembers).post(protect, addMember);
router.route("/:id").put(protect, updateMember).delete(protect, deleteMember);

export default router;
