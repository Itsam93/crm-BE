import express from "express";
import {
  getAllPartners,
  getPartnerById,
  createPartner,
  addGiving,
  updatePartner,
  deletePartner,
  bulkUploadPartners,
  getGivingsByArm,
  getGroupSummary,
  getTotalGivingsPerMember,
  getTopGivers,
  getPartnersByChurchOrGroup,
  getAdminSummary,
} from "../controllers/partnerController.js";

const router = express.Router();

// Create a new partner (with optional initial giving)
router.post("/", createPartner);

// Add giving to an existing partner
router.post("/add-giving", addGiving);

// Get all partners
router.get("/", getAllPartners);

// Get partner by ID
router.get("/:id", getPartnerById);

// Update partner
router.put("/:id", updatePartner);

// Delete partner
router.delete("/:id", deletePartner);

// Bulk upload partners via CSV/XLSX
router.post("/upload", bulkUploadPartners);

// Get givings by arm
router.get("/arm/:armName", getGivingsByArm);

// Get group summary
router.get("/group-summary", getGroupSummary);

// Get totals per member
router.get("/totals", getTotalGivingsPerMember);

// Get top 100 givers
router.get("/top/givers", getTopGivers);

// Get partners by church or group
router.get("/by/:type/:value", getPartnersByChurchOrGroup);

// Admin dashboard summary
router.get("/admin/summary", getAdminSummary);

export default router;
