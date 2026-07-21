BEGIN;

ALTER TABLE coinpsi.admin_users
  ADD COLUMN IF NOT EXISTS username VARCHAR(50);

WITH first_admin AS (
  SELECT MIN(id) AS id
  FROM coinpsi.admin_users
  WHERE username IS NULL
)
UPDATE coinpsi.admin_users
SET username = 'admin'
WHERE id = (SELECT id FROM first_admin)
  AND username IS NULL;

UPDATE coinpsi.admin_users
SET username = 'admin_' || id
WHERE username IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS admin_users_username_lower_key
  ON coinpsi.admin_users (LOWER(username));

ALTER TABLE coinpsi.admin_users
  ALTER COLUMN username SET NOT NULL;

COMMIT;
