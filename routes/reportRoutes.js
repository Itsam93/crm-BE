import express from "express";
import { uploadReport } from "../controllers/reportController.js";

const router = express.Router();

router.post("/upload", uploadReport);

export default router;
