const fs = require("fs");
const path = require("path");

const {
  getDriveImageMetadata
} = require("./google-drive-gallery.service");

const MAX_GALLERY_ITEMS = 60;
const FILE_ID_PATTERN = /^[A-Za-z0-9_-]{10,200}$/;

function getSelectionPath() {
  return path.resolve(
    process.cwd(),
    process.env.GALLERY_SELECTION_PATH || ".gallery-selection.json"
  );
}

function createValidationError(message, details = {}) {
  const error = new Error(message);
  error.code = "VALIDATION_ERROR";
  error.details = details;
  return error;
}

function normalizeText(value, fallback = "", maxLength = 180) {
  const normalized = String(value ?? fallback).trim();
  return normalized.slice(0, maxLength);
}

function readSelectionFile() {
  const selectionPath = getSelectionPath();
  if (!fs.existsSync(selectionPath)) {
    return {
      version: 1,
      updatedAt: null,
      items: []
    };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(selectionPath, "utf8"));
    return {
      version: 1,
      updatedAt: parsed.updatedAt || null,
      items: Array.isArray(parsed.items) ? parsed.items : []
    };
  } catch {
    const error = new Error("El archivo local de seleccion de galeria no es valido.");
    error.code = "GALLERY_SELECTION_INVALID";
    throw error;
  }
}

function writeSelectionFile(selection) {
  const selectionPath = getSelectionPath();
  const tempPath = `${selectionPath}.tmp`;
  const directory = path.dirname(selectionPath);

  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(tempPath, JSON.stringify(selection, null, 2), {
    encoding: "utf8",
    mode: 0o600
  });
  fs.renameSync(tempPath, selectionPath);
}

function getAdminGallerySelection() {
  return readSelectionFile();
}

function getPublicGalleryItems() {
  const selection = readSelectionFile();

  return selection.items
    .filter((item) => item.published !== false)
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
    .map((item) => ({
      id: item.fileId,
      title: item.title,
      description: item.description,
      category: item.category,
      isFeatured: Boolean(item.isFeatured),
      imagePath: `/api/v1/gallery/images/${encodeURIComponent(item.fileId)}`
    }));
}

function getPublicGalleryItem(fileId) {
  const normalizedId = String(fileId || "").trim();
  return readSelectionFile().items.find(
    (item) => item.fileId === normalizedId && item.published !== false
  ) || null;
}

async function replaceGallerySelection(inputItems) {
  if (!Array.isArray(inputItems)) {
    throw createValidationError("items debe ser una lista.", { field: "items" });
  }

  if (inputItems.length > MAX_GALLERY_ITEMS) {
    throw createValidationError(
      `La galeria de prueba permite un maximo de ${MAX_GALLERY_ITEMS} imagenes.`,
      { field: "items" }
    );
  }

  const uniqueIds = new Set();
  const normalizedItems = [];

  for (let index = 0; index < inputItems.length; index += 1) {
    const input = inputItems[index] || {};
    const fileId = String(input.fileId || "").trim();

    if (!FILE_ID_PATTERN.test(fileId)) {
      throw createValidationError("Uno de los identificadores de Google Drive no es valido.", {
        field: `items[${index}].fileId`
      });
    }

    if (uniqueIds.has(fileId)) continue;
    uniqueIds.add(fileId);

    const metadata = await getDriveImageMetadata(fileId);
    const baseTitle = String(metadata.name || "Imagen COINPSI")
      .replace(/\.[a-z0-9]{2,8}$/i, "")
      .replace(/[_-]+/g, " ")
      .trim();

    normalizedItems.push({
      fileId,
      name: metadata.name,
      mimeType: metadata.mimeType,
      size: metadata.size || null,
      folderId: normalizeText(input.folderId, "", 200) || null,
      folderName: normalizeText(input.folderName, "", 180) || null,
      title: normalizeText(input.title, baseTitle || "Imagen COINPSI", 180),
      description: normalizeText(input.description, "Actividad realizada por COINPSI.", 500),
      category: normalizeText(input.category, input.folderName || "Galeria", 80) || "Galeria",
      isFeatured: Boolean(input.isFeatured),
      published: true,
      sortOrder: normalizedItems.length,
      selectedAt: new Date().toISOString()
    });
  }

  const selection = {
    version: 1,
    updatedAt: new Date().toISOString(),
    items: normalizedItems
  };

  writeSelectionFile(selection);
  return selection;
}

module.exports = {
  getAdminGallerySelection,
  getPublicGalleryItem,
  getPublicGalleryItems,
  replaceGallerySelection
};
