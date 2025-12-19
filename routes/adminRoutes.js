import express from "express";
import {
  getGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  getAdminSummary,
  getUpcomingBirthdays,
  getRecentGivings,
  getTopPartners,
  getGivingsTrend,          // ✅ new
  getPartnersTrend,         // ✅ new
  getCumulativePartnership, // ✅ new
} from "../controllers/adminController.js";

import churchRoutes from "./churchRoutes.js";
import { requireAuth, requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// All admin routes are protected
router.use(requireAuth, requireAdmin);

// ===== Admin Dashboard =====
router.get("/summary", getAdminSummary);

// Upcoming Birthdays
router.get("/upcoming-birthdays", getUpcomingBirthdays);

// Recent Givings
router.get("/recent-givings", getRecentGivings);

// Top Partners
router.get("/top-partners", getTopPartners);

// ===== Trend Analysis =====
router.get("/givings-trend", getGivingsTrend);               // ?period=daily|weekly|monthly|quarterly
router.get("/partners-trend", getPartnersTrend);             // ?period=daily|weekly|monthly|quarterly
router.get("/cumulative-partnership", getCumulativePartnership); 

// ===== Group Routes =====
router.get("/groups", getGroups);
router.post("/groups", createGroup);
router.put("/groups/:id", updateGroup);
router.delete("/groups/:id", deleteGroup);

// ===== Church Routes =====
router.use("/churches", churchRoutes);

export default router;
