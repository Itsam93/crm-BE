import express from "express";
import {
  getGroups,
  addGroup,
  deleteGroup,
  updateGroup,
  getGroupsWithChurches,
} from "../controllers/groupController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.route("/").get(protect, getGroups).post(protect, addGroup);

router.get("/groups-with-churches", protect, getGroupsWithChurches);

router.route("/:id").delete(protect, deleteGroup).put(protect, updateGroup);


export default router;
