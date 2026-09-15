import mongoose from "mongoose";
import Campaign from "../models/Campaign.js";
import CampaignPledge from "../models/CampaignPledge.js";
import Member from "../models/Member.js";

const validateObjectId = (value, message) => {
  if (!mongoose.isValidObjectId(value)) {
    throw new Error(message);
  }
};

const getMemberSnapshot = async (memberId) => {
  validateObjectId(memberId, "Invalid member ID");

  const member = await Member.findOne({
    _id: memberId,
    deleted: false,
  })
    .select(
      "_id name phone kingschatId birthday church group"
    )
    .populate("church", "_id name group")
    .populate("group", "_id group_name")
    .lean();

  if (!member) {
    throw new Error("Member not found");
  }

  if (!member.church) {
    throw new Error(
      "Member must belong to a church before a campaign pledge can be recorded"
    );
  }

  if (!member.group) {
    throw new Error(
      "Member must belong to a group before a campaign pledge can be recorded"
    );
  }

  return {
    member: member._id,
    memberName: member.name,
    phone: member.phone || "",
    kingschatId: member.kingschatId || "",
    birthday: member.birthday || null,
    church: member.church._id,
    churchName: member.church.name,
    group: member.group._id,
    groupName: member.group.group_name,
  };
};

const getCampaign = async (campaignId) => {
  validateObjectId(campaignId, "Invalid campaign ID");

  const campaign = await Campaign.findById(
    campaignId
  ).lean();

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  if (!campaign.arm) {
    throw new Error(
      "Campaign does not have a partnership arm"
    );
  }

  return campaign;
};

const validatePledgeDate = (
  pledgedAt,
  campaign
) => {
  const date = pledgedAt
    ? new Date(pledgedAt)
    : new Date();

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid pledge date");
  }

  const campaignStart = new Date(
    campaign.startDate
  );

  if (date < campaignStart) {
    throw new Error(
      "Pledge date cannot be before the campaign start date"
    );
  }

  if (campaign.endDate) {
    const campaignEnd = new Date(
      campaign.endDate
    );

    if (date > campaignEnd) {
      throw new Error(
        "Pledge date cannot be after the campaign end date"
      );
    }
  }

  return date;
};

const validatePledgeAmount = (
  pledgeAmount
) => {
  const amount = Number(pledgeAmount);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(
      "Pledge amount must be greater than zero"
    );
  }

  return amount;
};

const validateCustomValues = (
  customValues,
  campaign
) => {
  if (
    customValues === undefined ||
    customValues === null
  ) {
    return {};
  }

  if (
    typeof customValues !== "object" ||
    Array.isArray(customValues)
  ) {
    throw new Error(
      "Custom values must be an object"
    );
  }

  const configuredFields =
    campaign.customFields || [];

  const configuredKeys = new Set(
    configuredFields.map(
      (field) => field.key
    )
  );

  for (const key of Object.keys(
    customValues
  )) {
    if (!configuredKeys.has(key)) {
      throw new Error(
        `Unknown campaign field: ${key}`
      );
    }
  }

  for (const field of configuredFields) {
    if (
      field.required &&
      (customValues[field.key] === undefined ||
        customValues[field.key] === null ||
        String(customValues[field.key]).trim() === "")
    ) {
      throw new Error(
        `Campaign field "${field.label}" is required`
      );
    }

    if (
      field.type === "select" &&
      customValues[field.key] !== undefined &&
      customValues[field.key] !== null &&
      !field.options.includes(
        String(customValues[field.key])
      )
    ) {
      throw new Error(
        `Invalid value for campaign field "${field.label}"`
      );
    }
  }

  return customValues;
};

const createPledge = async ({
  campaignId,
  memberId,
  pledgeAmount,
  pledgedAt,
  recordedBy,
  notes,
  customValues,
}) => {
  validateObjectId(
    recordedBy,
    "Invalid recorder ID"
  );

  const campaign =
    await getCampaign(campaignId);

  if (campaign.status === "closed") {
    throw new Error(
      "Pledges cannot be added to a closed campaign"
    );
  }

  const snapshot =
    await getMemberSnapshot(memberId);

  const existingPledge =
    await CampaignPledge.findOne({
      campaign: campaign._id,
      member: snapshot.member,
    }).lean();

  if (existingPledge) {
    throw new Error(
      "Member has already pledged to this campaign"
    );
  }

  const amount =
    validatePledgeAmount(
      pledgeAmount
    );

  const pledgeDate =
    validatePledgeDate(
      pledgedAt,
      campaign
    );

  const values =
    validateCustomValues(
      customValues,
      campaign
    );

  const pledge =
    await CampaignPledge.create({
      campaign: campaign._id,
      member: snapshot.member,
      memberName: snapshot.memberName,
      church: snapshot.church,
      churchName: snapshot.churchName,
      group: snapshot.group,
      groupName: snapshot.groupName,
      phone: snapshot.phone,
      kingschatId: snapshot.kingschatId,
      birthday: snapshot.birthday,
      pledgeAmount: amount,
      pledgedAt: pledgeDate,
      recordedBy,
      notes: notes
        ? String(notes).trim()
        : "",
      customValues: values,
    });

  return pledge;
};

const getPledgeById = async (
  pledgeId
) => {
  validateObjectId(
    pledgeId,
    "Invalid pledge ID"
  );

  const pledge =
    await CampaignPledge.findById(
      pledgeId
    )
      .populate(
        "campaign",
        "name arm startDate endDate status"
      )
      .populate(
        "recordedBy",
        "name role"
      )
      .lean();

  if (!pledge) {
    throw new Error("Pledge not found");
  }

  return pledge;
};

const getPledge = async (
  campaignId,
  memberId
) => {
  validateObjectId(
    campaignId,
    "Invalid campaign ID"
  );

  validateObjectId(
    memberId,
    "Invalid member ID"
  );

  const pledge =
    await CampaignPledge.findOne({
      campaign: campaignId,
      member: memberId,
    })
      .populate(
        "campaign",
        "name arm startDate endDate status"
      )
      .populate(
        "recordedBy",
        "name role"
      )
      .lean();

  if (!pledge) {
    throw new Error("Pledge not found");
  }

  return pledge;
};

const getCampaignPledges = async ({
  campaignId,
  churchId,
  groupId,
  page = 1,
  limit = 50,
}) => {
  const campaign =
    await getCampaign(campaignId);

  if (churchId) {
    validateObjectId(
      churchId,
      "Invalid church ID"
    );
  }

  if (groupId) {
    validateObjectId(
      groupId,
      "Invalid group ID"
    );
  }

  const parsedPage = Math.max(
    Number.parseInt(page, 10) || 1,
    1
  );

  const parsedLimit = Math.min(
    Math.max(
      Number.parseInt(limit, 10) || 50,
      1
    ),
    100
  );

  const filter = {
    campaign: campaign._id,
  };

  if (churchId) {
    filter.church = churchId;
  }

  if (groupId) {
    filter.group = groupId;
  }

  const skip =
    (parsedPage - 1) *
    parsedLimit;

  const [
    pledges,
    total,
  ] = await Promise.all([
    CampaignPledge.find(filter)
      .populate(
        "recordedBy",
        "name role"
      )
      .sort({
        pledgeAmount: -1,
        createdAt: 1,
      })
      .skip(skip)
      .limit(parsedLimit)
      .lean(),

    CampaignPledge.countDocuments(
      filter
    ),
  ]);

  return {
    campaign: {
      id: campaign._id,
      name: campaign.name,
      arm: campaign.arm,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      status: campaign.status,
    },

    pledges,

    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      pages: Math.ceil(
        total / parsedLimit
      ),
    },
  };
};

const updatePledge = async (
  pledgeId,
  updates
) => {
  validateObjectId(
    pledgeId,
    "Invalid pledge ID"
  );

  const pledge =
    await CampaignPledge.findById(
      pledgeId
    );

  if (!pledge) {
    throw new Error("Pledge not found");
  }

  const campaign =
    await getCampaign(
      pledge.campaign
    );

  if (campaign.status === "closed") {
    throw new Error(
      "Pledges cannot be updated after the campaign is closed"
    );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      updates,
      "pledgeAmount"
    )
  ) {
    pledge.pledgeAmount =
      validatePledgeAmount(
        updates.pledgeAmount
      );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      updates,
      "pledgedAt"
    )
  ) {
    pledge.pledgedAt =
      validatePledgeDate(
        updates.pledgedAt,
        campaign
      );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      updates,
      "notes"
    )
  ) {
    pledge.notes = updates.notes
      ? String(updates.notes).trim()
      : "";
  }

  if (
    Object.prototype.hasOwnProperty.call(
      updates,
      "customValues"
    )
  ) {
    pledge.customValues =
      validateCustomValues(
        updates.customValues,
        campaign
      );
  }

  await pledge.save();

  return pledge;
};

const deletePledge = async (
  pledgeId
) => {
  validateObjectId(
    pledgeId,
    "Invalid pledge ID"
  );

  const pledge =
    await CampaignPledge.findById(
      pledgeId
    );

  if (!pledge) {
    throw new Error("Pledge not found");
  }

  const campaign =
    await getCampaign(
      pledge.campaign
    );

  if (campaign.status === "closed") {
    throw new Error(
      "Pledges cannot be deleted after the campaign is closed"
    );
  }

  await CampaignPledge.deleteOne({
    _id: pledgeId,
  });

  return {
    message:
      "Campaign pledge deleted successfully",
  };
};

export {
  createPledge,
  getPledgeById,
  getPledge,
  getCampaignPledges,
  updatePledge,
  deletePledge,
};