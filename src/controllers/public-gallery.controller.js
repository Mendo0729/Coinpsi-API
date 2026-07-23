const {
  getPublicGalleryItem,
  getPublicGalleryItems
} = require("../services/gallery-selection.service");
const {
  getOptimizedDriveImage
} = require("../services/image-optimization.service");

function listPublicGallery(req, res) {
  try {
    const items = getPublicGalleryItems();
    return res.status(200).json({
      status: "ok",
      count: items.length,
      items
    });
  } catch (error) {
    console.error("No fue posible consultar la galeria publica:", error.message);
    return res.status(500).json({
      error: "PUBLIC_GALLERY_ERROR",
      message: "No fue posible consultar la galeria publica."
    });
  }
}

async function streamPublicGalleryImage(req, res) {
  const selectedItem = getPublicGalleryItem(req.params.fileId);
  if (!selectedItem) {
    return res.status(404).json({
      error: "GALLERY_IMAGE_NOT_FOUND",
      message: "La imagen solicitada no esta publicada."
    });
  }

  try {
    const image = await getOptimizedDriveImage(selectedItem.fileId, "medium");
    const etag = `"${image.cacheKey}-${image.variant}"`;

    if (req.headers["if-none-match"] === etag) {
      return res.status(304).end();
    }

    res.set("Content-Type", image.mimeType);
    res.set("Content-Length", String(image.buffer.length));
    res.set("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
    res.set("ETag", etag);
    res.set("X-Coinpsi-Image-Variant", image.variant);
    res.set("X-Coinpsi-Image-Cache", image.cacheStatus);

    return res.status(200).send(image.buffer);
  } catch (error) {
    console.error("No fue posible entregar la imagen publica:", error.message);
    return res.status(502).json({
      error: error.code || "GALLERY_IMAGE_ERROR",
      message: "No fue posible cargar la imagen."
    });
  }
}

module.exports = {
  listPublicGallery,
  streamPublicGalleryImage
};
