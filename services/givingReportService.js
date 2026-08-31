import mongoose from "mongoose";

import Giving from "../models/Giving.js";
import Campaign from "../models/Campaign.js";
import MinistryYear from "../models/ministryYear.js";

const { Types } = mongoose;

/* =========================================================
   ROLE → ARM
========================================================= */

export const ROLE_TO_ARM = {
  healing_hod: "Healing School",
  rhapsody_hod: "Rhapsody",
  ministry_hod: "Ministry Programs",
  bibles_hod: "LoveWorld Bibles",
  innercity_hod: "InnerCity Missions",
  lwpm_hod: "LWPM",
};

/* =========================================================
   HELPERS
========================================================= */

export const normalize = (
  value,
  fallback = "-"
) => {
  return value || value === 0
    ? value
    : fallback;
};

export const normalizeArm = (arm) => {
  return arm
    ?.toLowerCase()
    .trim()
    .replace(/\s+/g, "_");
};

/* =========================================================
   RESOLVE MINISTRY YEAR
========================================================= */

export const resolveMinistryYear =
  async (ministryYearId) => {
    if (
      ministryYearId &&
      Types.ObjectId.isValid(ministryYearId)
    ) {
      const ministryYear =
        await MinistryYear.findById(
          ministryYearId
        );

      if (!ministryYear) {
        throw new Error(
          "Ministry Year not found."
        );
      }

      return ministryYear;
    }

    const currentYear =
      await MinistryYear.findOne({
        status: "Current",
      });

    if (!currentYear) {
      throw new Error(
        "No active Ministry Year found."
      );
    }

    return currentYear;
  };

/* =========================================================
   RESOLVE CAMPAIGN
========================================================= */

export const resolveCampaign =
  async (arm, ministryYearId) => {
    return Campaign.findOne({
      arm: new RegExp(`^${arm}$`, "i"),
      ministryYear: ministryYearId,
      deleted: false,
    }).sort({
      startDate: -1,
    });
  };

/* =========================================================
   BUILD MATCH
========================================================= */

export const buildMatch = ({
  ministryYear,
  normalizedArm,
  from,
  to,
}) => {
  const match = {
    deleted: false,

    ministryYear: ministryYear._id,

    $expr: {
      $eq: [
        {
          $replaceAll: {
            input: {
              $toLower: "$arm",
            },
            find: " ",
            replacement: "_",
          },
        },
        normalizedArm,
      ],
    },
  };

  if (from || to) {
    match.date = {};

    if (from) {
      match.date.$gte = new Date(
        new Date(from).setHours(
          0,
          0,
          0,
          0
        )
      );
    }

    if (to) {
      match.date.$lte = new Date(
        new Date(to).setHours(
          23,
          59,
          59,
          999
        )
      );
    }
  }

  return match;
};

/* =========================================================
   REPORT TYPE → GROUP FIELD
========================================================= */

export const getGroupField = (type) => {
  switch (type) {
    case "church":
      return "$church._id";

    case "group":
      return "$group._id";

    default:
      return "$member._id";
  }
};
/* =========================================================
   BUILD REPORT PIPELINE
========================================================= */

export const buildPipeline = ({
  match,
  campaign,
  groupField,
  page = 1,
  limit = 20,
  paginate = true,
}) => {
  const pipeline = [
    //------------------------------------------------------
    // Match
    //------------------------------------------------------

    {
      $match: match,
    },

    //------------------------------------------------------
    // Member
    //------------------------------------------------------

    {
      $lookup: {
        from: "members",
        localField: "member",
        foreignField: "_id",
        as: "member",
      },
    },

    {
      $unwind: {
        path: "$member",
        preserveNullAndEmptyArrays: true,
      },
    },

    //------------------------------------------------------
    // Group
    //------------------------------------------------------

    {
      $lookup: {
        from: "groups",
        localField: "member.group",
        foreignField: "_id",
        as: "group",
      },
    },

    {
      $unwind: {
        path: "$group",
        preserveNullAndEmptyArrays: true,
      },
    },

    //------------------------------------------------------
    // Church
    //------------------------------------------------------

    {
      $lookup: {
        from: "churches",
        localField: "member.church",
        foreignField: "_id",
        as: "church",
      },
    },

    {
      $unwind: {
        path: "$church",
        preserveNullAndEmptyArrays: true,
      },
    },

    //------------------------------------------------------
    // Ministry Year
    //------------------------------------------------------

    {
      $lookup: {
        from: "ministryyears",
        localField: "ministryYear",
        foreignField: "_id",
        as: "ministryYear",
      },
    },

    {
      $unwind: {
        path: "$ministryYear",
        preserveNullAndEmptyArrays: true,
      },
    },

    //------------------------------------------------------
    // Member Campaign Participation
    //------------------------------------------------------

    ...(campaign
      ? [
          {
            $lookup: {
              from: "membercampaignparticipations",
              let: {
                memberId: "$member._id",
              },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        {
                          $eq: [
                            "$member",
                            "$$memberId",
                          ],
                        },
                        {
                          $eq: [
                            "$campaign",
                            campaign._id,
                          ],
                        },
                      ],
                    },
                  },
                },
              ],
              as: "mcp",
            },
          },

          {
            $unwind: {
              path: "$mcp",
              preserveNullAndEmptyArrays: true,
            },
          },
        ]
      : []),

    //------------------------------------------------------
    // Category
    //------------------------------------------------------

    {
      $lookup: {
        from: "categories",
        localField: "mcp.pledgedCategory",
        foreignField: "_id",
        as: "category",
      },
    },

    {
      $unwind: {
        path: "$category",
        preserveNullAndEmptyArrays: true,
      },
    },
        //------------------------------------------------------
    // Group Report
    //------------------------------------------------------

    {
      $group: {
        _id: groupField,

        name: {
          $first: "$member.name",
        },

        phone: {
          $first: "$member.phone",
        },

        church: {
          $first: "$church.name",
        },

        group: {
          $first: "$group.group_name",
        },

        category: {
          $first: "$category.name",
        },

        pledgeAmount: {
          $first: "$mcp.targetAmount",
        },

        ministryYear: {
          $first: "$ministryYear.name",
        },

        totalAmount: {
          $sum: "$amount",
        },

        monthlyRaw: {
          $push: {
            month: {
              $dateToString: {
                format: "%Y-%m",
                date: "$date",
              },
            },

            amount: "$amount",
          },
        },
      },
    },

    //------------------------------------------------------
    // Monthly Totals
    //------------------------------------------------------

    {
      $addFields: {
        monthly: {
          $arrayToObject: {
            $map: {
              input: {
                $setUnion: [
                  {
                    $map: {
                      input: "$monthlyRaw",
                      as: "m",
                      in: "$$m.month",
                    },
                  },
                ],
              },

              as: "monthKey",

              in: {
                k: "$$monthKey",

                v: {
                  $sum: {
                    $map: {
                      input: {
                        $filter: {
                          input: "$monthlyRaw",
                          as: "m",
                          cond: {
                            $eq: [
                              "$$m.month",
                              "$$monthKey",
                            ],
                          },
                        },
                      },

                      as: "x",

                      in: "$$x.amount",
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    //------------------------------------------------------
    // Remove Temporary Field
    //------------------------------------------------------

    {
      $project: {
        monthlyRaw: 0,
      },
    },

    //------------------------------------------------------
    // Sort
    //------------------------------------------------------

    {
      $sort: {
        totalAmount: -1,
      },
    },
  ];

  //------------------------------------------------------
  // Pagination
  //------------------------------------------------------

  if (paginate) {
    pipeline.push(
      {
        $skip:
          (Number(page) - 1) *
          Number(limit),
      },
      {
        $limit: Number(limit),
      }
    );
  }

  return pipeline;
};