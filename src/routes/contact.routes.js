const express = require("express");
const { contactLimiter } = require("../middleware/rate-limit");
const { submitContact } = require("../controllers/contact.controller");

const router = express.Router();
router.post("/", contactLimiter, submitContact);

module.exports = router;
