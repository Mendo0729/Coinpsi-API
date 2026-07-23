const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const { google } = require("googleapis");

const { getEnv } = require("../config/env");

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const DEV_FOLDER_NAME = "COINPSI-DEV";
const STATE_TTL_MS = 10 * 60 * 1000;
const pendingStates = new Map();

function getTokenPath() {
  return path.resolve(
    process.cwd(),
    process.env.GOOGLE_DRIVE_TOKEN_PATH || ".google-drive-token.json"
  );
}

function assertOAuthConfiguration() {
  const required = [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_REDIRECT_URI",
    "GOOGLE_DRIVE_ROOT_FOLDER_ID"
  ];

  const missing = required.filter((name) => !String(process.env[name] || "").trim());
  if (missing.length) {
    const error = new Error(`Faltan variables de Google Drive: ${missing.join(", ")}`);
    error.code = "GOOGLE_DRIVE_NOT_CONFIGURED";
    throw error;
  }
}

function createOAuthClient() {
  assertOAuthConfiguration();

  return new google.auth.OAuth2(
    getEnv("GOOGLE_CLIENT_ID"),
    getEnv("GOOGLE_CLIENT_SECRET"),
    getEnv("GOOGLE_REDIRECT_URI")
  );
}

function readLocalTokens() {
  const tokenPath = getTokenPath();
  if (!fs.existsSync(tokenPath)) return {};

  try {
    return JSON.parse(fs.readFileSync(tokenPath, "utf8"));
  } catch {
    const error = new Error("El archivo local de tokens de Google Drive no es valido.");
    error.code = "GOOGLE_DRIVE_TOKEN_INVALID";
    throw error;
  }
}

function readStoredTokens() {
  const localTokens = readLocalTokens();
  const refreshToken = String(process.env.GOOGLE_REFRESH_TOKEN || "").trim();

  return {
    ...localTokens,
    ...(refreshToken ? { refresh_token: refreshToken } : {})
  };
}

function saveTokens(tokens) {
  const current = readStoredTokens();
  const merged = {
    ...current,
    ...tokens,
    refresh_token: tokens.refresh_token || current.refresh_token
  };

  if (!merged.refresh_token) {
    const error = new Error(
      "Google no devolvio un refresh token. Revoca el acceso anterior y conecta nuevamente."
    );
    error.code = "GOOGLE_DRIVE_REFRESH_TOKEN_MISSING";
    throw error;
  }

  if (process.env.NODE_ENV !== "production") {
    fs.writeFileSync(getTokenPath(), JSON.stringify(merged, null, 2), {
      encoding: "utf8",
      mode: 0o600
    });
  }

  return merged;
}

function cleanupExpiredStates() {
  const now = Date.now();
  for (const [state, entry] of pendingStates.entries()) {
    if (entry.expiresAt <= now) pendingStates.delete(state);
  }
}

function createAuthorizationUrl(userId) {
  const oauthClient = createOAuthClient();
  const state = crypto.randomBytes(32).toString("hex");

  cleanupExpiredStates();
  pendingStates.set(state, {
    userId: String(userId),
    expiresAt: Date.now() + STATE_TTL_MS
  });

  return oauthClient.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    scope: [DRIVE_SCOPE],
    state
  });
}

function consumeAuthorizationState(state) {
  cleanupExpiredStates();
  const entry = pendingStates.get(String(state || ""));

  if (!entry) {
    const error = new Error("El estado OAuth es invalido o expiro.");
    error.code = "GOOGLE_DRIVE_OAUTH_STATE_INVALID";
    throw error;
  }

  pendingStates.delete(String(state));
  return entry;
}

async function exchangeAuthorizationCode(code, state) {
  consumeAuthorizationState(state);
  const oauthClient = createOAuthClient();
  const { tokens } = await oauthClient.getToken(String(code || ""));
  return saveTokens(tokens);
}

async function createDriveClient() {
  const tokens = readStoredTokens();
  if (!tokens.refresh_token && !tokens.access_token) {
    const error = new Error("Google Drive aun no esta conectado.");
    error.code = "GOOGLE_DRIVE_NOT_CONNECTED";
    throw error;
  }

  const oauthClient = createOAuthClient();
  oauthClient.setCredentials(tokens);
  oauthClient.on("tokens", (newTokens) => {
    try {
      saveTokens(newTokens);
    } catch (error) {
      console.error("No fue posible actualizar los tokens de Google Drive:", error.message);
    }
  });

  return google.drive({ version: "v3", auth: oauthClient });
}

function escapeDriveQuery(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function listFolderItems(drive, folderId) {
  const items = [];
  let pageToken;

  do {
    const response = await drive.files.list({
      q: `'${escapeDriveQuery(folderId)}' in parents and trashed = false`,
      spaces: "drive",
      orderBy: "folder,name_natural",
      pageSize: 100,
      pageToken,
      fields:
        "nextPageToken,files(id,name,mimeType,size,createdTime,modifiedTime,thumbnailLink,webViewLink)"
    });

    items.push(...(response.data.files || []));
    pageToken = response.data.nextPageToken;
  } while (pageToken && items.length < 500);

  return items.slice(0, 500);
}

async function getConnectionStatus() {
  try {
    assertOAuthConfiguration();
  } catch (error) {
    return {
      configured: false,
      connected: false,
      code: error.code,
      message: error.message
    };
  }

  const tokens = readStoredTokens();
  if (!tokens.refresh_token && !tokens.access_token) {
    return {
      configured: true,
      connected: false,
      rootFolderId: getEnv("GOOGLE_DRIVE_ROOT_FOLDER_ID")
    };
  }

  try {
    const drive = await createDriveClient();
    const rootFolderId = getEnv("GOOGLE_DRIVE_ROOT_FOLDER_ID");
    const [folderResponse, aboutResponse, items] = await Promise.all([
      drive.files.get({
        fileId: rootFolderId,
        fields: "id,name,mimeType,webViewLink,capabilities(canAddChildren)"
      }),
      drive.about.get({
        fields: "user(displayName,emailAddress),storageQuota(limit,usage)"
      }),
      listFolderItems(drive, rootFolderId)
    ]);

    return {
      configured: true,
      connected: true,
      account: aboutResponse.data.user || null,
      storageQuota: aboutResponse.data.storageQuota || null,
      rootFolder: folderResponse.data,
      items
    };
  } catch (error) {
    return {
      configured: true,
      connected: false,
      rootFolderId: getEnv("GOOGLE_DRIVE_ROOT_FOLDER_ID"),
      code: error.code || "GOOGLE_DRIVE_CONNECTION_ERROR",
      message: error.message
    };
  }
}

async function findOrCreateDevFolder(drive) {
  const rootFolderId = getEnv("GOOGLE_DRIVE_ROOT_FOLDER_ID");
  const response = await drive.files.list({
    q: [
      `'${escapeDriveQuery(rootFolderId)}' in parents`,
      `name = '${escapeDriveQuery(DEV_FOLDER_NAME)}'`,
      `mimeType = '${FOLDER_MIME_TYPE}'`,
      "trashed = false"
    ].join(" and "),
    spaces: "drive",
    pageSize: 1,
    fields: "files(id,name,webViewLink)"
  });

  const existing = response.data.files?.[0];
  if (existing) return { ...existing, created: false };

  const created = await drive.files.create({
    requestBody: {
      name: DEV_FOLDER_NAME,
      mimeType: FOLDER_MIME_TYPE,
      parents: [rootFolderId]
    },
    fields: "id,name,webViewLink"
  });

  return { ...created.data, created: true };
}

async function runDriveTest() {
  const drive = await createDriveClient();
  const devFolder = await findOrCreateDevFolder(drive);
  const fileName = `coinpsi-drive-test-${Date.now()}.png`;
  const imageBuffer = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64"
  );

  let uploadedFile;
  let result;
  let cleanupStatus = "not-required";

  try {
    const uploadResponse = await drive.files.create({
      requestBody: {
        name: fileName,
        mimeType: "image/png",
        parents: [devFolder.id],
        description: "Archivo temporal creado por la prueba de Coinpsi-API."
      },
      media: {
        mimeType: "image/png",
        body: Readable.from(imageBuffer)
      },
      fields: "id,name,mimeType,size,createdTime,parents,webViewLink"
    });

    uploadedFile = uploadResponse.data;

    const downloadResponse = await drive.files.get(
      {
        fileId: uploadedFile.id,
        alt: "media"
      },
      {
        responseType: "arraybuffer"
      }
    );

    const downloadedBytes = Buffer.from(downloadResponse.data).length;
    const metadataResponse = await drive.files.get({
      fileId: uploadedFile.id,
      fields: "id,name,mimeType,size,createdTime,parents,trashed,webViewLink"
    });

    result = {
      status: "ok",
      folder: devFolder,
      upload: metadataResponse.data,
      download: {
        bytes: downloadedBytes,
        matchesUpload: downloadedBytes === imageBuffer.length
      },
      cleanup: {
        status: "pending"
      }
    };
  } finally {
    if (uploadedFile?.id) {
      try {
        await drive.files.update({
          fileId: uploadedFile.id,
          requestBody: { trashed: true },
          fields: "id,trashed"
        });
        cleanupStatus = "trashed";
      } catch (error) {
        cleanupStatus = "failed";
        console.error("No fue posible enviar la imagen de prueba a la papelera:", error.message);
      }
    }

    if (result) result.cleanup.status = cleanupStatus;
  }

  return result;
}

module.exports = {
  createAuthorizationUrl,
  exchangeAuthorizationCode,
  getConnectionStatus,
  runDriveTest
};
