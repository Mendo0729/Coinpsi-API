BEGIN;

ALTER TABLE coinpsi.knowledge_posts
  ADD COLUMN IF NOT EXISTS show_on_landing BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE coinpsi.knowledge_posts
  ADD COLUMN IF NOT EXISTS display_order SMALLINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'knowledge_posts_display_order_check'
      AND conrelid = 'coinpsi.knowledge_posts'::regclass
  ) THEN
    ALTER TABLE coinpsi.knowledge_posts
      ADD CONSTRAINT knowledge_posts_display_order_check
      CHECK (display_order IS NULL OR display_order BETWEEN 1 AND 10);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'knowledge_posts_landing_status_check'
      AND conrelid = 'coinpsi.knowledge_posts'::regclass
  ) THEN
    ALTER TABLE coinpsi.knowledge_posts
      ADD CONSTRAINT knowledge_posts_landing_status_check
      CHECK (show_on_landing = FALSE OR status = 'published');
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS knowledge_posts_display_order_unique_idx
ON coinpsi.knowledge_posts (display_order)
WHERE show_on_landing = TRUE;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      ORDER BY is_featured DESC, published_at DESC NULLS LAST, id DESC
    ) AS position
  FROM coinpsi.knowledge_posts
  WHERE status = 'published'
)
UPDATE coinpsi.knowledge_posts kp
SET
  show_on_landing = TRUE,
  display_order = ranked.position
FROM ranked
WHERE kp.id = ranked.id
  AND ranked.position <= 10
  AND kp.show_on_landing = FALSE;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE coinpsi.knowledge_posts
TO coinpsi_app;

COMMIT;
