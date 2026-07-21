const {
  cancelAdminEvent,
  createAdminEvent,
  getAdminEvents,
  removeAdminEvent
} = require("../services/event.service");

function sendKnownError(res, error) {
  if (error.code === "VALIDATION_ERROR") {
    res.status(400).json({
      error: "VALIDATION_ERROR",
      message: error.message,
      details: error.details
    });
    return true;
  }

  if (error.code === "EVENT_NOT_FOUND") {
    res.status(404).json({
      error: "EVENT_NOT_FOUND",
      message: error.message
    });
    return true;
  }

  return false;
}

async function listEvents(req, res) {
  try {
    const events = await getAdminEvents();

    return res.status(200).json({
      status: "ok",
      count: events.length,
      events
    });
  } catch (error) {
    console.error("No fue posible consultar los eventos:", error.message);

    return res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "No fue posible consultar los eventos."
    });
  }
}

async function createEvent(req, res) {
  try {
    const event = await createAdminEvent(req.body);

    return res.status(201).json({
      status: "ok",
      event
    });
  } catch (error) {
    if (sendKnownError(res, error)) return;

    console.error("No fue posible crear el evento:", error.message);

    return res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "No fue posible crear el evento."
    });
  }
}

async function cancelEvent(req, res) {
  try {
    const event = await cancelAdminEvent(req.params.id);

    return res.status(200).json({
      status: "ok",
      event
    });
  } catch (error) {
    if (sendKnownError(res, error)) return;

    console.error("No fue posible cancelar el evento:", error.message);

    return res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "No fue posible cancelar el evento."
    });
  }
}

async function deleteEvent(req, res) {
  try {
    const deletedId = await removeAdminEvent(req.params.id);

    return res.status(200).json({
      status: "ok",
      deletedId
    });
  } catch (error) {
    if (sendKnownError(res, error)) return;

    console.error("No fue posible eliminar el evento:", error.message);

    return res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "No fue posible eliminar el evento."
    });
  }
}

module.exports = {
  cancelEvent,
  createEvent,
  deleteEvent,
  listEvents
};
