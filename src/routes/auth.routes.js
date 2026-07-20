const express = require("express");

const { login, me } = require("../controllers/auth.controller");
const requireAuth = require("../middleware/require-auth");

const router = express.Router();

router.post("/login", login);
router.get("/me", requireAuth, me);

module.exports = router;
