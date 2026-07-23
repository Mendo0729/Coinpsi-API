const cors = require("cors");
const express = require("express");

const adminEventRoutes = require("./routes/admin-event.routes");
const adminGalleryRoutes = require("./routes/admin-gallery.routes");
const authRoutes = require("./routes/auth.routes");
const googleDriveRoutes = require("./routes/google-drive.routes");
const googleOAuthRoutes = require("./routes/google-oauth.routes");
const publicEventRoutes = require("./routes/public-event.routes");
const publicGalleryRoutes = require("./routes/public-gallery.routes");
const { getDatabaseHealth } = require("./services/health.service");

const app = express();

const adminOrigin = process.env.ADMIN_ORIGIN || "http://localhost:3001";
const landingOrigin = process.env.LANDING_ORIGIN || "http://localhost:3000";
const allowedOrigins = new Set([adminOrigin, landingOrigin]);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origen no permitido por CORS."));
    },
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);
app.use(express.json({ limit: "1mb" }));
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/events", publicEventRoutes);
app.use("/api/v1/gallery", publicGalleryRoutes);
app.use("/api/v1/admin/events", adminEventRoutes);
app.use("/api/v1/admin/gallery", adminGalleryRoutes);
app.use("/api/v1/admin/google-drive", googleDriveRoutes);
app.use("/api/v1/google", googleOAuthRoutes);

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
