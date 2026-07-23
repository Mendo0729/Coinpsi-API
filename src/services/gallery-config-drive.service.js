const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");

const { getEnv } = require("../config/env");
const {
  FOLDER_MIME_TYPE,
  createDriveClient
} = require("./google-drive-gallery.service");

const CONFIG_MIME_TYPE = "application/json";
const DEFAULT_CONFIG_FOLDER_NAME = "COINPSI-CONFIG";
const DEFAULT_CONFIG_FILE_NAME = "gallery-config.json";
const DEFAULT_CACHE_TTL_MS = 30 * 1000;

let memoryCache = null;
let writeQueue = Promise.resolve();

function createConfigError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function escapeDriveQuery(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function getConfigFolderName() {
  return String(
    process.env.GOOGLE_DRIVE_CONFIG_FOLDER_NAME || DEFAULT_CONFIG_FOLDER_NAME
  ).trim() || DEFAULT_CONFIG_FOLDER_NAME;
}

function getConfigFileName() {
  return String(
    process.env.GOOGLE_DRIVE_CONFIG_FILE_NAME || DEFAULT_CONFIG_FILE_NAME
  ).trim() || DEFAULT_CONFIG_FILE_NAME;
}

function getCacheTtlMs() {
  const parsed = Number.parseInt(process.env.GALLERY_CONFIG_CACHE_TTL_MS || "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_CACHE_TTL_MS;
}

function getLegacySelectionPath() {
  return path.resolve(
    process.cwd(),
    process.env.GALLERY_SELECTION_PATH || ".gallery-selection.json"
  );
}

function getDefaultConfig() {
  return {
    version: 4,
    settings: {
      mode: "manual"
    },
    updatedAt: null,
    items: []
  };
}

function normalizeStoredConfig(value) {
  const parsed = value && typeof value === "object" ? value : {};

  return {
    version: 4,
    settings: {
      mode: "manual"
    },
    updatedAt: parsed.updatedAt || null,
    items: Array.isArray(parsed.items) ? parsed.items : []
  };
}

function readLegacySelection() {
  const legacyPath = getLegacySelectionPath();
  if (!fs.existsSync(legacyPath)) return null;

  try {
    const parsed = JSON.parse(fs.readFileSync(legacyPath, "utf8"));
    return normalizeStoredConfig(parsed);
  } catch {
    throw createConfigError(
      "GALLERY_LEGACY_CONFIG_INVALID",
      "La seleccion local anterior de la galeria no es valida."
    );
  }
}

async function findConfigFolder(drive, rootFolderId) {
  const response = await drive.files.list({
    q: [
      `'${escapeDriveQuery(rootFolderId)}' in parents`,
      `name = '${escapeDriveQuery(getConfigFolderName())}'`,
      `mimeType = '${FOLDER_MIME_TYPE}'`,
      "trashed = false"
    ].join(" and "),
    spaces: "drive",
    pageSize: 1,
    fields: "files(id,name,mimeType,modifiedTime,webViewLink)"
  });

  return response.data.files?.[0] || null;
}

async function findOrCreateConfigFolder(drive) {
  const rootFolderId = getEnv("GOOGLE_DRIVE_ROOT_FOLDER_ID");
  const existing = await findConfigFolder(drive, rootFolderId);
  if (existing) return { ...existing, created: false };

  const response = await drive.files.create({
    requestBody: {
      name: getConfigFolderName(),
      mimeType: FOLDER_MIME_TYPE,
      parents: [rootFolderId],
      description: "Configuracion privada de la galeria web de COINPSI."
    },
    fields: "id,name,mimeType,modifiedTime,webViewLink"
  });

  return { ...response.data, created: true };
}

async function findConfigFile(drive, folderId) {
  const response = await drive.files.list({
    q: [
      `'${escapeDriveQuery(folderId)}' in parents`,
      `name = '${escapeDriveQuery(getConfigFileName())}'`,
      "trashed = false"
    ].join(" and "),
    spaces: "drive",
    pageSize: 1,
    fields: "files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink)"
  });

  return response.data.files?.[0] || null;
}

async function downloadConfigFile(drive, file) {
  const response = await drive.files.get(
    {
      fileId: file.id,
      alt: "media"
    },
    {
      responseType: "arraybuffer"
    }
  );

  try {
    return normalizeStoredConfig(
      JSON.parse(Buffer.from(response.data).toString("utf8"))
    );
  } catch {
    throw createConfigError(
      "GALLERY_DRIVE_CONFIG_INVALID",
      "El archivo gallery-config.json de Google Drive no contiene JSON valido."
    );
  }
}

function buildCacheEntry(config, folder, file) {
  return {
    expiresAt: Date.now() + getCacheTtlMs(),
    config,
    storage: {
      provider: "google-drive",
      folderId: folder.id,
      folderName: folder.name,
      fileId: file.id,
      fileName: file.name,
      modifiedTime: file.modifiedTime || null,
      webViewLink: file.webViewLink || null
    }
  };
}

async function performWrite(config) {
  const drive = createDriveClient();
  const folder = await findOrCreateConfigFolder(drive);
  const existingFile = await findConfigFile(drive, folder.id);
  const normalizedConfig = normalizeStoredConfig(config);
  const content = Buffer.from(JSON.stringify(normalizedConfig, null, 2), "utf8");

  let file;
  if (existingFile) {
    const response = await drive.files.update({
      fileId: existingFile.id,
      requestBody: {
        name: getConfigFileName(),
        mimeType: CONFIG_MIME_TYPE,
        description: "Configuracion privada de la galeria web de COINPSI.",
        appProperties: {
          coinpsiResource: "gallery-config",
          coinpsiVersion: "4"
        }
      },
      media: {
        mimeType: CONFIG_MIME_TYPE,
        body: Readable.from(content)
      },
      fields: "id,name,mimeType,size,createdTime,modifiedTime,webViewLink"
    });
    file = response.data;
  } else {
    const response = await drive.files.create({
      requestBody: {
        name: getConfigFileName(),
        mimeType: CONFIG_MIME_TYPE,
        parents: [folder.id],
        description: "Configuracion privada de la galeria web de COINPSI.",
        appProperties: {
          coinpsiResource: "gallery-config",
          coinpsiVersion: "4"
        }
      },
      media: {
        mimeType: CONFIG_MIME_TYPE,
        body: Readable.from(content)
      },
      fields: "id,name,mimeType,size,createdTime,modifiedTime,webViewLink"
    });
    file = response.data;
  }

  memoryCache = buildCacheEntry(normalizedConfig, folder, file);
  return memoryCache;
}

function writeGalleryConfig(config) {
  const operation = writeQueue.then(() => performWrite(config));
  writeQueue = operation.catch(() => undefined);
  return operation;
}

async function readGalleryConfig({ force = false } = {}) {
  if (!force && memoryCache && memoryCache.expiresAt > Date.now()) {
    return memoryCache;
  }

  const drive = createDriveClient();
  const folder = await findOrCreateConfigFolder(drive);
  const file = await findConfigFile(drive, folder.id);

  if (file) {
    const config = await downloadConfigFile(drive, file);
    memoryCache = buildCacheEntry(config, folder, file);
    return memoryCache;
  }

  const migrated = readLegacySelection() || getDefaultConfig();
  migrated.updatedAt = migrated.updatedAt || new Date().toISOString();
  return writeGalleryConfig(migrated);
}

function clearGalleryConfigCache() {
  memoryCache = null;
}

module.exports = {
  clearGalleryConfigCache,
  getDefaultConfig,
  readGalleryConfig,
  writeGalleryConfig
};
