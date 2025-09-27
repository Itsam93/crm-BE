import dotenv from "dotenv";
dotenv.config();

import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server } from "socket.io";

import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import groupRoutes from "./routes/groupRoutes.js";
import churchRoutes from "./routes/churchRoutes.js";
import memberRoutes from "./routes/memberRoutes.js";
import partnershipRoutes from "./routes/partnershipRoutes.js";
import givingRoutes from "./routes/givingRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import reportRoutes from "./routes/reportRoutes.js"; 
import { notFound, errorHandler } from "./middleware/errorMiddleware.js";

import User from "./models/User.js";


const startServer = async () => {
  try {
    await connectDB(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected");
  } catch (error) {
    console.error("❌ DB Connection Failed:", error.message);
    process.exit(1);
  }
};

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: [
      "http://localhost:5173",
      "http://localhost:3000",
      "https://crm-app-wheat.vercel.app",
    ],
    credentials: true,
  },
});

app.set("io", io);

io.on("connection", (socket) => {
  console.log("⚡ Client connected:", socket.id);
  socket.on("disconnect", () => console.log("⚡ Client disconnected:", socket.id));
});

app.use(helmet());

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://crm-app-wheat.vercel.app",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); 
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        console.error("❌ CORS blocked origin:", origin);
        return callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.options("*", cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, 
  max: 200,
  message: "Too many requests from this IP, please try again later.",
});
app.use(limiter);

app.use("/api/auth", authRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/churches", churchRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/partnerships", partnershipRoutes);
app.use("/api/givings", givingRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/reports", reportRoutes);

app.get("/api/health", (req, res) =>
  res.json({ ok: true, env: process.env.NODE_ENV })
);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (process.env.NODE_ENV === "production") {
  const frontendPath = path.join(__dirname, "../frontend/dist");
  app.use(express.static(frontendPath));

  app.get("*", (req, res) =>
    res.sendFile(path.resolve(frontendPath, "index.html"))
  );
}

app.use(notFound);
app.use(errorHandler);

const seedAdminIfNeeded = async () => {
  try {
    const existingAdmin = await User.findOne({
      username: process.env.ADMIN_USERNAME || "admin",
    });
    if (!existingAdmin) {
      const adminUser = new User({
        username: process.env.ADMIN_USERNAME || "admin",
        password: process.env.ADMIN_PASSWORD || "admin123",
        role: "admin",
      });

      await adminUser.save();
      console.log("✅ Admin user seeded:", adminUser.username);
    } else {
      console.log("ℹ️ Admin user already exists");
    }
  } catch (err) {
    console.error("❌ Error seeding admin:", err);
  }
};

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, async () => {
  console.log(`🚀 Server running in ${process.env.NODE_ENV} on port ${PORT}`);
  await startServer();
  await seedAdminIfNeeded();
});
