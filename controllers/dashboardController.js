import asyncHandler from "express-async-handler";
import Group from "../models/Group.js";
import Church from "../models/Church.js";
import Member from "../models/Member.js";
import Giving from "../models/Giving.js";

export const getDashboard = asyncHandler(async (req, res) => {
  const totalGiving = await Giving.aggregate([
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  const groups = await Group.countDocuments();
  const churches = await Church.countDocuments();
  const members = await Member.countDocuments();

  res.json({
    total: totalGiving[0]?.total || 0,
    groups,
    churches,
    members,
  });
});
