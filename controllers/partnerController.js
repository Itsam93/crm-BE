import Partner from "../models/Partner.js";
import csvParser from "csv-parser";
import XLSX from "xlsx";
import stream from "stream";

/**
 * Helper: normalize arm names (optional)
 */
const normalizeArm = (s) => {
  if (!s) return "";
  const val = String(s).trim();
  if (/healing/i.test(val)) return "Healing";
  if (/rhapsody/i.test(val)) return "Rhapsody";
  if (/ministry/i.test(val)) return "Ministry";
  return val;
};

/* ============================================================
   GET /api/partners
   - paginated list of partners with search, filter, sort
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

    // query filters
    if (arm) query.partnershipArm = arm;
    if (zone) query.zone = zone;
    if (church) query.church = church;

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
   - HOD access enforced
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
   - Admin only
   ============================================================ */
export const createPartner = async (req, res) => {
  try {
    const { fullName, church, group, zone, partnershipArm, amount, date, status = "confirmed", notes = "" } = req.body;

    if (!fullName || !church || !partnershipArm || amount == null) {
      return res.status(400).json({ message: "fullName, church, partnershipArm and amount are required" });
    }

    const doc = await Partner.create({
      fullName: fullName.trim(),
      church: church.trim(),
      group: group?.trim() || "",
      zone: zone?.trim() || "North West Zone One",
      partnershipArm: normalizeArm(partnershipArm),
      amount: Number(amount),
      date: date ? new Date(date) : new Date(),
      status,
      notes,
    });

    res.status(201).json(doc);
  } catch (err) {
    console.error("createPartner error:", err);
    res.status(500).json({ message: "Failed to create partner" });
  }
};

/* ============================================================
   PUT /api/partners/:id
   - Admin only
   ============================================================ */
export const updatePartner = async (req, res) => {
  try {
    const updates = { ...req.body };
    if (updates.partnershipArm) updates.partnershipArm = normalizeArm(updates.partnershipArm);
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
   - Admin only
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
   - Admin only: bulk CSV/XLSX upload
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

      if (!fullName || !church || !partnershipArm || amount == null || Number.isNaN(amount)) {
        failed.push({ row: i + 1, reason: "Missing required fields or invalid amount" });
        return;
      }

      toInsert.push({ fullName, church, group: group || "", zone: zone || "North West Zone One", partnershipArm, amount, date: new Date(date), notes: r.notes || "" });
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
   - Aggregated totals per member for a given arm
   ============================================================ */
export const getGivingsByArm = async (req, res) => {
  try {
    const { armName } = req.params;
    const { page = 1, limit = 30, search = "" } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const pageSize = Math.max(1, Math.min(200, parseInt(limit, 10)));
    const skip = (pageNum - 1) * pageSize;

    const role = req.user?.role;
    if ((role === "HealingHOD" && !/healing/i.test(armName)) ||
        (role === "RhapsodyHOD" && !/rhapsody/i.test(armName)) ||
        (role === "MinistryHOD" && !/ministry/i.test(armName))) {
      return res.status(403).json({ message: "Access denied" });
    }

    const match = { partnershipArm: { $regex: armName, $options: "i" } };
    if (search) match.$or = [{ fullName: { $regex: search, $options: "i" } }, { church: { $regex: search, $options: "i" } }];

    const agg = [
      { $match: match },
      { $group: { _id: "$fullName", fullName: { $first: "$fullName" }, church: { $first: "$church" }, group: { $first: "$group" }, zone: { $first: "$zone" }, totalAmount: { $sum: "$amount" }, lastDate: { $max: "$date" } } },
      { $sort: { totalAmount: -1 } },
      { $skip: skip },
      { $limit: pageSize },
    ];

    const [data, totalCountArr] = await Promise.all([Partner.aggregate(agg), Partner.aggregate([{ $match: match }, { $group: { _id: "$fullName" } }, { $count: "count" }])]);
    const totalItems = totalCountArr[0]?.count || 0;

    res.json({ data, meta: { page: pageNum, limit: pageSize, totalPages: Math.ceil(totalItems / pageSize), totalItems } });
  } catch (err) {
    console.error("getGivingsByArm error:", err);
    res.status(500).json({ message: "Server error fetching givings by arm" });
  }
};

/* ============================================================
   GET /api/partners/totals
   - Total given by each member across all arms
   ============================================================ */
export const getTotalGivingsPerMember = async (req, res) => {
  try {
    const { page = 1, limit = 30, search = "" } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const pageSize = Math.max(1, Math.min(200, parseInt(limit, 10)));
    const skip = (pageNum - 1) * pageSize;

    const match = {};
    if (search) match.$or = [{ fullName: { $regex: search, $options: "i" } }, { church: { $regex: search, $options: "i" } }];

    const agg = [
      { $match: match },
      { $group: { _id: "$fullName", fullName: { $first: "$fullName" }, church: { $first: "$church" }, totalGiven: { $sum: "$amount" }, lastGiving: { $max: "$date" } } },
      { $sort: { totalGiven: -1 } },
      { $skip: skip },
      { $limit: pageSize },
    ];

    const [data, totalCountArr] = await Promise.all([Partner.aggregate(agg), Partner.aggregate([{ $match: match }, { $group: { _id: "$fullName" } }, { $count: "count" }])]);
    const totalItems = totalCountArr[0]?.count || 0;

    res.json({ data, meta: { page: pageNum, limit: pageSize, totalPages: Math.ceil(totalItems / pageSize), totalItems } });
  } catch (err) {
    console.error("getTotalGivingsPerMember error:", err);
    res.status(500).json({ message: "Server error fetching totals per member" });
  }
};

/* ============================================================
   GET /api/partners/summary/group/:groupName
   - Totals grouped by church for a given group
   ============================================================ */
export const getGroupSummary = async (req, res) => {
  try {
    const { groupName } = req.params;

    const agg = [
      { $match: { group: { $regex: groupName, $options: "i" } } },
      { $group: { _id: "$church", totalAmount: { $sum: "$amount" }, memberCount: { $addToSet: "$fullName" } } },
      { $project: { church: "$_id", totalAmount: 1, memberCount: { $size: "$memberCount" }, _id: 0 } },
      { $sort: { totalAmount: -1 } },
    ];

    const data = await Partner.aggregate(agg);
    res.json({ data });
  } catch (err) {
    console.error("getGroupSummary error:", err);
    res.status(500).json({ message: "Server error fetching group summary" });
  }
};

/* ============================================================
   GET /api/partners/top/givers
   - Returns top N givers, default 100
   ============================================================ */
export const getTopGivers = async (req, res) => {
  try {
    const limit = Math.min(500, parseInt(req.query.limit || "100", 10));

    const agg = [
      { $group: { _id: "$fullName", fullName: { $first: "$fullName" }, church: { $first: "$church" }, totalGiven: { $sum: "$amount" } } },
      { $sort: { totalGiven: -1 } },
      { $limit: limit },
    ];

    const data = await Partner.aggregate(agg);
    res.json({ data });
  } catch (err) {
    console.error("getTopGivers error:", err);
    res.status(500).json({ message: "Server error fetching top givers" });
  }
};

/* ============================================================
   GET /api/partners/by/:type/:value
   - Returns partners by church | group | zone
   ============================================================ */
export const getPartnersByChurchOrGroup = async (req, res) => {
  try {
    const { type, value } = req.params;
    const { page = 1, limit = 30 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const pageSize = Math.max(1, Math.min(200, parseInt(limit, 10)));
    const skip = (pageNum - 1) * pageSize;

    if (!["church", "group", "zone"].includes(type)) return res.status(400).json({ message: "Invalid type" });

    const match = { [type]: { $regex: value, $options: "i" } };

    const role = req.user?.role;
    if (role === "HealingHOD") match.partnershipArm = { $regex: /healing/i };
    if (role === "RhapsodyHOD") match.partnershipArm = { $regex: /rhapsody/i };
    if (role === "MinistryHOD") match.partnershipArm = { $regex: /ministry/i };

    const [items, totalItems] = await Promise.all([
      Partner.find(match).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
      Partner.countDocuments(match),
    ]);

    res.json({ data: items, meta: { page: pageNum, limit: pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) } });
  } catch (err) {
    console.error("getPartnersByChurchOrGroup error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
