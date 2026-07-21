const pool = require("../config/database");

async function findAdminByUsername(username) {
  const result = await pool.query(
    `
      SELECT
        id,
        full_name,
        username,
        email,
        password_hash,
        role,
        is_active
      FROM coinpsi.admin_users
      WHERE LOWER(username) = LOWER($1)
      LIMIT 1
    `,
    [username]
  );

  return result.rows[0] ?? null;
}

async function findAdminById(id) {
  const result = await pool.query(
    `
      SELECT
        id,
        full_name,
        username,
        email,
        role,
        is_active
      FROM coinpsi.admin_users
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] ?? null;
}

module.exports = {
  findAdminById,
  findAdminByUsername
};
