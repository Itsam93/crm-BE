import express from "express";
import {
  getArms,
  addArm,
  updateArm,
  deleteArm,
} from "../controllers/armController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.route("/").get(protect, getArms).post(protect, addArm);
router.route("/:id").put(protect, updateArm).delete(protect, deleteArm);

export default router;
