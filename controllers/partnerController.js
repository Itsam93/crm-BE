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
  dateOfGiving: p.dateOfGiving || new Date(),
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
    const { partnerId, date, amount } = req.body;

    if (!partnerId || !amount || !date) {
      return res.status(400).json({ message: "Partner ID, date, and amount are required" });
    }

    const partner = await Partner.findById(partnerId);
    if (!partner) return res.status(404).json({ message: "Partner not found" });

    // Ensure partnershipArm exists to satisfy schema
    partner.partnershipArm = partner.partnershipArm || "Unknown Arm";

    const givingDate = new Date(date);
    const numericAmount = Number(amount);

    partner.givings.push({ date: givingDate, amount: numericAmount });
    partner.amount = (partner.amount || 0) + numericAmount;
    partner.dateOfGiving = givingDate; // optional: track latest giving

    await partner.save();

    return res.json({
      message: "Giving added successfully",
      partner: {
        id: partner._id,
        fullName: partner.fullName,
        church: partner.church,
        partnershipArm: partner.partnershipArm,
        amount: partner.amount,
        totalGivings: partner.givings.length,
      },
    });
  } catch (err) {
    console.error("addGiving error:", err);
    return res.status(500).json({ message: "Failed to add giving", error: err.message });
  }
};

/* =========================
   Create Partner (with optional initial giving)
   ========================= */
export const createPartner = async (req, res) => {
  try {
    const {
      fullName,
      church,
      partnershipArm,
      zone,
      group,
      amount,
      dateOfGiving,
      status,
      notes,
    } = req.body;

    // Validate required fields
    if (!fullName || !church || !partnershipArm) {
      return res.status(400).json({
        message: "Full name, church, and partnershipArm are required",
      });
    }

    // Normalize fields
    const normalizedArm = partnershipArm?.trim() || "Unknown Arm";
    const normalizedZone = zone?.trim() || "Unknown Zone";
    const normalizedGroup = group?.trim() || "";
    const normalizedStatus = status?.trim() || "confirmed";
    const normalizedNotes = notes?.trim() || "";

    // Check if partner already exists
    let partner = await Partner.findOne({
      fullName: fullName.trim(),
      church: church.trim(),
    });

    if (!partner) {
      partner = await Partner.create({
        fullName: fullName.trim(),
        church: church.trim(),
        partnershipArm: normalizedArm,
        zone: normalizedZone,
        group: normalizedGroup,
        status: normalizedStatus,
        notes: normalizedNotes,
        givings: [], // start empty
        amount: 0,
        dateOfGiving: dateOfGiving ? new Date(dateOfGiving) : new Date(),
      });
    }

    // If initial giving is provided
    if (amount && !isNaN(amount)) {
      partner.givings.push({
        amount: Number(amount),
        date: dateOfGiving ? new Date(dateOfGiving) : new Date(),
      });

      // Update total amount
      partner.amount = (partner.amount || 0) + Number(amount);

      await partner.save();
    }

    // Calculate totalAmount for response
    const totalAmount = partner.givings.reduce((sum, g) => sum + g.amount, 0);

    res.status(201).json({
      message: "Partner created successfully",
      partner: {
        id: partner._id,
        fullName: partner.fullName,
        church: partner.church,
        partnershipArm: partner.partnershipArm,
        zone: partner.zone,
        group: partner.group,
        status: partner.status,
        notes: partner.notes,
        givings: partner.givings,
        totalAmount,
      },
    });
  } catch (error) {
    console.error("Error creating partner:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/* ============================================================
   PUT /api/partners/:id
   ============================================================ */
export const updatePartner = async (req, res) => {
  try {
    const updates = { ...req.body };

    // Normalize fields to prevent schema validation errors
    if (updates.fullName) updates.fullName = updates.fullName.trim();
    if (updates.church) updates.church = updates.church.trim();
    if (updates.arm || updates.partnershipArm) updates.partnershipArm = (updates.arm || updates.partnershipArm).trim() || "Unknown Arm";
    if (updates.zone) updates.zone = updates.zone.trim() || "Unknown Zone";
    if (updates.status) updates.status = updates.status.trim();
    if (updates.notes) updates.notes = updates.notes.trim();
    if (updates.amount != null) updates.amount = Number(updates.amount);
    if (updates.dateOfGiving) updates.dateOfGiving = new Date(updates.dateOfGiving);

    const updated = await Partner.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    if (!updated) return res.status(404).json({ message: "Partner not found" });

    // Ensure total amount matches givings
    updated.amount = updated.givings.reduce((sum, g) => sum + g.amount, 0);
    await updated.save();

    return res.json({
      message: "Partner updated successfully",
      partner: {
        id: updated._id,
        fullName: updated.fullName,
        church: updated.church,
        partnershipArm: updated.partnershipArm,
        zone: updated.zone,
        amount: updated.amount,
        totalGivings: updated.givings.length,
        status: updated.status,
        notes: updated.notes,
      },
    });
  } catch (err) {
    console.error("updatePartner error:", err);
    return res.status(500).json({ message: "Failed to update partner", error: err.message });
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
    if (!req.file || !req.file.buffer) {
      console.error("No file uploaded");
      return res.status(400).json({ message: "No file uploaded" });
    }

    console.log("=== BULK UPLOAD INITIATED ===");
    console.log("File received:", req.file.originalname, "Size:", req.file.size);

    const filename = req.file.originalname.toLowerCase();
    const ext = filename.split(".").pop();
    let rows = [];

    // Parse CSV or Excel
    if (ext === "csv") {
      const bufferStream = new stream.PassThrough();
      bufferStream.end(req.file.buffer);
      rows = await new Promise((resolve, reject) => {
        const data = [];
        bufferStream
          .pipe(csvParser())
          .on("data", (row) => data.push(row))
          .on("end", () => resolve(data))
          .on("error", (err) => reject(err));
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    } else {
      return res.status(400).json({ message: "Unsupported file format" });
    }

    if (!rows.length) return res.status(400).json({ message: "No data found in file" });

    console.log("Rows parsed:", rows.length);

    const moment = (await import("moment")).default;
    const givingData = [];

    for (const row of rows) {
      const fullName = row.Name?.trim() || row.FullName?.trim() || "";
      const church = row.Church?.trim() || "Unassigned Church";
      const group = row.Group?.trim() || "";
      const arm = row.Arm?.trim() || "Unknown Arm";

      if (!fullName) continue; // skip rows without a name

      // Detect giving columns (dates)
      Object.keys(row).forEach((key) => {
        if (moment(key, ["YYYY-MM-DD", "M/D/YYYY", "D/M/YYYY"], true).isValid()) {
          const amount = parseFloat(row[key] || 0);
          if (amount > 0) {
            givingData.push({
              fullName,
              church,
              group,
              partnershipArm: arm,
              date: moment(key, ["YYYY-MM-DD", "M/D/YYYY", "D/M/YYYY"]).format("YYYY-MM-DD"),
              amount,
            });
          }
        }
      });
    }

    if (!givingData.length) return res.status(400).json({ message: "No valid giving entries detected" });

    const Partner = (await import("../models/Partner.js")).default;

    for (const g of givingData) {
      let partner = await Partner.findOne({ fullName: g.fullName, church: g.church });
      if (!partner) {
        console.log(`Creating new partner: ${g.fullName}`);
        partner = new Partner({
          fullName: g.fullName,
          church: g.church,
          group: g.group,
          partnershipArm: g.partnershipArm,
          zone: g.zone || "Unknown Zone",
          status: g.status || "confirmed",
          notes: g.notes || "",
          givings: [],
          amount: 0,
          dateOfGiving: g.date,
        });
      }

      // Add giving and update total amount
      partner.givings.push({ date: g.date, amount: g.amount });
      partner.amount = (partner.amount || 0) + g.amount;

      await partner.save();
    }

    console.log("=== BULK UPLOAD COMPLETED SUCCESSFULLY ===");
    return res.json({ message: "Upload successful", count: givingData.length });
  } catch (err) {
    console.error("Bulk upload failed:", err);
    return res.status(500).json({ message: "Internal server error", error: err.message });
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

    // Normalize arm name
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

    if (!partners.length) {
      return res.json({ success: true, data: [], message: "No records found for this arm" });
    }

    const data = partners.map((p) => ({
      name: p.fullName || "N/A",
      church: p.church || "Unassigned Church",
      arm: p.partnershipArm || "Unassigned Arm",
      amount: p.amount || 0,
      date: p.date ? new Date(p.date).toISOString().split("T")[0] : null,
    }));

    // Prevent caching
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

    const recentMapped = recent.length
      ? recent.map((r) => ({
          name: r.fullName || "N/A",
          church: r.church || "Unassigned Church",
          arm: r.partnershipArm || "Unassigned Arm",
          amount: r.amount || 0,
          date: r.date ? new Date(r.date).toISOString().split("T")[0] : null,
        }))
      : [];

    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.json({
      success: true,
      summary: { totalPartners, healing, rhapsody, ministry },
      recent: recentMapped,
      message: recentMapped.length ? "Recent partners fetched successfully" : "No recent records found",
    });
  } catch (err) {
    console.error("getAdminSummary error:", err);
    res.status(500).json({ message: "Failed to fetch admin summary" });
  }
};
