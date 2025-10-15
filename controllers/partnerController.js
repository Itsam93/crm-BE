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
export const addGiving = async (req, res) => {
  try {
    const {
      fullName,
      church,
      group,
      zone,
      partnershipArm,
      amount,
      date,
      status = "confirmed",
      notes = "",
    } = req.body;

    // Validate required fields
    if (!fullName || !partnershipArm || amount == null || !church) {
      return res
        .status(400)
        .json({ message: "fullName, partnershipArm, church, and amount are required" });
    }

    // Create the giving record
    const giving = await Partner.create({
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

    res.status(201).json(formatPartner(giving));
  } catch (err) {
    console.error("addGiving error:", err);
    res.status(500).json({ message: "Failed to record giving" });
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
    if (!req.file || !req.file.buffer)
      return res.status(400).json({ message: "No file uploaded" });

    const filename = req.file.originalname.toLowerCase();
    const ext = filename.split(".").pop();
    let rows = [];

    // -------------------------------
    // Read uploaded file (CSV / Excel)
    // -------------------------------
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

    if (!rows.length)
      return res.status(400).json({ message: "File contains no rows" });

    // -------------------------------
    // Detect static & date columns
    // -------------------------------
    const sample = rows[0];
    const headers = Object.keys(sample).map((h) => h.trim());

    // Core columns you have: Name, Church, Group, Arm
    const staticCols = ["name", "full name", "fullname", "church", "group", "arm"];
    const dateCols = headers.filter((h) =>
      /^\d{4}-\d{2}-\d{2}$/.test(h.trim())
    );

    if (!dateCols.length)
      return res
        .status(400)
        .json({ message: "No date columns found. Ensure headers are in YYYY-MM-DD format." });

    // -------------------------------
    // Transform (melt) wide → long
    // -------------------------------
    const melted = [];

    for (const row of rows) {
      const fullName =
        row.name || row["Full Name"] || row.fullName || row["fullname"];
      const church = row.church || row["Church"] || "";
      const group = row.group || row["Group"] || "";
      const arm = row.arm || row["Arm"] || "";

      if (!fullName || !arm) continue;

      for (const dateCol of dateCols) {
        const amount = Number(row[dateCol]);
        if (!amount || isNaN(amount)) continue;

        melted.push({
          fullName: String(fullName).trim(),
          church: String(church).trim(),
          group: String(group).trim(),
          partnershipArm: normalizeArm(arm),
          amount,
          date: new Date(dateCol),
          status: "confirmed",
        });
      }
    }

    if (!melted.length)
      return res
        .status(400)
        .json({ message: "No valid giving data found in the file" });

    // -------------------------------
    // Save to database
    // -------------------------------
    const created = await Partner.insertMany(melted);

    res.status(201).json({
      message: `${created.length} giving records uploaded successfully`,
      data: created.map(formatPartner),
    });
  } catch (err) {
    console.error("bulkUploadPartners error:", err);
    res.status(500).json({ message: "Failed to upload givings" });
  }
};


/* ============================================================
   GET /api/partners/arm/:armName
   ============================================================ */
export const getGivingsByArm = async (req, res) => {
  try {
    let { armName } = req.params;
    if (!armName || !armName.trim()) {
      return res.status(400).json({ message: "Arm name is required" });
    }

    // Normalize arm
    armName = armName.toLowerCase().trim();
    const normalizedArm = /healing/.test(armName)
      ? "Healing"
      : /rhapsody/.test(armName)
      ? "Rhapsody"
      : /ministry/.test(armName)
      ? "Ministry"
      : armName;

    // Fetch recent 50 entries for this arm
    const partners = await Partner.find({ partnershipArm: new RegExp(normalizedArm, "i") })
      .sort({ date: -1 })
      .limit(50)
      .lean();

    const data = partners.map(p => ({
      name: p.fullName,
      church: p.church || "Unassigned Church",
      arm: p.partnershipArm,
      amount: p.amount,
      date: p.date,
    }));

    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.json({ success: true, data });
  } catch (err) {
    console.error("getGivingsByArm error:", err);
    res.status(500).json({ message: "Failed to fetch partners by arm" });
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
    // Count total partners
    const totalPartners = await Partner.countDocuments();

    // Count by arm
    const healing = await Partner.countDocuments({ partnershipArm: /healing/i });
    const rhapsody = await Partner.countDocuments({ partnershipArm: /rhapsody/i });
    const ministry = await Partner.countDocuments({ partnershipArm: /ministry/i });

    // Get recent 10 entries
    const recent = await Partner.find({})
      .sort({ date: -1 })
      .limit(10)
      .lean();

    // Map fields to frontend-friendly keys
    const recentMapped = recent.map(r => ({
      name: r.fullName,
      church: r.church || "Unassigned Church",
      arm: r.partnershipArm,
      amount: r.amount,
      date: r.date,
    }));

    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.json({
      success: true,
      summary: { totalPartners, healing, rhapsody, ministry },
      recent: recentMapped,
    });
  } catch (err) {
    console.error("getAdminSummary error:", err);
    res.status(500).json({ message: "Failed to fetch admin summary" });
  }
};