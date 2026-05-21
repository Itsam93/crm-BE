import express from "express";
import { requireAuth, requireRole, requireAdmin } from "../middleware/authMiddleware.js";
import { getCampaignStats, getCampaignSummary, } from "../controllers/campaignGivingController.js";

const router = express.Router();

// HOD roles
const HOD_ROLES = [
  "healing_hod",
  "rhapsody_hod",
  "ministry_hod",
  "bibles_hod",
  "innercity_hod",
  "lwpm_hod",
];

// GET /campaignGivings/stats?campaignId=xxx&category=yyy&timeframe=monthly
router.get("/stats", requireAuth, requireRole([...HOD_ROLES, "admin"]), getCampaignStats);
router.get("/summary", requireAuth, requireRole([...HOD_ROLES, "admin"]), getCampaignSummary);

export default router;