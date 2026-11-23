const express = require("express");

const { login, me } = require("../controllers/auth.controller");
const requireAuth = require("../middleware/require-auth");
const { loginLimiter } = require("../middleware/rate-limit");

const router = express.Router();

router.post("/login", loginLimiter, login);
router.get("/me", requireAuth, me);

module.exports = router;
