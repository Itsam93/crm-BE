// controllers/churchController.js
import Church from "../models/Church.js";

export const getChurches = async (req, res) => {
  try {
    const churches = await Church.find().populate("group", "name group_name");
    res.status(200).json(churches);
  } catch (err) {
    console.error("Error fetching churches:", err);
    res.status(500).json({ message: err.message });
  }
};

export const createChurch = async (req, res) => {
  try {
    const { name, group, pastorName, location } = req.body;
    if (!name || !group)
      return res.status(400).json({ message: "Name and Group are required." });

    const exists = await Church.findOne({ name, group });

    const church = await Church.create({ name, group, pastorName, location });
    const populated = await church.populate("group", "name group_name");
    res.status(201).json(populated);
  } catch (err) {
    console.error("Error creating church:", err);
    res.status(500).json({ message: err.message });
  }
};

export const updateChurch = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, group, pastorName, location } = req.body;

    const updatedChurch = await Church.findByIdAndUpdate(
      id,
      { name, group, pastorName, location },
      { new: true }
    ).populate("group", "name group_name");

    if (!updatedChurch)
      return res.status(404).json({ message: "Church not found" });

    res.json(updatedChurch);
  } catch (err) {
    console.error("Error updating church:", err);
    res.status(500).json({ message: err.message });
  }
};

export const deleteChurch = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Church.findByIdAndDelete(id);
    if (!deleted)
      return res.status(404).json({ message: "Church not found" });

    res.json({ message: "Church deleted successfully" });
  } catch (err) {
    console.error("Error deleting church:", err);
    res.status(500).json({ message: err.message });
  }
};
