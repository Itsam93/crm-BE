import express from "express";
import {
  addGiving,
  getGivings,
  getGivingsByMember,  
  getTotalsByMember,
  getReport,
  updateGiving,
  deleteGiving,
} from "../controllers/givingController.js";

const router = express.Router();

// ===== Givings CRUD =====
router.post("/", addGiving);          
router.get("/", getGivings);         
router.get("/member/:id", getGivingsByMember); 
router.put("/:id", updateGiving);      
router.delete("/:id", deleteGiving);   

// ===== Reports & Aggregates =====
router.get("/totals", getTotalsByMember);
router.get("/reports", getReport);       

export default router;
