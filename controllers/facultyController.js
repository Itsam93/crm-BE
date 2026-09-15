import mongoose from "mongoose";

import Giving from "../models/Giving.js";
import Campaign from "../models/Campaign.js";

import {
  getCampaignSummary as getCampaignSummaryReport,
} from "../services/campaignReportService.js";

import {
  getFacultyCampaignMembers,
  getFacultyCampaignChurches,
  getFacultyCampaignGroups,
  getFacultyFinancialIndividuals,
  getFacultyFinancialChurches,
  getFacultyFinancialGroups,
} from "../services/facultyService.js";

const ARMS = [
  "Rhapsody",
  "Healing School",
  "Ministry Programs",
  "Innercity Missions",
  "Loveworld Bibles",
  "LWPM",
];

const validateObjectId = (value, message) => {
  if (!mongoose.isValidObjectId(value)) {
    throw new Error(message);
  }
};

const parsePagination = (
  page,
  limit,
  maxLimit = 100
) => {
  const parsedPage = Math.max(
    Number(page) || 1,
    1
  );

  const parsedLimit = Math.min(
    Math.max(Number(limit) || 20, 1),
    maxLimit
  );

  return {
    page: parsedPage,
    limit: parsedLimit,
  };
};

const validateArm = (arm) => {
  if (
    arm &&
    !ARMS.includes(arm)
  ) {
    throw new Error(
      "Invalid partnership arm"
    );
  }
};

const buildDateFilter = (from, to) => {
  if (!from && !to) {
    return {};
  }

  const date = {};

  if (from) {
    const fromDate = new Date(
      `${from}T00:00:00.000`
    );

    if (Number.isNaN(fromDate.getTime())) {
      throw new Error("Invalid from date");
    }

    date.$gte = fromDate;
  }

  if (to) {
    const toDate = new Date(
      `${to}T23:59:59.999`
    );

    if (Number.isNaN(toDate.getTime())) {
      throw new Error("Invalid to date");
    }

    date.$lte = toDate;
  }

  if (
    date.$gte &&
    date.$lte &&
    date.$gte > date.$lte
  ) {
    throw new Error(
      "From date cannot be after to date"
    );
  }

  return { date };
};

export const getDashboard = async (
  req,
  res
) => {
  try {
    const {
      ministryYear,
      from,
      to,
    } = req.query;

    if (
      ministryYear &&
      !mongoose.isValidObjectId(ministryYear)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid ministry year",
      });
    }

    const givingMatch = {
      deleted: false,

      ...(ministryYear
        ? {
            ministryYear:
              new mongoose.Types.ObjectId(
                ministryYear
              ),
          }
        : {}),

      ...buildDateFilter(from, to),
    };

    const [
      overallGiving,
      givingByArm,
      campaignCounts,
    ] = await Promise.all([
      Giving.aggregate([
        {
          $match: givingMatch,
        },
        {
          $group: {
            _id: null,

            totalAmount: {
              $sum: "$amount",
            },

            totalGivings: {
              $sum: 1,
            },

            givers: {
              $addToSet: "$member",
            },
          },
        },
      ]),

      Giving.aggregate([
        {
          $match: givingMatch,
        },
        {
          $group: {
            _id: "$arm",

            totalAmount: {
              $sum: "$amount",
            },

            totalGivings: {
              $sum: 1,
            },

            givers: {
              $addToSet: "$member",
            },
          },
        },
        {
          $project: {
            _id: 0,

            arm: "$_id",

            totalAmount: 1,

            totalGivings: 1,

            givers: {
              $size: "$givers",
            },
          },
        },
      ]),

      Campaign.aggregate([
        {
          $group: {
            _id: "$status",

            count: {
              $sum: 1,
            },
          },
        },
      ]),
    ]);

    const givingSummary =
      overallGiving[0] || {
        totalAmount: 0,
        totalGivings: 0,
        givers: [],
      };

    const campaignSummary = {
      total: 0,
      active: 0,
      completed: 0,
      draft: 0,
      cancelled: 0,
    };

    for (const item of campaignCounts) {
      campaignSummary.total += item.count;

      if (item._id === "active") {
        campaignSummary.active =
          item.count;
      }

      if (item._id === "draft") {
        campaignSummary.draft =
          item.count;
      }

      if (item._id === "closed") {
        campaignSummary.completed =
          item.count;
      }

      if (item._id === "cancelled") {
        campaignSummary.cancelled =
          item.count;
      }
    }

    const armMap = new Map(
      givingByArm.map((item) => [
        item.arm,
        item,
      ])
    );

    const arms = ARMS.map((arm) => {
      const item = armMap.get(arm);

      return {
        arm,

        totalAmount:
          item?.totalAmount || 0,

        totalGivings:
          item?.totalGivings || 0,

        givers:
          item?.givers || 0,
      };
    });

    return res.status(200).json({
      success: true,

      summary: {
        totalGiving:
          givingSummary.totalAmount || 0,

        totalGivings:
          givingSummary.totalGivings || 0,

        totalGivers:
          givingSummary.givers?.length || 0,

        campaigns: campaignSummary,
      },

      arms,
    });
  } catch (error) {
    console.error(
      "Head of Faculty dashboard error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        error.message ||
        "Failed to load Head of Faculty dashboard",
    });
  }
};

/*
 * Legacy financial records endpoint.
 *
 * Kept for compatibility while the frontend
 * transitions to the Individuals / Churches /
 * Groups financial-record views.
 */
export const getFinancialRecords = async (
  req,
  res
) => {
  try {
    const {
      arm,
      page,
      limit,
    } = req.query;

    validateArm(arm);

    const pagination = parsePagination(
      page,
      limit,
      100
    );

    const match = {
      deleted: false,

      ...(arm
        ? { arm }
        : {}),
    };

    const [
      aggregateResult,
      summary,
    ] = await Promise.all([
      Giving.aggregate([
        {
          $match: match,
        },

        {
          $sort: {
            date: -1,
            createdAt: -1,
          },
        },

        {
          $group: {
            _id: "$member",

            totalAmount: {
              $sum: "$amount",
            },

            transactionCount: {
              $sum: 1,
            },

            arm: {
              $first: "$arm",
            },

            church: {
              $first: "$church",
            },

            group: {
              $first: "$group",
            },

            latestGivingDate: {
              $first: "$date",
            },
          },
        },

        {
          $sort: {
            totalAmount: -1,

            latestGivingDate: -1,

            _id: 1,
          },
        },

        {
          $project: {
            _id: 0,

            member: "$_id",

            totalAmount: 1,

            transactionCount: 1,

            arm: 1,

            church: 1,

            group: 1,

            latestGivingDate: 1,
          },
        },

        {
          $skip:
            (pagination.page - 1) *
            pagination.limit,
        },

        {
          $limit: pagination.limit,
        },
      ]),

      Giving.aggregate([
        {
          $match: match,
        },

        {
          $group: {
            _id: "$member",

            totalAmount: {
              $sum: "$amount",
            },

            transactionCount: {
              $sum: 1,
            },
          },
        },

        {
          $group: {
            _id: null,

            totalAmount: {
              $sum: "$totalAmount",
            },

            totalGivings: {
              $sum: "$transactionCount",
            },

            totalGivers: {
              $sum: 1,
            },
          },
        },
      ]),
    ]);

    const summaryData =
      summary[0] || {
        totalAmount: 0,
        totalGivings: 0,
        totalGivers: 0,
      };

    const total =
      summaryData.totalGivers || 0;

    const pages =
      total > 0
        ? Math.ceil(
            total / pagination.limit
          )
        : 0;

    const normalizedPage =
      pages > 0
        ? Math.min(
            pagination.page,
            pages
          )
        : 1;

    const records =
      await Giving.populate(
        aggregateResult,
        [
          {
            path: "member",

            select:
              "_id name phone kingschatId",
          },

          {
            path: "church",

            select:
              "_id name",
          },

          {
            path: "group",

            select:
              "_id group_name",
          },
        ]
      );

    const normalizedRecords =
      records.map((record) => ({
        _id:
          record.member?._id ||
          null,

        member:
          record.member || null,

        church:
          record.church || null,

        group:
          record.group || null,

        arm:
          record.arm ||
          arm ||
          null,

        amount:
          record.totalAmount || 0,

        totalAmount:
          record.totalAmount || 0,

        transactionCount:
          record.transactionCount || 0,

        latestGivingDate:
          record.latestGivingDate ||
          null,

        date:
          record.latestGivingDate ||
          null,
      }));

    return res.status(200).json({
      success: true,

      filters: {
        arm: arm || null,
      },

      summary: {
        totalAmount:
          summaryData.totalAmount || 0,

        totalGivings:
          summaryData.totalGivings || 0,

        totalGivers:
          summaryData.totalGivers || 0,
      },

      records:
        normalizedRecords,

      pagination: {
        page: normalizedPage,

        limit:
          pagination.limit,

        total,

        pages,
      },

      arms: ARMS,
    });
  } catch (error) {
    console.error(
      "Head of Faculty financial records error:",
      error
    );

    return res.status(400).json({
      success: false,

      message:
        error.message ||
        "Failed to load financial records",
    });
  }
};

/*
 * Financial Records → Individuals
 *
 * Cumulative giving per individual for
 * the selected partnership arm.
 */
export const getFinancialIndividuals = async (
  req,
  res
) => {
  try {
    const {
      arm,
      page,
      limit,
    } = req.query;

    if (!arm) {
      return res.status(400).json({
        success: false,
        message:
          "Partnership arm is required",
      });
    }

    validateArm(arm);

    const report =
      await getFacultyFinancialIndividuals({
        arm,
        page: page || 1,
        limit: limit || 20,
      });

    return res.status(200).json({
      success: true,

      ...report,
    });
  } catch (error) {
    console.error(
      "Head of Faculty financial individuals error:",
      error
    );

    return res.status(400).json({
      success: false,

      message:
        error.message ||
        "Failed to load financial individuals",
    });
  }
};

/*
 * Financial Records → Churches
 *
 * Cumulative giving per church for
 * the selected partnership arm.
 */
export const getFinancialChurches = async (
  req,
  res
) => {
  try {
    const {
      arm,
      page,
      limit,
    } = req.query;

    if (!arm) {
      return res.status(400).json({
        success: false,

        message:
          "Partnership arm is required",
      });
    }

    validateArm(arm);

    const report =
      await getFacultyFinancialChurches({
        arm,
        page: page || 1,
        limit: limit || 20,
      });

    return res.status(200).json({
      success: true,

      ...report,
    });
  } catch (error) {
    console.error(
      "Head of Faculty financial churches error:",
      error
    );

    return res.status(400).json({
      success: false,

      message:
        error.message ||
        "Failed to load financial churches",
    });
  }
};

/*
 * Financial Records → Groups
 *
 * Cumulative giving per group for
 * the selected partnership arm.
 */
export const getFinancialGroups = async (
  req,
  res
) => {
  try {
    const {
      arm,
      page,
      limit,
    } = req.query;

    if (!arm) {
      return res.status(400).json({
        success: false,

        message:
          "Partnership arm is required",
      });
    }

    validateArm(arm);

    const report =
      await getFacultyFinancialGroups({
        arm,
        page: page || 1,
        limit: limit || 20,
      });

    return res.status(200).json({
      success: true,

      ...report,
    });
  } catch (error) {
    console.error(
      "Head of Faculty financial groups error:",
      error
    );

    return res.status(400).json({
      success: false,

      message:
        error.message ||
        "Failed to load financial groups",
    });
  }
};

export const getCampaigns = async (
  req,
  res
) => {
  try {
    const {
      arm,
      status,
      search,
      page,
      limit,
    } = req.query;

    validateArm(arm);

    const validStatuses = [
      "draft",
      "active",
      "closed",
    ];

    if (
      status &&
      !validStatuses.includes(status)
    ) {
      return res.status(400).json({
        success: false,

        message:
          "Invalid campaign status",
      });
    }

    const pagination = parsePagination(
      page,
      limit,
      100
    );

    const match = {
      ...(arm
        ? { arm }
        : {}),

      ...(status
        ? { status }
        : {}),
    };

    if (search?.trim()) {
      const searchRegex =
        new RegExp(
          search
            .trim()
            .replace(
              /[.*+?^${}()|[\]\\]/g,
              "\\$&"
            ),
          "i"
        );

      match.$or = [
        {
          name: searchRegex,
        },

        {
          description:
            searchRegex,
        },

        {
          arm: searchRegex,
        },
      ];
    }

    const [
      campaigns,
      total,
    ] = await Promise.all([
      Campaign.find(match)
        .populate(
          "createdBy",
          "_id name"
        )
        .populate(
          "closedBy",
          "_id name"
        )
        .sort({
          startDate: -1,
          createdAt: -1,
        })
        .skip(
          (pagination.page - 1) *
            pagination.limit
        )
        .limit(
          pagination.limit
        )
        .lean(),

      Campaign.countDocuments(
        match
      ),
    ]);

    const pages =
      total > 0
        ? Math.ceil(
            total /
              pagination.limit
          )
        : 0;

    const normalizedPage =
      pages > 0
        ? Math.min(
            pagination.page,
            pages
          )
        : 1;

    return res.status(200).json({
      success: true,

      filters: {
        arm: arm || null,

        status:
          status || null,

        search:
          search || null,
      },

      campaigns,

      pagination: {
        page:
          normalizedPage,

        limit:
          pagination.limit,

        total,

        pages,
      },

      arms: ARMS,

      statuses:
        validStatuses,
    });
  } catch (error) {
    console.error(
      "Head of Faculty campaigns error:",
      error
    );

    return res.status(400).json({
      success: false,

      message:
        error.message ||
        "Failed to load campaigns",
    });
  }
};

export const getCampaignSummary =
  async (req, res) => {
    try {
      const {
        campaignId,
      } = req.params;

      const {
        asOfDate,
      } = req.query;

      validateObjectId(
        campaignId,
        "Invalid campaign ID"
      );

      const report =
        await getCampaignSummaryReport({
          campaignId,

          asOfDate:
            asOfDate || null,
        });

      return res.status(200).json({
        success: true,

        ...report,
      });
    } catch (error) {
      console.error(
        "Head of Faculty campaign summary error:",
        error
      );

      const status =
        error.message ===
        "Campaign not found"
          ? 404
          : 400;

      return res
        .status(status)
        .json({
          success: false,

          message:
            error.message ||
            "Failed to load campaign summary",
        });
    }
  };

export const getCampaignMembers =
  async (req, res) => {
    try {
      const {
        campaignId,
      } = req.params;

      const {
        asOfDate,
        page,
        limit,
        churchId,
        groupId,
      } = req.query;

      validateObjectId(
        campaignId,
        "Invalid campaign ID"
      );

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

      const report =
        await getFacultyCampaignMembers({
          campaignId,

          asOfDate:
            asOfDate || null,

          page:
            page || 1,

          limit:
            limit || 20,

          churchId:
            churchId || null,

          groupId:
            groupId || null,
        });

      return res.status(200).json({
        success: true,

        ...report,
      });
    } catch (error) {
      console.error(
        "Head of Faculty campaign members error:",
        error
      );

      const status =
        error.message ===
        "Campaign not found"
          ? 404
          : 400;

      return res
        .status(status)
        .json({
          success: false,

          message:
            error.message ||
            "Failed to load campaign members",
        });
    }
  };

export const getCampaignChurches =
  async (req, res) => {
    try {
      const {
        campaignId,
      } = req.params;

      const {
        asOfDate,
        page,
        limit,
      } = req.query;

      validateObjectId(
        campaignId,
        "Invalid campaign ID"
      );

      const report =
        await getFacultyCampaignChurches({
          campaignId,

          asOfDate:
            asOfDate || null,

          page:
            page || 1,

          limit:
            limit || 20,
        });

      return res.status(200).json({
        success: true,

        ...report,
      });
    } catch (error) {
      console.error(
        "Head of Faculty campaign churches error:",
        error
      );

      const status =
        error.message ===
        "Campaign not found"
          ? 404
          : 400;

      return res
        .status(status)
        .json({
          success: false,

          message:
            error.message ||
            "Failed to load campaign churches",
        });
    }
  };

export const getCampaignGroups =
  async (req, res) => {
    try {
      const {
        campaignId,
      } = req.params;

      const {
        asOfDate,
        page,
        limit,
      } = req.query;

      validateObjectId(
        campaignId,
        "Invalid campaign ID"
      );

      const report =
        await getFacultyCampaignGroups({
          campaignId,

          asOfDate:
            asOfDate || null,

          page:
            page || 1,

          limit:
            limit || 20,
        });

      return res.status(200).json({
        success: true,

        ...report,
      });
    } catch (error) {
      console.error(
        "Head of Faculty campaign groups error:",
        error
      );

      const status =
        error.message ===
        "Campaign not found"
          ? 404
          : 400;

      return res
        .status(status)
        .json({
          success: false,

          message:
            error.message ||
            "Failed to load campaign groups",
        });
    }
  };
