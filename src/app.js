const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const { generalLimiter } = require("./middleware/rate-limit");

const adminEventRoutes = require("./routes/admin-event.routes");
const adminGalleryRoutes = require("./routes/admin-gallery.routes");
const adminKnowledgeRoutes = require("./routes/admin-knowledge.routes");
const authRoutes = require("./routes/auth.routes");
const googleDriveRoutes = require("./routes/google-drive.routes");
const googleOAuthRoutes = require("./routes/google-oauth.routes");
const publicEventRoutes = require("./routes/public-event.routes");
const publicGalleryRoutes = require("./routes/public-gallery.routes");
const publicKnowledgeRoutes = require("./routes/public-knowledge.routes");
const { getDatabaseHealth } = require("./services/health.service");

const app = express();

// Render uses one trusted reverse proxy.
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(helmet());

const adminOrigin = (process.env.ADMIN_ORIGIN || "http://localhost:3001").replace(/\/$/, "");
const landingOrigin = (process.env.LANDING_ORIGIN || "http://localhost:3000").replace(/\/$/, "");
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
app.use(generalLimiter);
app.use(express.json({ limit: "1mb" }));
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/events", publicEventRoutes);
app.use("/api/v1/gallery", publicGalleryRoutes);
app.use("/api/v1/knowledge", publicKnowledgeRoutes);
app.use("/api/v1/admin/events", adminEventRoutes);
app.use("/api/v1/admin/gallery", adminGalleryRoutes);
app.use("/api/v1/admin/knowledge", adminKnowledgeRoutes);
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

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.message === "Origen no permitido por CORS.") {
    return res.status(403).json({ error: "ORIGIN_NOT_ALLOWED", message: "Origen no permitido." });
  }
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ error: "INVALID_JSON", message: "El cuerpo JSON no es válido." });
  }
  if (error.type === "entity.too.large") {
    return res.status(413).json({ error: "PAYLOAD_TOO_LARGE", message: "Solicitud demasiado grande." });
  }
  console.error("Error no controlado de API:", error.message);
  return res.status(500).json({ error: "INTERNAL_ERROR", message: "Error interno del servidor." });
});

module.exports = app;
