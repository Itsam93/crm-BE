import express from "express";
import {
  addGiving,
  getGivings,
  getTotalsByMember,
  updateGiving,
  deleteGiving,
  getReport, 
} from "../controllers/givingController.js";

import { uploadGivings, upload } from "../controllers/uploadGivingsController.js";

const router = express.Router();

// Reports & Upload (specific routes first)
router.get("/reports", getReport);
router.post("/upload", upload.single("file"), uploadGivings);

// CRUD routes
router.post("/", addGiving);
router.get("/", getGivings);
router.get("/totals", getTotalsByMember);
router.put("/:id", updateGiving);
router.delete("/:id", deleteGiving);

export default router;
