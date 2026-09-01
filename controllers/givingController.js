import fs from "fs";
import path from "path";
import xlsx from "xlsx";
import csvParser from "csv-parser";
import mongoose from "mongoose";

import Giving from "../models/Giving.js";
import Member from "../models/Member.js";
import Group from "../models/Group.js";
import Church from "../models/Church.js";
import Campaign from "../models/Campaign.js";
import MemberCampaignParticipation from "../models/MemberCampaignParticipation.js";

import { parse } from "json2csv";

const { Types } = mongoose;

/* =========================================================
   ARM HELPERS
========================================================= */

const normalizeArm = (value) => {
  if (!value) return "Rhapsody";

  const key = String(value)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");

  const map = {
    rhapsody: "Rhapsody",
    healing_school: "Healing School",
    ministry_programs: "Ministry Programs",
    loveworld_bibles: "Loveworld Bibles",
    innercity_missions: "Innercity Missions",
    lwpm: "LWPM",
  };

  return map[key] || "Rhapsody";
};

const hodArmMap = {
  healing_hod: "healing_school",
  rhapsody_hod: "rhapsody",
  ministry_hod: "ministry_programs",
  bibles_hod: "loveworld_bibles",
  innercity_hod: "innercity_missions",
  lwpm_hod: "lwpm",
};

const ROLE_TO_ARM = {
  healing_hod: "Healing School",
  rhapsody_hod: "Rhapsody",
  ministry_hod: "Ministry Programs",
  bibles_hod: "LoveWorld Bibles",
  innercity_hod: "InnerCity Missions",
  lwpm_hod: "LWPM",
};

/* =========================================================
   GENERAL HELPERS
========================================================= */

const isValidId = (id) => Types.ObjectId.isValid(id);

const normalizeDateRange = (date) => {
  const d = new Date(date);

  return {
    start: new Date(d.setHours(0, 0, 0, 0)),
    end: new Date(d.setHours(23, 59, 59, 999)),
  };
};

const normalizeMinistryYear = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return String(value).trim();
};

const escapeRegex = (value) => {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

/* =========================================================
   SAFE CAMPAIGN RESOLUTION
========================================================= */

const resolveCampaign = async ({ campaignId, givingDate }) => {
  if (campaignId && isValidId(campaignId)) {
    const campaign = await Campaign.findById(campaignId);

    if (!campaign) {
      throw new Error("Campaign not found");
    }

    return campaign;
  }

  const matches = await Campaign.find({
    startDate: { $lte: givingDate },
    endDate: { $gte: givingDate },
  });

  if (matches.length === 1) {
    console.warn("⚠️ Auto-attached campaign:", matches[0].name);
    return matches[0];
  }

  if (matches.length > 1) {
    throw new Error(
      "Multiple campaigns match this date. Please specify campaignId."
    );
  }

  throw new Error("No active campaign found for this date.");
};

/* =========================================================
   ADD GIVING
========================================================= */

export const addGiving = async (req, res) => {
  try {
    const {
      memberId,
      memberName,
      amount,
      arm,
      groupId,
      churchId,
      category,
      date,
      campaignId,
      ministryYear,
    } = req.body;

    // =====================================================
    // VALIDATION
    // =====================================================

    if ((!memberId && !memberName) || amount === undefined || !arm) {
      return res.status(400).json({
        message: "Missing required fields",
      });
    }

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        message: "Amount must be greater than 0",
      });
    }

    // Ministry year is optional.
    // Store null when it is not supplied.
    const normalizedMinistryYear =
      normalizeMinistryYear(ministryYear);

    // =====================================================
    // FIND MEMBER
    // =====================================================

    let member = null;

    if (memberId) {
      if (!isValidId(memberId)) {
        return res.status(400).json({
          message: "Invalid memberId",
        });
      }

      member = await Member.findById(memberId);
    }

    if (!member && memberName) {
      member = await Member.findOne({
        name: String(memberName).trim(),
      });
    }

    if (!member) {
      return res.status(404).json({
        message: "Member not found",
      });
    }

    // =====================================================
    // DATE
    // =====================================================

    const givingDate = date
      ? new Date(date)
      : new Date();

    if (Number.isNaN(givingDate.getTime())) {
      return res.status(400).json({
        message: "Invalid giving date",
      });
    }

    // =====================================================
    // CAMPAIGN
    // =====================================================

    let campaign = null;

    if (campaignId) {
      if (!isValidId(campaignId)) {
        return res.status(400).json({
          message: "Invalid campaignId",
        });
      }

      campaign = await Campaign.findById(campaignId);

      if (!campaign) {
        return res.status(404).json({
          message: "Campaign not found",
        });
      }
    }

    // =====================================================
    // CREATE GIVING
    // =====================================================

    const givingData = {
      member: member._id,
      amount: numericAmount,
      arm: normalizeArm(arm),
      date: givingDate,
      group: groupId || member.group || null,
      church: churchId || member.church || null,
      category: category || null,
      ministryYear: normalizedMinistryYear || null,
    };

    if (campaign) {
      givingData.campaign = campaign._id;
    }

    const giving = await Giving.create(givingData);

    console.log("Giving created:", {
      id: giving._id,
      member: member.name,
      amount: giving.amount,
      arm: giving.arm,
      ministryYear: giving.ministryYear,
      campaign: giving.campaign || null,
      date: giving.date,
    });

    return res.status(201).json({
      message: "Giving recorded successfully",
      giving,
    });
  } catch (err) {
    console.error("addGiving error:", err);

    if (err?.name === "ValidationError") {
      return res.status(400).json({
        message: err.message,
        errors: Object.fromEntries(
          Object.entries(err.errors || {}).map(
            ([key, value]) => [key, value.message]
          )
        ),
      });
    }

    return res.status(500).json({
      message: err.message || "Server error",
    });
  }
};

/* =========================================================
   DEBUG CAMPAIGN GIVINGS
========================================================= */

export const debugCampaignGivings = async (req, res) => {
  try {
    const { campaignId } = req.params;

    if (!isValidId(campaignId)) {
      return res.status(400).json({
        message: "Invalid campaignId",
      });
    }

    const givings = await Giving.find({
      campaign: campaignId,
      deleted: false,
    }).lean();

    console.log(
      "📊 DEBUG CAMPAIGN GIVINGS COUNT:",
      givings.length
    );

    console.log("📊 SAMPLE:", givings[0]);

    return res.json({
      count: givings.length,
      sample: givings[0] || null,
      data: givings,
    });
  } catch (err) {
    console.error("❌ debugCampaignGivings error:", err);

    return res.status(500).json({
      message: "Debug failed",
    });
  }
};

/* =========================================================
   MIGRATION FIX
========================================================= */

export const fixMissingCampaigns = async (req, res) => {
  try {
    const campaigns = await Campaign.find();

    const givings = await Giving.find({
      $or: [
        { campaign: null },
        { campaign: { $exists: false } },
      ],
    });

    let fixed = 0;

    for (const giving of givings) {
      const match = campaigns.find(
        (campaign) =>
          giving.date >= campaign.startDate &&
          giving.date <= campaign.endDate
      );

      if (match) {
        giving.campaign = match._id;
        await giving.save();
        fixed++;
      }
    }

    console.log(`✅ Fixed ${fixed} givings`);

    return res.json({
      message: "Migration complete",
      fixed,
    });
  } catch (err) {
    console.error("❌ Migration error:", err);

    return res.status(500).json({
      message: "Migration failed",
    });
  }
};

/* =========================================================
   GET ALL GIVINGS
========================================================= */

export const getGivings = async (req, res) => {
  try {
    let {
      page = 1,
      limit = 30,
      arm,
      groupId,
      churchId,
      campaignId,
      category,
      ministryYear,
      hodId,
      q,
      from,
      to,
    } = req.query;

    const returnAll = limit === "all";

    /* =====================================================
       HOD AUTO FILTER
    ===================================================== */

    if (req.user?.role?.includes("_hod")) {
      hodId = req.user.id;
    }

    /* =====================================================
       BASE MATCH
    ===================================================== */

    const match = {
      deleted: false,
    };

    if (arm) {
      match.arm = arm;
    }

    if (campaignId && isValidId(campaignId)) {
      match.campaign = new Types.ObjectId(campaignId);
    }

    if (category) {
      match.category = category;
    }

    if (ministryYear) {
      match.ministryYear = String(ministryYear);
    }

    if (from || to) {
      match.date = {};

      if (from) {
        match.date.$gte = new Date(from);
      }

      if (to) {
        match.date.$lte = new Date(to);
      }
    }

    /* =====================================================
       OBJECT FILTERS
    ===================================================== */

    const objectFilters = {};

    if (groupId && isValidId(groupId)) {
      objectFilters["member.group"] =
        new Types.ObjectId(groupId);
    }

    if (churchId && isValidId(churchId)) {
      objectFilters["member.church"] =
        new Types.ObjectId(churchId);
    }

    if (hodId && isValidId(hodId)) {
      objectFilters["member.hod"] =
        new Types.ObjectId(hodId);
    }

    /* =====================================================
       PIPELINE
    ===================================================== */

    const pipeline = [
      {
        $match: match,
      },

      {
        $lookup: {
          from: "members",
          localField: "member",
          foreignField: "_id",
          as: "member",
        },
      },

      {
        $unwind: "$member",
      },

      ...(q
        ? [
            {
              $match: {
                "member.name": {
                  $regex: escapeRegex(q),
                  $options: "i",
                },
              },
            },
          ]
        : []),

      {
        $match: objectFilters,
      },

      {
        $lookup: {
          from: "churches",
          localField: "member.church",
          foreignField: "_id",
          as: "member.church",
        },
      },

      {
        $unwind: {
          path: "$member.church",
          preserveNullAndEmptyArrays: true,
        },
      },

      {
        $lookup: {
          from: "groups",
          localField: "member.group",
          foreignField: "_id",
          as: "member.group",
        },
      },

      {
        $unwind: {
          path: "$member.group",
          preserveNullAndEmptyArrays: true,
        },
      },

      {
        $lookup: {
          from: "campaigns",
          localField: "campaign",
          foreignField: "_id",
          as: "campaign",
        },
      },

      {
        $unwind: {
          path: "$campaign",
          preserveNullAndEmptyArrays: true,
        },
      },

      {
        $project: {
          amount: 1,
          date: 1,
          arm: 1,
          campaign: 1,
          category: 1,
          ministryYear: 1,
          deleted: 1,

          "member._id": 1,
          "member.name": 1,
          "member.phone": 1,
          "member.hod": 1,

          "member.church._id": 1,
          "member.church.name": 1,

          "member.group._id": 1,
          "member.group.name": 1,
        },
      },

      {
        $sort: {
          date: -1,
        },
      },
    ];

    /* =====================================================
       TOTAL
    ===================================================== */

    const totalResult = await Giving.aggregate([
      ...pipeline,
      {
        $count: "total",
      },
    ]);

    const total = totalResult[0]?.total || 0;

    let rows;

    /* =====================================================
       RETURN ALL
    ===================================================== */

    if (returnAll) {
      rows = await Giving.aggregate(pipeline);
    } else {
      limit = Number(limit);
      page = Number(page);

      const skip = (page - 1) * limit;

      pipeline.push(
        {
          $skip: skip,
        },
        {
          $limit: limit,
        }
      );

      rows = await Giving.aggregate(pipeline);
    }

    return res.json({
      data: rows,
      meta: {
        total,
        page: returnAll ? 1 : page,
        limit: returnAll ? "all" : limit,
        totalPages: returnAll
          ? 1
          : Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("getGivings error:", err);

    return res.status(500).json({
      message: "Server error",
    });
  }
};

/* =========================================================
   UPDATE GIVING
========================================================= */

export const updateGiving = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        message: "Invalid giving ID",
      });
    }

    const existing = await Giving.findById(id);

    if (!existing) {
      return res.status(404).json({
        message: "Giving not found",
      });
    }

    const updateData = {
      ...req.body,
    };

    if (
      updateData.amount !== undefined &&
      Number(updateData.amount) <= 0
    ) {
      return res.status(400).json({
        message: "Invalid amount",
      });
    }

    if (updateData.amount !== undefined) {
      updateData.amount = Number(updateData.amount);
    }

    if (updateData.date) {
      updateData.date = new Date(updateData.date);

      if (Number.isNaN(updateData.date.getTime())) {
        return res.status(400).json({
          message: "Invalid date",
        });
      }
    }

    if (updateData.ministryYear !== undefined) {
      updateData.ministryYear =
        normalizeMinistryYear(updateData.ministryYear);

      if (!updateData.ministryYear) {
        return res.status(400).json({
          message: "Ministry year is required",
        });
      }
    }

    if (updateData.arm) {
      updateData.arm = normalizeArm(updateData.arm);
    }

    if (updateData.campaignId !== undefined) {
      if (
        updateData.campaignId &&
        !isValidId(updateData.campaignId)
      ) {
        return res.status(400).json({
          message: "Invalid campaignId",
        });
      }

      updateData.campaign =
        updateData.campaignId || null;

      delete updateData.campaignId;
    }

    const updated = await Giving.findByIdAndUpdate(
      id,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    );

    return res.json({
      message: "Giving updated",
      giving: updated,
    });
  } catch (err) {
    console.error("updateGiving error:", err);

    return res.status(500).json({
      message: err.message || "Server error",
    });
  }
};

/* =========================================================
   DELETE GIVING
========================================================= */

export const deleteGiving = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        message: "Invalid giving ID",
      });
    }

    const giving = await Giving.findById(id);

    if (!giving) {
      return res.status(404).json({
        message: "Giving not found",
      });
    }

    const {
      member,
      campaign,
      amount,
    } = giving;

    await Giving.findByIdAndDelete(id);

    /* =====================================================
       UPDATE PARTICIPATION
    ===================================================== */

    if (campaign && member) {
      await MemberCampaignParticipation.findOneAndUpdate(
        {
          member,
          campaign,
        },
        {
          $inc: {
            totalContributed: -Number(amount || 0),
          },
        }
      );
    }

    /* =====================================================
       GLOBAL SUMMARY
    ===================================================== */

    const givingsAgg = await Giving.aggregate([
      {
        $match: {
          deleted: false,
        },
      },

      {
        $group: {
          _id: null,

          totalAmount: {
            $sum: "$amount",
          },

          count: {
            $sum: 1,
          },
        },
      },
    ]);

    const totalGivingsAmount =
      givingsAgg[0]?.totalAmount || 0;

    const totalGivingsCount =
      givingsAgg[0]?.count || 0;

    return res.status(200).json({
      message: "Giving deleted successfully",

      summary: {
        totalGivingsAmount,
        totalGivingsCount,
      },
    });
  } catch (error) {
    console.error("Error deleting giving:", error);

    return res.status(500).json({
      message: "Server error while deleting giving",
    });
  }
};

/* =========================================================
   RESTORE GIVING
========================================================= */

export const restoreGiving = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        message: "Invalid giving ID",
      });
    }

    const updated = await Giving.findByIdAndUpdate(
      id,
      {
        deleted: false,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updated) {
      return res.status(404).json({
        message: "Giving not found",
      });
    }

    return res.json({
      message: "Giving restored",
      giving: updated,
    });
  } catch (err) {
    console.error("restoreGiving error:", err);

    return res.status(500).json({
      message: err.message,
    });
  }
};

/* =========================================================
   BULK UPLOAD GIVINGS
========================================================= */

export const bulkUploadGivings = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "No file uploaded",
      });
    }

    const ext = path.extname(
      req.file.originalname.toLowerCase()
    );

    let createdMembers = 0;
    let createdGivings = 0;
    let skippedDuplicates = 0;

    const duplicateRows = [];
    const newMembers = [];

    /* =====================================================
       PROCESS ROW
    ===================================================== */

    const processRow = async (row) => {
      const name = String(
        row.name ||
          row.Name ||
          ""
      ).trim();

      const amount = Number(
        row.amount ||
          row.Amount ||
          0
      );

      const arm = normalizeArm(
        row.arm ||
          row.Arm ||
          "Rhapsody"
      );

      const groupName = String(
        row.group ||
          row.Group ||
          ""
      ).trim();

      const churchName = String(
        row.church ||
          row.Church ||
          ""
      ).trim();

      const dateVal =
        row.date ||
        row.Date ||
        "";

      const campaignName = String(
        row.campaign ||
          row.Campaign ||
          ""
      ).trim();

      const categoryName = String(
        row.category ||
          row.Category ||
          ""
      ).trim();

      const ministryYear =
        normalizeMinistryYear(
          row.ministryYear ||
            row.MinistryYear ||
            row["Ministry Year"] ||
            row["ministry year"] ||
            ""
        );

      /* ===================================================
         REQUIRED FIELDS
      =================================================== */

      if (!name || !amount) {
        return;
      }

      if (!ministryYear) {
        duplicateRows.push({
          name,
          amount,
          date: dateVal,
          reason: "Missing ministry year",
        });

        return;
      }

      /* ===================================================
         GROUP
      =================================================== */

      let groupDoc = groupName
        ? await Group.findOne({
            name: groupName,
          })
        : null;

      if (groupName && !groupDoc) {
        groupDoc = await Group.create({
          name: groupName,
        });
      }

      /* ===================================================
         CHURCH
      =================================================== */

      let churchDoc = churchName
        ? await Church.findOne({
            name: churchName,
            group: groupDoc?._id,
          })
        : null;

      if (churchName && !churchDoc) {
        churchDoc = await Church.create({
          name: churchName,
          group: groupDoc?._id,
        });
      }

      /* ===================================================
         MEMBER
      =================================================== */

      let memberDoc =
        (await Member.findOne({
          name,
          church: churchDoc?._id,
        })) ||
        (await Member.findOne({
          name,
        }));

      if (!memberDoc) {
        memberDoc = await Member.create({
          name,
          church: churchDoc?._id || null,
          group: groupDoc?._id || null,
        });

        createdMembers++;

        newMembers.push({
          name,
          id: memberDoc._id,
        });
      }

      /* ===================================================
         CAMPAIGN
      =================================================== */

      let campaignDoc = null;

      if (campaignName) {
        campaignDoc = await Campaign.findOne({
          name: campaignName,
        });
      }

      /* ===================================================
         DATE
      =================================================== */

      const givingDate = dateVal
        ? new Date(dateVal)
        : new Date();

      if (Number.isNaN(givingDate.getTime())) {
        duplicateRows.push({
          name,
          amount,
          date: dateVal,
          ministryYear,
          reason: "Invalid date",
        });

        return;
      }

      const {
        start,
        end,
      } = normalizeDateRange(givingDate);

      /* ===================================================
         DUPLICATE CHECK
      =================================================== */

      const exists = await Giving.findOne({
        member: memberDoc._id,
        amount,
        date: {
          $gte: start,
          $lte: end,
        },
        arm,
        campaign: campaignDoc?._id || null,
        category: categoryName || null,
        ministryYear,
      });

      if (exists) {
        skippedDuplicates++;

        duplicateRows.push({
          name,
          amount,
          date: givingDate,
          ministryYear,
          reason: "duplicate",
        });

        return;
      }

      /* ===================================================
         CREATE GIVING
      =================================================== */

      await Giving.create({
        member: memberDoc._id,
        amount,
        arm,
        date: givingDate,
        group: groupDoc?._id || null,
        church: churchDoc?._id || null,
        campaign: campaignDoc?._id || null,
        category: categoryName || null,
        ministryYear,
      });

      createdGivings++;
    };

    /* =====================================================
       READ FILE
    ===================================================== */

    let rows = [];

    if (ext === ".csv") {
      await new Promise((resolve, reject) => {
        fs.createReadStream(req.file.path)
          .pipe(csvParser())
          .on("data", (row) => {
            rows.push(row);
          })
          .on("end", resolve)
          .on("error", reject);
      });

      fs.unlink(req.file.path, () => {});
    } else {
      const workbook = xlsx.read(
        req.file.buffer,
        {
          type: "buffer",
        }
      );

      const sheet =
        workbook.Sheets[
          workbook.SheetNames[0]
        ];

      rows = xlsx.utils.sheet_to_json(
        sheet,
        {
          defval: "",
        }
      );
    }

    /* =====================================================
       PROCESS SEQUENTIALLY
    ===================================================== */

    for (const row of rows) {
      await processRow(row);
    }

    return res.json({
      message: "Upload processed",
      createdMembers,
      createdGivings,
      skippedDuplicates,
      duplicates: duplicateRows.slice(0, 50),
      newMembers: newMembers.slice(0, 50),
    });
  } catch (err) {
    console.error("bulkUploadGivings error:", err);

    return res.status(500).json({
      message: err.message || "Server error",
    });
  }
};

/* =========================================================
   INTERNAL REPORT HELPER
========================================================= */

export const getReportsInternal = async ({
  user,
  type,
  from,
  to,
  page = 1,
  limit = 20,
  ministryYear,
  arm,
}) => {
  const typeMap = {
    individual: "member",
    member: "member",
    group: "group",
    church: "church",
    campaign: "campaign",
    category: "category",
  };

  const reportType =
    typeMap[String(type || "").toLowerCase()];

  if (!reportType) {
    throw new Error("Invalid report type");
  }

  /* =====================================================
     HOD ARM
  ===================================================== */

  let partnershipArm = null;

  if (user?.role?.endsWith("_hod")) {
    partnershipArm =
      hodArmMap[user.role]?.toLowerCase();
  }

  /* =====================================================
     BASE MATCH
  ===================================================== */

  const baseMatch = {
    deleted: false,
  };

  if (from || to) {
    baseMatch.date = {};

    if (from) {
      baseMatch.date.$gte = new Date(
        new Date(from).setHours(
          0,
          0,
          0,
          0
        )
      );
    }

    if (to) {
      baseMatch.date.$lte = new Date(
        new Date(to).setHours(
          23,
          59,
          59,
          999
        )
      );
    }
  }

  if (ministryYear) {
    baseMatch.ministryYear =
      String(ministryYear);
  }

  if (arm) {
    baseMatch.arm = normalizeArm(arm);
  }

  /* =====================================================
     PIPELINE
  ===================================================== */

  const pipeline = [
    {
      $addFields: {
        normalizedArm: {
          $replaceAll: {
            input: {
              $toLower: "$arm",
            },
            find: " ",
            replacement: "_",
          },
        },
      },
    },

    {
      $match: {
        ...baseMatch,

        ...(partnershipArm
          ? {
              normalizedArm: partnershipArm,
            }
          : {}),
      },
    },

    {
      $lookup: {
        from: "members",
        localField: "member",
        foreignField: "_id",
        as: "member",
      },
    },

    {
      $unwind: "$member",
    },

    {
      $lookup: {
        from: "churches",
        localField: "member.church",
        foreignField: "_id",
        as: "member.church",
      },
    },

    {
      $unwind: {
        path: "$member.church",
        preserveNullAndEmptyArrays: true,
      },
    },

    {
      $lookup: {
        from: "groups",
        localField: "member.group",
        foreignField: "_id",
        as: "member.group",
      },
    },

    {
      $unwind: {
        path: "$member.group",
        preserveNullAndEmptyArrays: true,
      },
    },

    {
      $lookup: {
        from: "categories",
        localField: "member.category",
        foreignField: "_id",
        as: "member.category",
      },
    },

    {
      $unwind: {
        path: "$member.category",
        preserveNullAndEmptyArrays: true,
      },
    },

    {
      $lookup: {
        from: "campaigns",
        localField: "campaign",
        foreignField: "_id",
        as: "campaign",
      },
    },

    {
      $unwind: {
        path: "$campaign",
        preserveNullAndEmptyArrays: true,
      },
    },

    {
      $group:
        reportType === "member"
          ? {
              _id: "$member._id",

              name: {
                $first: "$member.name",
              },

              phone: {
                $first: "$member.phone",
              },

              church: {
                $first: "$member.church.name",
              },

              group: {
                $first: "$member.group.name",
              },

              category: {
                $first: "$member.category.name",
              },

              pledge: {
                $first: "$member.pledge",
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

              totalAmount: {
                $sum: "$amount",
              },
            }
          : reportType === "church"
          ? {
              _id: "$member.church._id",

              name: {
                $first: "$member.church.name",
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

              totalAmount: {
                $sum: "$amount",
              },
            }
          : reportType === "group"
          ? {
              _id: "$member.group._id",

              name: {
                $first: "$member.group.name",
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

              totalAmount: {
                $sum: "$amount",
              },
            }
          : reportType === "campaign"
          ? {
              _id: "$campaign._id",

              name: {
                $first: "$campaign.name",
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

              totalAmount: {
                $sum: "$amount",
              },
            }
          : {
              _id: "$member.category._id",

              name: {
                $first: "$member.category.name",
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

              totalAmount: {
                $sum: "$amount",
              },
            },
    },

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

    {
      $project: {
        monthlyRaw: 0,
      },
    },

    {
      $sort: {
        totalAmount: -1,
      },
    },

    {
      $skip:
        (Number(page) - 1) *
        Number(limit),
    },

    {
      $limit: Number(limit),
    },
  ];

  const rows = await Giving.aggregate(pipeline);

  /* =====================================================
     GRAND TOTAL
  ===================================================== */

  const grandTotalPipeline = [
    {
      $addFields: {
        normalizedArm: {
          $replaceAll: {
            input: {
              $toLower: "$arm",
            },
            find: " ",
            replacement: "_",
          },
        },
      },
    },

    {
      $match: {
        ...baseMatch,

        ...(partnershipArm
          ? {
              normalizedArm: partnershipArm,
            }
          : {}),
      },
    },

    {
      $group: {
        _id: null,

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
  ];

  const allRows = await Giving.aggregate(
    grandTotalPipeline
  );

  const grandTotal =
    allRows[0]?.totalAmount || 0;

  return {
    rows,
    grandTotal,
    monthly: allRows[0]?.monthlyRaw || [],
  };
};

/* =========================================================
   UNIFIED REPORT ENDPOINT
========================================================= */

export const getReports = async (req, res) => {
  try {
    const { type, from, to } = req.query;

    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const partnershipArm = req.user.role?.endsWith("_hod")
      ? hodArmMap[req.user.role]?.toLowerCase()
      : null;

    const data = await getReportsInternal({ user: req.user, type, from, to });

    // Extra per-arm total for HODs
    let armTotal = 0;
    if (partnershipArm) {
      const match = { deleted: false, normalizedArm: partnershipArm };
      if (from || to) {
        match.date = {};
        if (from) match.date.$gte = new Date(new Date(from).setHours(0, 0, 0, 0));
        if (to) match.date.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
      }

      const armTotalAgg = await Giving.aggregate([
        { $addFields: { normalizedArm: { $replaceAll: { input: { $toLower: "$arm" }, find: " ", replacement: "_" } } } },
        { $match: match },
        { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
      ]);

      armTotal = armTotalAgg[0]?.totalAmount || 0;
    }

    return res.json({ data, armTotal });
  } catch (err) {
    console.error("getReports error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};


export const downloadReportsCSV = async (req, res) => {
  try {
    const { type = "member", from, to } = req.query;

    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    // Determine HOD arm if user is a HOD
    const partnershipArm = req.user.role?.endsWith("_hod")
      ? hodArmMap[req.user.role]?.toLowerCase()
      : null;

    // Build base match for date filtering
    const match = { deleted: false };
    if (from || to) {
      match.date = {};
      if (from) match.date.$gte = new Date(new Date(from).setHours(0, 0, 0, 0));
      if (to) match.date.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
    }

    if (partnershipArm) {
      match.normalizedArm = partnershipArm;
    }

    // Normalize type
    const typeMap = {
      individual: "member",
      member: "member",
      group: "group",
      church: "church",
    };
    const reportType = typeMap[type.toLowerCase()];
    if (!reportType) return res.status(400).json({ message: "Invalid report type" });

    // Aggregation pipeline
    const pipeline = [
      // Normalize arm
      {
        $addFields: {
          normalizedArm: { $replaceAll: { input: { $toLower: "$arm" }, find: " ", replacement: "_" } },
        },
      },
      { $match: match },
      { $lookup: { from: "members", localField: "member", foreignField: "_id", as: "member" } },
      { $unwind: "$member" },
      { $lookup: { from: "churches", localField: "member.church", foreignField: "_id", as: "member.church" } },
      { $unwind: { path: "$member.church", preserveNullAndEmptyArrays: true } },
      { $lookup: { from: "groups", localField: "member.group", foreignField: "_id", as: "member.group" } },
      { $unwind: { path: "$member.group", preserveNullAndEmptyArrays: true } },
      {
        $group: (() => {
          switch (reportType) {
            case "member":
              return {
                _id: "$member._id",
                name: { $first: "$member.name" },
                phone: { $first: "$member.phone" },
                church: { $first: "$member.church.name" },
                group: { $first: "$member.group.name" },
                totalAmount: { $sum: "$amount" },
                arms: { $push: { arm: "$arm", amount: "$amount" } },
              };
            case "group":
              return {
                _id: "$member.group._id",
                name: { $first: "$member.group.name" },
                totalAmount: { $sum: "$amount" },
                arms: { $push: { arm: "$arm", amount: "$amount" } },
              };
            case "church":
              return {
                _id: "$member.church._id",
                name: { $first: "$member.church.name" },
                group: { $first: "$member.group.name" },
                totalAmount: { $sum: "$amount" },
                arms: { $push: { arm: "$arm", amount: "$amount" } },
              };
          }
        })(),
      },
      { $sort: { totalAmount: -1 } },
    ];

    const rows = await Giving.aggregate(pipeline);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "No records found for the selected filters" });
    }

    // Convert aggregation result to CSV
    const csv = parse(
      rows.map((row) => {
        const result = {
          id: row._id,
          name: row.name || "TOTAL",
          totalAmount: row.totalAmount,
          arms: row.arms ? row.arms.map((a) => `${a.arm}:${a.amount}`).join("; ") : "",
        };
        if (reportType === "member") {
          result.phone = row.phone || "";
          result.church = row.church || "";
          result.group = row.group || "";
        }
        if (reportType === "church") {
          result.group = row.group || "";
        }
        return result;
      })
    );

    res.header("Content-Type", "text/csv");
    res.attachment(`report-${reportType}-${Date.now()}.csv`);
    return res.send(csv);
  } catch (err) {
    console.error("downloadReportsCSV error:", err);
    return res.status(500).json({ message: "Error generating CSV" });
  }
};



/* =========================================================
   GET HOD REPORTS (MAIN FUNCTION)
========================================================= */
export const getHodReport = async (req, res) => {
  try {
    console.log("🚀 HOD REPORT REQUEST STARTED");

    const { type = "individual", from, to, page = 1, limit = 20 } = req.query;
    const role = req.user?.role;

    if (!role) return res.status(401).json({ message: "Unauthorized" });

    const arm = ROLE_TO_ARM[role];
    if (!arm) return res.status(403).json({ message: "Invalid HOD role" });

    console.log("🎯 HOD Arm:", arm);

    const normalizedArm = arm.toLowerCase().replace(/\s+/g, "_");

    /* =========================================================
       1️⃣ GET CAMPAIGN (FOR MCP ONLY)
    ========================================================= */
    const campaign = await Campaign.findOne({
      arm: new RegExp(`^${arm}$`, "i"),
      deleted: false,
    }).sort({ startDate: -1 });

    if (!campaign) {
      console.log("⚠️ No campaign found");
    } else {
      console.log("📌 Campaign:", campaign.name);
    }

    /* =========================================================
       2️⃣ MATCH GIVINGS BY ARM
    ========================================================= */
    const match = {
      deleted: false,
      $expr: {
        $eq: [
          {
            $replaceAll: {
              input: { $toLower: "$arm" },
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
      if (from) match.date.$gte = new Date(from);
      if (to) {
        const d = new Date(to);
        d.setHours(23, 59, 59, 999);
        match.date.$lte = d;
      }
    }

    console.log("🔎 MATCH:", JSON.stringify(match));

    /* =========================================================
       3️⃣ GROUP FIELD
    ========================================================= */
    let groupIdField = "$member._id";
    if (type === "church") groupIdField = "$church._id";
    if (type === "group") groupIdField = "$group._id";

    /* =========================================================
       4️⃣ PIPELINE
    ========================================================= */
    const pipeline = [
      { $match: match },

      // MEMBER
      {
        $lookup: {
          from: "members",
          localField: "member",
          foreignField: "_id",
          as: "member",
        },
      },
      { $unwind: { path: "$member", preserveNullAndEmptyArrays: true } },

      // GROUP
      {
        $lookup: {
          from: "groups",
          localField: "member.group",
          foreignField: "_id",
          as: "group",
        },
      },
      { $unwind: { path: "$group", preserveNullAndEmptyArrays: true } },

      // CHURCH
      {
        $lookup: {
          from: "churches",
          localField: "member.church",
          foreignField: "_id",
          as: "church",
        },
      },
      { $unwind: { path: "$church", preserveNullAndEmptyArrays: true } },

      /* =============================
         🔥 MCP (FIXED: ONLY WHEN CAMPAIGN EXISTS)
      ============================= */
      ...(campaign
        ? [
            {
              $lookup: {
                from: "membercampaignparticipations",
                let: { memberId: "$member._id" },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $eq: ["$member", "$$memberId"] },
                          { $eq: ["$campaign", campaign._id] },
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

      // CATEGORY FROM MCP
      {
        $lookup: {
          from: "categories",
          localField: "mcp.pledgedCategory",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },

      /* =============================
         GROUPING
      ============================= */
      {
        $group: {
          _id: groupIdField,

          name: { $first: "$member.name" },
          phone: { $first: "$member.phone" },
          church: { $first: "$church.name" },

          group: { $first: "$group.group_name" },

          category: { $first: "$category.name" },
          pledgeAmount: { $first: "$mcp.targetAmount" },

          totalAmount: { $sum: "$amount" },

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

      /* =============================
         MONTHLY MAP
      ============================= */
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
                              $eq: ["$$m.month", "$$monthKey"],  
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

      { $project: { monthlyRaw: 0 } },

      { $sort: { totalAmount: -1 } },
      { $skip: (parseInt(page) - 1) * parseInt(limit) },
      { $limit: parseInt(limit) },
    ];

    const rows = await Giving.aggregate(pipeline);

    console.log("📊 Rows:", rows.length);

    /* =========================================================
       ALL ROWS
    ========================================================= */
    const allRowsPipeline = [...pipeline];
    allRowsPipeline.pop();
    allRowsPipeline.pop();

    const allRows = await Giving.aggregate(allRowsPipeline);

    const grandTotal = allRows.reduce(
      (acc, g) => acc + (g.totalAmount || 0),
      0
    );

    /* =========================================================
       NORMALIZATION
    ========================================================= */
    const normalize = (v, d = "-") => (v || v === 0 ? v : d);

    rows.forEach((r) => {
      r.name = normalize(r.name, "Unnamed");
      r.phone = normalize(r.phone);
      r.church = normalize(r.church);
      r.group = normalize(r.group);
      r.category = normalize(r.category, "Uncategorized");
      r.pledgeAmount = normalize(r.pledgeAmount, 0);
    });

    console.log("✅ HOD REPORT READY");

    return res.json({
      data: {
        rows,
        allRows,
        grandTotal,
        meta: { total: allRows.length },
      },
    });
  } catch (err) {
    console.error("❌ HOD REPORT ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  } 
};  