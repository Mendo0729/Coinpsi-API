const pool = require("../config/database");

const ADMIN_POST_FIELDS = `
  kp.id,
  kp.title,
  kp.slug,
  kp.summary,
  kp.content,
  kp.cover_image_url,
  kp.author_name,
  kp.category_id,
  kp.status,
  kp.is_featured,
  kp.show_on_landing,
  kp.display_order,
  kp.created_by,
  kp.updated_by,
  kp.published_at,
  kp.created_at,
  kp.updated_at,
  kc.name AS category_name,
  kc.slug AS category_slug,
  creator.full_name AS created_by_name,
  updater.full_name AS updated_by_name
`;

const PUBLIC_POST_FIELDS = `
  kp.id,
  kp.title,
  kp.slug,
  kp.summary,
  kp.content,
  kp.cover_image_url,
  kp.author_name,
  kp.published_at,
  kp.display_order,
  kc.id AS category_id,
  kc.name AS category_name,
  kc.slug AS category_slug
`;

function mapCategory(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapAdminPost(row) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    content: row.content,
    coverImageUrl: row.cover_image_url,
    authorName: row.author_name,
    categoryId: row.category_id,
    categoryName: row.category_name,
    categorySlug: row.category_slug,
    status: row.status,
    isFeatured: row.is_featured,
    showOnLanding: row.show_on_landing,
    displayOrder: row.display_order,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    updatedBy: row.updated_by,
    updatedByName: row.updated_by_name,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapPublicPost(row) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    content: row.content,
    coverImageUrl: row.cover_image_url,
    authorName: row.author_name,
    publishedAt: row.published_at,
    displayOrder: row.display_order,
    category: {
      id: row.category_id,
      name: row.category_name,
      slug: row.category_slug
    }
  };
}

async function listKnowledgeCategories({ activeOnly = false } = {}) {
  const result = await pool.query(`
    SELECT
      id,
      name,
      slug,
      description,
      is_active,
      created_at,
      updated_at
    FROM coinpsi.knowledge_categories
    ${activeOnly ? "WHERE is_active = TRUE" : ""}
    ORDER BY name ASC, id ASC
  `);

  return result.rows.map(mapCategory);
}

async function knowledgeCategoryExists(id) {
  const result = await pool.query(
    `
      SELECT 1
      FROM coinpsi.knowledge_categories
      WHERE id = $1
        AND is_active = TRUE
      LIMIT 1
    `,
    [id]
  );

  return result.rowCount > 0;
}

async function listAdminKnowledgePosts() {
  const result = await pool.query(`
    SELECT ${ADMIN_POST_FIELDS}
    FROM coinpsi.knowledge_posts kp
    JOIN coinpsi.knowledge_categories kc
      ON kc.id = kp.category_id
    JOIN coinpsi.admin_users creator
      ON creator.id = kp.created_by
    LEFT JOIN coinpsi.admin_users updater
      ON updater.id = kp.updated_by
    ORDER BY
      kp.show_on_landing DESC,
      kp.display_order ASC NULLS LAST,
      kp.created_at DESC,
      kp.id DESC
  `);

  return result.rows.map(mapAdminPost);
}

async function listPublishedKnowledgePosts() {
  const result = await pool.query(`
    SELECT ${PUBLIC_POST_FIELDS}
    FROM coinpsi.knowledge_posts kp
    JOIN coinpsi.knowledge_categories kc
      ON kc.id = kp.category_id
    WHERE kp.status = 'published'
      AND kp.show_on_landing = TRUE
      AND kc.is_active = TRUE
    ORDER BY kp.display_order ASC NULLS LAST, kp.published_at DESC, kp.id DESC
    LIMIT 10
  `);

  return result.rows.map(mapPublicPost);
}

async function insertKnowledgePost(post) {
  const result = await pool.query(
    `
      WITH inserted AS (
        INSERT INTO coinpsi.knowledge_posts (
          title,
          slug,
          summary,
          content,
          cover_image_url,
          author_name,
          category_id,
          status,
          is_featured,
          show_on_landing,
          display_order,
          created_by,
          published_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8::VARCHAR(20),
          FALSE,
          FALSE,
          NULL,
          $9,
          CASE
            WHEN $8::VARCHAR(20) = 'published'::VARCHAR(20) THEN NOW()
            ELSE NULL
          END
        )
        RETURNING *
      )
      SELECT ${ADMIN_POST_FIELDS}
      FROM inserted kp
      JOIN coinpsi.knowledge_categories kc
        ON kc.id = kp.category_id
      JOIN coinpsi.admin_users creator
        ON creator.id = kp.created_by
      LEFT JOIN coinpsi.admin_users updater
        ON updater.id = kp.updated_by
    `,
    [
      post.title,
      post.slug,
      post.summary,
      post.content,
      post.coverImageUrl,
      post.authorName,
      post.categoryId,
      post.status,
      post.createdBy
    ]
  );

  return mapAdminPost(result.rows[0]);
}

async function updateKnowledgePostById(id, post) {
  const result = await pool.query(
    `
      WITH updated AS (
        UPDATE coinpsi.knowledge_posts
        SET
          title = $2,
          summary = $3,
          content = $4,
          cover_image_url = $5,
          author_name = $6,
          category_id = $7,
          status = $8::VARCHAR(20),
          is_featured = FALSE,
          show_on_landing = CASE
            WHEN $8::VARCHAR(20) = 'published'::VARCHAR(20) THEN show_on_landing
            ELSE FALSE
          END,
          display_order = CASE
            WHEN $8::VARCHAR(20) = 'published'::VARCHAR(20) THEN display_order
            ELSE NULL
          END,
          updated_by = $9,
          published_at = CASE
            WHEN $8::VARCHAR(20) = 'published'::VARCHAR(20) AND published_at IS NULL THEN NOW()
            WHEN $8::VARCHAR(20) = 'published'::VARCHAR(20) THEN published_at
            WHEN $8::VARCHAR(20) = 'draft'::VARCHAR(20) THEN NULL
            ELSE published_at
          END,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      )
      SELECT ${ADMIN_POST_FIELDS}
      FROM updated kp
      JOIN coinpsi.knowledge_categories kc
        ON kc.id = kp.category_id
      JOIN coinpsi.admin_users creator
        ON creator.id = kp.created_by
      LEFT JOIN coinpsi.admin_users updater
        ON updater.id = kp.updated_by
    `,
    [
      id,
      post.title,
      post.summary,
      post.content,
      post.coverImageUrl,
      post.authorName,
      post.categoryId,
      post.status,
      post.updatedBy
    ]
  );

  return result.rows[0] ? mapAdminPost(result.rows[0]) : null;
}

async function replaceKnowledgeLandingSelection(postIds, adminId) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    if (postIds.length) {
      const locked = await client.query(
        `
          SELECT id, status
          FROM coinpsi.knowledge_posts
          WHERE id = ANY($1::BIGINT[])
          FOR UPDATE
        `,
        [postIds]
      );

      if (locked.rowCount !== postIds.length) {
        const error = new Error("Una de las publicaciones seleccionadas no existe.");
        error.code = "VALIDATION_ERROR";
        error.details = { field: "postIds" };
        throw error;
      }

      const unpublished = locked.rows.find((row) => row.status !== "published");
      if (unpublished) {
        const error = new Error("Solo las publicaciones con estado Publicado pueden mostrarse en la landing.");
        error.code = "VALIDATION_ERROR";
        error.details = { field: "postIds", postId: unpublished.id };
        throw error;
      }
    }

    await client.query(
      `
        UPDATE coinpsi.knowledge_posts
        SET
          show_on_landing = FALSE,
          display_order = NULL,
          updated_by = $1,
          updated_at = NOW()
        WHERE show_on_landing = TRUE
      `,
      [adminId]
    );

    for (let index = 0; index < postIds.length; index += 1) {
      await client.query(
        `
          UPDATE coinpsi.knowledge_posts
          SET
            show_on_landing = TRUE,
            display_order = $2,
            updated_by = $3,
            updated_at = NOW()
          WHERE id = $1
        `,
        [postIds[index], index + 1, adminId]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return listAdminKnowledgePosts();
}

async function deleteKnowledgePostById(id) {
  const result = await pool.query(
    `
      DELETE FROM coinpsi.knowledge_posts
      WHERE id = $1
      RETURNING id
    `,
    [id]
  );

  return result.rows[0]?.id ?? null;
}

module.exports = {
  deleteKnowledgePostById,
  insertKnowledgePost,
  knowledgeCategoryExists,
  listAdminKnowledgePosts,
  listKnowledgeCategories,
  listPublishedKnowledgePosts,
  replaceKnowledgeLandingSelection,
  updateKnowledgePostById
};
