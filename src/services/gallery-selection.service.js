const {
  getDriveImageMetadata
} = require("./google-drive-gallery.service");
const {
  getDefaultConfig,
  readGalleryConfig,
  writeGalleryConfig
} = require("./gallery-config-drive.service");

const MAX_GALLERY_ITEMS = 60;
const FILE_ID_PATTERN = /^[A-Za-z0-9_-]{10,200}$/;
const ALLOWED_MODES = new Set(["manual", "random", "mixed"]);
const ALLOWED_ROTATIONS = new Set(["visit", "daily", "weekly"]);

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

function normalizeSettings(inputSettings = {}) {
  const defaults = getDefaultConfig().settings;
  const input = inputSettings && typeof inputSettings === "object"
    ? inputSettings
    : {};
  const mode = ALLOWED_MODES.has(input.mode) ? input.mode : defaults.mode;
  const rotation = ALLOWED_ROTATIONS.has(input.rotation)
    ? input.rotation
    : defaults.rotation;
  const rawDisplayCount = input.displayCount ?? input.randomCount;
  const parsedDisplayCount = Number.parseInt(rawDisplayCount, 10);
  const displayCount = Number.isFinite(parsedDisplayCount)
    ? Math.min(MAX_GALLERY_ITEMS, Math.max(1, parsedDisplayCount))
    : defaults.displayCount;

  return {
    mode,
    rotation,
    displayCount,
    timezone: normalizeText(
      input.timezone,
      defaults.timezone || "America/Panama",
      100
    ) || "America/Panama"
  };
}

function validateSettingsAgainstItems(settings, items) {
  if (settings.mode !== "mixed") return;

  const fixedCount = items.filter((item) => item.isFeatured).length;
  if (fixedCount > settings.displayCount) {
    throw createValidationError(
      `La cantidad total debe ser igual o mayor que las ${fixedCount} imagenes fijas del modo mixto.`,
      {
        field: "settings.displayCount",
        fixedCount,
        displayCount: settings.displayCount
      }
    );
  }
}

function sortByConfiguredOrder(items) {
  return [...items].sort(
    (a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)
  );
}

function getZonedDateParts(timezone) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date());

    return Object.fromEntries(
      parts
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value])
    );
  } catch {
    return getZonedDateParts("America/Panama");
  }
}

function getRotationKey(settings) {
  if (settings.rotation === "visit") {
    return `visit-${Date.now()}-${Math.random()}`;
  }

  const parts = getZonedDateParts(settings.timezone);
  const dailyKey = `${parts.year}-${parts.month}-${parts.day}`;
  if (settings.rotation === "daily") return dailyKey;

  const date = new Date(Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day)
  ));
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);

  return `week-${date.toISOString().slice(0, 10)}`;
}

function hashString(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed) {
  let state = seed >>> 0;
  return function seededRandom() {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleItems(items, seedValue) {
  const shuffled = [...items];
  const random = createSeededRandom(hashString(seedValue));

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function selectPublicItems(config) {
  const settings = normalizeSettings(config.settings);
  const published = sortByConfiguredOrder(
    config.items.filter((item) => item.published !== false)
  );
  const rotationKey = getRotationKey(settings);
  const seed = [
    rotationKey,
    config.updatedAt || "initial",
    settings.mode,
    settings.displayCount
  ].join("|");

  if (settings.mode === "manual") {
    return {
      items: published,
      settings,
      rotationKey,
      fixedCount: published.length,
      randomFillCount: 0
    };
  }

  if (settings.mode === "random") {
    const items = shuffleItems(published, seed).slice(0, settings.displayCount);
    return {
      items,
      settings,
      rotationKey,
      fixedCount: 0,
      randomFillCount: items.length
    };
  }

  const fixed = published.filter((item) => item.isFeatured);
  const candidates = published.filter((item) => !item.isFeatured);
  const fixedItems = fixed.slice(0, settings.displayCount);
  const remainingSlots = Math.max(0, settings.displayCount - fixedItems.length);
  const randomItems = shuffleItems(candidates, seed).slice(0, remainingSlots);

  return {
    items: [...fixedItems, ...randomItems],
    settings,
    rotationKey,
    fixedCount: fixedItems.length,
    randomFillCount: randomItems.length
  };
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
    settings: normalizeSettings(record.config.settings),
    storage: record.storage
  };
}

async function getPublicGalleryItems() {
  const record = await readGalleryConfig();
  const selected = selectPublicItems(record.config);

  return {
    items: selected.items.map(mapPublicItem),
    settings: selected.settings,
    rotationKey: selected.rotationKey,
    sourceCount: record.config.items.filter((item) => item.published !== false).length,
    fixedCount: selected.fixedCount,
    randomFillCount: selected.randomFillCount
  };
}

async function getPublicGalleryItem(fileId) {
  const normalizedId = String(fileId || "").trim();
  const record = await readGalleryConfig();

  return record.config.items.find(
    (item) => item.fileId === normalizedId && item.published !== false
  ) || null;
}

async function replaceGallerySelection(inputItems, inputSettings = null) {
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
  const hasExplicitSettings = inputSettings
    && typeof inputSettings === "object"
    && Object.keys(inputSettings).length > 0;
  const settings = normalizeSettings(
    hasExplicitSettings ? inputSettings : currentRecord.config.settings
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

  validateSettingsAgainstItems(settings, normalizedItems);

  const config = {
    version: 3,
    settings,
    updatedAt: new Date().toISOString(),
    items: normalizedItems
  };
  const record = await writeGalleryConfig(config);

  return {
    ...record.config,
    storage: record.storage
  };
}

module.exports = {
  getAdminGallerySelection,
  getPublicGalleryItem,
  getPublicGalleryItems,
  replaceGallerySelection
};
