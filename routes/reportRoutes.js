import express from "express";
import { authenticateUser } from "../middlewares/authMiddleware.js";
import { authorizeRoles } from "../middlewares/authorizeRoles.js";
import { getReports, getOverallReports } from "../controllers/reportController.js";

const router = express.Router();

// Head of Faculty & Super Admin can view all reports
router.get(
  "/overall",
  authenticateUser,
  authorizeRoles("super_admin", "head_of_faculty"),
  getOverallReports
);

// HODs can only view reports from their partnership arm
router.get(
  "/arm/:armName",
  authenticateUser,
  authorizeRoles("super_admin", "hod", "head_of_faculty"),
  getReports
);

export default router;
