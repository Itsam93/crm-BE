import express from "express";
import {
  getCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  getCampaignStats,
  getCampaignById,
  getCampaignReport,
  getCampaignsWithCategories,
  getCampaignMemberReport,
  getAdvancedCampaignReport,
  assignMembersToCampaign,
  getCampaignParticipation,
  getChurchMembersByCampaign,
  getHodDashboard // ✅ NEW
} from "../controllers/campaignController.js";

import { requireAuth, requireAdmin } from "../middleware/authMiddleware.js";

// ─────────────────────────────────────────────
// STARTUP LOGS
// ─────────────────────────────────────────────
console.log("=================================================================");
console.log("🚀 campaignRoutes.js LOADED at", new Date().toISOString());
console.log("Mount point expected: /api/campaigns/*");
console.log("Registered routes:");
console.log("  GET    / → getCampaigns");
console.log("  GET    /with-categories → getCampaignsWithCategories");
console.log("  GET    /stats → getCampaignStats");
console.log("  GET    /report/advanced → getAdvancedCampaignReport");
console.log("  GET    /hod-dashboard → getHodDashboard 🔥 NEW");
console.log("  GET    /participation/:campaignId → getCampaignParticipation");
console.log("  GET    /:campaignId/church/:churchId → getChurchMembersByCampaign");
console.log("  POST   /assign → assignMembersToCampaign");
console.log("  GET    /:id/members → getCampaignMemberReport");
console.log("  GET    /:id → getCampaignById");
console.log("  GET    /:id/report → getCampaignReport");
console.log("  POST   / → createCampaign (admin)");
console.log("  PATCH  /:id → updateCampaign (admin)");
console.log("  DELETE /:id → deleteCampaign (admin)");
console.log("=================================================================");

const router = express.Router();

// ─────────────────────────────────────────────
// GLOBAL REQUEST LOGGER
// ─────────────────────────────────────────────
router.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method.padEnd(6);
  const path = req.originalUrl;
  const userId = req.user ? req.user._id || req.user.id : "anonymous";
  const bodySize = req.body ? Object.keys(req.body).length : 0;

  console.log(`[${timestamp}] ${method} ${path}`);
  console.log(`   • User: ${userId}`);
  console.log(`   • Body keys: ${bodySize}`);
  if (bodySize > 0 && req.method !== "GET") {
    console.log(
      `   • Body sample:`,
      JSON.stringify(req.body, null, 2).slice(0, 300) +
        (JSON.stringify(req.body).length > 300 ? "..." : "")
    );
  }
  console.log("───────────────────────────────────────");

  next();
});

// ─────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────

// ✅ STATIC ROUTES FIRST
router.get("/", requireAuth, getCampaigns);
router.get("/with-categories", requireAuth, getCampaignsWithCategories);
router.get("/stats", requireAuth, getCampaignStats);

// 🔥 HOD DASHBOARD (AUTO-SCOPED — NO CAMPAIGN SELECTOR)
router.get("/hod-dashboard", requireAuth, getHodDashboard);

// ✅ ADVANCED REPORT (manual access if needed)
router.get("/report/advanced", requireAuth, getAdvancedCampaignReport);

// OTHER SPECIFIC ROUTES
router.get("/participation/:campaignId", requireAuth, getCampaignParticipation);
router.get("/:campaignId/church/:churchId", requireAuth, getChurchMembersByCampaign);
router.post("/assign", requireAuth, requireAdmin, assignMembersToCampaign);

// 👇 STILL SAFE (more specific than :id)
router.get("/:id/members", requireAuth, getCampaignMemberReport);

// ❗ ALWAYS LAST (dynamic routes)
router.get("/:id", requireAuth, getCampaignById);
router.get("/:id/report", requireAuth, getCampaignReport);

// ADMIN
router.post("/", requireAuth, requireAdmin, createCampaign);
router.patch("/:id", requireAuth, requireAdmin, updateCampaign);
router.delete("/:id", requireAuth, requireAdmin, deleteCampaign);

export default router;