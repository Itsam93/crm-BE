import {
  createCampaign,
  getCampaigns,
  getCampaignById,
  updateCampaign,
  activateCampaign,
  closeCampaign,
  deleteCampaign,
} from "../services/campaignService.js";

import {
  createPledge,
  getPledgeById,
  getPledge as getMemberPledgeService,
  getCampaignPledges,
  updatePledge,
  deletePledge,
} from "../services/campaignPledgeService.js";

import {
  getMemberReport,
  getChurchReport,
  getGroupReport,
  getCampaignSummary,
} from "../services/campaignReportService.js";

const handleError = (res, error) => {
  const message =
    error instanceof Error
      ? error.message
      : "An unexpected error occurred";

  const notFoundMessages = [
    "Campaign not found",
    "Pledge not found",
    "Member not found",
  ];

  const status = notFoundMessages.includes(message) ? 404 : 400;

  return res.status(status).json({
    success: false,
    message,
  });
};

const create = async (req, res) => {
  try {
    const campaign = await createCampaign({
      ...req.body,
      createdBy: req.user.id,
    });

    return res.status(201).json({
      success: true,
      message: "Campaign created successfully",
      campaign,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

const getAll = async (req, res) => {
  try {
    const result = await getCampaigns({
      status: req.query.status,
      arm: req.campaignArm,
      page: req.query.page,
      limit: req.query.limit,
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

const getOne = async (req, res) => {
  try {
    const campaign = await getCampaignById(req.params.campaignId);

    return res.status(200).json({
      success: true,
      campaign,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

const update = async (req, res) => {
  try {
    const campaign = await updateCampaign(
      req.params.campaignId,
      req.body
    );

    return res.status(200).json({
      success: true,
      message: "Campaign updated successfully",
      campaign,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

const activate = async (req, res) => {
  try {
    const campaign = await activateCampaign(
      req.params.campaignId
    );

    return res.status(200).json({
      success: true,
      message: "Campaign activated successfully",
      campaign,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

const close = async (req, res) => {
  try {
    const campaign = await closeCampaign(
      req.params.campaignId,
      req.user.id
    );

    return res.status(200).json({
      success: true,
      message: "Campaign closed successfully",
      campaign,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

const remove = async (req, res) => {
  try {
    const result = await deleteCampaign(
      req.params.campaignId
    );

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

const createCampaignPledge = async (req, res) => {
  try {
    const pledge = await createPledge({
      campaignId: req.params.campaignId,
      memberId: req.body.memberId,
      pledgeAmount: req.body.pledgeAmount,
      pledgedAt: req.body.pledgedAt,
      recordedBy: req.user.id,
      notes: req.body.notes,
      customValues: req.body.customValues,
    });

    return res.status(201).json({
      success: true,
      message: "Campaign pledge recorded successfully",
      pledge,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

const getPledge = async (req, res) => {
  try {
    const pledge = await getPledgeById(
      req.params.pledgeId
    );

    return res.status(200).json({
      success: true,
      pledge,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

const getMemberPledge = async (req, res) => {
  try {
    const pledge = await getMemberPledgeService(
      req.params.campaignId,
      req.params.memberId
    );

    return res.status(200).json({
      success: true,
      pledge,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

const getPledges = async (req, res) => {
  try {
    const result = await getCampaignPledges({
      campaignId: req.params.campaignId,
      churchId: req.query.churchId,
      groupId: req.query.groupId,
      page: req.query.page,
      limit: req.query.limit,
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

const updateCampaignPledge = async (req, res) => {
  try {
    const pledge = await updatePledge(
      req.params.pledgeId,
      {
        pledgeAmount: req.body.pledgeAmount,
        pledgedAt: req.body.pledgedAt,
        notes: req.body.notes,
        customValues: req.body.customValues,
      }
    );

    return res.status(200).json({
      success: true,
      message: "Campaign pledge updated successfully",
      pledge,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

const removeCampaignPledge = async (req, res) => {
  try {
    const result = await deletePledge(
      req.params.pledgeId
    );

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

const summary = async (req, res) => {
  try {
    const result = await getCampaignSummary({
      campaignId: req.params.campaignId,
      asOfDate: req.query.asOfDate,
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

const memberReport = async (req, res) => {
  try {
    const result = await getMemberReport({
      campaignId: req.params.campaignId,
      asOfDate: req.query.asOfDate,
      page: req.query.page,
      limit: req.query.limit,
      churchId: req.query.churchId,
      groupId: req.query.groupId,
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

const churchReport = async (req, res) => {
  try {
    const result = await getChurchReport({
      campaignId: req.params.campaignId,
      asOfDate: req.query.asOfDate,
      page: req.query.page,
      limit: req.query.limit,
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

const groupReport = async (req, res) => {
  try {
    const result = await getGroupReport({
      campaignId: req.params.campaignId,
      asOfDate: req.query.asOfDate,
      page: req.query.page,
      limit: req.query.limit,
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export {
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
};