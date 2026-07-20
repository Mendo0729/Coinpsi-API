const express = require("express");

const {
  createEvent,
  listEvents
} = require("../controllers/admin-event.controller");
const requireAuth = require("../middleware/require-auth");

const router = express.Router();

router.use(requireAuth);
router.get("/", listEvents);
router.post("/", createEvent);

module.exports = router;
