import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import errorHandler from "./middleware/errorHandler.js";
import validateEnv from "./config/validateEnv.js";

const app = express();
const PORT = process.env.PORT || 5000;

try {
  validateEnv();
} catch (error) {
  console.error("Environment validation failed:", error.message);
  process.exit(1);
}

const { default: healthRoutes } = await import("./routes/health.js");
const { default: authRoutes } = await import("./routes/auth.js");
const { default: workspaceRoutes } = await import("./routes/workspaces.js");
const { default: documentRoutes } = await import("./routes/documents.js");
const { testConnection } = await import("./config/db.js");
const { initQdrantCollection } = await import("./config/qdrant.js");
const { default: passport } = await import("./config/passport.js");

app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  }),
);
app.use(morgan("dev"));
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

app.use("/api", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/workspaces", documentRoutes);

app.use(errorHandler);

async function startServer() {
  try {
    // PostgreSQL is mandatory
    await testConnection();
    await initQdrantCollection();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    process.exit(1);
  }
}

startServer();
