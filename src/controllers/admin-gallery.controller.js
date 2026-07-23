const {
  getAdminGallerySelection,
  replaceGallerySelection
} = require("../services/gallery-selection.service");

function listGallerySelection(req, res) {
  try {
    const selection = getAdminGallerySelection();
    return res.status(200).json({ status: "ok", selection });
  } catch (error) {
    console.error("No fue posible consultar la seleccion de galeria:", error.message);
    return res.status(500).json({
      error: "GALLERY_SELECTION_ERROR",
      message: "No fue posible consultar la seleccion de galeria."
    });
  }
}

async function saveGallerySelection(req, res) {
  try {
    const selection = await replaceGallerySelection(req.body?.items);
    return res.status(200).json({ status: "ok", selection });
  } catch (error) {
    if (error.code === "VALIDATION_ERROR") {
      return res.status(400).json({
        error: error.code,
        message: error.message,
        details: error.details
      });
    }

    console.error("No fue posible guardar la seleccion de galeria:", error.message);
    return res.status(400).json({
      error: error.code || "GALLERY_SELECTION_ERROR",
      message: error.message || "No fue posible guardar la seleccion de galeria."
    });
  }
}

module.exports = {
  listGallerySelection,
  saveGallerySelection
};
