const {
  cancelEventById,
  deleteEventById,
  insertEvent,
  listAdminEvents,
  listPublishedEvents,
  updateEventById
} = require("../repositories/event.repository");

const VALID_CREATE_STATUSES = new Set(["draft", "published"]);
const VALID_UPDATE_STATUSES = new Set(["draft", "published", "finished", "cancelled"]);
const MODALITY_TO_DATABASE = {
  in_person: "presencial",
  virtual: "virtual",
  hybrid: "hibrido"
};

function createValidationError(message, details = {}) {
  const error = new Error(message);
  error.code = "VALIDATION_ERROR";
  error.details = details;
  return error;
}

function createNotFoundError() {
  const error = new Error("El evento solicitado no existe.");
  error.code = "EVENT_NOT_FOUND";
  return error;
}

function normalizeEventId(value) {
  const id = String(value ?? "").trim();

  if (!/^[1-9]\d*$/.test(id)) {
    throw createValidationError("El identificador del evento no es valido.", {
      field: "id"
    });
  }

  return id;
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
    throw createValidationError(`${fieldName} debe contener una fecha valida.`, {
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

function normalizeWhatsappNumber(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const digits = raw.replace(/\D/g, "");

  if (digits.length < 8 || digits.length > 15) {
    throw createValidationError(
      "whatsappNumber debe incluir codigo de pais y contener entre 8 y 15 digitos.",
      { field: "whatsappNumber" }
    );
  }

  return digits;
}

function createEventSlug(title) {
  const baseSlug = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "evento";

  const uniqueSuffix = `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;

  return `${baseSlug}-${uniqueSuffix}`;
}

function normalizeEventPayload(payload = {}, { allowAllStatuses = false } = {}) {
  const title = normalizeRequiredText(payload.title, "title");
  const startAt = normalizeDate(payload.startAt, "startAt", true);
  const endAt = normalizeDate(payload.endAt, "endAt");
  const status = String(payload.status || "draft").trim().toLowerCase();
  const requestedModality = String(payload.modality ?? "").trim().toLowerCase();
  const modality = MODALITY_TO_DATABASE[requestedModality];
  const whatsappNumber = normalizeWhatsappNumber(payload.whatsappNumber);
  const validStatuses = allowAllStatuses ? VALID_UPDATE_STATUSES : VALID_CREATE_STATUSES;

  if (!validStatuses.has(status)) {
    throw createValidationError(
      allowAllStatuses
        ? "status debe ser draft, published, finished o cancelled."
        : "status debe ser draft o published.",
      { field: "status" }
    );
  }

  if (!modality) {
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

  if (status === "published" && !whatsappNumber) {
    throw createValidationError(
      "whatsappNumber es obligatorio para publicar el evento.",
      { field: "whatsappNumber" }
    );
  }

  return {
    title,
    description: normalizeRequiredText(payload.description, "description"),
    eventType: normalizeRequiredText(payload.eventType, "eventType"),
    startAt,
    endAt,
    location: normalizeOptionalText(payload.location),
    modality,
    whatsappNumber,
    whatsappMessage: whatsappNumber
      ? normalizeOptionalText(payload.whatsappMessage) || `Hola, deseo recibir informacion sobre el evento ${title}.`
      : null,
    status
  };
}

async function getAdminEvents() {
  return listAdminEvents();
}

async function getPublishedEvents() {
  return listPublishedEvents();
}

async function createAdminEvent(payload) {
  const event = normalizeEventPayload(payload);
  return insertEvent({
    ...event,
    slug: createEventSlug(event.title)
  });
}

async function updateAdminEvent(id, payload) {
  const event = await updateEventById(
    normalizeEventId(id),
    normalizeEventPayload(payload, { allowAllStatuses: true })
  );

  if (!event) {
    throw createNotFoundError();
  }

  return event;
}

async function cancelAdminEvent(id) {
  const event = await cancelEventById(normalizeEventId(id));

  if (!event) {
    throw createNotFoundError();
  }

  return event;
}

async function removeAdminEvent(id) {
  const deletedId = await deleteEventById(normalizeEventId(id));

  if (!deletedId) {
    throw createNotFoundError();
  }

  return deletedId;
}

module.exports = {
  cancelAdminEvent,
  createAdminEvent,
  getAdminEvents,
  getPublishedEvents,
  removeAdminEvent,
  updateAdminEvent
};
