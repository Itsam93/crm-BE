import express from "express";
import {
  getChurches,
  addChurch,
  updateChurch,
  deleteChurch,
} from "../controllers/churchController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.route("/").get(protect, getChurches).post(protect, addChurch);

router.route("/:id").put(protect, updateChurch).delete(protect, deleteChurch);

export default router;
