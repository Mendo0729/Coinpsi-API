const {
  getDriveImageContent,
  listDriveFolder
} = require("../services/google-drive-gallery.service");

async function getFolderContents(req, res) {
  try {
    const result = await listDriveFolder(req.params.folderId || null);
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
    const image = await getDriveImageContent(req.params.fileId);
    res.set("Content-Type", image.metadata.mimeType);
    res.set("Cache-Control", "private, no-store");
    if (image.metadata.size) res.set("Content-Length", String(image.metadata.size));

    image.stream.on("error", (error) => {
      console.error("Google Drive interrumpio la vista previa:", error.message);
      if (!res.headersSent) res.status(502).end();
      else res.destroy(error);
    });

    return image.stream.pipe(res);
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
