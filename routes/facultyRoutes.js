import express from "express";

import {
  getDashboard,
  getFinancialRecords,
  getFinancialIndividuals,
  getFinancialChurches,
  getFinancialGroups,
  getCampaigns,
  getCampaignSummary,
  getCampaignMembers,
  getCampaignChurches,
  getCampaignGroups,
} from "../controllers/facultyController.js";

import {
  requireAuth,
  requireHeadOfFaculty,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(
  requireAuth,
  requireHeadOfFaculty
);

router.get(
  "/dashboard",
  getDashboard
);

router.get(
  "/financial-records/individuals",
  getFinancialIndividuals
);

router.get(
  "/financial-records/churches",
  getFinancialChurches
);

router.get(
  "/financial-records/groups",
  getFinancialGroups
);

router.get(
  "/financial-records",
  getFinancialRecords
);

router.get(
  "/campaigns",
  getCampaigns
);

router.get(
  "/campaigns/:campaignId/summary",
  getCampaignSummary
);

router.get(
  "/campaigns/:campaignId/members",
  getCampaignMembers
);

router.get(
  "/campaigns/:campaignId/churches",
  getCampaignChurches
);

router.get(
  "/campaigns/:campaignId/groups",
  getCampaignGroups
);

export default router;
