import Member from "../models/Member.js";
import Group from "../models/Group.js";
import Church from "../models/Church.js";

// ✅ Create new member
export const createMember = async (req, res) => {
  try {
    const { name, phone, birthday, kingschatId, group, church } = req.body;

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
    });

    res.status(201).json(member);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
// ✅ Get all members (exclude deleted)
export const getMembers = async (req, res) => {
  try {
    const members = await Member.find({ deleted: false })
      .populate("group", "group_name")
      .populate("church", "name");
    res.json(members);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ✅ Update member
export const updateMember = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const updated = await Member.findByIdAndUpdate(id, updates, { new: true });
    if (!updated) return res.status(404).json({ message: "Member not found" });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ✅ Soft delete member
export const deleteMember = async (req, res) => {
  try {
    const { id } = req.params;
    const member = await Member.findByIdAndUpdate(id, { deleted: true }, { new: true });
    if (!member) return res.status(404).json({ message: "Member not found" });
    res.json({ message: "Member deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
