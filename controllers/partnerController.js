import Partner from "../models/Partner.js";
import csvParser from "csv-parser";
import XLSX from "xlsx";
import stream from "stream";

/* ============================================================
   HELPERS
   ============================================================ */

// Normalize partnership arms
const normalizeArm = (s) => {
  if (!s) return "";
  const val = String(s).trim();
  if (/healing/i.test(val)) return "Healing";
  if (/rhapsody/i.test(val)) return "Rhapsody";
  if (/ministry/i.test(val)) return "Ministry";
  return val;
};

// Normalize zone and church names with defaults
const normalizeZone = (z) => (z?.trim() || "North West Zone One");
const normalizeChurch = (c) => (c?.trim() || "Unassigned Church");

/* ============================================================
   GET /api/partners
   ============================================================ */
export const getAllPartners = async (req, res) => {
  try {
    const { page = 1, limit = 30, search = "", arm, zone, church, sort = "-createdAt" } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const pageSize = Math.max(1, Math.min(100, parseInt(limit, 10)));

    const query = {};
    const role = req.user?.role;

    // HOD scoping
    if (role === "HealingHOD") query.partnershipArm = { $regex: /healing/i };
    if (role === "RhapsodyHOD") query.partnershipArm = { $regex: /rhapsody/i };
    if (role === "MinistryHOD") query.partnershipArm = { $regex: /ministry/i };

    // Filters
    if (arm) query.partnershipArm = arm;
    if (zone) query.zone = zone;
    if (church) query.church = church;

    // Search
    if (search) {
      const s = search.trim();
      query.$or = [
        { fullName: { $regex: s, $options: "i" } },
        { church: { $regex: s, $options: "i" } },
        { group: { $regex: s, $options: "i" } },
        { zone: { $regex: s, $options: "i" } },
      ];
    }

    const skip = (pageNum - 1) * pageSize;

    const [items, totalItems] = await Promise.all([
      Partner.find(query).sort(sort).skip(skip).limit(pageSize).lean(),
      Partner.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalItems / pageSize) || 1;

    res.json({
      data: items,
      meta: { page: pageNum, limit: pageSize, totalPages, totalItems },
    });
  } catch (err) {
    console.error("getAllPartners error:", err);
    res.status(500).json({ message: "Server error fetching partners" });
  }
};

/* ============================================================
   GET /api/partners/:id
   ============================================================ */
export const getPartnerById = async (req, res) => {
  try {
    const p = await Partner.findById(req.params.id);
    if (!p) return res.status(404).json({ message: "Partner not found" });

    const role = req.user?.role;
    if (role === "HealingHOD" && !/healing/i.test(p.partnershipArm)) return res.status(403).json({ message: "Access denied" });
    if (role === "RhapsodyHOD" && !/rhapsody/i.test(p.partnershipArm)) return res.status(403).json({ message: "Access denied" });
    if (role === "MinistryHOD" && !/ministry/i.test(p.partnershipArm)) return res.status(403).json({ message: "Access denied" });

    res.json(p);
  } catch (err) {
    console.error("getPartnerById error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ============================================================
   POST /api/partners
   ============================================================ */
export const createPartner = async (req, res) => {
  try {
    const { fullName, church, group, zone, partnershipArm, amount, date, status = "confirmed", notes = "" } = req.body;

    if (!fullName || !partnershipArm || amount == null) {
      return res.status(400).json({ message: "fullName, partnershipArm, and amount are required" });
    }

    const doc = await Partner.create({
      fullName: fullName.trim(),
      church: normalizeChurch(church),
      group: group?.trim() || "",
      zone: normalizeZone(zone),
      partnershipArm: normalizeArm(partnershipArm),
      amount: Number(amount),
      date: date ? new Date(date) : new Date(),
      status,
      notes: notes?.trim() || "",
    });

    res.status(201).json(doc);
  } catch (err) {
    console.error("createPartner error:", err);
    res.status(500).json({ message: "Failed to create partner" });
  }
};

/* ============================================================
   PUT /api/partners/:id
   ============================================================ */
export const updatePartner = async (req, res) => {
  try {
    const updates = { ...req.body };

    if (updates.partnershipArm) updates.partnershipArm = normalizeArm(updates.partnershipArm);
    if (updates.zone) updates.zone = normalizeZone(updates.zone);
    if (updates.church) updates.church = normalizeChurch(updates.church);
    if (updates.amount != null) updates.amount = Number(updates.amount);

    const updated = await Partner.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ message: "Partner not found" });
    res.json(updated);
  } catch (err) {
    console.error("updatePartner error:", err);
    res.status(500).json({ message: "Failed to update partner" });
  }
};

/* ============================================================
   DELETE /api/partners/:id
   ============================================================ */
export const deletePartner = async (req, res) => {
  try {
    const deleted = await Partner.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Partner not found" });
    res.json({ message: "Partner deleted" });
  } catch (err) {
    console.error("deletePartner error:", err);
    res.status(500).json({ message: "Failed to delete partner" });
  }
};

/* ============================================================
   POST /api/partners/upload
   ============================================================ */
export const bulkUploadPartners = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) return res.status(400).json({ message: "No file uploaded" });

    const filename = req.file.originalname.toLowerCase();
    const ext = filename.split(".").pop();
    let rows = [];

    if (ext === "csv") {
      const bufferStream = new stream.PassThrough();
      bufferStream.end(req.file.buffer);
      await new Promise((resolve, reject) => {
        bufferStream
          .pipe(csvParser({ mapHeaders: ({ header }) => header.trim() }))
          .on("data", (data) => rows.push(data))
          .on("end", resolve)
          .on("error", reject);
      });
    } else if (ext === "xls" || ext === "xlsx") {
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    } else {
      return res.status(400).json({ message: "Unsupported file type" });
    }

    if (!rows.length) return res.status(400).json({ message: "File contains no rows" });

    const toInsert = [];
    const failed = [];

    rows.forEach((r, i) => {
      const fullName = (r.fullName || r.FullName || r.name)?.toString().trim();
      const church = (r.church || r.Church)?.toString().trim();
      const group = (r.group || r.Group)?.toString().trim();
      const zone = (r.zone || r.Zone)?.toString().trim();
      const partnershipArm = normalizeArm(r.partnershipArm || r.arm);
      const amtRaw = r.amount || r.Amount;
      const amount = amtRaw !== undefined && amtRaw !== "" ? Number(String(amtRaw).replace(/[,₦\s]/g, "")) : null;
      const date = r.date || new Date();

      if (!fullName || !partnershipArm || amount == null || Number.isNaN(amount)) {
        failed.push({ row: i + 1, reason: "Missing required fields or invalid amount" });
        return;
      }

      toInsert.push({
        fullName,
        church: normalizeChurch(church),
        group: group || "",
        zone: normalizeZone(zone),
        partnershipArm,
        amount,
        date: new Date(date),
        notes: r.notes || "",
      });
    });

    let insertedCount = 0;
    if (toInsert.length) {
      const result = await Partner.insertMany(toInsert, { ordered: false });
      insertedCount = result.length;
    }

    res.json({ success: true, inserted: insertedCount, failedCount: failed.length, failures: failed.slice(0, 30) });
  } catch (err) {
    console.error("bulkUploadPartners error:", err);
    res.status(500).json({ message: "Failed processing upload", error: err.message });
  }
};

/* ============================================================
   GET /api/partners/arm/:arm
   ============================================================ */
export const getGivingsByArm = async (req, res) => {
  try {
    const { arm } = req.params;
    if (!arm) return res.status(400).json({ message: "Arm is required" });

    const normalizedArm = arm.trim();
    const partners = await Partner.find({ partnershipArm: { $regex: normalizedArm, $options: "i" } }).lean();

    res.json({ success: true, count: partners.length, data: partners });
  } catch (err) {
    console.error("getGivingsByArm error:", err);
    res.status(500).json({ message: "Failed to fetch partners by arm" });
  }
};
