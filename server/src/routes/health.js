import express from "express";
import pool from "../config/db.js";

const router = express.Router();

router.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT NOW()");

    return res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
      db: "connected",
    });
  } catch (error) {
    return res.status(503).json({
      status: "error",
      timestamp: new Date().toISOString(),
      db: "disconnected",
    });
  }
});

export default router;
