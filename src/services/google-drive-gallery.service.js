const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

const { getEnv } = require("../config/env");

const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const FILE_ID_PATTERN = /^[A-Za-z0-9_-]{10,200}$/;

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

function createDriveClient() {
  const oauthClient = new google.auth.OAuth2(
    getEnv("GOOGLE_CLIENT_ID"),
    getEnv("GOOGLE_CLIENT_SECRET"),
    getEnv("GOOGLE_REDIRECT_URI")
  );
  oauthClient.setCredentials(readCredentials());
  return google.drive({ version: "v3", auth: oauthClient });
}

function escapeQuery(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function listDriveFolder(folderId = null) {
  const normalizedFolderId = normalizeFileId(
    folderId,
    getEnv("GOOGLE_DRIVE_ROOT_FOLDER_ID")
  );
  const drive = createDriveClient();

  const folderResponse = await drive.files.get({
    fileId: normalizedFolderId,
    fields: "id,name,mimeType,parents,webViewLink,modifiedTime"
  });

  if (folderResponse.data.mimeType !== FOLDER_MIME_TYPE) {
    throw createDriveError("GOOGLE_DRIVE_NOT_FOLDER", "El elemento solicitado no es una carpeta.");
  }

  const items = [];
  let pageToken;

  do {
    const response = await drive.files.list({
      q: `'${escapeQuery(normalizedFolderId)}' in parents and trashed = false`,
      spaces: "drive",
      orderBy: "folder,name_natural",
      pageSize: 100,
      pageToken,
      fields:
        "nextPageToken,files(id,name,mimeType,size,createdTime,modifiedTime,parents,webViewLink,imageMediaMetadata(width,height))"
    });

    items.push(...(response.data.files || []));
    pageToken = response.data.nextPageToken;
  } while (pageToken && items.length < 500);

  return {
    folder: folderResponse.data,
    items: items.slice(0, 500).map((item) => ({
      ...item,
      isFolder: item.mimeType === FOLDER_MIME_TYPE,
      isImage: String(item.mimeType || "").startsWith("image/")
    }))
  };
}

async function getDriveImageMetadata(fileId) {
  const normalizedFileId = normalizeFileId(fileId);
  const drive = createDriveClient();
  const response = await drive.files.get({
    fileId: normalizedFileId,
    fields: "id,name,mimeType,size,createdTime,modifiedTime,parents,trashed,imageMediaMetadata(width,height)"
  });

  if (response.data.trashed || !String(response.data.mimeType || "").startsWith("image/")) {
    throw createDriveError("GOOGLE_DRIVE_IMAGE_INVALID", "El archivo solicitado no es una imagen disponible.");
  }

  return response.data;
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
  getDriveImageContent,
  getDriveImageMetadata,
  listDriveFolder
};
