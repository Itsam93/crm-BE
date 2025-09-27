import express from "express";
import {
  addGiving,
  getGivings,
  getTotalsByMember,
  updateGiving,
  deleteGiving,
  getReport, // <-- import the new reports controller
} from "../controllers/givingController.js";
import { uploadGivings, upload } from "../controllers/uploadGivingsController.js";

const router = express.Router();

// CRUD routes
router.post("/", addGiving);
router.get("/", getGivings);
router.get("/totals", getTotalsByMember);
router.put("/:id", updateGiving);
router.delete("/:id", deleteGiving);

// NEW reports route
router.get("/reports", getReport); // <-- add this

// Upload Excel
router.post("/upload", upload.single("file"), uploadGivings);


export default router;
