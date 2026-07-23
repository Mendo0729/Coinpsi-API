const {
  getDriveImageMetadata
} = require("./google-drive-gallery.service");
const {
  readGalleryConfig,
  writeGalleryConfig
} = require("./gallery-config-drive.service");

const MAX_GALLERY_ITEMS = 60;
const FILE_ID_PATTERN = /^[A-Za-z0-9_-]{10,200}$/;
const MANUAL_SETTINGS = Object.freeze({ mode: "manual" });

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

function sortByConfiguredOrder(items) {
  return [...items].sort(
    (a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)
  );
}

function mapPublicItem(item) {
  return {
    id: item.fileId,
    title: item.title,
    description: item.description,
    category: item.category,
    isFeatured: Boolean(item.isFeatured),
    imagePath: `/api/v1/gallery/images/${encodeURIComponent(item.fileId)}`
  };
}

async function getAdminGallerySelection() {
  const record = await readGalleryConfig();
  return {
    ...record.config,
    version: 4,
    settings: MANUAL_SETTINGS,
    storage: record.storage
  };
}

async function getPublicGalleryItems() {
  const record = await readGalleryConfig();
  const published = sortByConfiguredOrder(
    record.config.items.filter((item) => item.published !== false)
  );

  return {
    items: published.map(mapPublicItem),
    settings: MANUAL_SETTINGS,
    sourceCount: published.length
  };
}

async function getPublicGalleryItem(fileId) {
  const normalizedId = String(fileId || "").trim();
  const record = await readGalleryConfig();

  return record.config.items.find(
    (item) => item.fileId === normalizedId && item.published !== false
  ) || null;
}

async function replaceGallerySelection(inputItems) {
  if (!Array.isArray(inputItems)) {
    throw createValidationError("items debe ser una lista.", { field: "items" });
  }

  if (inputItems.length > MAX_GALLERY_ITEMS) {
    throw createValidationError(
      `La galeria permite un maximo de ${MAX_GALLERY_ITEMS} imagenes habilitadas.`,
      { field: "items" }
    );
  }

  const currentRecord = await readGalleryConfig();
  const currentItems = new Map(
    currentRecord.config.items.map((item) => [item.fileId, item])
  );
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

    const currentItem = currentItems.get(fileId) || null;
    const metadata = currentItem?.mimeType
      ? {
          name: currentItem.name,
          mimeType: currentItem.mimeType,
          size: currentItem.size
        }
      : await getDriveImageMetadata(fileId);
    const baseTitle = String(metadata.name || "Imagen COINPSI")
      .replace(/\.[a-z0-9]{2,8}$/i, "")
      .replace(/[_-]+/g, " ")
      .trim();

    normalizedItems.push({
      fileId,
      name: metadata.name,
      mimeType: metadata.mimeType,
      size: metadata.size || null,
      folderId: normalizeText(
        input.folderId,
        currentItem?.folderId || "",
        200
      ) || null,
      folderName: normalizeText(
        input.folderName,
        currentItem?.folderName || "",
        180
      ) || null,
      title: normalizeText(
        input.title,
        currentItem?.title || baseTitle || "Imagen COINPSI",
        180
      ),
      description: normalizeText(
        input.description,
        currentItem?.description || "Actividad realizada por COINPSI.",
        500
      ),
      category: normalizeText(
        input.category,
        currentItem?.category || input.folderName || "Galeria",
        80
      ) || "Galeria",
      isFeatured: Boolean(input.isFeatured),
      published: true,
      sortOrder: normalizedItems.length,
      selectedAt: input.selectedAt || currentItem?.selectedAt || new Date().toISOString()
    });
  }

  const config = {
    version: 4,
    settings: MANUAL_SETTINGS,
    updatedAt: new Date().toISOString(),
    items: normalizedItems
  };
  const record = await writeGalleryConfig(config);

  return {
    ...record.config,
    settings: MANUAL_SETTINGS,
    storage: record.storage
  };
}

module.exports = {
  getAdminGallerySelection,
  getPublicGalleryItem,
  getPublicGalleryItems,
  replaceGallerySelection
};
