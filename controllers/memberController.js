import Member from "../models/Member.js";
import Group from "../models/Group.js";
import Church from "../models/Church.js";
import fs from "fs";
import XLSX from "xlsx";

/* ===============================
   CREATE NEW MEMBER
================================= */
export const createMember = async (req, res) => {
  try {
    const { name, phone, birthday, kingschatId, group, church, hod, email } = req.body;

    if (!name) return res.status(400).json({ message: "Member name is required" });

    const existingGroup = await Group.findById(group);
    const existingChurch = await Church.findById(church);
    if (!existingGroup) return res.status(404).json({ message: "Group not found" });
    if (!existingChurch) return res.status(404).json({ message: "Church not found" });

    const member = await Member.create({
      name,
      phone,
      birthday,
      kingschatId,
      group,
      church,
      hod,
      email,
    });

    res.status(201).json(member);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ===============================
   GET MEMBERS (Paginated, Filtered)
================================= */
export const getMembers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const group = req.query.group || "";
    const church = req.query.church || "";

    const filter = {}; // <-- removed deleted: false since hard delete is used
    if (search) filter.name = { $regex: search, $options: "i" };
    if (group) filter.group = group;
    if (church) filter.church = church;

    const total = await Member.countDocuments(filter);
    const members = await Member.find(filter)
      .populate("group", "group_name")
      .populate("church", "name")
      .populate("hod", "name")
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({ members, total, page, limit });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ===============================
   UPDATE MEMBER (Admin/HOD Direct Update)
================================= */
export const updateMember = async (req, res) => {
  try {
    const { id } = req.params; // ID comes from the URL
    const updates = { ...req.body };

    // Remove editId if present to avoid trying to update _id
    if (updates.editId) delete updates.editId;

    // Find and update member
    const updated = await Member.findByIdAndUpdate(id, updates, {
      new: true,          // return the updated document
      runValidators: true // ensure schema validations are applied
    });

    if (!updated) return res.status(404).json({ message: "Member not found" });

    res.status(200).json(updated);
  } catch (err) {
    console.error("Error updating member:", err);
    res.status(500).json({ message: err.message });
  }
};

/* ===============================
   MEMBER SELF-UPDATE REQUEST
================================= */
export const submitUpdateRequest = async (req, res) => {
  try {
    const { id } = req.params; // Member ID
    const newDetails = req.body;

    const member = await Member.findById(id);
    if (!member) return res.status(404).json({ message: "Member not found" });

    member.pendingUpdate = newDetails;
    member.updateStatus = "pending";
    await member.save();

    res.status(200).json({ message: "Update request submitted successfully", member });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ===============================
   APPROVE OR REJECT MEMBER UPDATE
================================= */
export const reviewUpdateRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, notes } = req.body; // action: 'approve' | 'reject'

    const member = await Member.findById(id);
    if (!member) return res.status(404).json({ message: "Member not found" });

    if (action === "approve") {
      if (member.pendingUpdate) {
        Object.assign(member, member.pendingUpdate); // apply changes
        member.pendingUpdate = null;
        member.updateStatus = "approved";
        member.updateNotes = notes || "Approved successfully";
      }
    } else if (action === "reject") {
      member.updateStatus = "rejected";
      member.updateNotes = notes || "Request rejected";
      member.pendingUpdate = null;
    } else {
      return res.status(400).json({ message: "Invalid action. Must be 'approve' or 'reject'." });
    }

    await member.save();
    res.status(200).json({ message: `Update ${action}ed successfully`, member });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ===============================
   HARD DELETE MEMBER
================================= */
export const deleteMember = async (req, res) => {
  try {
    const { id } = req.params;
    const member = await Member.findByIdAndDelete(id); // <-- hard delete
    if (!member) return res.status(404).json({ message: "Member not found" });
    res.json({ message: "Member deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ===============================
   BULK UPLOAD MEMBERS
================================= */
export const bulkUploadMembers = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });

  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    if (!data || data.length === 0) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: "Excel file is empty or invalid" });
    }

    const membersToInsert = [];
    const skippedRows = [];

    for (const row of data) {
      if (!row.name || !row.group || !row.church) {
        skippedRows.push({ row, reason: "Missing required fields" });
        continue;
      }

      const groupDoc = await Group.findOne({ group_name: row.group });
      const churchDoc = await Church.findOne({ name: row.church });

      if (!groupDoc) {
        skippedRows.push({ row, reason: "Group not found" });
        continue;
      }
      if (!churchDoc) {
        skippedRows.push({ row, reason: "Church not found" });
        continue;
      }

      let birthday = null;
      if (row.birthday) {
        const date = new Date(row.birthday);
        if (!isNaN(date.getTime())) birthday = date;
      }

      membersToInsert.push({
        name: row.name,
        email: row.email || "",
        phone: row.phone || "",
        birthday,
        kingschatId: row.kingschatId || "",
        group: groupDoc._id,
        church: churchDoc._id,
      });
    }

    if (membersToInsert.length === 0) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: "No valid members to insert" });
    }

    let inserted = [];
    let duplicateCount = 0;

    try {
      inserted = await Member.insertMany(membersToInsert, { ordered: false });
    } catch (err) {
      if (err.code === 11000 && err.writeErrors) {
        duplicateCount = err.writeErrors.length;
        inserted = err.insertedDocs || [];
      } else {
        throw err;
      }
    }

    fs.unlinkSync(req.file.path);
    return res.status(201).json({
      message: `${inserted.length} members uploaded successfully`,
      duplicatesSkipped: duplicateCount,
      skippedRows,
    });
  } catch (err) {
    console.error("Bulk upload error:", err);
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
};
