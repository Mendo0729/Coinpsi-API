const {
  insertEvent,
  listAdminEvents
} = require("../repositories/event.repository");

const VALID_STATUSES = new Set(["draft", "published"]);
const VALID_MODALITIES = new Set(["in_person", "virtual", "hybrid"]);

function createValidationError(message, details = {}) {
  const error = new Error(message);
  error.code = "VALIDATION_ERROR";
  error.details = details;
  return error;
}

function normalizeDate(value, fieldName, required = false) {
  if (value === undefined || value === null || value === "") {
    if (required) {
      throw createValidationError(`${fieldName} es obligatorio.`, {
        field: fieldName
      });
    }

    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw createValidationError(`${fieldName} debe contener una fecha válida.`, {
      field: fieldName
    });
  }

  return date.toISOString();
}

function normalizeRequiredText(value, fieldName) {
  const normalized = String(value ?? "").trim();

  if (!normalized) {
    throw createValidationError(`${fieldName} es obligatorio.`, {
      field: fieldName
    });
  }

  return normalized;
}

function normalizeOptionalText(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function normalizeNewEvent(payload = {}) {
  const startAt = normalizeDate(payload.startAt, "startAt", true);
  const endAt = normalizeDate(payload.endAt, "endAt");
  const status = String(payload.status || "draft").trim().toLowerCase();
  const modality = String(payload.modality ?? "").trim().toLowerCase();

  if (!VALID_STATUSES.has(status)) {
    throw createValidationError("status debe ser draft o published.", {
      field: "status"
    });
  }

  if (!VALID_MODALITIES.has(modality)) {
    throw createValidationError(
      "modality debe ser in_person, virtual o hybrid.",
      { field: "modality" }
    );
  }

  if (endAt && new Date(endAt) < new Date(startAt)) {
    throw createValidationError(
      "endAt no puede ser anterior a startAt.",
      { field: "endAt" }
    );
  }

  return {
    title: normalizeRequiredText(payload.title, "title"),
    description: normalizeRequiredText(payload.description, "description"),
    eventType: normalizeRequiredText(payload.eventType, "eventType"),
    startAt,
    endAt,
    location: normalizeOptionalText(payload.location),
    modality,
    status
  };
}

async function getAdminEvents() {
  return listAdminEvents();
}

async function createAdminEvent(payload) {
  return insertEvent(normalizeNewEvent(payload));
}

module.exports = {
  createAdminEvent,
  getAdminEvents
};
