const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

const { getEnv } = require("../config/env");

const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const FILE_ID_PATTERN = /^[A-Za-z0-9_-]{10,200}$/;
const IMAGE_PAGE_SIZE = 20;
const MAX_FOLDERS = 200;

function createDriveError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizeFileId(value, fallback = null) {
  const fileId = String(value || fallback || "").trim();
  if (!FILE_ID_PATTERN.test(fileId)) {
    throw createDriveError("GOOGLE_DRIVE_FILE_ID_INVALID", "El identificador de Google Drive no es valido.");
  }
  return fileId;
}

function normalizePageToken(value) {
  const pageToken = String(value || "").trim();
  if (!pageToken) return undefined;

  if (pageToken.length > 2000) {
    throw createDriveError("GOOGLE_DRIVE_PAGE_TOKEN_INVALID", "El token de paginacion no es valido.");
  }

  return pageToken;
}

function readCredentials() {
  const tokenPath = path.resolve(
    process.cwd(),
    process.env.GOOGLE_DRIVE_TOKEN_PATH || ".google-drive-token.json"
  );

  let localTokens = {};
  if (fs.existsSync(tokenPath)) {
    try {
      localTokens = JSON.parse(fs.readFileSync(tokenPath, "utf8"));
    } catch {
      throw createDriveError(
        "GOOGLE_DRIVE_TOKEN_INVALID",
        "El archivo local de tokens de Google Drive no es valido."
      );
    }
  }

  const refreshToken = String(process.env.GOOGLE_REFRESH_TOKEN || "").trim();
  const tokens = {
    ...localTokens,
    ...(refreshToken ? { refresh_token: refreshToken } : {})
  };

  if (!tokens.refresh_token && !tokens.access_token) {
    throw createDriveError("GOOGLE_DRIVE_NOT_CONNECTED", "Google Drive aun no esta conectado.");
  }

  return tokens;
}

function createOAuthClient() {
  const oauthClient = new google.auth.OAuth2(
    getEnv("GOOGLE_CLIENT_ID"),
    getEnv("GOOGLE_CLIENT_SECRET"),
    getEnv("GOOGLE_REDIRECT_URI")
  );
  oauthClient.setCredentials(readCredentials());
  return oauthClient;
}

function createDriveClient() {
  return google.drive({ version: "v3", auth: createOAuthClient() });
}

function escapeQuery(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function mapFolderItem(item) {
  return {
    ...item,
    isFolder: true,
    isImage: false
  };
}

function mapImageItem(item) {
  return {
    ...item,
    isFolder: false,
    isImage: true
  };
}

async function listChildFolders(drive, folderId) {
  const folders = [];
  let pageToken;

  do {
    const response = await drive.files.list({
      q: [
        `'${escapeQuery(folderId)}' in parents`,
        `mimeType = '${FOLDER_MIME_TYPE}'`,
        "trashed = false"
      ].join(" and "),
      spaces: "drive",
      orderBy: "name_natural",
      pageSize: 100,
      pageToken,
      fields: "nextPageToken,files(id,name,mimeType,createdTime,modifiedTime,parents,webViewLink)"
    });

    folders.push(...(response.data.files || []));
    pageToken = response.data.nextPageToken;
  } while (pageToken && folders.length < MAX_FOLDERS);

  return folders.slice(0, MAX_FOLDERS).map(mapFolderItem);
}

async function listChildImages(drive, folderId, pageToken) {
  const response = await drive.files.list({
    q: [
      `'${escapeQuery(folderId)}' in parents`,
      "mimeType contains 'image/'",
      "trashed = false"
    ].join(" and "),
    spaces: "drive",
    orderBy: "name_natural",
    pageSize: IMAGE_PAGE_SIZE,
    pageToken: normalizePageToken(pageToken),
    fields:
      "nextPageToken,files(id,name,mimeType,size,createdTime,modifiedTime,parents,webViewLink,thumbnailLink,imageMediaMetadata(width,height))"
  });

  return {
    images: (response.data.files || []).map(mapImageItem),
    nextPageToken: response.data.nextPageToken || null
  };
}

// Prevent a broad Drive OAuth grant from granting access to arbitrary folders.
async function assertFileWithinRoot(drive, fileId, initialParents) {
  const rootId = normalizeFileId(getEnv("GOOGLE_DRIVE_ROOT_FOLDER_ID"));
  let currentId = normalizeFileId(fileId);
  let parents = initialParents;
  const visited = new Set();

  if (currentId === rootId) return;

  // Google Drive files have a single parent. Limit traversal to avoid cycles
  // and excessive API requests if unexpected metadata is returned.
  for (let depth = 0; depth < 32; depth += 1) {
    if (visited.has(currentId)) break;
    visited.add(currentId);

    if (!Array.isArray(parents)) {
      const response = await drive.files.get({
        fileId: currentId,
        fields: "id,parents,trashed"
      });
      if (response.data.trashed) break;
      parents = response.data.parents;
    }

    if (!Array.isArray(parents) || parents.length === 0) break;
    const parentId = parents[0];
    if (parentId === rootId) return;
    if (!FILE_ID_PATTERN.test(parentId)) break;

    currentId = parentId;
    parents = undefined;
  }

  throw createDriveError(
    "GOOGLE_DRIVE_OUTSIDE_ROOT",
    "El archivo o carpeta no pertenece al espacio autorizado de COINPSI."
  );
}

async function listDriveFolder(folderId = null, pageToken = null) {
  const normalizedFolderId = normalizeFileId(
    folderId,
    getEnv("GOOGLE_DRIVE_ROOT_FOLDER_ID")
  );
  const drive = createDriveClient();
  await assertFileWithinRoot(drive, normalizedFolderId);

  const folderResponse = await drive.files.get({
    fileId: normalizedFolderId,
    fields: "id,name,mimeType,parents,webViewLink,modifiedTime"
  });

  if (folderResponse.data.mimeType !== FOLDER_MIME_TYPE) {
    throw createDriveError("GOOGLE_DRIVE_NOT_FOLDER", "El elemento solicitado no es una carpeta.");
  }

  const [folders, imagePage] = await Promise.all([
    listChildFolders(drive, normalizedFolderId),
    listChildImages(drive, normalizedFolderId, pageToken)
  ]);

  return {
    folder: folderResponse.data,
    items: [...folders, ...imagePage.images],
    folders,
    images: imagePage.images,
    pagination: {
      pageSize: IMAGE_PAGE_SIZE,
      nextPageToken: imagePage.nextPageToken
    }
  };
}

async function getDriveImageMetadata(fileId) {
  const normalizedFileId = normalizeFileId(fileId);
  const drive = createDriveClient();
  const response = await drive.files.get({
    fileId: normalizedFileId,
    fields: "id,name,mimeType,size,createdTime,modifiedTime,parents,trashed,thumbnailLink,md5Checksum,imageMediaMetadata(width,height)"
  });

  if (response.data.trashed || !String(response.data.mimeType || "").startsWith("image/")) {
    throw createDriveError("GOOGLE_DRIVE_IMAGE_INVALID", "El archivo solicitado no es una imagen disponible.");
  }

  await assertFileWithinRoot(drive, normalizedFileId, response.data.parents);
  return response.data;
}

async function getDriveImageBuffer(fileOrMetadata) {
  const metadata = typeof fileOrMetadata === "string"
    ? await getDriveImageMetadata(fileOrMetadata)
    : fileOrMetadata;
  const drive = createDriveClient();
  const response = await drive.files.get(
    {
      fileId: metadata.id,
      alt: "media"
    },
    {
      responseType: "arraybuffer"
    }
  );

  return {
    metadata,
    buffer: Buffer.from(response.data),
    mimeType: metadata.mimeType
  };
}

async function getDriveThumbnailBuffer(fileOrMetadata) {
  const metadata = typeof fileOrMetadata === "string"
    ? await getDriveImageMetadata(fileOrMetadata)
    : fileOrMetadata;

  if (!metadata.thumbnailLink) return null;

  const oauthClient = createOAuthClient();
  const response = await oauthClient.request({
    url: metadata.thumbnailLink,
    method: "GET",
    responseType: "arraybuffer"
  });

  return {
    metadata,
    buffer: Buffer.from(response.data),
    mimeType: response.headers?.["content-type"] || "image/jpeg"
  };
}

async function getDriveImageContent(fileId) {
  const metadata = await getDriveImageMetadata(fileId);
  const drive = createDriveClient();
  const response = await drive.files.get(
    {
      fileId: metadata.id,
      alt: "media"
    },
    {
      responseType: "stream"
    }
  );

  return {
    metadata,
    stream: response.data
  };
}

module.exports = {
  FOLDER_MIME_TYPE,
  IMAGE_PAGE_SIZE,
  createDriveClient,
  getDriveImageBuffer,
  getDriveImageContent,
  getDriveImageMetadata,
  getDriveThumbnailBuffer,
  listDriveFolder,
  assertFileWithinRoot
};
