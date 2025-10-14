import User from "../models/User.js";
import bcrypt from "bcryptjs";

export const ensureSuperAdmin = async () => {
  const { SUPERADMIN_NAME, SUPERADMIN_USERNAME, SUPERADMIN_PASSWORD } = process.env;

  if (!SUPERADMIN_USERNAME || !SUPERADMIN_PASSWORD) {
    console.error(
      "❌ SUPERADMIN_USERNAME and SUPERADMIN_PASSWORD must be set in .env"
    );
    return;
  }

  try {
    const existing = await User.findOne({ username: SUPERADMIN_USERNAME });

    if (existing) {
      console.log(`✅ Super admin already exists: ${existing.username}`);
      return;
    }

    const hashedPassword = await bcrypt.hash(SUPERADMIN_PASSWORD, 10);

    const superAdmin = await User.create({
      name: SUPERADMIN_NAME || "Admin",
      username: SUPERADMIN_USERNAME,
      password: hashedPassword,
      role: "super_admin",
    });

    console.log("✅ Super admin ensured:", superAdmin.username);
  } catch (err) {
    // Handle duplicate key gracefully
    if (err.code === 11000) {
      console.log(
        `⚠️ Super admin with username '${SUPERADMIN_USERNAME}' already exists. Skipping creation.`
      );
    } else {
      console.error("❌ Error ensuring super admin:", err.message);
    }
  }
};
