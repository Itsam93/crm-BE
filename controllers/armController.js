// controllers/armController.js
import asyncHandler from "express-async-handler";
import PartnershipArm from "../models/PartnershipArm.js";

// @desc    Get all arms
// @route   GET /api/arms
// @access  Private
export const getArms = asyncHandler(async (req, res) => {
  const arms = await PartnershipArm.find();
  res.json(arms);
});

// @desc    Add new arm
// @route   POST /api/arms
// @access  Private
export const addArm = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  if (!name) {
    res.status(400);
    throw new Error("Arm name is required");
  }
  const arm = await PartnershipArm.create({ name, description });
  res.status(201).json(arm);
});

// @desc    Update an arm
// @route   PUT /api/arms/:id
// @access  Private
export const updateArm = asyncHandler(async (req, res) => {
  const arm = await PartnershipArm.findById(req.params.id);
  if (!arm) {
    res.status(404);
    throw new Error("Arm not found");
  }
  Object.assign(arm, req.body);
  const updatedArm = await arm.save();
  res.json(updatedArm);
});

export const deleteArm = asyncHandler(async (req, res) => {
  const arm = await PartnershipArm.findById(req.params.id);
  if (!arm) {
    res.status(404);
    throw new Error("Arm not found");
  }
  await arm.remove();
  res.json({ message: "Arm removed" });
});
