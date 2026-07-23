const {
  getPublicGalleryItem,
  getPublicGalleryItems
} = require("../services/gallery-selection.service");
const {
  getDriveImageContent
} = require("../services/google-drive-gallery.service");

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
    const image = await getDriveImageContent(selectedItem.fileId);
    res.set("Content-Type", image.metadata.mimeType);
    res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
    if (image.metadata.size) res.set("Content-Length", String(image.metadata.size));

    image.stream.on("error", (error) => {
      console.error("Google Drive interrumpio la imagen publica:", error.message);
      if (!res.headersSent) res.status(502).end();
      else res.destroy(error);
    });

    return image.stream.pipe(res);
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
