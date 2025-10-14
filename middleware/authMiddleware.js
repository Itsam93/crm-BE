import jwt from "jsonwebtoken";

/**
 * Protect routes by verifying JWT
 */
export const protect = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { role: "Admin" | "HealingHOD" | "RhapsodyHOD" | "MinistryHOD" | "Viewer" }
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};

/**
 * Restrict access to specific roles
 * Usage: restrictTo("Admin") or restrictTo("HealingHOD", "RhapsodyHOD")
 */
export const restrictTo = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }

    next();
  };
};
