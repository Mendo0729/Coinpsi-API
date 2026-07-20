const pool = require("../config/database");

async function findAdminByEmail(email) {
  const result = await pool.query(
    `
      SELECT
        id,
        full_name,
        email,
        password_hash,
        role,
        is_active
      FROM coinpsi.admin_users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
    `,
    [email]
  );

  return result.rows[0] ?? null;
}

async function findAdminById(id) {
  const result = await pool.query(
    `
      SELECT
        id,
        full_name,
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
  findAdminByEmail,
  findAdminById
};
