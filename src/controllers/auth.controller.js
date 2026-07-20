const {
  authenticateAdmin,
  INVALID_CREDENTIALS
} = require("../services/auth.service");

async function login(req, res) {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");

  if (!email || !password) {
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Correo y contraseña son obligatorios."
    });
  }

  try {
    const session = await authenticateAdmin(email, password);

    return res.status(200).json({
      status: "ok",
      ...session
    });
  } catch (error) {
    if (error.code === INVALID_CREDENTIALS) {
      return res.status(401).json({
        error: "INVALID_CREDENTIALS",
        message: "Correo o contraseña incorrectos."
      });
    }

    console.error("No fue posible iniciar sesión:", error.message);

    return res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "No fue posible iniciar sesión."
    });
  }
}

module.exports = {
  login
};
