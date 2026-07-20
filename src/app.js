const express = require("express");

const { getDatabaseHealth } = require("./services/health.service");

const app = express();

app.use(express.json());

app.get("/health", async (req, res) => {
  try {
    const database = await getDatabaseHealth();
    const isProduction = process.env.NODE_ENV === "production";

    return res.status(200).json({
      service: "coinpsi-api",
      status: "ok",
      database: isProduction
        ? {
            status: database.status,
            responseTimeMs: database.responseTimeMs
          }
        : database
    });
  } catch (error) {
    console.error("No fue posible consultar PostgreSQL:", error.message);

    return res.status(503).json({
      service: "coinpsi-api",
      status: "degraded",
      database: {
        status: "disconnected"
      }
    });
  }
});

module.exports = app;
