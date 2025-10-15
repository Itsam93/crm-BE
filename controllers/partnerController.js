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

// Format partner object consistently
const formatPartner = (p) => ({
  id: p._id,
  fullName: p.fullName || "N/A",
  church: p.church || "Unassigned Church",
  group: p.group || "",
  zone: p.zone || "North West Zone One",
  partnershipArm: p.partnershipArm || "Unassigned Arm",
  amount: Number(p.amount || 0),
  date: p.date || new Date(),
  status: p.status || "confirmed",
  notes: p.notes || "",
});

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
    if (arm) query.partnershipArm = { $regex: normalizeArm(arm), $options: "i" };
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

    res.json({
      data: items.map(formatPartner),
      meta: { page: pageNum, limit: pageSize, totalPages: Math.ceil(totalItems / pageSize) || 1, totalItems },
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
    const p = await Partner.findById(req.params.id).lean();
    if (!p) return res.status(404).json({ message: "Partner not found" });

    const role = req.user?.role;
    if ((role === "HealingHOD" && !/healing/i.test(p.partnershipArm)) ||
        (role === "RhapsodyHOD" && !/rhapsody/i.test(p.partnershipArm)) ||
        (role === "MinistryHOD" && !/ministry/i.test(p.partnershipArm))) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json(formatPartner(p));
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

    res.status(201).json(formatPartner(doc));
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

    const updated = await Partner.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }).lean();
    if (!updated) return res.status(404).json({ message: "Partner not found" });

    res.json(formatPartner(updated));
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
   GET /api/partners/arm/:armName
   ============================================================ */
export const getGivingsByArm = async (req, res) => {
  try {
    let { armName } = req.params;
    const { page = 1, limit = 30, search = "" } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const pageSize = Math.max(1, Math.min(200, parseInt(limit, 10)));
    const skip = (pageNum - 1) * pageSize;

    if (!armName?.trim()) return res.status(400).json({ message: "Arm is required" });

    const normalizedArm = normalizeArm(armName);

    const role = req.user?.role;
    if ((role === "HealingHOD" && !/healing/i.test(normalizedArm)) ||
        (role === "RhapsodyHOD" && !/rhapsody/i.test(normalizedArm)) ||
        (role === "MinistryHOD" && !/ministry/i.test(normalizedArm))) {
      return res.status(403).json({ message: "Access denied" });
    }

    const match = { partnershipArm: { $regex: normalizedArm, $options: "i" } };
    if (search) match.$or = [
      { fullName: { $regex: search, $options: "i" } },
      { church: { $regex: search, $options: "i" } },
    ];

    const agg = [
      { $match: match },
      { $group: {
          _id: "$fullName",
          fullName: { $first: "$fullName" },
          church: { $first: "$church" },
          group: { $first: "$group" },
          zone: { $first: "$zone" },
          arm: { $first: "$partnershipArm" },
          amount: { $sum: "$amount" },
          lastDate: { $max: "$date" },
        }
      },
      { $sort: { amount: -1 } },
      { $skip: skip },
      { $limit: pageSize },
    ];

    const [data, totalCountArr] = await Promise.all([
      Partner.aggregate(agg),
      Partner.aggregate([{ $match: match }, { $group: { _id: "$fullName" } }, { $count: "count" }])
    ]);

    const totalItems = totalCountArr[0]?.count || 0;

    res.json({
      data: data.map(d => ({
        name: d.fullName,
        church: d.church,
        arm: d.arm,
        amount: d.amount,
        date: d.lastDate,
        group: d.group,
        zone: d.zone,
      })),
      meta: { page: pageNum, limit: pageSize, totalPages: Math.ceil(totalItems / pageSize), totalItems }
    });
  } catch (err) {
    console.error("getGivingsByArm error:", err);
    res.status(500).json({ message: "Server error fetching givings by arm" });
  }
};

/* ============================================================
   GET /api/partners/group-summary
   ============================================================ */
export const getGroupSummary = async (req, res) => {
  try {
    const summary = await Partner.aggregate([
      {
        $group: {
          _id: "$group",
          group: { $first: "$group" },
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalAmount: -1 } }
    ]);

    res.json({
      success: true,
      data: summary.map(s => ({
        group: s.group || "Unassigned Group",
        totalAmount: s.totalAmount,
        count: s.count,
      }))
    });
  } catch (err) {
    console.error("getGroupSummary error:", err);
    res.status(500).json({ message: "Failed to fetch group summary" });
  }
};

/* ============================================================
   GET /api/partners/totals
   ============================================================ */
export const getTotalGivingsPerMember = async (req, res) => {
  try {
    const totals = await Partner.aggregate([
      {
        $group: {
          _id: "$fullName",
          name: { $first: "$fullName" },
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalAmount: -1 } }
    ]);

    res.json({
      success: true,
      data: totals.map(t => ({
        name: t.name || "N/A",
        totalAmount: t.totalAmount,
        count: t.count,
      }))
    });
  } catch (err) {
    console.error("getTotalGivingsPerMember error:", err);
    res.status(500).json({ message: "Failed to fetch totals per member" });
  }
};

/* ============================================================
   GET /api/partners/top/givers
   ============================================================ */
export const getTopGivers = async (req, res) => {
  try {
    const top = await Partner.aggregate([
      {
        $group: {
          _id: "$fullName",
          name: { $first: "$fullName" },
          totalAmount: { $sum: "$amount" },
        },
      },
      { $sort: { totalAmount: -1 } },
      { $limit: 100 },
    ]);

    res.json({
      success: true,
      data: top.map(t => ({
        name: t.name || "N/A",
        totalAmount: t.totalAmount,
      }))
    });
  } catch (err) {
    console.error("getTopGivers error:", err);
    res.status(500).json({ message: "Failed to fetch top givers" });
  }
};

/* ============================================================
   GET /api/partners/by/:type/:value
   ============================================================ */
export const getPartnersByChurchOrGroup = async (req, res) => {
  try {
    const { type, value } = req.params;
    if (!type || !value) return res.status(400).json({ message: "Type and value are required" });

    const query = {};
    if (type === "church") query.church = value;
    else if (type === "group") query.group = value;
    else return res.status(400).json({ message: "Type must be 'church' or 'group'" });

    const partners = await Partner.find(query).lean();

    res.json({
      success: true,
      count: partners.length,
      data: partners.map(formatPartner)
    });
  } catch (err) {
    console.error("getPartnersByChurchOrGroup error:", err);
    res.status(500).json({ message: "Failed to fetch partners by type/value" });
  }
};


/* ============================================================
   GET /api/admin/summary
   Returns dashboard summary for Admin
   ============================================================ */
export const getAdminSummary = async (req, res) => {
  try {
    // Aggregate totals per arm
    const totals = await Partner.aggregate([
      {
        $group: {
          _id: "$partnershipArm",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 }
        }
      }
    ]);

    // Convert to object with default 0
    const summary = {
      totalPartners: 0,
      healing: 0,
      rhapsody: 0,
      ministry: 0
    };

    totals.forEach(t => {
      summary.totalPartners += t.count;
      if (/healing/i.test(t._id)) summary.healing = t.count;
      else if (/rhapsody/i.test(t._id)) summary.rhapsody = t.count;
      else if (/ministry/i.test(t._id)) summary.ministry = t.count;
    });

    // Get recent entries (last 10)
    const recent = await Partner.find({})
      .sort({ date: -1 })
      .limit(10)
      .lean();

    res.json({ success: true, summary, recent });
  } catch (err) {
    console.error("getAdminSummary error:", err);
    res.status(500).json({ message: "Failed to fetch admin summary" });
  }
};
