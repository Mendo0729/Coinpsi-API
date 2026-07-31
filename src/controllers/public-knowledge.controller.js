const { getPublishedKnowledgePosts } = require("../services/knowledge.service");

async function listPublishedPosts(req, res) {
  try {
    const posts = await getPublishedKnowledgePosts();

    return res.status(200).json({
      status: "ok",
      count: posts.length,
      posts
    });
  } catch (error) {
    console.error("No fue posible consultar Espacio del Saber:", error.message);

    return res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "No fue posible consultar Espacio del Saber."
    });
  }
}

module.exports = {
  listPublishedPosts
};
