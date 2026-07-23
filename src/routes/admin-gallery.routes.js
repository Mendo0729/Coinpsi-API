const express = require("express");

const {
  listGallerySelection,
  saveGallerySelection
} = require("../controllers/admin-gallery.controller");
const requireAuth = require("../middleware/require-auth");

const router = express.Router();

router.use(requireAuth);
router.get("/", listGallerySelection);
router.post("/selection", saveGallerySelection);

module.exports = router;
