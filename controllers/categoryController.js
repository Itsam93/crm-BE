import mongoose from "mongoose";
import Category from "../models/Category.js";
import Campaign from "../models/Campaign.js";


// ----------------------------------
// GET /categories/:campaignId
// ----------------------------------
export const getCategories = async (req, res) => {
  try {
    const { campaignId } = req.params;

    if (!campaignId) {
      return res.status(400).json({ message: "Campaign ID is required" });
    }

    const categories = await Category.find({
      campaign: campaignId,
      deleted: false,
    }).sort({ order: 1 });

    res.json(categories);
  } catch (err) {
    console.error("Error fetching categories:", err);
    res.status(500).json({ message: "Server error fetching categories" });
  }
};


// ----------------------------------
// POST /categories
// ----------------------------------
export const createCategory = async (req, res) => {
  try {
    const { name, minAmount, maxAmount, campaign, order } = req.body;

    if (!name || minAmount === undefined || !campaign || !order) {
      return res.status(400).json({
        message: "Name, minAmount, campaign, and order are required",
      });
    }

    const existingCampaign = await Campaign.findById(campaign);

    if (!existingCampaign) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    const category = await Category.create({
      name,
      minAmount: Number(minAmount),
      maxAmount:
        maxAmount === undefined || maxAmount === null
          ? null
          : Number(maxAmount),
      campaign,
      order: Number(order),
    });

    res.status(201).json(category);
  } catch (err) {
    console.error("Create category error:", err);
    res.status(500).json({ message: "Server error creating category" });
  }
};


// ----------------------------------
// PATCH /categories/:id
// ----------------------------------
export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, minAmount, maxAmount, order } = req.body;

    if (!name || minAmount === undefined || order === undefined) {
      return res.status(400).json({
        message: "Name, minAmount and order are required",
      });
    }

    const category = await Category.findByIdAndUpdate(
      id,
      {
        name,
        minAmount: Number(minAmount),
        maxAmount:
          maxAmount === undefined || maxAmount === null
            ? null
            : Number(maxAmount),
        order: Number(order),
      },
      { new: true }
    );

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.json(category);
  } catch (err) {
    console.error("Update category error:", err);
    res.status(500).json({ message: "Server error updating category" });
  }
};


// ----------------------------------
// DELETE /categories/:id (soft delete)
// ----------------------------------
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findByIdAndUpdate(
      id,
      { deleted: true },
      { new: true }
    );

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.json({ message: "Category deleted successfully" });
  } catch (err) {
    console.error("Delete category error:", err);
    res.status(500).json({ message: "Server error deleting category" });
  }
};


// ----------------------------------
// GET /categories/:id
// ----------------------------------
export const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid category ID" });
    }

    const category = await Category.findById(id);

    if (!category || category.deleted) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.json(category);
  } catch (error) {
    console.error("Category fetch error:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// ----------------------------------
// POST /categories/:categoryId/members
// ----------------------------------
export const assignMembersToCategory = async (req, res) => {
  try {
    const { id: categoryId } = req.params;
    const { members } = req.body;

    if (!mongoose.isValidObjectId(categoryId)) {
      return res.status(400).json({ message: "Invalid categoryId" });
    }

    if (!Array.isArray(members) || members.length === 0) {
      return res.status(400).json({ message: "Members required" });
    }

    const category = await Category.findById(categoryId);

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    const campaignId = category.campaign;

    const operations = [];

    for (const m of members) {
      if (!mongoose.isValidObjectId(m.memberId)) continue;

      const existing = await MemberCampaignParticipation.findOne({
        member: m.memberId,
        campaign: campaignId,
      });

      // 🚨 ENFORCE SINGLE CATEGORY PER CAMPAIGN
      if (
        existing &&
        existing.pledgedCategory &&
        existing.pledgedCategory.toString() !== categoryId.toString()
      ) {
        return res.status(409).json({
          message: `Member ${m.memberId} already assigned to another category in this campaign`,
        });
      }

      const targetAmount =
        category.maxAmount === null
          ? m.pledgeAmount || category.minAmount
          : category.minAmount;

      operations.push({
        updateOne: {
          filter: {
            member: m.memberId,
            campaign: campaignId,
          },
          update: {
            $set: {
              pledgedCategory: category._id,
              effectiveCategory: category._id,
              targetAmount,
              pledgedTargetCopies: m.pledgeAmount || null,
            },
            $setOnInsert: {
              member: m.memberId,
              campaign: campaignId,
              totalContributed: 0,
              createdAt: new Date(),
            },
          },
          upsert: true,
        },
      });
    }

    if (operations.length > 0) {
      await MemberCampaignParticipation.bulkWrite(operations);
    }

    res.status(200).json({
      success: true,
      message: "Members assigned successfully",
    });
  } catch (err) {
    console.error("Assign members error:", err);
    res.status(500).json({ message: "Server error assigning members" });
  }
};