const express = require("express");

const {
  createPost,
  deletePost,
  listCategories,
  listPosts,
  saveLandingSelection,
  updatePost
} = require("../controllers/admin-knowledge.controller");
const requireAuth = require("../middleware/require-auth");

const router = express.Router();

router.use(requireAuth);
router.get("/categories", listCategories);
router.get("/posts", listPosts);
router.post("/posts", createPost);
router.post("/selection", saveLandingSelection);
router.patch("/posts/:id", updatePost);
router.delete("/posts/:id", deletePost);

module.exports = router;
