import express from "express";
import { requireAuth, requireAdmin } from "../middleware/authMiddleware.js";
import {
  createMarriage,
  updateMarriage,
  endMarriage,
  getMarriages,
} from "../controllers/marriageController.js";

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.post("/", createMarriage);
router.get("/", getMarriages);
router.put("/:id", updateMarriage);
router.delete("/:id", endMarriage);

export default router;
