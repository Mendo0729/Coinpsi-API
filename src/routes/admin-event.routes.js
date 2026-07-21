const express = require("express");

const {
  cancelEvent,
  createEvent,
  deleteEvent,
  listEvents
} = require("../controllers/admin-event.controller");
const requireAuth = require("../middleware/require-auth");

const router = express.Router();

router.use(requireAuth);
router.get("/", listEvents);
router.post("/", createEvent);
router.patch("/:id/cancel", cancelEvent);
router.delete("/:id", deleteEvent);

module.exports = router;
