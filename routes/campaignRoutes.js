import express from "express";

import {
  create,
  getAll,
  getOne,
  update,
  activate,
  close,
  remove,
  createCampaignPledge,
  getPledge,
  getMemberPledge,
  getPledges,
  updateCampaignPledge,
  removeCampaignPledge,
  summary,
  memberReport,
  churchReport,
  groupReport,
} from "../controllers/campaignController.js";

import { requireAuth } from "../middleware/authMiddleware.js";

import {
  requireCampaignAdmin,
  requireCampaignReadAccess,
  requireCampaignWriteAccess,
  requireCampaignArmAccess,
  requirePledgeArmAccess,
  applyCampaignArmFilter,
} from "../middleware/campaignMiddleware.js";

const router = express.Router();

router.use(requireAuth);

router.post(
  "/",
  requireCampaignAdmin,
  create
);

router.get(
  "/",
  requireCampaignReadAccess,
  applyCampaignArmFilter,
  getAll
);

router.get(
  "/:campaignId",
  requireCampaignReadAccess,
  requireCampaignArmAccess,
  getOne
);

router.patch(
  "/:campaignId",
  requireCampaignAdmin,
  update
);

router.patch(
  "/:campaignId/activate",
  requireCampaignAdmin,
  activate
);

router.patch(
  "/:campaignId/close",
  requireCampaignAdmin,
  close
);

router.delete(
  "/:campaignId",
  requireCampaignAdmin,
  remove
);

router.post(
  "/:campaignId/pledges",
  requireCampaignWriteAccess,
  requireCampaignArmAccess,
  createCampaignPledge
);

router.get(
  "/:campaignId/pledges",
  requireCampaignReadAccess,
  requireCampaignArmAccess,
  getPledges
);

router.get(
  "/:campaignId/pledges/member/:memberId",
  requireCampaignReadAccess,
  requireCampaignArmAccess,
  getMemberPledge
);

router.get(
  "/pledges/:pledgeId",
  requireCampaignReadAccess,
  requirePledgeArmAccess,
  getPledge
);

router.patch(
  "/pledges/:pledgeId",
  requireCampaignWriteAccess,
  requirePledgeArmAccess,
  updateCampaignPledge
);

router.delete(
  "/pledges/:pledgeId",
  requireCampaignWriteAccess,
  requirePledgeArmAccess,
  removeCampaignPledge
);

router.get(
  "/:campaignId/reports/summary",
  requireCampaignReadAccess,
  requireCampaignArmAccess,
  summary
);

router.get(
  "/:campaignId/reports/members",
  requireCampaignReadAccess,
  requireCampaignArmAccess,
  memberReport
);

router.get(
  "/:campaignId/reports/churches",
  requireCampaignReadAccess,
  requireCampaignArmAccess,
  churchReport
);

router.get(
  "/:campaignId/reports/groups",
  requireCampaignReadAccess,
  requireCampaignArmAccess,
  groupReport
);

export default router;