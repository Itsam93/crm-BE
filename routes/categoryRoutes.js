import express from "express";
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  assignMembersToCategory,
  getCategoryById,
} from "../controllers/categoryController.js";

import { requireAuth, requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();


// ----------------------------------
// GET categories for a campaign
// GET /categories/:campaignId
// ----------------------------------
router.get("/:campaignId", requireAuth, getCategories);


// ----------------------------------
// CREATE category
// POST /categories
// ----------------------------------
router.post("/", requireAuth, requireAdmin, createCategory);


// ----------------------------------
// UPDATE category
// PATCH /categories/:id
// ----------------------------------
router.patch("/:id", requireAuth, requireAdmin, updateCategory);


// ----------------------------------
// DELETE category
// DELETE /categories/:id
// ----------------------------------
router.delete("/:id", requireAuth, requireAdmin, deleteCategory);


// ----------------------------------
// ASSIGN members to category
// POST /categories/:categoryId/members
// ----------------------------------
router.post("/:id/members", requireAuth, requireAdmin, assignMembersToCategory);


router.get("/:id", getCategoryById);


export default router;