const { validateContact } = require("../validators/contact.validator");
const { sendContactEmail } = require("../services/contact-email.service");

async function submitContact(req, res) {
  // Honeypot: automated submissions often fill a field hidden from humans.
  // Always acknowledge these without sending anything.
  if (req.body && typeof req.body.website === "string" && req.body.website.trim()) {
    return res.status(200).json({ status: "ok", message: "Consulta recibida." });
  }

  const result = validateContact(req.body);
  if (!result.valid) {
    return res.status(422).json({
      error: "VALIDATION_ERROR",
      message: "Revise los campos del formulario.",
      fields: result.errors
    });
  }

  try {
    await sendContactEmail(result.data);
    return res.status(200).json({
      status: "ok",
      message: "Tu consulta se envió correctamente."
    });
  } catch (error) {
    const missingConfig = error.code === "CONTACT_NOT_CONFIGURED";
    console.error("No fue posible entregar una consulta desde el formulario:", error.code || "CONTACT_ERROR");
    return res.status(missingConfig ? 503 : 502).json({
      error: missingConfig ? "CONTACT_UNAVAILABLE" : "CONTACT_DELIVERY_FAILED",
      message: "No se pudo enviar tu consulta. Intenta nuevamente más tarde o escríbenos a info@coinpsi.org."
    });
  }
}

module.exports = { submitContact };
