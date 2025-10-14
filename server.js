import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import partnerRoutes from "./routes/partnerRoutes.js";

dotenv.config();
connectDB();

const app = express();
app.use(express.json());
app.use(cors({ origin: "*" }));
app.use(helmet());
app.use(morgan("tiny"));

app.get("/", (req, res) => {
  res.status(200).json({ message: "CRM Backend API running successfully 🚀" });
});

// ✅ Authentication and Partners
app.use("/api/auth", authRoutes);
app.use("/api/partners", partnerRoutes);

app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err);
  res.status(500).json({ message: "Internal Server Error" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
