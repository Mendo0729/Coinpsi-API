const {
  listDriveFolder
} = require("../services/google-drive-gallery.service");
const {
  getOptimizedDriveImage
} = require("../services/image-optimization.service");

async function getFolderContents(req, res) {
  try {
    const result = await listDriveFolder(
      req.params.folderId || null,
      req.query.pageToken || null
    );
    return res.status(200).json({ status: "ok", ...result });
  } catch (error) {
    console.error("No fue posible consultar la carpeta de Google Drive:", error.message);
    const status = error.code === "GOOGLE_DRIVE_NOT_CONNECTED" ? 409 : 400;
    return res.status(status).json({
      error: error.code || "GOOGLE_DRIVE_FOLDER_ERROR",
      message: error.message || "No fue posible consultar la carpeta."
    });
  }
}

async function streamAdminDriveImage(req, res) {
  try {
    const image = await getOptimizedDriveImage(req.params.fileId, "thumbnail");
    const etag = `"${image.cacheKey}-${image.variant}"`;

    if (req.headers["if-none-match"] === etag) {
      return res.status(304).end();
    }

    res.set("Content-Type", image.mimeType);
    res.set("Content-Length", String(image.buffer.length));
    res.set("Cache-Control", "private, max-age=86400");
    res.set("ETag", etag);
    res.set("X-Coinpsi-Image-Variant", image.variant);
    res.set("X-Coinpsi-Image-Cache", image.cacheStatus);

    return res.status(200).send(image.buffer);
  } catch (error) {
    console.error("No fue posible cargar la vista previa de Google Drive:", error.message);
    return res.status(400).json({
      error: error.code || "GOOGLE_DRIVE_IMAGE_ERROR",
      message: error.message || "No fue posible cargar la imagen."
    });
  }
}

module.exports = {
  getFolderContents,
  streamAdminDriveImage
};
