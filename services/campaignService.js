import mongoose from "mongoose";
import Campaign, {
  CAMPAIGN_ARMS,
} from "../models/Campaign.js";
import CampaignPledge from "../models/CampaignPledge.js";

const validateObjectId = (
  id,
  fieldName = "ID"
) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error(`Invalid ${fieldName}`);
  }
};

const normalizeCustomFields = (
  customFields = []
) => {
  if (!Array.isArray(customFields)) {
    throw new Error(
      "Custom fields must be an array"
    );
  }

  const keys = new Set();

  return customFields.map(
    (field, index) => {
      if (
        !field ||
        typeof field !== "object" ||
        Array.isArray(field)
      ) {
        throw new Error(
          `Invalid custom field at position ${
            index + 1
          }`
        );
      }

      const key = String(
        field.key || ""
      ).trim();

      const label = String(
        field.label || ""
      ).trim();

      if (!key) {
        throw new Error(
          `Custom field key is required at position ${
            index + 1
          }`
        );
      }

      if (!label) {
        throw new Error(
          `Custom field label is required at position ${
            index + 1
          }`
        );
      }

      if (keys.has(key)) {
        throw new Error(
          `Duplicate custom field key: ${key}`
        );
      }

      keys.add(key);

      const type =
        field.type || "text";

      const allowedTypes = [
        "text",
        "number",
        "date",
        "select",
        "textarea",
      ];

      if (
        !allowedTypes.includes(type)
      ) {
        throw new Error(
          `Invalid custom field type for "${label}"`
        );
      }

      const options =
        Array.isArray(field.options)
          ? field.options
              .map((option) =>
                String(option).trim()
              )
              .filter(Boolean)
          : [];

      if (
        type === "select" &&
        options.length === 0
      ) {
        throw new Error(
          `Select field "${label}" must have at least one option`
        );
      }

      return {
        key,
        label,
        type,
        options,
        required: Boolean(
          field.required
        ),
        order: Number.isFinite(
          Number(field.order)
        )
          ? Number(field.order)
          : index,
      };
    }
  );
};

const validateArm = (arm) => {
  if (!CAMPAIGN_ARMS.includes(arm)) {
    throw new Error(
      "Invalid partnership arm"
    );
  }

  return arm;
};

const validateDateRange = (
  startDate,
  endDate
) => {
  const start = new Date(startDate);

  if (Number.isNaN(start.getTime())) {
    throw new Error(
      "Invalid campaign start date"
    );
  }

  if (
    endDate !== undefined &&
    endDate !== null &&
    endDate !== ""
  ) {
    const end = new Date(endDate);

    if (Number.isNaN(end.getTime())) {
      throw new Error(
        "Invalid campaign end date"
      );
    }

    if (end < start) {
      throw new Error(
        "Campaign end date cannot be before the start date"
      );
    }

    return {
      startDate: start,
      endDate: end,
    };
  }

  return {
    startDate: start,
    endDate: null,
  };
};

const validateStatus = (status) => {
  const allowedStatuses = [
    "draft",
    "active",
    "closed",
  ];

  if (!allowedStatuses.includes(status)) {
    throw new Error(
      "Invalid campaign status"
    );
  }

  return status;
};

const createCampaign = async ({
  name,
  description,
  arm,
  startDate,
  endDate,
  status,
  customFields,
  createdBy,
}) => {
  if (!name || !String(name).trim()) {
    throw new Error(
      "Campaign name is required"
    );
  }

  if (!arm) {
    throw new Error(
      "Partnership arm is required"
    );
  }

  if (!createdBy) {
    throw new Error(
      "Campaign creator is required"
    );
  }

  validateObjectId(
    createdBy,
    "creator ID"
  );

  validateArm(arm);

  const dates =
    validateDateRange(
      startDate,
      endDate
    );

  const normalizedFields =
    normalizeCustomFields(
      customFields
    );

  const campaignStatus =
    status || "draft";

  validateStatus(
    campaignStatus
  );

  const campaign =
    await Campaign.create({
      name: String(name).trim(),

      description: description
        ? String(description).trim()
        : "",

      arm,

      startDate:
        dates.startDate,

      endDate:
        dates.endDate,

      status:
        campaignStatus,

      customFields:
        normalizedFields,

      createdBy,
    });

  return campaign;
};

const getCampaigns = async ({
  status,
  arm,
  page = 1,
  limit = 20,
}) => {
  const parsedPage = Math.max(
    Number.parseInt(page, 10) || 1,
    1
  );

  const parsedLimit = Math.min(
    Math.max(
      Number.parseInt(limit, 10) || 20,
      1
    ),
    100
  );

  const filter = {};

  if (status) {
    validateStatus(status);
    filter.status = status;
  }

  if (arm) {
    validateArm(arm);
    filter.arm = arm;
  }

  const skip =
    (parsedPage - 1) *
    parsedLimit;

  const [
    campaigns,
    total,
  ] = await Promise.all([
    Campaign.find(filter)
      .populate(
        "createdBy",
        "name role"
      )
      .populate(
        "closedBy",
        "name role"
      )
      .sort({
        startDate: -1,
        createdAt: -1,
      })
      .skip(skip)
      .limit(parsedLimit)
      .lean(),

    Campaign.countDocuments(filter),
  ]);

  return {
    campaigns,

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

const getCampaignById = async (
  campaignId
) => {
  validateObjectId(
    campaignId,
    "campaign ID"
  );

  const campaign =
    await Campaign.findById(
      campaignId
    )
      .populate(
        "createdBy",
        "name role"
      )
      .populate(
        "closedBy",
        "name role"
      )
      .lean();

  if (!campaign) {
    throw new Error(
      "Campaign not found"
    );
  }

  return campaign;
};

const updateCampaign = async (
  campaignId,
  updates
) => {
  validateObjectId(
    campaignId,
    "campaign ID"
  );

  const campaign =
    await Campaign.findById(
      campaignId
    );

  if (!campaign) {
    throw new Error(
      "Campaign not found"
    );
  }

  if (
    campaign.status === "closed"
  ) {
    throw new Error(
      "Closed campaigns cannot be updated"
    );
  }

  const allowedFields = [
    "name",
    "description",
    "startDate",
    "endDate",
    "customFields",
  ];

  const updateData = {};

  for (const field of allowedFields) {
    if (
      Object.prototype.hasOwnProperty.call(
        updates,
        field
      )
    ) {
      updateData[field] =
        updates[field];
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(
      updates,
      "arm"
    )
  ) {
    throw new Error(
      "Campaign partnership arm cannot be changed after creation"
    );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      updates,
      "status"
    )
  ) {
    throw new Error(
      "Use the campaign status actions to change campaign status"
    );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      updateData,
      "name"
    )
  ) {
    const name = String(
      updateData.name
    ).trim();

    if (!name) {
      throw new Error(
        "Campaign name is required"
      );
    }

    updateData.name = name;
  }

  if (
    Object.prototype.hasOwnProperty.call(
      updateData,
      "description"
    )
  ) {
    updateData.description =
      updateData.description
        ? String(
            updateData.description
          ).trim()
        : "";
  }

  if (
    Object.prototype.hasOwnProperty.call(
      updateData,
      "startDate"
    ) ||
    Object.prototype.hasOwnProperty.call(
      updateData,
      "endDate"
    )
  ) {
    const startDate =
      updateData.startDate !==
      undefined
        ? updateData.startDate
        : campaign.startDate;

    const endDate =
      updateData.endDate !==
      undefined
        ? updateData.endDate
        : campaign.endDate;

    const dates =
      validateDateRange(
        startDate,
        endDate
      );

    updateData.startDate =
      dates.startDate;

    updateData.endDate =
      dates.endDate;
  }

  if (
    Object.prototype.hasOwnProperty.call(
      updateData,
      "customFields"
    )
  ) {
    updateData.customFields =
      normalizeCustomFields(
        updateData.customFields
      );
  }

  Object.assign(
    campaign,
    updateData
  );

  await campaign.save();

  return campaign;
};

const activateCampaign = async (
  campaignId
) => {
  validateObjectId(
    campaignId,
    "campaign ID"
  );

  const campaign =
    await Campaign.findById(
      campaignId
    );

  if (!campaign) {
    throw new Error(
      "Campaign not found"
    );
  }

  if (
    campaign.status === "closed"
  ) {
    throw new Error(
      "Closed campaigns cannot be activated"
    );
  }

  if (
    campaign.status === "active"
  ) {
    throw new Error(
      "Campaign is already active"
    );
  }

  campaign.status = "active";

  await campaign.save();

  return campaign;
};

const closeCampaign = async (
  campaignId,
  closedBy
) => {
  validateObjectId(
    campaignId,
    "campaign ID"
  );

  validateObjectId(
    closedBy,
    "user ID"
  );

  const campaign =
    await Campaign.findById(
      campaignId
    );

  if (!campaign) {
    throw new Error(
      "Campaign not found"
    );
  }

  if (
    campaign.status === "closed"
  ) {
    throw new Error(
      "Campaign is already closed"
    );
  }

  campaign.status = "closed";
  campaign.closedAt = new Date();
  campaign.closedBy = closedBy;

  await campaign.save();

  return campaign;
};

const deleteCampaign = async (
  campaignId
) => {
  validateObjectId(
    campaignId,
    "campaign ID"
  );

  const campaign =
    await Campaign.findById(
      campaignId
    );

  if (!campaign) {
    throw new Error(
      "Campaign not found"
    );
  }

  if (
    campaign.status === "active"
  ) {
    throw new Error(
      "Active campaigns cannot be deleted"
    );
  }

  const pledgeCount =
    await CampaignPledge.countDocuments({
      campaign: campaignId,
    });

  if (pledgeCount > 0) {
    throw new Error(
      "Campaigns with recorded pledges cannot be deleted"
    );
  }

  await Campaign.deleteOne({
    _id: campaignId,
  });

  return {
    message:
      "Campaign deleted successfully",
  };
};

const getCampaignAsOfDate = async (
  campaignId,
  asOfDate
) => {
  const campaign =
    await getCampaignById(
      campaignId
    );

  const requestedDate =
    asOfDate
      ? new Date(asOfDate)
      : new Date();

  if (
    Number.isNaN(
      requestedDate.getTime()
    )
  ) {
    throw new Error(
      "Invalid as-of date"
    );
  }

  if (
    requestedDate <
    new Date(campaign.startDate)
  ) {
    throw new Error(
      "As-of date cannot be before the campaign start date"
    );
  }

  let effectiveDate =
    requestedDate;

  if (
    campaign.endDate &&
    effectiveDate >
      new Date(campaign.endDate)
  ) {
    effectiveDate = new Date(
      campaign.endDate
    );
  }

  return {
    campaign,
    asOfDate: effectiveDate,
  };
};

const getCampaignDateRange = async (
  campaignId,
  asOfDate
) => {
  const {
    campaign,
    asOfDate: effectiveDate,
  } = await getCampaignAsOfDate(
    campaignId,
    asOfDate
  );

  return {
    campaign,

    startDate: new Date(
      campaign.startDate
    ),

    endDate: effectiveDate,
  };
};

export {
  createCampaign,
  getCampaigns,
  getCampaignById,
  updateCampaign,
  activateCampaign,
  closeCampaign,
  deleteCampaign,
  getCampaignAsOfDate,
  getCampaignDateRange,
};