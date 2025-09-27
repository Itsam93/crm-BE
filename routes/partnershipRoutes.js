import express from "express";
import {
  getPartnerships,
  addPartnership,
  updatePartnership,
  deletePartnership,
} from "../controllers/partnershipController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.route("/")
  .get(protect, getPartnerships)
  .post(protect, addPartnership);

router.route("/:id")
  .put(protect, updatePartnership)
  .delete(protect, deletePartnership);

export default router;
