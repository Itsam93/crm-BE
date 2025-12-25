import express from "express";
import {
  getGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  getAdminSummary,
  getUpcomingBirthdays,
  getUpcomingAnniversaries,
  getRecentGivings,
  getTopPartners,
  getGivingsTrend,          
  getPartnersTrend,         
  getCumulativePartnership, 
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

// Upcoming Wedding Anniversaries
router.get("/upcoming-anniversaries", getUpcomingAnniversaries);

// Recent Givings
router.get("/recent-givings", getRecentGivings);

// Top Partners
router.get("/top-partners", getTopPartners);

// ===== Trend Analysis =====
router.get("/givings-trend", getGivingsTrend);               
router.get("/partners-trend", getPartnersTrend);             
router.get("/cumulative-partnership", getCumulativePartnership); 

// ===== Group Routes =====
router.get("/groups", getGroups);
router.post("/groups", createGroup);
router.put("/groups/:id", updateGroup);
router.delete("/groups/:id", deleteGroup);

// ===== Church Routes =====
router.use("/churches", churchRoutes);

export default router;
