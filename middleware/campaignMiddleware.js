import Campaign from "../models/Campaign.js";
import CampaignPledge from "../models/CampaignPledge.js";

const HOD_ARM_MAP = {
  healing_hod: "Healing School",
  rhapsody_hod: "Rhapsody",
  ministry_hod: "Ministry Programs",
  bibles_hod: "Loveworld Bibles",
  innercity_hod: "Innercity Missions",
  lwpm_hod: "LWPM",
};

export const CAMPAIGN_ROLES = [
  "admin",
  "head_of_faculty",
  "healing_hod",
  "rhapsody_hod",
  "ministry_hod",
  "bibles_hod",
  "innercity_hod",
  "lwpm_hod",
];

export const requireCampaignAdmin = (
  req,
  res,
  next
) => {
  if (!req.user) {
    return res.status(401).json({
      message: "User not authenticated.",
    });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({
      message: "Admin access required.",
    });
  }

  next();
};

export const requireCampaignReadAccess = (
  req,
  res,
  next
) => {
  if (!req.user) {
    return res.status(401).json({
      message: "User not authenticated.",
    });
  }

  if (
    !CAMPAIGN_ROLES.includes(
      req.user.role
    )
  ) {
    return res.status(403).json({
      message: "Access denied.",
    });
  }

  next();
};

export const requireCampaignWriteAccess = (
  req,
  res,
  next
) => {
  if (!req.user) {
    return res.status(401).json({
      message: "User not authenticated.",
    });
  }

  if (
    req.user.role !== "admin" &&
    !Object.prototype.hasOwnProperty.call(
      HOD_ARM_MAP,
      req.user.role
    )
  ) {
    return res.status(403).json({
      message:
        "You do not have permission to modify campaign data.",
    });
  }

  next();
};

export const requireCampaignArmAccess = async (
  req,
  res,
  next
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "User not authenticated.",
      });
    }

    if (
      req.user.role === "admin" ||
      req.user.role === "head_of_faculty"
    ) {
      return next();
    }

    const userArm =
      HOD_ARM_MAP[req.user.role];

    if (!userArm) {
      return res.status(403).json({
        message: "Access denied.",
      });
    }

    const campaignId =
      req.params.campaignId ||
      req.params.id;

    if (!campaignId) {
      return res.status(400).json({
        message: "Campaign ID is required.",
      });
    }

    const campaign =
      await Campaign.findById(
        campaignId
      )
        .select("arm")
        .lean();

    if (!campaign) {
      return res.status(404).json({
        message: "Campaign not found.",
      });
    }

    if (campaign.arm !== userArm) {
      return res.status(403).json({
        message:
          "Access denied for this partnership arm.",
      });
    }

    req.campaign = campaign;

    next();
  } catch (error) {
    console.error(
      "Campaign arm authorization error:",
      error
    );

    return res.status(500).json({
      message: "Authorization failed.",
    });
  }
};

export const requirePledgeArmAccess = async (
  req,
  res,
  next
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "User not authenticated.",
      });
    }

    if (
      req.user.role === "admin" ||
      req.user.role === "head_of_faculty"
    ) {
      return next();
    }

    const userArm =
      HOD_ARM_MAP[req.user.role];

    if (!userArm) {
      return res.status(403).json({
        message: "Access denied.",
      });
    }

    const pledge =
      await CampaignPledge.findById(
        req.params.pledgeId
      )
        .select("campaign")
        .populate({
          path: "campaign",
          select: "arm",
        })
        .lean();

    if (!pledge) {
      return res.status(404).json({
        message: "Pledge not found.",
      });
    }

    if (!pledge.campaign) {
      return res.status(404).json({
        message: "Campaign not found.",
      });
    }

    if (
      pledge.campaign.arm !== userArm
    ) {
      return res.status(403).json({
        message:
          "Access denied for this partnership arm.",
      });
    }

    req.pledge = pledge;
    req.campaign = pledge.campaign;

    next();
  } catch (error) {
    console.error(
      "Pledge arm authorization error:",
      error
    );

    return res.status(500).json({
      message: "Authorization failed.",
    });
  }
};

export const applyCampaignArmFilter = (
  req,
  res,
  next
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "User not authenticated.",
      });
    }

    const userArm =
      HOD_ARM_MAP[req.user.role];

    if (userArm) {
      req.campaignArm = userArm;
      return next();
    }

    req.campaignArm =
      req.query.arm || undefined;

    next();
  } catch (error) {
    console.error(
      "Campaign arm filter error:",
      error
    );

    return res.status(500).json({
      message: "Authorization failed.",
    });
  }
};

export const getHodArm = (role) => {
  return HOD_ARM_MAP[role] || null;
};