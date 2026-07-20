const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { getEnv } = require("../config/env");
const { findAdminByEmail } = require("../repositories/admin-user.repository");

const INVALID_CREDENTIALS = "INVALID_CREDENTIALS";

function createAuthError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

async function authenticateAdmin(email, password) {
  const admin = await findAdminByEmail(email);

  if (!admin || !admin.is_active) {
    throw createAuthError(INVALID_CREDENTIALS);
  }

  const passwordMatches = await bcrypt.compare(password, admin.password_hash);

  if (!passwordMatches) {
    throw createAuthError(INVALID_CREDENTIALS);
  }

  const expiresIn = getEnv("JWT_EXPIRES_IN", "8h");
  const token = jwt.sign(
    {
      role: admin.role,
      email: admin.email
    },
    getEnv("JWT_SECRET"),
    {
      subject: String(admin.id),
      expiresIn,
      issuer: "coinpsi-api",
      audience: "coinpsi-admin"
    }
  );

  return {
    token,
    tokenType: "Bearer",
    expiresIn,
    user: {
      id: admin.id,
      fullName: admin.full_name,
      email: admin.email,
      role: admin.role
    }
  };
}

module.exports = {
  authenticateAdmin,
  INVALID_CREDENTIALS
};
