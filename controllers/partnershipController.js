import asyncHandler from "express-async-handler";
import Partnership from "../models/Partnership.js";

// @desc    Get all partnership arms
// @route   GET /api/partnerships
// @access  Private
export const getPartnerships = asyncHandler(async (req, res) => {
  const partnerships = await Partnership.find().sort({ createdAt: -1 });
  res.json(partnerships);
});

// @desc    Add new partnership arm
// @route   POST /api/partnerships
// @access  Private
export const addPartnership = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name) {
    res.status(400);
    throw new Error("Partnership arm name is required");
  }

  const partnership = await Partnership.create({ name });
  res.status(201).json(partnership);
});

// @desc    Update a partnership arm
// @route   PUT /api/partnerships/:id
// @access  Private
export const updatePartnership = asyncHandler(async (req, res) => {
  const partnership = await Partnership.findById(req.params.id);

  if (!partnership) {
    res.status(404);
    throw new Error("Partnership arm not found");
  }

  partnership.name = req.body.name || partnership.name;
  const updated = await partnership.save();

  res.json(updated);
});

// @desc    Delete a partnership arm
// @route   DELETE /api/partnerships/:id
// @access  Private
export const deletePartnership = asyncHandler(async (req, res) => {
  const partnership = await Partnership.findById(req.params.id);

  if (!partnership) {
    res.status(404);
    throw new Error("Partnership arm not found");
  }

  await partnership.deleteOne();
  res.json({ message: "Partnership arm removed" });
});
