const cors = require("cors");
const express = require("express");

const adminEventRoutes = require("./routes/admin-event.routes");
const authRoutes = require("./routes/auth.routes");
const { getDatabaseHealth } = require("./services/health.service");

const app = express();

const adminOrigin = process.env.ADMIN_ORIGIN || "http://localhost:3001";

app.use(
  cors({
    origin: adminOrigin,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);
app.use(express.json());
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/admin/events", adminEventRoutes);

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
