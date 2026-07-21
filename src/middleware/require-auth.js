const jwt = require("jsonwebtoken");

const { getEnv } = require("../config/env");

function requireAuth(req, res, next) {
  const authorization = String(req.headers.authorization ?? "").trim();
  const [scheme, token] = authorization.split(/\s+/);

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({
      error: "UNAUTHORIZED",
      message: "Se requiere un token de acceso válido."
    });
  }

  try {
    const payload = jwt.verify(token, getEnv("JWT_SECRET"), {
      issuer: "coinpsi-api",
      audience: "coinpsi-admin"
    });

    req.auth = {
      userId: String(payload.sub),
      username: payload.username,
      role: payload.role
    };

    return next();
  } catch (error) {
    return res.status(401).json({
      error: "UNAUTHORIZED",
      message: "El token de acceso no es válido o expiró."
    });
  }
}

module.exports = requireAuth;
