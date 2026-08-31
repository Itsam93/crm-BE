import mongoose from "mongoose";
import MinistryYear from "../models/ministryYear.js";
import Giving from "../models/Giving.js";

/* =========================================================
   GET ALL MINISTRY YEARS
========================================================= */

export const getMinistryYears = async (req, res) => {
  try {
    const years = await MinistryYear.find()
      .sort({ startDate: -1 });

    return res.status(200).json(years);
  } catch (err) {
    console.error(
      "getMinistryYears error:",
      err
    );

    return res.status(500).json({
      message:
        "Error fetching ministry years.",
    });
  }
};

/* =========================================================
   GET CURRENT MINISTRY YEAR
========================================================= */

export const getCurrentMinistryYear = async (
  req,
  res
) => {
  try {
    const current =
      await MinistryYear.findOne({
        status: "Current",
      });

    if (!current) {
      return res.status(404).json({
        message:
          "No current ministry year found.",
      });
    }

    return res.status(200).json(current);
  } catch (err) {
    console.error(
      "getCurrentMinistryYear error:",
      err
    );

    return res.status(500).json({
      message:
        "Error fetching current ministry year.",
    });
  }
};

/* =========================================================
   CREATE MINISTRY YEAR
========================================================= */

export const createMinistryYear = async (
  req,
  res
) => {
  try {
    const {
      name,
      startDate,
      endDate,
      description = "",
    } = req.body;

    /* ------------------------------------------------------
       Required fields
    ------------------------------------------------------ */

    if (
      !name ||
      !startDate ||
      !endDate
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Name, start date and end date are required.",
      });
    }

    /* ------------------------------------------------------
       Validate dates
    ------------------------------------------------------ */

    const start = new Date(
      startDate
    );

    const end = new Date(
      endDate
    );

    if (
      isNaN(start.getTime()) ||
      isNaN(end.getTime())
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid date supplied.",
      });
    }

    if (start >= end) {
      return res.status(400).json({
        success: false,
        message:
          "End date must be after the start date.",
      });
    }

    /* ------------------------------------------------------
       Duplicate name
    ------------------------------------------------------ */

    const duplicate =
      await MinistryYear.findOne({
        name: name.trim(),
      });

    if (duplicate) {
      return res.status(400).json({
        success: false,
        message:
          "A ministry year with this name already exists.",
      });
    }

    /* ------------------------------------------------------
       Prevent overlapping years
    ------------------------------------------------------ */

    const overlap =
      await MinistryYear.findOne({
        startDate: {
          $lte: end,
        },

        endDate: {
          $gte: start,
        },
      });

    if (overlap) {
      return res.status(400).json({
        success: false,
        message:
          `Date range overlaps with "${overlap.name}".`,
      });
    }

    /* ------------------------------------------------------
       Determine status
    ------------------------------------------------------ */

    const current =
      await MinistryYear.findOne({
        status: "Current",
      });

    /*
     * If no current year exists, the new year becomes Current.
     *
     * Otherwise it becomes Upcoming.
     */

    const status = current
      ? "Upcoming"
      : "Current";

    const isActive =
      status === "Current";

    /* ------------------------------------------------------
       Create
    ------------------------------------------------------ */

    const ministryYear =
      await MinistryYear.create({
        name: name.trim(),

        startDate: start,

        endDate: end,

        description,

        status,

        isActive,

        createdBy:
          req.user?.id || null,
      });

    return res.status(201).json({
      success: true,

      message:
        status === "Current"
          ? "Ministry year created and activated successfully."
          : "Ministry year created successfully.",

      ministryYear,
    });
  } catch (err) {
    console.error(
      "createMinistryYear error:",
      err
    );

    return res.status(500).json({
      success: false,
      message:
        "Error creating ministry year.",
    });
  }
};

/* =========================================================
   UPDATE MINISTRY YEAR
========================================================= */

export const updateMinistryYear = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(
        id
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid ministry year ID.",
      });
    }

    const ministryYear =
      await MinistryYear.findById(id);

    if (!ministryYear) {
      return res.status(404).json({
        success: false,
        message:
          "Ministry year not found.",
      });
    }

    const {
      name,
      startDate,
      endDate,
      description = "",
    } = req.body;

    /* ------------------------------------------------------
       Required fields
    ------------------------------------------------------ */

    if (
      !name ||
      !startDate ||
      !endDate
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Name, start date and end date are required.",
      });
    }

    /* ------------------------------------------------------
       Validate dates
    ------------------------------------------------------ */

    const start =
      new Date(startDate);

    const end =
      new Date(endDate);

    if (
      isNaN(start.getTime()) ||
      isNaN(end.getTime())
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid date supplied.",
      });
    }

    if (start >= end) {
      return res.status(400).json({
        success: false,
        message:
          "End date must be after the start date.",
      });
    }

    /* ------------------------------------------------------
       Prevent overlapping years
    ------------------------------------------------------ */

    const overlap =
      await MinistryYear.findOne({
        _id: {
          $ne: id,
        },

        startDate: {
          $lte: end,
        },

        endDate: {
          $gte: start,
        },
      });

    if (overlap) {
      return res.status(400).json({
        success: false,
        message:
          `The selected dates overlap with "${overlap.name}".`,
      });
    }

    /* ------------------------------------------------------
       Prevent duplicate names
    ------------------------------------------------------ */

    const duplicate =
      await MinistryYear.findOne({
        _id: {
          $ne: id,
        },

        name: name.trim(),
      });

    if (duplicate) {
      return res.status(400).json({
        success: false,
        message:
          "A ministry year with this name already exists.",
      });
    }

    /* ------------------------------------------------------
       Update fields
    ------------------------------------------------------ */

    ministryYear.name =
      name.trim();

    ministryYear.startDate =
      start;

    ministryYear.endDate =
      end;

    ministryYear.description =
      description;

    /*
     * Do NOT change status here.
     *
     * Activation is handled by
     * activateMinistryYear().
     */

    await ministryYear.save();

    return res.status(200).json({
      success: true,

      message:
        "Ministry year updated successfully.",

      ministryYear,
    });
  } catch (err) {
    console.error(
      "updateMinistryYear error:",
      err
    );

    return res.status(500).json({
      success: false,

      message:
        "Error updating ministry year.",
    });
  }
};

/* =========================================================
   ACTIVATE MINISTRY YEAR
========================================================= */

export const activateMinistryYear = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(
        id
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid ministry year ID.",
      });
    }

    const ministryYear =
      await MinistryYear.findById(id);

    if (!ministryYear) {
      return res.status(404).json({
        success: false,
        message:
          "Ministry year not found.",
      });
    }

    /* ------------------------------------------------------
       Archive the existing Current year
    ------------------------------------------------------ */

    await MinistryYear.updateMany(
      {
        _id: {
          $ne: id,
        },

        status: "Current",
      },
      {
        $set: {
          status: "Archived",

          isActive: false,
        },
      }
    );

    /* ------------------------------------------------------
       Activate selected year
    ------------------------------------------------------ */

    ministryYear.status =
      "Current";

    ministryYear.isActive =
      true;

    await ministryYear.save();

    return res.status(200).json({
      success: true,

      message:
        "Ministry year activated successfully.",

      ministryYear,
    });
  } catch (err) {
    console.error(
      "activateMinistryYear error:",
      err
    );

    return res.status(500).json({
      success: false,

      message:
        "Error activating ministry year.",
    });
  }
};

/* =========================================================
   DELETE MINISTRY YEAR
========================================================= */

export const deleteMinistryYear = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(
        id
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid ministry year ID.",
      });
    }

    const ministryYear =
      await MinistryYear.findById(id);

    if (!ministryYear) {
      return res.status(404).json({
        success: false,
        message:
          "Ministry year not found.",
      });
    }

    /* ------------------------------------------------------
       Protect Current year
    ------------------------------------------------------ */

    if (
      ministryYear.status ===
        "Current" ||
      ministryYear.isActive
    ) {
      return res.status(400).json({
        success: false,
        message:
          "The current ministry year cannot be deleted. Activate another ministry year first.",
      });
    }

    /* ------------------------------------------------------
       Protect years with givings
    ------------------------------------------------------ */

    const givingCount =
      await Giving.countDocuments({
        ministryYear:
          ministryYear._id,
      });

    if (givingCount > 0) {
      return res.status(400).json({
        success: false,

        message:
          `This ministry year has ${givingCount} giving record(s) attached to it and cannot be deleted.`,
      });
    }

    /* ------------------------------------------------------
       Delete
    ------------------------------------------------------ */

    await ministryYear.deleteOne();

    return res.status(200).json({
      success: true,

      message:
        "Ministry year deleted successfully.",
    });
  } catch (err) {
    console.error(
      "deleteMinistryYear error:",
      err
    );

    return res.status(500).json({
      success: false,

      message:
        "Error deleting ministry year.",
    });
  }
};
