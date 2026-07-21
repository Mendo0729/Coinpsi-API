const { getPublishedEvents } = require("../services/event.service");

async function listPublishedEvents(req, res) {
  try {
    const events = await getPublishedEvents();

    return res.status(200).json({
      status: "ok",
      count: events.length,
      events
    });
  } catch (error) {
    console.error("No fue posible consultar los eventos publicados:", error.message);

    return res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "No fue posible consultar los eventos publicados."
    });
  }
}

module.exports = {
  listPublishedEvents
};
