import express from "express";
import {
  getMembers,
  getMemberById,
  addMember,
  updateMember,
  deleteMember,
  getGroupsWithChurches,
} from "../controllers/memberController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

// ============================
// Members Routes
// ============================
router.route("/")
  .get(protect, getMembers)
  .post(protect, addMember);

router.route("/:id")
  .get(protect, getMemberById)
  .put(protect, updateMember)
  .delete(protect, deleteMember);

// ============================
// Groups with Churches
// ============================
router.get("/groups-with-churches", protect, getGroupsWithChurches);

export default router;
