import jwt from "jsonwebtoken";

/**
 * ✅ Verifies that the user is authenticated
 */
export const requireAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided." });
    }

    const token = authHeader.split(" ")[1];
    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not defined in environment.");
      return res.status(500).json({ message: "Server configuration error." });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      console.error("JWT verification failed:", err);
      return res.status(401).json({ message: "Invalid or expired token." });
    }

    // Attach user data to request
    req.user = { id: decoded.id, role: decoded.role };
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

/**
 * ✅ Restricts route access to specific roles
 */
export const requireRole = (roles = []) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "User not authenticated." });
      }

      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ message: "Access denied." });
      }

      next();
    } catch (error) {
      console.error("Role check error:", error);
      return res.status(500).json({ message: "Authorization failed." });
    }
  };
};

/**
 * ✅ Shortcut for admin-only routes
 */
export const requireAdmin = requireRole(["admin"]);
