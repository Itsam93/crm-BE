import express from "express";
import { getGivings, getReports } from "../controllers/givingController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

// All routes here are read-only for HODs
router.use(requireAuth);

// Get all givings (filtered by hodId)
router.get("/givings", getGivings);

// Get reports (type: member, church, group) filtered by hodId
router.get("/reports", getReports);

export default router;
