const jwt = require("jsonwebtoken");
const { getEnv } = require("../config/env");
const { findAdminById } = require("../repositories/admin-user.repository");

async function requireAuth(req, res, next) {
  const authorization = String(req.headers.authorization ?? "").trim();
  const [scheme, token] = authorization.split(/\s+/);
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "UNAUTHORIZED", message: "Se requiere un token de acceso válido." });
  }

  let payload;
  try {
    payload = jwt.verify(token, getEnv("JWT_SECRET"), {
      algorithms: ["HS256"],
      issuer: "coinpsi-api",
      audience: "coinpsi-admin"
    });
  } catch {
    return res.status(401).json({ error: "UNAUTHORIZED", message: "El token de acceso no es válido o expiró." });
  }

  try {
    const admin = await findAdminById(String(payload.sub));
    if (!admin || !admin.is_active) {
      return res.status(401).json({ error: "UNAUTHORIZED", message: "La sesión ya no está activa." });
    }
    if (admin.role !== "admin" || payload.role !== admin.role) {
      return res.status(403).json({ error: "FORBIDDEN", message: "No tiene permisos para realizar esta operación." });
    }
    req.auth = { userId: String(admin.id), username: admin.username, role: admin.role };
    return next();
  } catch (error) {
    console.error("No fue posible verificar el estado de la sesión:", error.message);
    return res.status(503).json({ error: "AUTH_UNAVAILABLE", message: "No fue posible verificar la sesión." });
  }
}
module.exports = requireAuth;
