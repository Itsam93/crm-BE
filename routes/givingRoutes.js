import express from "express";
import multer from "multer";
import {
  addGiving,
  getGivings,
  updateGiving,
  deleteGiving,
  bulkUploadGivings,
  restoreGiving,
  getReports,
  getHodReport, 
} from "../controllers/givingController.js";
import { requireAuth, requireAdmin, requireRole } from "../middleware/authMiddleware.js";

const router = express.Router();
const upload = multer();

// -----------------------------
// HOD ROLES (STRICT CONTROL)
// -----------------------------
const HOD_ROLES = [
  "healing_hod",
  "rhapsody_hod",
  "ministry_hod",
  "bibles_hod",
  "innercity_hod",
  "lwpm_hod",
];

// -----------------------------
// STARTUP LOGS
// -----------------------------
console.log("=================================================================");
console.log("🚀 givingRoutes.js LOADED at", new Date().toISOString());
console.log("Mount point expected: /api/givings/*");
console.log("Registered routes:");
console.log("  GET    / → getGivings");
console.log("  GET    /reports → getReports (HOD filtered)");
console.log("  GET    /reports/hod → getHodReports (HOD only)");
console.log("  POST   / → addGiving (admin)");
console.log("  PUT    /:id → updateGiving (admin)");
console.log("  PUT    /:id/restore → restoreGiving (admin)");
console.log("  DELETE /:id → deleteGiving (admin)");
console.log("  POST   /upload → bulkUploadGivings (admin)");
console.log("=================================================================");

// -----------------------------
// GLOBAL REQUEST LOGGER
// -----------------------------
router.use(requireAuth); 

router.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method.padEnd(6);
  const path = req.originalUrl;
  const userId = req.user ? req.user._id || req.user.id : "anonymous";

  console.log(`[${timestamp}] ${method} ${path}`);
  console.log(`   • User: ${userId}`);
  console.log(`   • Role: ${req.user?.role || "unknown"}`);
  console.log("───────────────────────────────────────");

  next();
});

// -----------------------------
// HOD + ADMIN ACCESS ROUTES
// -----------------------------

// ✅ Get raw givings (all HOD campaigns + admin)
router.get("/", requireRole([...HOD_ROLES, "admin"]), getGivings);

router.get("/reports", requireRole([...HOD_ROLES, "admin"]), getReports);

router.get("/reports/hod", requireRole([...HOD_ROLES, "admin"]), getHodReport);

// -----------------------------
// ADMIN-ONLY ROUTES
// -----------------------------
router.post("/", requireAuth, requireAdmin, addGiving);
router.put("/:id", requireAuth, requireAdmin, updateGiving);
router.put("/:id/restore", requireAuth, requireAdmin, restoreGiving);
router.delete("/:id", requireAuth, requireAdmin, deleteGiving);

// -----------------------------
// BULK UPLOAD (ADMIN)
// -----------------------------
router.post("/upload", requireAuth, requireAdmin, upload.single("file"), bulkUploadGivings);

export default router;