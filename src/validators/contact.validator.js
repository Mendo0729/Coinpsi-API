const SERVICE_LABELS = Object.freeze({
  "empresas-organizaciones": "Servicios para Empresas y Organizaciones",
  "consulta-psicologica": "Consulta Psicológica",
  "trabajo-familiar-equipo": "Técnica de Trabajo Familiar en Equipo",
  "proyectos-sociales-comunitarios": "Proyectos Sociales y Comunitarios"
});

function validateContact(value) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const errors = {};
  const string = (field) => typeof input[field] === "string" ? input[field].trim() : "";

  const fullName = string("fullName");
  const email = string("email").toLowerCase();
  const phone = string("phone");
  const serviceType = string("serviceType");
  const message = string("message");
  const submissionId = string("submissionId");

  if (fullName.length < 2 || fullName.length > 120 || /[\r\n\u0000-\u001f\u007f]/.test(fullName)) {
    errors.fullName = "El nombre debe contener entre 2 y 120 caracteres.";
  }
  if (email.length > 254 || !/^[^\s@<>()";:,\[\]\\]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(email) || email.includes("..")) {
    errors.email = "Ingrese un correo electrónico válido.";
  }
  const digits = phone.replace(/\D/g, "");
  if (!/^[+()\d\s.-]{7,25}$/.test(phone) || digits.length < 7 || digits.length > 15) {
    errors.phone = "Ingrese un teléfono válido (entre 7 y 15 dígitos).";
  }
  if (!Object.hasOwn(SERVICE_LABELS, serviceType)) {
    errors.serviceType = "Seleccione un servicio válido.";
  }
  if (message.length < 10 || message.length > 3000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(message)) {
    errors.message = "El mensaje debe contener entre 10 y 3000 caracteres.";
  }
  if (submissionId && !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submissionId)) {
    errors.submissionId = "Identificador de envío inválido.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    data: {
      fullName, email, phone, serviceType, message, submissionId,
      serviceLabel: SERVICE_LABELS[serviceType] || ""
    }
  };
}

module.exports = { validateContact, SERVICE_LABELS };
