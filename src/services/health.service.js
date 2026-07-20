const pool = require("../config/database");

async function getDatabaseHealth() {
  const startedAt = Date.now();
  const result = await pool.query(`
    SELECT
      current_database() AS name,
      current_user AS "user",
      current_schema() AS schema,
      NOW() AS checked_at
  `);

  const database = result.rows[0];

  return {
    status: "connected",
    name: database.name,
    user: database.user,
    schema: database.schema,
    checkedAt: database.checked_at,
    responseTimeMs: Date.now() - startedAt
  };
}

module.exports = { getDatabaseHealth };
