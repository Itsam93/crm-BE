import jwt from "jsonwebtoken";
import User from "../models/userModel.js"; // if you have a User model

// Protect routes: verify JWT token
export const protect = async (req, res, next) => {
  let token;

  // 1. Check Authorization header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  // 2. Check token existence
  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }

  try {
    // 3. Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 4. Attach user info to request (optional)
    req.user = {
      id: decoded.id,
      role: decoded.role.toLowerCase(), // lowercase for consistent role checking
    };

    next();
  } catch (err) {
    console.error(err);
    return res.status(401).json({ message: "Not authorized, token failed" });
  }
};

// Restrict access to specific roles (case-insensitive)
export const restrictTo = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const allowedRoles = roles.map((r) => r.toLowerCase());
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied" });
  }

  next();
};
