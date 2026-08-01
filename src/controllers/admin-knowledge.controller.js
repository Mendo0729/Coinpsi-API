const {
  createAdminKnowledgePost,
  getAdminKnowledgePosts,
  getKnowledgeCategories,
  removeAdminKnowledgePost,
  updateAdminKnowledgePost,
  updateKnowledgeLandingSelection
} = require("../services/knowledge.service");

function sendKnownError(res, error) {
  if (error.code === "VALIDATION_ERROR") {
    res.status(400).json({
      error: "VALIDATION_ERROR",
      message: error.message,
      details: error.details
    });
    return true;
  }

  if (error.code === "KNOWLEDGE_POST_NOT_FOUND") {
    res.status(404).json({
      error: "KNOWLEDGE_POST_NOT_FOUND",
      message: error.message
    });
    return true;
  }

  return false;
}

async function listCategories(req, res) {
  try {
    const categories = await getKnowledgeCategories();

    return res.status(200).json({
      status: "ok",
      count: categories.length,
      categories
    });
  } catch (error) {
    console.error("No fue posible consultar las categorías:", error.message);

    return res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "No fue posible consultar las categorías."
    });
  }
}

async function listPosts(req, res) {
  try {
    const posts = await getAdminKnowledgePosts();

    return res.status(200).json({
      status: "ok",
      count: posts.length,
      posts
    });
  } catch (error) {
    console.error("No fue posible consultar las publicaciones:", error.message);

    return res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "No fue posible consultar las publicaciones."
    });
  }
}

async function saveLandingSelection(req, res) {
  try {
    const posts = await updateKnowledgeLandingSelection(
      req.body?.postIds,
      req.auth.userId
    );

    return res.status(200).json({
      status: "ok",
      selectedCount: posts.filter((post) => post.showOnLanding).length,
      posts
    });
  } catch (error) {
    if (sendKnownError(res, error)) return;

    console.error("No fue posible guardar la selección de Espacio del Saber:", error.message);

    return res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "No fue posible guardar la selección para la landing."
    });
  }
}

async function createPost(req, res) {
  try {
    const post = await createAdminKnowledgePost(req.body, req.auth.userId);

    return res.status(201).json({
      status: "ok",
      post
    });
  } catch (error) {
    if (sendKnownError(res, error)) return;

    console.error("No fue posible crear la publicación:", error.message);

    return res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "No fue posible crear la publicación."
    });
  }
}

async function updatePost(req, res) {
  try {
    const post = await updateAdminKnowledgePost(
      req.params.id,
      req.body,
      req.auth.userId
    );

    return res.status(200).json({
      status: "ok",
      post
    });
  } catch (error) {
    if (sendKnownError(res, error)) return;

    console.error("No fue posible actualizar la publicación:", error.message);

    return res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "No fue posible actualizar la publicación."
    });
  }
}

async function deletePost(req, res) {
  try {
    const deletedId = await removeAdminKnowledgePost(req.params.id);

    return res.status(200).json({
      status: "ok",
      deletedId
    });
  } catch (error) {
    if (sendKnownError(res, error)) return;

    console.error("No fue posible eliminar la publicación:", error.message);

    return res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "No fue posible eliminar la publicación."
    });
  }
}

module.exports = {
  createPost,
  deletePost,
  listCategories,
  listPosts,
  saveLandingSelection,
  updatePost
};
