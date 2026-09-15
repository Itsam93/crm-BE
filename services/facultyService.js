import mongoose from "mongoose";

import Campaign from "../models/Campaign.js";
import CampaignPledge from "../models/CampaignPledge.js";
import Giving from "../models/Giving.js";
import Member from "../models/Member.js";
import Church from "../models/Church.js";
import Group from "../models/Group.js";

const parsePagination = (page, limit, maxLimit = 100) => {
  const parsedPage = Math.max(Number(page) || 1, 1);
  const parsedLimit = Math.min(
    Math.max(Number(limit) || 20, 1),
    maxLimit
  );

  return {
    page: parsedPage,
    limit: parsedLimit,
  };
};

const getCampaign = async (campaignId) => {
  if (!mongoose.isValidObjectId(campaignId)) {
    throw new Error("Invalid campaign ID");
  }

  const campaign = await Campaign.findById(campaignId).lean();

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  return campaign;
};

const getCampaignDateRange = (campaign, asOfDate) => {
  const startDate = new Date(campaign.startDate);
  let endDate = new Date(campaign.endDate);

  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime())
  ) {
    throw new Error("Campaign has invalid dates");
  }

  if (asOfDate) {
    const requestedEndDate = new Date(
      `${asOfDate}T23:59:59.999`
    );

    if (Number.isNaN(requestedEndDate.getTime())) {
      throw new Error("Invalid as of date");
    }

    if (requestedEndDate < startDate) {
      throw new Error(
        "As of date cannot be before campaign start date"
      );
    }

    if (requestedEndDate < endDate) {
      endDate = requestedEndDate;
    }
  }

  return {
    startDate,
    endDate,
  };
};

const normalizeId = (value) => {
  if (!value) return null;

  if (typeof value === "object" && value._id) {
    return String(value._id);
  }

  return String(value);
};

const getPledgeAmount = (pledge) =>
  Number(
    pledge?.pledgeAmount ??
      pledge?.amount ??
      0
  );

const getMemberName = (member, pledge) =>
  member?.name ||
  pledge?.memberName ||
  "Unknown member";

const getChurchName = (member, pledge) =>
  member?.church?.name ||
  pledge?.churchName ||
  "Unassigned";

const getGroupName = (member, pledge) =>
  member?.group?.group_name ||
  pledge?.groupName ||
  "Unassigned";

const paginate = (items, page, limit) => {
  const total = items.length;

  const pages =
    total > 0
      ? Math.ceil(total / limit)
      : 0;

  const normalizedPage =
    pages > 0
      ? Math.min(page, pages)
      : 1;

  const start =
    (normalizedPage - 1) *
    limit;

  return {
    data: items.slice(
      start,
      start + limit
    ),

    pagination: {
      page: normalizedPage,
      limit,
      total,
      pages,
    },
  };
};

const getCampaignPledgeMap = async (campaignId) => {
  const pledges =
    await CampaignPledge.find({
      campaign: campaignId,
    })
      .sort({
        updatedAt: -1,
        createdAt: -1,
        pledgedAt: -1,
      })
      .populate({
        path: "member",
        select:
          "_id name phone kingschatId birthday church group",
        populate: [
          {
            path: "church",
            select:
              "_id name group",
          },
          {
            path: "group",
            select:
              "_id group_name",
          },
        ],
      })
      .populate({
        path: "church",
        select:
          "_id name group",
      })
      .populate({
        path: "group",
        select:
          "_id group_name",
      })
      .lean();

  const pledgeMap = new Map();

  for (const pledge of pledges) {
    const memberId = normalizeId(
      pledge.member
    );

    if (!memberId) continue;

    if (!pledgeMap.has(memberId)) {
      pledgeMap.set(
        memberId,
        pledge
      );
    }
  }

  return pledgeMap;
};

const getCampaignGivingMap = async ({
  campaign,
  startDate,
  endDate,
}) => {
  const givingRows =
    await Giving.aggregate([
      {
        $match: {
          deleted: false,
          arm: campaign.arm,
          date: {
            $gte: startDate,
            $lte: endDate,
          },
        },
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

          totalGiven: {
            $sum: "$amount",
          },

          transactionCount: {
            $sum: 1,
          },

          latestGivingDate: {
            $first: "$date",
          },

          church: {
            $first: "$church",
          },

          group: {
            $first: "$group",
          },
        },
      },
    ]);

  const givingMap = new Map();

  for (const row of givingRows) {
    const memberId =
      normalizeId(row._id);

    if (!memberId) continue;

    givingMap.set(
      memberId,
      row
    );
  }

  return givingMap;
};

const getFacultyCampaignMembers = async ({
  campaignId,
  asOfDate = null,
  page = 1,
  limit = 20,
  churchId = null,
  groupId = null,
}) => {
  const campaign =
    await getCampaign(campaignId);

  const {
    startDate,
    endDate,
  } = getCampaignDateRange(
    campaign,
    asOfDate
  );

  const pagination =
    parsePagination(
      page,
      limit,
      100
    );

  const [
    pledgeMap,
    givingMap,
  ] = await Promise.all([
    getCampaignPledgeMap(
      campaignId
    ),

    getCampaignGivingMap({
      campaign,
      startDate,
      endDate,
    }),
  ]);

  const memberIds = new Set([
    ...pledgeMap.keys(),
    ...givingMap.keys(),
  ]);

  if (memberIds.size === 0) {
    return {
      campaign,

      summary: {
        totalPledge: 0,
        totalGiven: 0,
        participants: 0,
        totalPledgers: 0,
        totalGivers: 0,
      },

      participants: [],

      pagination: {
        page: 1,
        limit: pagination.limit,
        total: 0,
        pages: 0,
      },
    };
  }

  const objectIds =
    Array.from(memberIds)
      .filter((id) =>
        mongoose.isValidObjectId(id)
      )
      .map(
        (id) =>
          new mongoose.Types.ObjectId(
            id
          )
      );

  const members =
    await Member.find({
      _id: {
        $in: objectIds,
      },
    })
      .select(
        "_id name phone kingschatId birthday church group"
      )
      .populate({
        path: "church",
        select:
          "_id name group",
      })
      .populate({
        path: "group",
        select:
          "_id group_name",
      })
      .lean();

  const memberMap = new Map(
    members.map((member) => [
      String(member._id),
      member,
    ])
  );

  const participants = [];

  for (const memberId of memberIds) {
    const pledge =
      pledgeMap.get(memberId);

    const giving =
      givingMap.get(memberId);

    const member =
      memberMap.get(memberId);

    const effectiveChurchId =
      normalizeId(
        member?.church
      ) ||
      normalizeId(
        pledge?.church
      ) ||
      normalizeId(
        giving?.church
      );

    const effectiveGroupId =
      normalizeId(
        member?.group
      ) ||
      normalizeId(
        pledge?.group
      ) ||
      normalizeId(
        giving?.group
      );

    if (
      churchId &&
      effectiveChurchId !==
        String(churchId)
    ) {
      continue;
    }

    if (
      groupId &&
      effectiveGroupId !==
        String(groupId)
    ) {
      continue;
    }

    const pledgeAmount =
      getPledgeAmount(pledge);

    const totalGiven =
      Number(
        giving?.totalGiven || 0
      );

    const transactionCount =
      Number(
        giving?.transactionCount || 0
      );

    const participant = {
      _id:
        member?._id ||
        pledge?.member?._id ||
        memberId,

      member:
        member ||
        pledge?.member ||
        null,

      memberName:
        getMemberName(
          member,
          pledge
        ),

      phone:
        member?.phone ||
        pledge?.phone ||
        null,

      kingschatId:
        member?.kingschatId ||
        pledge?.kingschatId ||
        null,

      church:
        member?.church ||
        pledge?.church ||
        null,

      group:
        member?.group ||
        pledge?.group ||
        null,

      churchName:
        getChurchName(
          member,
          pledge
        ),

      groupName:
        getGroupName(
          member,
          pledge
        ),

      pledgeAmount,

      pledgedAmount:
        pledgeAmount,

      totalPledge:
        pledgeAmount,

      totalGiven,

      totalGiving:
        totalGiven,

      givenAmount:
        totalGiven,

      balance:
        Math.max(
          pledgeAmount -
            totalGiven,
          0
        ),

      transactionCount,

      latestGivingDate:
        giving?.latestGivingDate ||
        null,

      date:
        giving?.latestGivingDate ||
        null,

      hasPledge:
        Boolean(pledge),

      hasGiving:
        transactionCount > 0,
    };

    participants.push(
      participant
    );
  }

  participants.sort((a, b) => {
    if (
      b.totalGiven !==
      a.totalGiven
    ) {
      return (
        b.totalGiven -
        a.totalGiven
      );
    }

    if (
      b.pledgeAmount !==
      a.pledgeAmount
    ) {
      return (
        b.pledgeAmount -
        a.pledgeAmount
      );
    }

    return a.memberName.localeCompare(
      b.memberName
    );
  });

  const totalPledge =
    participants.reduce(
      (sum, participant) =>
        sum +
        participant.pledgeAmount,
      0
    );

  const totalGiven =
    participants.reduce(
      (sum, participant) =>
        sum +
        participant.totalGiven,
      0
    );

  const totalPledgers =
    participants.filter(
      (participant) =>
        participant.hasPledge
    ).length;

  const totalGivers =
    participants.filter(
      (participant) =>
        participant.hasGiving
    ).length;

  const result = paginate(
    participants,
    pagination.page,
    pagination.limit
  );

  return {
    campaign,

    summary: {
      totalPledge,
      totalGiven,
      participants:
        participants.length,
      totalPledgers,
      totalGivers,
    },

    participants:
      result.data,

    pagination:
      result.pagination,
  };
};

const getFacultyCampaignChurches =
  async ({
    campaignId,
    asOfDate = null,
    page = 1,
    limit = 20,
  }) => {
    const campaign =
      await getCampaign(
        campaignId
      );

    const {
      startDate,
      endDate,
    } = getCampaignDateRange(
      campaign,
      asOfDate
    );

    const pagination =
      parsePagination(
        page,
        limit,
        100
      );

    const campaignObjectId =
      new mongoose.Types.ObjectId(
        campaignId
      );

    const [
      churches,
      pledgeRows,
      givingRows,
    ] = await Promise.all([
      Church.find({})
        .select(
          "_id name group totalMembers isActive"
        )
        .populate({
          path: "group",
          select:
            "_id group_name",
        })
        .lean(),

      CampaignPledge.aggregate([
        {
          $match: {
            campaign:
              campaignObjectId,
          },
        },

        {
          $group: {
            _id: "$church",

            totalPledge: {
              $sum: {
                $ifNull: [
                  "$pledgeAmount",
                  0,
                ],
              },
            },

            participants: {
              $addToSet:
                "$member",
            },
          },
        },

        {
          $project: {
            _id: 1,
            totalPledge: 1,

            participants: {
              $size:
                "$participants",
            },
          },
        },
      ]),

      Giving.aggregate([
        {
          $match: {
            deleted: false,
            arm: campaign.arm,
            date: {
              $gte: startDate,
              $lte: endDate,
            },
          },
        },

        {
          $group: {
            _id: "$church",

            totalGiven: {
              $sum: "$amount",
            },

            participants: {
              $addToSet:
                "$member",
            },
          },
        },

        {
          $project: {
            _id: 1,
            totalGiven: 1,

            participants: {
              $size:
                "$participants",
            },
          },
        },
      ]),
    ]);

    const pledgeMap = new Map(
      pledgeRows
        .filter((row) => row._id)
        .map((row) => [
          String(row._id),
          row,
        ])
    );

    const givingMap = new Map(
      givingRows
        .filter((row) => row._id)
        .map((row) => [
          String(row._id),
          row,
        ])
    );

    const churchReports =
      churches.map(
        (church) => {
          const churchId =
            String(
              church._id
            );

          const pledge =
            pledgeMap.get(
              churchId
            );

          const giving =
            givingMap.get(
              churchId
            );

          const pledgeParticipants =
            Number(
              pledge?.participants ||
                0
            );

          const givingParticipants =
            Number(
              giving?.participants ||
                0
            );

          return {
            _id: church._id,

            church,

            churchName:
              church.name ||
              "Unnamed church",

            group:
              church.group ||
              null,

            groupName:
              church.group
                ?.group_name ||
              "Unassigned",

            totalMembers:
              Number(
                church.totalMembers ||
                  0
              ),

            totalPledge:
              Number(
                pledge?.totalPledge ||
                  0
              ),

            totalGiven:
              Number(
                giving?.totalGiven ||
                  0
              ),

            participants:
              Math.max(
                pledgeParticipants,
                givingParticipants
              ),

            partnering:
              Boolean(
                pledge ||
                  giving
              ),

            isActive:
              church.isActive !==
              false,
          };
        }
      );

    churchReports.sort(
      (a, b) => {
        if (
          b.totalGiven !==
          a.totalGiven
        ) {
          return (
            b.totalGiven -
            a.totalGiven
          );
        }

        if (
          b.totalPledge !==
          a.totalPledge
        ) {
          return (
            b.totalPledge -
            a.totalPledge
          );
        }

        if (
          b.participants !==
          a.participants
        ) {
          return (
            b.participants -
            a.participants
          );
        }

        return a.churchName.localeCompare(
          b.churchName
        );
      }
    );

    const totalPledge =
      churchReports.reduce(
        (sum, church) =>
          sum +
          church.totalPledge,
        0
      );

    const totalGiven =
      churchReports.reduce(
        (sum, church) =>
          sum +
          church.totalGiven,
        0
      );

    const partneringChurches =
      churchReports.filter(
        (church) =>
          church.partnering
      ).length;

    const result = paginate(
      churchReports,
      pagination.page,
      pagination.limit
    );

    return {
      campaign,

      summary: {
        totalPledge,
        totalGiven,
        churches:
          churchReports.length,
        partneringChurches,
      },

      churches:
        result.data,

      pagination:
        result.pagination,
    };
  };

const getFacultyCampaignGroups =
  async ({
    campaignId,
    asOfDate = null,
    page = 1,
    limit = 20,
  }) => {
    const campaign =
      await getCampaign(
        campaignId
      );

    const {
      startDate,
      endDate,
    } = getCampaignDateRange(
      campaign,
      asOfDate
    );

    const pagination =
      parsePagination(
        page,
        limit,
        100
      );

    const campaignObjectId =
      new mongoose.Types.ObjectId(
        campaignId
      );

    const [
      groups,
      churches,
      pledgeRows,
      givingRows,
    ] = await Promise.all([
      Group.find({})
        .select(
          "_id group_name totalMembers isActive"
        )
        .lean(),

      Church.find({})
        .select(
          "_id name group isActive"
        )
        .lean(),

      CampaignPledge.aggregate([
        {
          $match: {
            campaign:
              campaignObjectId,
          },
        },

        {
          $group: {
            _id: "$group",

            totalPledge: {
              $sum: {
                $ifNull: [
                  "$pledgeAmount",
                  0,
                ],
              },
            },

            participants: {
              $addToSet:
                "$member",
            },

            churches: {
              $addToSet:
                "$church",
            },
          },
        },

        {
          $project: {
            _id: 1,
            totalPledge: 1,

            participants: {
              $size:
                "$participants",
            },

            churches: {
              $size: {
                $filter: {
                  input:
                    "$churches",
                  as: "church",
                  cond: {
                    $ne: [
                      "$$church",
                      null,
                    ],
                  },
                },
              },
            },
          },
        },
      ]),

      Giving.aggregate([
        {
          $match: {
            deleted: false,
            arm: campaign.arm,
            date: {
              $gte: startDate,
              $lte: endDate,
            },
          },
        },

        {
          $group: {
            _id: "$group",

            totalGiven: {
              $sum: "$amount",
            },

            participants: {
              $addToSet:
                "$member",
            },

            churches: {
              $addToSet:
                "$church",
            },
          },
        },

        {
          $project: {
            _id: 1,
            totalGiven: 1,

            participants: {
              $size:
                "$participants",
            },

            churches: {
              $size: {
                $filter: {
                  input:
                    "$churches",
                  as: "church",
                  cond: {
                    $ne: [
                      "$$church",
                      null,
                    ],
                  },
                },
              },
            },
          },
        },
      ]),
    ]);

    const pledgeMap = new Map(
      pledgeRows
        .filter((row) => row._id)
        .map((row) => [
          String(row._id),
          row,
        ])
    );

    const givingMap = new Map(
      givingRows
        .filter((row) => row._id)
        .map((row) => [
          String(row._id),
          row,
        ])
    );

    const churchCountMap =
      new Map();

    for (const church of churches) {
      const groupId =
        normalizeId(
          church.group
        );

      if (!groupId) continue;

      churchCountMap.set(
        groupId,
        (churchCountMap.get(
          groupId
        ) || 0) + 1
      );
    }

    const groupReports =
      groups.map((group) => {
        const groupId =
          String(group._id);

        const pledge =
          pledgeMap.get(
            groupId
          );

        const giving =
          givingMap.get(
            groupId
          );

        const pledgeParticipants =
          Number(
            pledge?.participants ||
              0
          );

        const givingParticipants =
          Number(
            giving?.participants ||
              0
          );

        const pledgeChurches =
          Number(
            pledge?.churches || 0
          );

        const givingChurches =
          Number(
            giving?.churches || 0
          );

        return {
          _id: group._id,

          group,

          groupName:
            group.group_name ||
            "Unnamed group",

          totalMembers:
            Number(
              group.totalMembers ||
                0
            ),

          totalChurches:
            churchCountMap.get(
              groupId
            ) || 0,

          totalPledge:
            Number(
              pledge?.totalPledge ||
                0
            ),

          totalGiven:
            Number(
              giving?.totalGiven ||
                0
            ),

          participants:
            Math.max(
              pledgeParticipants,
              givingParticipants
            ),

          partneringChurches:
            Math.max(
              pledgeChurches,
              givingChurches
            ),

          partnering:
            Boolean(
              pledge ||
                giving
            ),

          isActive:
            group.isActive !==
            false,
        };
      });

    groupReports.sort(
      (a, b) => {
        if (
          b.totalGiven !==
          a.totalGiven
        ) {
          return (
            b.totalGiven -
            a.totalGiven
          );
        }

        if (
          b.totalPledge !==
          a.totalPledge
        ) {
          return (
            b.totalPledge -
            a.totalPledge
          );
        }

        if (
          b.participants !==
          a.participants
        ) {
          return (
            b.participants -
            a.participants
          );
        }

        return a.groupName.localeCompare(
          b.groupName
        );
      }
    );

    const totalPledge =
      groupReports.reduce(
        (sum, group) =>
          sum +
          group.totalPledge,
        0
      );

    const totalGiven =
      groupReports.reduce(
        (sum, group) =>
          sum +
          group.totalGiven,
        0
      );

    const partneringGroups =
      groupReports.filter(
        (group) =>
          group.partnering
      ).length;

    const partneringChurches =
      groupReports.reduce(
        (sum, group) =>
          sum +
          group.partneringChurches,
        0
      );

    const result = paginate(
      groupReports,
      pagination.page,
      pagination.limit
    );

    return {
      campaign,

      summary: {
        totalPledge,
        totalGiven,
        groups:
          groupReports.length,
        partneringGroups,
        partneringChurches,
      },

      groups:
        result.data,

      pagination:
        result.pagination,
    };
  };

const getFacultyFinancialIndividuals = async ({
  arm,
  page = 1,
  limit = 20,
}) => {
  const pagination =
    parsePagination(
      page,
      limit,
      100
    );

  const givingRows =
    await Giving.aggregate([
      {
        $match: {
          deleted: false,
          arm,
        },
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

          latestGivingDate: {
            $first: "$date",
          },

          church: {
            $first: "$church",
          },

          group: {
            $first: "$group",
          },
        },
      },
    ]);

  const memberIds = givingRows
    .map((row) =>
      normalizeId(row._id)
    )
    .filter(Boolean);

  if (memberIds.length === 0) {
    return {
      arm,

      summary: {
        totalAmount: 0,
        totalTransactions: 0,
        totalGivers: 0,
      },

      individuals: [],

      pagination: {
        page: 1,
        limit: pagination.limit,
        total: 0,
        pages: 0,
      },
    };
  }

  const objectIds = memberIds
    .filter((id) =>
      mongoose.isValidObjectId(id)
    )
    .map(
      (id) =>
        new mongoose.Types.ObjectId(id)
    );

  const members =
    await Member.find({
      _id: {
        $in: objectIds,
      },
    })
      .select(
        "_id name phone kingschatId church group"
      )
      .populate({
        path: "church",
        select:
          "_id name group",
      })
      .populate({
        path: "group",
        select:
          "_id group_name",
      })
      .lean();

  const memberMap = new Map(
    members.map((member) => [
      String(member._id),
      member,
    ])
  );

  const individuals =
    givingRows.map((row) => {
      const memberId =
        normalizeId(row._id);

      const member =
        memberMap.get(memberId);

      const givingChurch =
        normalizeId(row.church);

      const givingGroup =
        normalizeId(row.group);

      const memberChurchId =
        normalizeId(member?.church);

      const memberGroupId =
        normalizeId(member?.group);

      const churchId =
        memberChurchId ||
        givingChurch;

      const groupId =
        memberGroupId ||
        givingGroup;

      return {
        _id:
          member?._id ||
          row._id,

        member:
          member || null,

        memberName:
          member?.name ||
          "Unknown member",

        phone:
          member?.phone ||
          null,

        kingschatId:
          member?.kingschatId ||
          null,

        church:
          member?.church ||
          row.church ||
          null,

        churchId,

        churchName:
          member?.church?.name ||
          "Unassigned",

        group:
          member?.group ||
          row.group ||
          null,

        groupId,

        groupName:
          member?.group?.group_name ||
          "Unassigned",

        totalAmount:
          Number(
            row.totalAmount || 0
          ),

        totalGiving:
          Number(
            row.totalAmount || 0
          ),

        transactionCount:
          Number(
            row.transactionCount ||
              0
          ),

        latestGivingDate:
          row.latestGivingDate ||
          null,

        date:
          row.latestGivingDate ||
          null,
      };
    });

  individuals.sort(
    (a, b) => {
      if (
        b.totalAmount !==
        a.totalAmount
      ) {
        return (
          b.totalAmount -
          a.totalAmount
        );
      }

      return a.memberName.localeCompare(
        b.memberName
      );
    }
  );

  const totalAmount =
    individuals.reduce(
      (sum, individual) =>
        sum +
        individual.totalAmount,
      0
    );

  const totalTransactions =
    individuals.reduce(
      (sum, individual) =>
        sum +
        individual.transactionCount,
      0
    );

  const result = paginate(
    individuals,
    pagination.page,
    pagination.limit
  );

  return {
    arm,

    summary: {
      totalAmount,
      totalTransactions,
      totalGivers:
        individuals.length,
    },

    individuals:
      result.data,

    pagination:
      result.pagination,
  };
};

const getFacultyFinancialChurches = async ({
  arm,
  page = 1,
  limit = 20,
}) => {
  const pagination =
    parsePagination(
      page,
      limit,
      100
    );

  const [
    churches,
    givingRows,
  ] = await Promise.all([
    Church.find({})
      .select(
        "_id name group totalMembers isActive"
      )
      .populate({
        path: "group",
        select:
          "_id group_name",
      })
      .lean(),

    Giving.aggregate([
      {
        $match: {
          deleted: false,
          arm,
        },
      },

      {
        $group: {
          _id: "$church",

          totalAmount: {
            $sum: "$amount",
          },

          transactionCount: {
            $sum: 1,
          },

          members: {
            $addToSet: "$member",
          },
        },
      },

      {
        $project: {
          _id: 1,
          totalAmount: 1,
          transactionCount: 1,

          members: {
            $size: {
              $filter: {
                input: "$members",
                as: "member",
                cond: {
                  $ne: [
                    "$$member",
                    null,
                  ],
                },
              },
            },
          },
        },
      },
    ]),
  ]);

  const givingMap = new Map(
    givingRows
      .filter((row) => row._id)
      .map((row) => [
        String(row._id),
        row,
      ])
  );

  const churchReports =
    churches.map((church) => {
      const churchId =
        String(church._id);

      const giving =
        givingMap.get(churchId);

      return {
        _id: church._id,

        church,

        churchName:
          church.name ||
          "Unnamed church",

        group:
          church.group ||
          null,

        groupId:
          normalizeId(
            church.group
          ),

        groupName:
          church.group
            ?.group_name ||
          "Unassigned",

        totalMembers:
          Number(
            church.totalMembers ||
              0
          ),

        totalAmount:
          Number(
            giving?.totalAmount ||
              0
          ),

        totalGiving:
          Number(
            giving?.totalAmount ||
              0
          ),

        individualGivers:
          Number(
            giving?.members ||
              0
          ),

        transactionCount:
          Number(
            giving?.transactionCount ||
              0
          ),

        isActive:
          church.isActive !==
          false,
      };
    });

  churchReports.sort(
    (a, b) => {
      if (
        b.totalAmount !==
        a.totalAmount
      ) {
        return (
          b.totalAmount -
          a.totalAmount
        );
      }

      if (
        b.individualGivers !==
        a.individualGivers
      ) {
        return (
          b.individualGivers -
          a.individualGivers
        );
      }

      return a.churchName.localeCompare(
        b.churchName
      );
    }
  );

  const totalAmount =
    churchReports.reduce(
      (sum, church) =>
        sum +
        church.totalAmount,
      0
    );

  const totalTransactions =
    churchReports.reduce(
      (sum, church) =>
        sum +
        church.transactionCount,
      0
    );

  const totalGivers =
    churchReports.reduce(
      (sum, church) =>
        sum +
        church.individualGivers,
      0
    );

  const result = paginate(
    churchReports,
    pagination.page,
    pagination.limit
  );

  return {
    arm,

    summary: {
      totalAmount,
      totalTransactions,
      totalGivers,
      totalChurches:
        churchReports.length,
      churchesWithGiving:
        churchReports.filter(
          (church) =>
            church.totalAmount > 0
        ).length,
    },

    churches:
      result.data,

    pagination:
      result.pagination,
  };
};

const getFacultyFinancialGroups = async ({
  arm,
  page = 1,
  limit = 20,
}) => {
  const pagination =
    parsePagination(
      page,
      limit,
      100
    );

  const [
    groups,
    churches,
    givingRows,
  ] = await Promise.all([
    Group.find({})
      .select(
        "_id group_name totalMembers isActive"
      )
      .lean(),

    Church.find({})
      .select(
        "_id name group isActive"
      )
      .lean(),

    Giving.aggregate([
      {
        $match: {
          deleted: false,
          arm,
        },
      },

      {
        $group: {
          _id: "$group",

          totalAmount: {
            $sum: "$amount",
          },

          transactionCount: {
            $sum: 1,
          },

          members: {
            $addToSet: "$member",
          },

          churches: {
            $addToSet: "$church",
          },
        },
      },

      {
        $project: {
          _id: 1,
          totalAmount: 1,
          transactionCount: 1,

          members: {
            $size: {
              $filter: {
                input: "$members",
                as: "member",
                cond: {
                  $ne: [
                    "$$member",
                    null,
                  ],
                },
              },
            },
          },

          churches: {
            $size: {
              $filter: {
                input: "$churches",
                as: "church",
                cond: {
                  $ne: [
                    "$$church",
                    null,
                  ],
                },
              },
            },
          },
        },
      },
    ]),
  ]);

  const givingMap = new Map(
    givingRows
      .filter((row) => row._id)
      .map((row) => [
        String(row._id),
        row,
      ])
  );

  const churchCountMap =
    new Map();

  for (const church of churches) {
    const groupId =
      normalizeId(
        church.group
      );

    if (!groupId) continue;

    churchCountMap.set(
      groupId,
      (churchCountMap.get(
        groupId
      ) || 0) + 1
    );
  }

  const groupReports =
    groups.map((group) => {
      const groupId =
        String(group._id);

      const giving =
        givingMap.get(groupId);

      return {
        _id: group._id,

        group,

        groupName:
          group.group_name ||
          "Unnamed group",

        totalMembers:
          Number(
            group.totalMembers ||
              0
          ),

        totalChurches:
          churchCountMap.get(
            groupId
          ) || 0,

        totalAmount:
          Number(
            giving?.totalAmount ||
              0
          ),

        totalGiving:
          Number(
            giving?.totalAmount ||
              0
          ),

        individualGivers:
          Number(
            giving?.members ||
              0
          ),

        transactionCount:
          Number(
            giving?.transactionCount ||
              0
          ),

        churchesWithGiving:
          Number(
            giving?.churches ||
              0
          ),

        isActive:
          group.isActive !==
          false,
      };
    });

  groupReports.sort(
    (a, b) => {
      if (
        b.totalAmount !==
        a.totalAmount
      ) {
        return (
          b.totalAmount -
          a.totalAmount
        );
      }

      if (
        b.individualGivers !==
        a.individualGivers
      ) {
        return (
          b.individualGivers -
          a.individualGivers
        );
      }

      return a.groupName.localeCompare(
        b.groupName
      );
    }
  );

  const totalAmount =
    groupReports.reduce(
      (sum, group) =>
        sum +
        group.totalAmount,
      0
    );

  const totalTransactions =
    groupReports.reduce(
      (sum, group) =>
        sum +
        group.transactionCount,
      0
    );

  const totalGivers =
    groupReports.reduce(
      (sum, group) =>
        sum +
        group.individualGivers,
      0
    );

  const result = paginate(
    groupReports,
    pagination.page,
    pagination.limit
  );

  return {
    arm,

    summary: {
      totalAmount,
      totalTransactions,
      totalGivers,
      totalGroups:
        groupReports.length,
      groupsWithGiving:
        groupReports.filter(
          (group) =>
            group.totalAmount > 0
        ).length,
    },

    groups:
      result.data,

    pagination:
      result.pagination,
  };
};

export {
  getFacultyCampaignMembers,
  getFacultyCampaignChurches,
  getFacultyCampaignGroups,
  getFacultyFinancialIndividuals,
  getFacultyFinancialChurches,
  getFacultyFinancialGroups,
};
