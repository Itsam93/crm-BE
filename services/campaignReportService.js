import mongoose from "mongoose";
import Campaign from "../models/Campaign.js";
import CampaignPledge from "../models/CampaignPledge.js";
import Giving from "../models/Giving.js";
import Church from "../models/Church.js";
import Group from "../models/Group.js";
import Member from "../models/Member.js";

const validateObjectId = (value, message) => {
  if (!mongoose.isValidObjectId(value)) {
    throw new Error(message);
  }
};

const getDateRange = async (campaignId, asOfDate = null) => {
  validateObjectId(campaignId, "Invalid campaign ID");

  const campaign = await Campaign.findById(campaignId).lean();

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  if (!campaign.arm) {
    throw new Error(
      "Campaign does not have a partnership arm"
    );
  }

  const startDate = new Date(campaign.startDate);

  if (Number.isNaN(startDate.getTime())) {
    throw new Error("Campaign has an invalid start date");
  }

  let endDate;

  if (asOfDate) {
    endDate = new Date(`${asOfDate}T23:59:59.999`);

    if (Number.isNaN(endDate.getTime())) {
      throw new Error("Invalid report date");
    }
  } else if (campaign.endDate) {
    endDate = new Date(campaign.endDate);
  } else {
    endDate = new Date();
  }

  if (campaign.endDate) {
    const campaignEndDate = new Date(
      campaign.endDate
    );

    if (endDate > campaignEndDate) {
      endDate = campaignEndDate;
    }
  }

  if (endDate < startDate) {
    throw new Error(
      "Report date cannot be before the campaign start date"
    );
  }

  return {
    campaign,
    startDate,
    endDate,
  };
};

const getGivingDetails = async ({
  campaign,
  startDate,
  endDate,
}) => {
  return Giving.aggregate([
    {
      $match: {
        arm: campaign.arm,
        deleted: false,
        date: {
          $gte: startDate,
          $lte: endDate,
        },
      },
    },
    {
      $group: {
        _id: "$member",
        amountGiven: {
          $sum: "$amount",
        },
        firstGivingDate: {
          $min: "$date",
        },
        lastGivingDate: {
          $max: "$date",
        },
        givingCount: {
          $sum: 1,
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
};

const calculateProgress = (
  pledgeAmount,
  amountGiven
) => {
  if (!pledgeAmount || pledgeAmount <= 0) {
    return null;
  }

  return Number(
    ((amountGiven / pledgeAmount) * 100).toFixed(2)
  );
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

  const startIndex =
    (normalizedPage - 1) * limit;

  return {
    items: items.slice(
      startIndex,
      startIndex + limit
    ),
    pagination: {
      page: normalizedPage,
      limit,
      total,
      pages,
    },
  };
};

const getMemberReport = async ({
  campaignId,
  asOfDate = null,
  page = 1,
  limit = 20,
  churchId = null,
  groupId = null,
}) => {
  const {
    campaign,
    startDate,
    endDate,
  } = await getDateRange(
    campaignId,
    asOfDate
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

  const [pledges, givingDetails] =
    await Promise.all([
      CampaignPledge.find({
        campaign: campaign._id,
        ...(churchId
          ? { church: churchId }
          : {}),
        ...(groupId
          ? { group: groupId }
          : {}),
      }).lean(),

      getGivingDetails({
        campaign,
        startDate,
        endDate,
      }),
    ]);

  const pledgeMap = new Map(
    pledges.map((pledge) => [
      pledge.member.toString(),
      pledge,
    ])
  );

  const givingMap = new Map(
    givingDetails.map((giving) => [
      giving._id.toString(),
      giving,
    ])
  );

  const memberIds = new Set([
    ...pledges.map((pledge) =>
      pledge.member.toString()
    ),
    ...givingDetails.map((giving) =>
      giving._id.toString()
    ),
  ]);

  const memberObjectIds = [
    ...memberIds,
  ].map(
    (id) => new mongoose.Types.ObjectId(id)
  );

  const members =
    memberObjectIds.length > 0
      ? await Member.find({
          _id: {
            $in: memberObjectIds,
          },
          deleted: false,
          ...(churchId
            ? { church: churchId }
            : {}),
          ...(groupId
            ? { group: groupId }
            : {}),
        })
          .select(
            "_id name phone kingschatId birthday church group"
          )
          .populate(
            "church",
            "_id name group"
          )
          .populate(
            "group",
            "_id group_name"
          )
          .lean()
      : [];

  const memberMap = new Map(
    members.map((member) => [
      member._id.toString(),
      member,
    ])
  );

  const participants = [];

  for (const memberId of memberIds) {
    const pledge = pledgeMap.get(memberId);
    const giving = givingMap.get(memberId);
    const member = memberMap.get(memberId);

    if (!pledge && !giving) {
      continue;
    }

    const amountGiven = Number(
      giving?.amountGiven || 0
    );

    const pledgeAmount = pledge
      ? Number(pledge.pledgeAmount || 0)
      : null;

    const church = pledge
      ? {
          id: pledge.church,
          name: pledge.churchName,
        }
      : member?.church
        ? {
            id: member.church._id,
            name: member.church.name,
          }
        : giving?.church
          ? {
              id: giving.church,
              name: "Unknown Church",
            }
          : null;

    const group = pledge
      ? {
          id: pledge.group,
          name: pledge.groupName,
        }
      : member?.group
        ? {
            id: member.group._id,
            name: member.group.group_name,
          }
        : giving?.group
          ? {
              id: giving.group,
              name: "Unknown Group",
            }
          : null;

    participants.push({
      memberId,
      rank: 0,
      memberName:
        pledge?.memberName ||
        member?.name ||
        "Unknown Member",
      church,
      group,
      phone:
        pledge?.phone ??
        member?.phone ??
        "",
      kingschatId:
        pledge?.kingschatId ??
        member?.kingschatId ??
        "",
      birthday:
        pledge?.birthday ??
        member?.birthday ??
        null,
      pledgeAmount,
      pledgeStatus: pledge
        ? "Pledged"
        : "Pending",
      amountGiven,
      progress: calculateProgress(
        pledgeAmount,
        amountGiven
      ),
      givingStatus: giving
        ? "Giver"
        : "No Giving",
      firstGivingDate:
        giving?.firstGivingDate || null,
      lastGivingDate:
        giving?.lastGivingDate || null,
      givingCount:
        giving?.givingCount || 0,
      customValues:
        pledge?.customValues || {},
    });
  }

  participants.sort((a, b) => {
    if (b.amountGiven !== a.amountGiven) {
      return (
        b.amountGiven - a.amountGiven
      );
    }

    return a.memberName.localeCompare(
      b.memberName
    );
  });

  participants.forEach(
    (participant, index) => {
      participant.rank = index + 1;
    }
  );

  const paginationConfig =
    parsePagination(
      page,
      limit,
      500
    );

  const {
    items: paginatedParticipants,
    pagination,
  } = paginate(
    participants,
    paginationConfig.page,
    paginationConfig.limit
  );

  const pledgerCount =
    participants.filter(
      (participant) =>
        participant.pledgeAmount !== null
    ).length;

  const giverCount =
    participants.filter(
      (participant) =>
        participant.amountGiven > 0
    ).length;

  const totalPledge =
    participants.reduce(
      (sum, participant) =>
        sum +
        (participant.pledgeAmount || 0),
      0
    );

  const totalGiven =
    participants.reduce(
      (sum, participant) =>
        sum + participant.amountGiven,
      0
    );

  return {
    campaign: {
      id: campaign._id,
      name: campaign.name,
      description: campaign.description,
      arm: campaign.arm,
      startDate,
      endDate: campaign.endDate,
      reportEndDate: endDate,
      status: campaign.status,
      customFields: campaign.customFields,
    },

    summary: {
      participants: participants.length,
      pledgers: pledgerCount,
      givers: giverCount,
      totalPledge,
      totalGiven,
      progress: totalPledge
        ? Number(
            (
              (totalGiven /
                totalPledge) *
              100
            ).toFixed(2)
          )
        : null,
    },

    participants: paginatedParticipants,

    pagination,
  };
};

const getChurchReport = async ({
  campaignId,
  asOfDate = null,
  page = 1,
  limit = 20,
}) => {
  const {
    campaign,
    startDate,
    endDate,
  } = await getDateRange(
    campaignId,
    asOfDate
  );

  const [
    churches,
    pledges,
    givingDetails,
  ] = await Promise.all([
    Church.find({})
      .select(
        "_id name group totalMembers isActive"
      )
      .lean(),

    CampaignPledge.find({
      campaign: campaign._id,
    })
      .select(
        "member church group pledgeAmount"
      )
      .lean(),

    getGivingDetails({
      campaign,
      startDate,
      endDate,
    }),
  ]);

  const churchMap = new Map(
    churches.map((church) => [
      church._id.toString(),
      {
        churchId: church._id,
        churchName: church.name,
        groupId: church.group,
        totalMembers: Number(
          church.totalMembers || 0
        ),
        isActive:
          church.isActive !== false,
        pledgers: 0,
        givers: new Set(),
        participants: new Set(),
        totalPledge: 0,
        totalGiven: 0,
      },
    ])
  );

  const pledgeMemberIds = pledges.map(
    (pledge) => pledge.member
  );

  const givingMemberIds =
    givingDetails.map(
      (giving) => giving._id
    );

  const participantIds = [
    ...new Set([
      ...pledgeMemberIds.map((id) =>
        id.toString()
      ),
      ...givingMemberIds.map((id) =>
        id.toString()
      ),
    ]),
  ];

  const participantObjectIds =
    participantIds.map(
      (id) =>
        new mongoose.Types.ObjectId(id)
    );

  const members =
    participantObjectIds.length > 0
      ? await Member.find({
          _id: {
            $in: participantObjectIds,
          },
          deleted: false,
        })
          .select(
            "_id church group"
          )
          .lean()
      : [];

  const memberMap = new Map(
    members.map((member) => [
      member._id.toString(),
      member,
    ])
  );

  for (const pledge of pledges) {
    const memberId =
      pledge.member.toString();

    const member =
      memberMap.get(memberId);

    const churchId =
      member?.church?.toString() ||
      pledge.church?.toString();

    if (!churchId) {
      continue;
    }

    const church =
      churchMap.get(churchId);

    if (!church) {
      continue;
    }

    church.pledgers += 1;

    church.participants.add(
      memberId
    );

    church.totalPledge += Number(
      pledge.pledgeAmount || 0
    );
  }

  for (const giving of givingDetails) {
    const memberId =
      giving._id.toString();

    const member =
      memberMap.get(memberId);

    const churchId =
      member?.church?.toString() ||
      giving.church?.toString();

    if (!churchId) {
      continue;
    }

    const church =
      churchMap.get(churchId);

    if (!church) {
      continue;
    }

    church.givers.add(
      memberId
    );

    church.participants.add(
      memberId
    );

    church.totalGiven += Number(
      giving.amountGiven || 0
    );
  }

  const report = [
    ...churchMap.values(),
  ].map((church) => {
    const totalPledge =
      church.totalPledge;

    const totalGiven =
      church.totalGiven;

    return {
      churchId: church.churchId,
      churchName: church.churchName,
      groupId: church.groupId,
      totalMembers:
        church.totalMembers,
      isActive:
        church.isActive,
      pledgers:
        church.pledgers,
      givers:
        church.givers.size,
      participants:
        church.participants.size,
      totalPledge,
      totalGiven,
      progress:
        calculateProgress(
          totalPledge,
          totalGiven
        ),
      participated:
        church.participants.size > 0,
    };
  });

  report.sort((a, b) => {
    if (
      b.participants !==
      a.participants
    ) {
      return (
        b.participants -
        a.participants
      );
    }

    if (b.totalGiven !== a.totalGiven) {
      return (
        b.totalGiven -
        a.totalGiven
      );
    }

    return a.churchName.localeCompare(
      b.churchName
    );
  });

  report.forEach(
    (church, index) => {
      church.rank = index + 1;
    }
  );

  const participatingChurches =
    report.filter(
      (church) =>
        church.participants > 0
    ).length;

  const totalPledge =
    report.reduce(
      (sum, church) =>
        sum + church.totalPledge,
      0
    );

  const totalGiven =
    report.reduce(
      (sum, church) =>
        sum + church.totalGiven,
      0
    );

  const paginationConfig =
    parsePagination(
      page,
      limit,
      100
    );

  const {
    items: paginatedChurches,
    pagination,
  } = paginate(
    report,
    paginationConfig.page,
    paginationConfig.limit
  );

  return {
    campaign: {
      id: campaign._id,
      name: campaign.name,
      arm: campaign.arm,
      startDate,
      endDate: campaign.endDate,
      reportEndDate: endDate,
    },

    summary: {
      churches: report.length,
      participatingChurches,
      totalPledge,
      totalGiven,
      progress:
        calculateProgress(
          totalPledge,
          totalGiven
        ),
    },

    churches: paginatedChurches,

    pagination,
  };
};

const getGroupReport = async ({
  campaignId,
  asOfDate = null,
  page = 1,
  limit = 20,
}) => {
  const {
    campaign,
    startDate,
    endDate,
  } = await getDateRange(
    campaignId,
    asOfDate
  );

  const [
    groups,
    churches,
    pledges,
    givingDetails,
  ] = await Promise.all([
    Group.find({
      isActive: true,
    })
      .select(
        "_id group_name totalMembers"
      )
      .lean(),

    Church.find({
      isActive: true,
    })
      .select("_id name group")
      .lean(),

    CampaignPledge.find({
      campaign: campaign._id,
    }).lean(),

    getGivingDetails({
      campaign,
      startDate,
      endDate,
    }),
  ]);

  const groupMap = new Map(
    groups.map((group) => [
      group._id.toString(),
      {
        groupId: group._id,
        groupName: group.group_name,
        totalMembers: Number(
          group.totalMembers || 0
        ),
        totalChurches: 0,
        partneringChurches:
          new Set(),
        pledgers: 0,
        givers: new Set(),
        participants: new Set(),
        totalPledge: 0,
        totalGiven: 0,
      },
    ])
  );

  for (const church of churches) {
    const group =
      groupMap.get(
        church.group?.toString()
      );

    if (group) {
      group.totalChurches += 1;
    }
  }

  for (const pledge of pledges) {
    const group =
      groupMap.get(
        pledge.group?.toString()
      );

    if (!group) {
      continue;
    }

    group.pledgers += 1;

    group.participants.add(
      pledge.member.toString()
    );

    group.totalPledge += Number(
      pledge.pledgeAmount || 0
    );

    if (pledge.church) {
      group.partneringChurches.add(
        pledge.church.toString()
      );
    }
  }

  const givingMemberIds =
    givingDetails.map(
      (giving) => giving._id
    );

  const givingMemberMap =
    new Map(
      givingDetails.map((giving) => [
        giving._id.toString(),
        giving,
      ])
    );

  if (givingMemberIds.length > 0) {
    const givingMembers =
      await Member.find({
        _id: {
          $in: givingMemberIds,
        },
        deleted: false,
      })
        .select(
          "_id group church"
        )
        .lean();

    for (const member of givingMembers) {
      const giving =
        givingMemberMap.get(
          member._id.toString()
        );

      if (!giving) {
        continue;
      }

      const groupId =
        member.group?.toString() ||
        giving.group?.toString();

      if (!groupId) {
        continue;
      }

      const group =
        groupMap.get(groupId);

      if (!group) {
        continue;
      }

      group.givers.add(
        member._id.toString()
      );

      group.participants.add(
        member._id.toString()
      );

      group.totalGiven += Number(
        giving.amountGiven || 0
      );

      const churchId =
        member.church?.toString() ||
        giving.church?.toString();

      if (churchId) {
        group.partneringChurches.add(
          churchId
        );
      }
    }
  }

  const report = [
    ...groupMap.values(),
  ].map((group) => {
    const totalChurches =
      group.totalChurches;

    const partneringChurches =
      group.partneringChurches.size;

    const churchParticipationCoverage =
      totalChurches > 0
        ? Number(
            (
              (partneringChurches /
                totalChurches) *
              100
            ).toFixed(2)
          )
        : 0;

    const totalPledge =
      group.totalPledge;

    const totalGiven =
      group.totalGiven;

    return {
      groupId: group.groupId,
      groupName: group.groupName,
      totalMembers:
        group.totalMembers,
      totalChurches,
      partneringChurches,
      churchParticipationCoverage,
      pledgers: group.pledgers,
      givers: group.givers.size,
      participants:
        group.participants.size,
      totalPledge,
      totalGiven,
      progress:
        calculateProgress(
          totalPledge,
          totalGiven
        ),
      participated:
        group.participants.size > 0,
    };
  });

  report.sort((a, b) => {
    if (
      b.churchParticipationCoverage !==
      a.churchParticipationCoverage
    ) {
      return (
        b.churchParticipationCoverage -
        a.churchParticipationCoverage
      );
    }

    if (
      b.partneringChurches !==
      a.partneringChurches
    ) {
      return (
        b.partneringChurches -
        a.partneringChurches
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

    if (b.totalGiven !== a.totalGiven) {
      return (
        b.totalGiven -
        a.totalGiven
      );
    }

    return a.groupName.localeCompare(
      b.groupName
    );
  });

  report.forEach(
    (group, index) => {
      group.rank = index + 1;
    }
  );

  const highestPartnerCountGroup =
    [...report].sort((a, b) => {
      if (b.givers !== a.givers) {
        return b.givers - a.givers;
      }

      return (
        b.participants -
        a.participants
      );
    })[0] || null;

  const totalPledge =
    report.reduce(
      (sum, group) =>
        sum + group.totalPledge,
      0
    );

  const totalGiven =
    report.reduce(
      (sum, group) =>
        sum + group.totalGiven,
      0
    );

  const paginationConfig =
    parsePagination(
      page,
      limit,
      100
    );

  const {
    items: paginatedGroups,
    pagination,
  } = paginate(
    report,
    paginationConfig.page,
    paginationConfig.limit
  );

  return {
    campaign: {
      id: campaign._id,
      name: campaign.name,
      arm: campaign.arm,
      startDate,
      endDate: campaign.endDate,
      reportEndDate: endDate,
    },

    summary: {
      groups: report.length,
      participatingGroups:
        report.filter(
          (group) =>
            group.participated
        ).length,
      totalPledge,
      totalGiven,
      progress:
        calculateProgress(
          totalPledge,
          totalGiven
        ),
      highestPartnerCountGroup,
    },

    groups: paginatedGroups,

    pagination,
  };
};

const getCampaignSummary = async ({
  campaignId,
  asOfDate = null,
}) => {
  const {
    campaign,
    startDate,
    endDate,
  } = await getDateRange(
    campaignId,
    asOfDate
  );

  const [
    pledgeSummary,
    givingSummary,
  ] = await Promise.all([
    CampaignPledge.aggregate([
      {
        $match: {
          campaign: campaign._id,
        },
      },
      {
        $group: {
          _id: null,
          pledgers: {
            $sum: 1,
          },
          totalPledge: {
            $sum: "$pledgeAmount",
          },
        },
      },
    ]),

    Giving.aggregate([
      {
        $match: {
          arm: campaign.arm,
          deleted: false,
          date: {
            $gte: startDate,
            $lte: endDate,
          },
        },
      },
      {
        $group: {
          _id: "$member",
          amountGiven: {
            $sum: "$amount",
          },
        },
      },
      {
        $group: {
          _id: null,
          givers: {
            $sum: 1,
          },
          totalGiven: {
            $sum: "$amountGiven",
          },
        },
      },
    ]),
  ]);

  const pledgers =
    pledgeSummary[0]?.pledgers || 0;

  const totalPledge =
    pledgeSummary[0]?.totalPledge || 0;

  const givers =
    givingSummary[0]?.givers || 0;

  const totalGiven =
    givingSummary[0]?.totalGiven || 0;

  const [
    pledgerIds,
    giverIds,
  ] = await Promise.all([
    CampaignPledge.distinct(
      "member",
      {
        campaign: campaign._id,
      }
    ),

    Giving.distinct(
      "member",
      {
        arm: campaign.arm,
        deleted: false,
        date: {
          $gte: startDate,
          $lte: endDate,
        },
      }
    ),
  ]);

  const participantIds =
    new Set([
      ...pledgerIds.map((id) =>
        id.toString()
      ),
      ...giverIds.map((id) =>
        id.toString()
      ),
    ]);

  return {
    campaign: {
      id: campaign._id,
      name: campaign.name,
      description:
        campaign.description,
      arm: campaign.arm,
      startDate,
      endDate: campaign.endDate,
      reportEndDate: endDate,
      status: campaign.status,
    },

    summary: {
      participants:
        participantIds.size,
      pledgers,
      givers,
      totalPledge,
      totalGiven,
      progress:
        calculateProgress(
          totalPledge,
          totalGiven
        ),
    },
  };
};

export {
  getMemberReport,
  getChurchReport,
  getGroupReport,
  getCampaignSummary,
};
