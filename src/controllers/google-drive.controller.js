const {
  createAuthorizationUrl,
  exchangeAuthorizationCode,
  getConnectionStatus,
  runDriveTest
} = require("../services/google-drive.service");

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderOAuthResult({ success, message }) {
  const adminOrigin = process.env.ADMIN_ORIGIN || "http://localhost:3001";
  const title = success ? "Google Drive conectado" : "No fue posible conectar Google Drive";
  const statusClass = success ? "success" : "error";
  const safeMessage = escapeHtml(message);

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} | COINPSI</title>
  <style>
    :root { color-scheme: light; font-family: Inter, system-ui, sans-serif; }
    body { min-height: 100vh; margin: 0; display: grid; place-items: center; background: #f8fafc; color: #0f172a; }
    main { width: min(520px, calc(100% - 40px)); padding: 36px; border: 1px solid #e2e8f0; border-radius: 22px; background: white; box-shadow: 0 18px 50px rgb(15 23 42 / .08); text-align: center; }
    .badge { display: inline-flex; padding: 7px 12px; border-radius: 999px; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; }
    .success { background: #dcfce7; color: #166534; }
    .error { background: #fee2e2; color: #991b1b; }
    h1 { margin: 20px 0 10px; font-size: 26px; }
    p { margin: 0; color: #475569; line-height: 1.65; }
    a { display: inline-flex; margin-top: 24px; padding: 11px 18px; border-radius: 12px; background: #1d4ed8; color: white; font-weight: 700; text-decoration: none; }
  </style>
</head>
<body>
  <main>
    <span class="badge ${statusClass}">${success ? "Conexion completada" : "Conexion fallida"}</span>
    <h1>${title}</h1>
    <p>${safeMessage}</p>
    <a href="${escapeHtml(adminOrigin)}/galeria">Volver al panel</a>
  </main>
  <script>
    if (window.opener) {
      window.opener.postMessage(
        { type: ${JSON.stringify(success ? "coinpsi-google-drive-connected" : "coinpsi-google-drive-error")} },
        ${JSON.stringify(adminOrigin)}
      );
      ${success ? "window.setTimeout(() => window.close(), 900);" : ""}
    }
  </script>
</body>
</html>`;
}

function getAuthorizationUrl(req, res) {
  try {
    const authorizationUrl = createAuthorizationUrl(req.auth.userId);
    return res.status(200).json({
      status: "ok",
      authorizationUrl
    });
  } catch (error) {
    return res.status(400).json({
      status: "error",
      error: error.code || "GOOGLE_DRIVE_AUTH_ERROR",
      message: error.message
    });
  }
}

async function handleOAuthCallback(req, res) {
  const { code, state, error: oauthError } = req.query;

  if (oauthError) {
    return res
      .status(400)
      .type("html")
      .send(
        renderOAuthResult({
          success: false,
          message: `Google rechazo la autorizacion: ${oauthError}`
        })
      );
  }

  if (!code || !state) {
    return res
      .status(400)
      .type("html")
      .send(
        renderOAuthResult({
          success: false,
          message: "La respuesta de Google no incluyo los datos requeridos."
        })
      );
  }

  try {
    await exchangeAuthorizationCode(code, state);

    return res
      .status(200)
      .type("html")
      .send(
        renderOAuthResult({
          success: true,
          message: "La cuenta fue autorizada. Ya puedes regresar al panel y ejecutar la prueba."
        })
      );
  } catch (error) {
    console.error("No fue posible completar OAuth de Google Drive:", error.message);

    return res
      .status(400)
      .type("html")
      .send(
        renderOAuthResult({
          success: false,
          message: error.message
        })
      );
  }
}

async function getDriveStatus(req, res) {
  const drive = await getConnectionStatus();
  return res.status(200).json({ status: "ok", drive });
}

async function testDriveConnection(req, res) {
  try {
    const test = await runDriveTest();
    return res.status(200).json({ status: "ok", test });
  } catch (error) {
    console.error("La prueba de Google Drive fallo:", error.message);

    const status = error.code === "GOOGLE_DRIVE_NOT_CONNECTED" ? 409 : 400;
    return res.status(status).json({
      status: "error",
      error: error.code || "GOOGLE_DRIVE_TEST_ERROR",
      message: error.message
    });
  }
}

module.exports = {
  getAuthorizationUrl,
  getDriveStatus,
  handleOAuthCallback,
  testDriveConnection
};
