import jwt from "jsonwebtoken";
import User from "../models/User.js";

const HOD_ROLES = [
  "healing_hod",
  "rhapsody_hod",
  "ministry_hod",
  "bibles_hod",
  "innercity_hod",
  "lwpm_hod",
];

const HEAD_OF_FACULTY_ROLE = "head_of_faculty";

export const loginUser = async (req, res) => {
  const { role, password } = req.body;

  if (!role || !password) {
    return res.status(400).json({
      message: "Role and password are required",
    });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({
      message: "Server configuration error.",
    });
  }

  const normalizedRole = String(role)
    .toLowerCase()
    .trim();

  try {
    if (normalizedRole === "admin") {
      if (password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({
          message: "Invalid credentials",
        });
      }

      let adminUser = await User.findOne({
        role: "admin",
      });

      if (!adminUser) {
        adminUser = await User.create({
          name: "System Administrator",
          password: process.env.ADMIN_PASSWORD,
          role: "admin",
          isActive: true,
        });
      }

      if (!adminUser.isActive) {
        return res.status(403).json({
          message: "Admin account is inactive",
        });
      }

      const token = jwt.sign(
        {
          id: adminUser._id.toString(),
          role: "admin",
          type: "system",
        },
        process.env.JWT_SECRET,
        {
          expiresIn: "7d",
        }
      );

      return res.status(200).json({
        success: true,
        role: "admin",
        token,
        userId: adminUser._id,
      });
    }

    if (normalizedRole === HEAD_OF_FACULTY_ROLE) {
      const facultyUser = await User.findOne({
        role: HEAD_OF_FACULTY_ROLE,
      }).select("+password");

      if (!facultyUser) {
        return res.status(404).json({
          message: "Head of Faculty account not found.",
        });
      }

      if (!facultyUser.isActive) {
        return res.status(403).json({
          message: "Head of Faculty account is inactive.",
        });
      }

      const passwordMatch =
        await facultyUser.matchPassword(password);

      if (!passwordMatch) {
        return res.status(401).json({
          message: "Invalid credentials",
        });
      }

      const token = jwt.sign(
        {
          id: facultyUser._id.toString(),
          role: HEAD_OF_FACULTY_ROLE,
          type: HEAD_OF_FACULTY_ROLE,
        },
        process.env.JWT_SECRET,
        {
          expiresIn: "7d",
        }
      );

      return res.status(200).json({
        success: true,
        role: HEAD_OF_FACULTY_ROLE,
        token,
        userId: facultyUser._id,
      });
    }

    if (!HOD_ROLES.includes(normalizedRole)) {
      return res.status(404).json({
        message: "Role not found",
      });
    }

    const user = await User.findOne({
      role: normalizedRole,
    }).select("+password");

    if (!user) {
      return res.status(404).json({
        message: "HOD user not found",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        message: "HOD account is inactive",
      });
    }

    if (!user.password) {
      return res.status(500).json({
        message:
          "User account is missing password credentials",
      });
    }

    const passwordMatch =
      await user.matchPassword(password);

    if (!passwordMatch) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    const token = jwt.sign(
      {
        id: user._id.toString(),
        role: user.role,
        type: "hod",
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    return res.status(200).json({
      success: true,
      role: user.role,
      token,
      userId: user._id,
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
