import express from "express";
import {
  getMembers,
  getMemberById,
  addMember,
  updateMember,
  deleteMember,
} from "../controllers/memberController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Get all members / Add new member
router.route("/").get(protect, getMembers).post(protect, addMember);

// Get single member / Update member / Delete member
router
  .route("/:id")
  .get(protect, getMemberById)   
  .put(protect, updateMember)
  .delete(protect, deleteMember);

export default router;
