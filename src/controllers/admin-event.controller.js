const {
  createAdminEvent,
  getAdminEvents
} = require("../services/event.service");

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
    if (error.code === "VALIDATION_ERROR") {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: error.message,
        details: error.details
      });
    }

    console.error("No fue posible crear el evento:", error.message);

    return res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "No fue posible crear el evento."
    });
  }
}

module.exports = {
  createEvent,
  listEvents
};
