// routes/churchRoutes.js
import express from "express";
import {
  getChurches,
  createChurch,
  updateChurch,
  deleteChurch,
} from "../controllers/churchController.js";
import { requireAuth, requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// All church routes are protected by auth and admin
router.use(requireAuth, requireAdmin);

// ===== Church Routes =====
router.get("/", getChurches);            // GET /api/churches
router.post("/", createChurch);          // POST /api/churches
router.put("/:id", updateChurch);        // PUT /api/churches/:id
router.delete("/:id", deleteChurch);     // DELETE /api/churches/:id

export default router;
