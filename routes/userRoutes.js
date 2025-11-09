import express from "express";
import { getUsers } from "../controllers/userController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", requireAuth, getUsers); // e.g. /api/users?role=pastor

export default router;
