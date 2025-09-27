import jwt from "jsonwebtoken";
import asyncHandler from "express-async-handler";
import User from "../models/User.js";

export const protect = asyncHandler(async (req, res, next) => {
  let token;

  // Check for Authorization header
  if (req.headers.authorization?.startsWith("Bearer")) {
    try {
      // Extract token from header
      token = req.headers.authorization.split(" ")[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Attach user to request object, exclude password
      req.user = await User.findById(decoded.id).select("-password");

      // Debugging info
      console.log("✅ Protected route accessed by:", req.user.username);

      next();
    } catch (err) {
      console.error("❌ Token verification failed:", err.message);
      res.status(401).json({ message: "Not authorized, token failed" });
    }
  } else {
    console.warn("⚠️ No token provided in request headers");
    res.status(401).json({ message: "Not authorized, no token" });
  }
});
