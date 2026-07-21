const express = require("express");

const {
  cancelEvent,
  createEvent,
  deleteEvent,
  listEvents,
  updateEvent
} = require("../controllers/admin-event.controller");
const requireAuth = require("../middleware/require-auth");

const router = express.Router();

router.use(requireAuth);
router.get("/", listEvents);
router.post("/", createEvent);
router.patch("/:id/cancel", cancelEvent);
router.patch("/:id", updateEvent);
router.delete("/:id", deleteEvent);

module.exports = router;
