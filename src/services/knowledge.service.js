const {
  deleteKnowledgePostById,
  insertKnowledgePost,
  knowledgeCategoryExists,
  listAdminKnowledgePosts,
  listKnowledgeCategories,
  listPublishedKnowledgePosts,
  updateKnowledgePostById
} = require("../repositories/knowledge.repository");

const CREATE_STATUSES = new Set(["draft", "published"]);
const UPDATE_STATUSES = new Set(["draft", "published", "archived"]);

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
    content: normalizeRequiredText(payload.content, "content", 50000),
    coverImageUrl: normalizeOptionalText(payload.coverImageUrl, "coverImageUrl", 500),
    authorName: normalizeRequiredText(payload.authorName, "authorName", 150),
    categoryId,
    status: normalizeStatus(payload.status, { allowArchived }),
    isFeatured: payload.isFeatured === true
  };
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
  updateAdminKnowledgePost
};
