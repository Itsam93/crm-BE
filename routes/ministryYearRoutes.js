import express from "express";

import {
  getMinistryYears,
  getCurrentMinistryYear,
  createMinistryYear,
  updateMinistryYear,
  activateMinistryYear,
  deleteMinistryYear,
} from "../controllers/ministryYearController.js";

import {
  requireAuth,
  requireAdmin,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", requireAuth, getMinistryYears);

router.get("/current", requireAuth, getCurrentMinistryYear);

router.post("/", requireAuth, requireAdmin, createMinistryYear);

router.put("/:id", requireAuth, requireAdmin, updateMinistryYear);

router.patch("/:id/activate", requireAuth, requireAdmin, activateMinistryYear);

router.delete("/:id", requireAuth, requireAdmin, deleteMinistryYear);

export default router;