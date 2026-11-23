const { rateLimit } = require("express-rate-limit");
const response = { error: "RATE_LIMITED", message: "Demasiadas solicitudes. Inténtelo nuevamente más tarde." };
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 600,
  standardHeaders: "draft-7", legacyHeaders: false,
  skip: (req) => req.path === "/health", message: response
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 8,
  standardHeaders: "draft-7", legacyHeaders: false,
  skipSuccessfulRequests: true, message: response
});
module.exports = { generalLimiter, loginLimiter };
