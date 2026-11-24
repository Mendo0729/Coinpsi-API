const {
  deleteKnowledgePostById,
  insertKnowledgePost,
  knowledgeCategoryExists,
  listAdminKnowledgePosts,
  listKnowledgeCategories,
  listPublishedKnowledgePosts,
  replaceKnowledgeLandingSelection,
  updateKnowledgePostById
} = require("../repositories/knowledge.repository");

const CREATE_STATUSES = new Set(["draft", "published"]);
const UPDATE_STATUSES = new Set(["draft", "published", "archived"]);
const MAX_LANDING_POSTS = 10;

function createValidationError(message, details = {}) {
  const error = new Error(message);
  error.code = "VALIDATION_ERROR";
  error.details = details;
  return error;
}

function createNotFoundError() {
  const error = new Error("La publicación solicitada no existe.");
  error.code = "KNOWLEDGE_POST_NOT_FOUND";
  return error;
}

function normalizeId(value, fieldName = "id") {
  const id = String(value ?? "").trim();

  if (!/^[1-9]\d*$/.test(id)) {
    throw createValidationError(`El campo ${fieldName} no es válido.`, {
      field: fieldName
    });
  }

  return id;
}

function normalizeRequiredText(value, fieldName, maxLength) {
  const normalized = String(value ?? "").trim();

  if (!normalized) {
    throw createValidationError(`${fieldName} es obligatorio.`, {
      field: fieldName
    });
  }

  if (normalized.length > maxLength) {
    throw createValidationError(`${fieldName} no puede superar ${maxLength} caracteres.`, {
      field: fieldName,
      maxLength
    });
  }

  return normalized;
}

function normalizeOptionalText(value, fieldName, maxLength) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;

  if (normalized.length > maxLength) {
    throw createValidationError(`${fieldName} no puede superar ${maxLength} caracteres.`, {
      field: fieldName,
      maxLength
    });
  }

  return normalized;
}

function normalizeStatus(value, { allowArchived = false } = {}) {
  const status = String(value || "draft").trim().toLowerCase();
  const validStatuses = allowArchived ? UPDATE_STATUSES : CREATE_STATUSES;

  if (!validStatuses.has(status)) {
    throw createValidationError(
      allowArchived
        ? "status debe ser draft, published o archived."
        : "status debe ser draft o published.",
      { field: "status" }
    );
  }

  return status;
}

function createPostSlug(title) {
  const baseSlug = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "capsula";

  const uniqueSuffix = `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;

  return `${baseSlug}-${uniqueSuffix}`;
}

function normalizeDocument(payload) {
  const raw = normalizeRequiredText(payload.driveUrl, "driveUrl", 1000);
  let url;
  try { url = new URL(raw); } catch { throw createValidationError("Enlace de Drive inválido.", {field:"driveUrl"}); }
  const match = /^\/file\/d\/([A-Za-z0-9_-]{10,255})(?:\/view|\/preview)?\/?$/.exec(url.pathname);
  if (url.protocol !== "https:" || url.host !== "drive.google.com" || url.username || url.password || !match) {
    throw createValidationError("Se requiere un enlace de archivo de Google Drive.", {field:"driveUrl"});
  }
  const documentType = String(payload.documentType || "research");
  if (!["research","article","guide","report","journal"].includes(documentType)) throw createValidationError("Tipo de documento inválido.", {field:"documentType"});
  const keywords = payload.keywords ?? [];
  if (!Array.isArray(keywords) || keywords.length > 20 || keywords.some(k => typeof k !== "string" || !k.trim() || k.length > 80)) throw createValidationError("Palabras clave inválidas.", {field:"keywords"});
  const publicationDate = payload.publicationDate || null;
  if (publicationDate !== null && (typeof publicationDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(publicationDate) || !Number.isFinite(Date.parse(publicationDate)) || new Date(publicationDate).toISOString().slice(0,10) !== publicationDate)) throw createValidationError("Fecha inválida.", {field:"publicationDate"});
  const canonical = new URL("https://drive.google.com/file/d/" + match[1] + "/view");
  const key = url.searchParams.get("resourcekey");
  if (key && /^[A-Za-z0-9_-]{1,255}$/.test(key)) canonical.searchParams.set("resourcekey", key);
  return {driveUrl:canonical.href, driveFileId:match[1], documentType, keywords:keywords.map(k=>k.trim()), publicationDate};
}

async function normalizePostPayload(payload = {}, { allowArchived = false } = {}) {
  const categoryId = normalizeId(payload.categoryId, "categoryId");

  if (!(await knowledgeCategoryExists(categoryId))) {
    throw createValidationError("La categoría seleccionada no existe o está inactiva.", {
      field: "categoryId"
    });
  }

  return {
    title: normalizeRequiredText(payload.title, "title", 180),
    summary: normalizeRequiredText(payload.summary, "summary", 350),
    ...normalizeDocument(payload),
    coverImageUrl: normalizeOptionalText(payload.coverImageUrl, "coverImageUrl", 500),
    authorName: normalizeRequiredText(payload.authorName, "authorName", 150),
    categoryId,
    status: normalizeStatus(payload.status, { allowArchived })
  };
}

function normalizeLandingSelection(input) {
  if (!Array.isArray(input)) {
    throw createValidationError("postIds debe ser una lista.", {
      field: "postIds"
    });
  }

  if (input.length > MAX_LANDING_POSTS) {
    throw createValidationError(
      `Espacio del Saber permite un máximo de ${MAX_LANDING_POSTS} publicaciones visibles.`,
      { field: "postIds", maxItems: MAX_LANDING_POSTS }
    );
  }

  const uniqueIds = [];
  const seen = new Set();

  input.forEach((value, index) => {
    const id = normalizeId(value, `postIds[${index}]`);
    if (seen.has(id)) return;
    seen.add(id);
    uniqueIds.push(id);
  });

  return uniqueIds;
}

async function getKnowledgeCategories() {
  return listKnowledgeCategories({ activeOnly: true });
}

async function getAdminKnowledgePosts() {
  return listAdminKnowledgePosts();
}

async function getPublishedKnowledgePosts() {
  return listPublishedKnowledgePosts();
}

async function createAdminKnowledgePost(payload, adminId) {
  const post = await normalizePostPayload(payload);

  return insertKnowledgePost({
    ...post,
    slug: createPostSlug(post.title),
    createdBy: normalizeId(adminId, "adminId")
  });
}

async function updateAdminKnowledgePost(id, payload, adminId) {
  const post = await updateKnowledgePostById(
    normalizeId(id),
    {
      ...(await normalizePostPayload(payload, { allowArchived: true })),
      updatedBy: normalizeId(adminId, "adminId")
    }
  );

  if (!post) throw createNotFoundError();
  return post;
}

async function updateKnowledgeLandingSelection(postIds, adminId) {
  return replaceKnowledgeLandingSelection(
    normalizeLandingSelection(postIds),
    normalizeId(adminId, "adminId")
  );
}

async function removeAdminKnowledgePost(id) {
  const deletedId = await deleteKnowledgePostById(normalizeId(id));

  if (!deletedId) throw createNotFoundError();
  return deletedId;
}

module.exports = {
  createAdminKnowledgePost,
  getAdminKnowledgePosts,
  getKnowledgeCategories,
  getPublishedKnowledgePosts,
  removeAdminKnowledgePost,
  updateAdminKnowledgePost,
  updateKnowledgeLandingSelection
};
