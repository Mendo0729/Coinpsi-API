const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { getEnv } = require("../config/env");
const {
  findAdminByUsername
} = require("../repositories/admin-user.repository");

const INVALID_CREDENTIALS = "INVALID_CREDENTIALS";

function createAuthError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

async function authenticateAdmin(username, password) {
  const admin = await findAdminByUsername(username);

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
      username: admin.username
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
      username: admin.username,
      email: admin.email,
      role: admin.role
    }
  };
}

module.exports = {
  authenticateAdmin,
  INVALID_CREDENTIALS
};
