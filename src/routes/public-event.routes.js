const express = require("express");

const {
  listPublishedEvents
} = require("../controllers/public-event.controller");

const router = express.Router();

router.get("/", listPublishedEvents);

module.exports = router;
