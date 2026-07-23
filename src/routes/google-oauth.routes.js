const express = require("express");

const { handleOAuthCallback } = require("../controllers/google-drive.controller");

const router = express.Router();

router.get("/oauth/callback", handleOAuthCallback);

module.exports = router;
