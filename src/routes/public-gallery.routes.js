const express = require("express");

const {
  listPublicGallery,
  streamPublicGalleryImage
} = require("../controllers/public-gallery.controller");

const router = express.Router();

router.get("/", listPublicGallery);
router.get("/images/:fileId", streamPublicGalleryImage);

module.exports = router;
