const {
  authenticateAdmin,
  INVALID_CREDENTIALS
} = require("../services/auth.service");
const { findAdminById } = require("../repositories/admin-user.repository");

async function login(req, res) {
  const username = String(req.body?.username ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");

  if (!username || !password) {
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Usuario y contraseña son obligatorios."
    });
  }

  try {
    const session = await authenticateAdmin(username, password);

    return res.status(200).json({
      status: "ok",
      ...session
    });
  } catch (error) {
    if (error.code === INVALID_CREDENTIALS) {
      return res.status(401).json({
        error: "INVALID_CREDENTIALS",
        message: "Usuario o contraseña incorrectos."
      });
    }

    console.error("No fue posible iniciar sesión:", error.message);

    return res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "No fue posible iniciar sesión."
    });
  }
}

async function me(req, res) {
  try {
    const admin = await findAdminById(req.auth.userId);

    if (!admin || !admin.is_active) {
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "La sesión ya no es válida."
      });
    }

    return res.status(200).json({
      status: "ok",
      user: {
        id: admin.id,
        fullName: admin.full_name,
        username: admin.username,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (error) {
    console.error("No fue posible consultar la sesión:", error.message);

    return res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "No fue posible consultar la sesión."
    });
  }
}

module.exports = {
  login,
  me
};
