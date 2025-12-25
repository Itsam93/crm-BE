import mongoose from "mongoose";
import Marriage from "../models/Marriage.js";
import Member from "../models/Member.js";

/* ===============================
   CREATE MARRIAGE (Admin Only)
================================= */
export const createMarriage = async (req, res) => {
  try {
    const { husbandId, wifeId, weddingDate } = req.body;

    if (!husbandId || !wifeId || !weddingDate) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (!mongoose.Types.ObjectId.isValid(husbandId) ||
        !mongoose.Types.ObjectId.isValid(wifeId)) {
      return res.status(400).json({ message: "Invalid member ID" });
    }

    if (husbandId === wifeId) {
      return res.status(400).json({ message: "A member cannot marry themselves" });
    }

    // Ensure members exist
    const [husband, wife] = await Promise.all([
      Member.findById(husbandId),
      Member.findById(wifeId),
    ]);

    if (!husband || !wife) {
      return res.status(404).json({ message: "Member not found" });
    }

    // Prevent multiple active marriages
    const existingMarriage = await Marriage.findOne({
      status: "active",
      $or: [
        { husband: husbandId },
        { wife: husbandId },
        { husband: wifeId },
        { wife: wifeId },
      ],
    });

    if (existingMarriage) {
      return res.status(409).json({
        message: "One or both members are already in an active marriage",
      });
    }

    const marriage = await Marriage.create({
      husband: husbandId,
      wife: wifeId,
      weddingDate,
      church: husband.church,
      group: husband.group,
    });

    res.status(201).json(marriage);
  } catch (err) {
    console.error("Create marriage error:", err);
    res.status(500).json({ message: err.message });
  }
};

/* ===============================
   UPDATE MARRIAGE
================================= */
export const updateMarriage = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const marriage = await Marriage.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!marriage) {
      return res.status(404).json({ message: "Marriage not found" });
    }

    res.json(marriage);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ===============================
   END MARRIAGE 
================================= */
export const endMarriage = async (req, res) => {
  try {
    const { id } = req.params;

    const marriage = await Marriage.findByIdAndUpdate(
      id,
      { status: "separated" },
      { new: true }
    );

    if (!marriage) {
      return res.status(404).json({ message: "Marriage not found" });
    }

    res.json({ message: "Marriage ended successfully", marriage });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ===============================
   GET MARRIAGES 
================================= */
export const getMarriages = async (req, res) => {
  try {
    const marriages = await Marriage.find({ status: "active" })
      .populate("husband", "name")
      .populate("wife", "name");

    res.json(marriages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
