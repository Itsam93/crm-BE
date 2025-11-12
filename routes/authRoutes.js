import express from "express";
import { loginUser, verifyUser } from "../controllers/authController.js";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";

const router = express.Router();

//  Login route
router.post("/login", loginUser);

// Verify token route
router.get("/verify", requireAuth, verifyUser);

// Dashboard routes
router.get(
  "/admin/dashboard",
  requireAuth,
  requireRole(["admin"]),
  (req, res) => res.json({ message: "Welcome Admin Dashboard" })
);

router.get(
  "/viewer/dashboard",
  requireAuth,
  requireRole(["viewer"]),
  (req, res) => res.json({ message: "Welcome Viewer Dashboard" })
);

router.get(
  "/hod/dashboard",
  requireAuth,
  requireRole(["healing_hod", "rhapsody_hod", "ministry_hod"]),
  (req, res) => res.json({ message: "Welcome HOD Dashboard" })
);

export default router;
