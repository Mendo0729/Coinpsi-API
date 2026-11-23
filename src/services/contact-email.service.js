const { randomUUID } = require("node:crypto");

const RESEND_URL = "https://api.resend.com/emails";
const DEFAULT_FROM = "notificaciones@coinpsi.org";
const DEFAULT_TO = "info@coinpsi.org";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildContactEmail(data) {
  const fields = [
    ["Nombre", data.fullName],
    ["Correo electrónico", data.email],
    ["Teléfono", data.phone],
    ["Servicio", data.serviceLabel],
    ["Mensaje", data.message]
  ];
  const text = [
    "Nueva consulta desde el formulario de COINPSI",
    "",
    ...fields.map(([label, value]) => `${label}: ${value}`),
    "",
    "Responde a esta consulta utilizando el correo de la persona que escribió."
  ].join("\n");
  const htmlFields = fields.map(([label, value]) => {
    const formatted = escapeHtml(value).replace(/\r?\n/g, "<br>");
    return `<tr><th style="text-align:left;padding:9px;vertical-align:top">${escapeHtml(label)}</th><td style="padding:9px;overflow-wrap:anywhere">${formatted}</td></tr>`;
  }).join("");

  return {
    from: `COINPSI <${process.env.RESEND_FROM_EMAIL || DEFAULT_FROM}>`,
    to: [process.env.CONTACT_TO_EMAIL || DEFAULT_TO],
    reply_to: data.email,
    subject: "Nueva consulta desde coinpsi.org",
    text,
    html: `<!doctype html><html lang="es"><body style="font:16px/1.5 Arial,sans-serif;color:#1e293b"><h2>Consulta recibida en COINPSI</h2><table style="border-collapse:collapse">${htmlFields}</table></body></html>`
  };
}

async function sendContactEmail(data, { fetchImpl = fetch } = {}) {
  const key = String(process.env.RESEND_API_KEY || "").trim();
  if (!key) {
    const error = new Error("El servicio de correo no está configurado.");
    error.code = "CONTACT_NOT_CONFIGURED";
    throw error;
  }

  const submissionId = data.submissionId || randomUUID();
  const email = buildContactEmail(data);
  let response;
  try {
    response = await fetchImpl(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `coinpsi-contact/${submissionId}`
      },
      body: JSON.stringify(email),
      signal: AbortSignal.timeout(12000)
    });
  } catch (error) {
    // Never log the contact message, the API key or user-provided personal data.
    console.error("Resend: error de conexión o tiempo agotado:", error.name);
    const failure = new Error("No fue posible enviar la consulta.");
    failure.code = "CONTACT_DELIVERY_FAILED";
    throw failure;
  }

  if (!response.ok) {
    console.error("Resend rechazó la solicitud. HTTP", response.status);
    const error = new Error("No fue posible enviar la consulta.");
    error.code = "CONTACT_DELIVERY_FAILED";
    throw error;
  }

  const result = await response.json().catch(() => ({}));
  if (typeof result.id !== "string" || !result.id) {
    const error = new Error("El proveedor no confirmó el envío.");
    error.code = "CONTACT_DELIVERY_FAILED";
    throw error;
  }

  return { id: result.id };
}

module.exports = { buildContactEmail, sendContactEmail };
