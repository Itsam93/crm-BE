import express from "express";
import {
  getGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  getAdminSummary,
  getUpcomingBirthdays,
} from "../controllers/adminController.js";

import churchRoutes from "./churchRoutes.js";

import { requireAuth, requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// All admin routes are protected
router.use(requireAuth, requireAdmin);

// ===== Admin Dashboard =====
router.get("/summary", getAdminSummary);

//  Upcoming Birthdays
router.get("/upcoming-birthdays", getUpcomingBirthdays);

// ===== Group Routes =====
router.get("/groups", getGroups);
router.post("/groups", createGroup);
router.put("/groups/:id", updateGroup);
router.delete("/groups/:id", deleteGroup);

// ===== Church Routes =====
router.use("/churches", churchRoutes);

export default router;
