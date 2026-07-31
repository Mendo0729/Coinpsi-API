const express = require("express");

const {
  listPublishedPosts
} = require("../controllers/public-knowledge.controller");

const router = express.Router();

router.get("/posts", listPublishedPosts);

module.exports = router;
